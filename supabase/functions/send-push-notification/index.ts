import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  data?: Record<string, unknown>;
}

interface SendPushRequest {
  user_ids?: string[];
  filter?: "all" | "trial" | "trial_expiring" | "expired" | "paid" | "admin";
  notification: PushPayload;
}

function safeMessageFromError(err: unknown): string {
  if (!err) return "unknown";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return "unknown";
  }
}

// Converte Base64 (padrão OU URL-safe) para Uint8Array
function base64ToUint8Array(base64String: string): Uint8Array {
  // Normaliza: converte Base64 URL para Base64 padrão
  let base64 = base64String
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  
  // Adiciona padding se necessário
  const padding = (4 - (base64.length % 4)) % 4;
  base64 += "=".repeat(padding);
  
  try {
    const binary = atob(base64);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch (e) {
    console.error("[SEND-PUSH] ❌ Erro decodificando Base64:", base64String.substring(0, 30), e);
    throw new Error(`InvalidBase64: ${safeMessageFromError(e)}`);
  }
}

function uint8ArrayToBase64Url(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// HKDF implementation usando Web Crypto API
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    ikm.buffer.slice(ikm.byteOffset, ikm.byteOffset + ikm.byteLength) as ArrayBuffer,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
      info: info.buffer.slice(info.byteOffset, info.byteOffset + info.byteLength) as ArrayBuffer,
    },
    keyMaterial,
    length * 8
  );
  
  return new Uint8Array(derivedBits);
}

// Criar info para HKDF
function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const typeBuffer = encoder.encode(type);
  
  const result = new Uint8Array(
    18 + typeBuffer.length + 1 + 5 + 1 + 2 + clientPublicKey.length + 2 + serverPublicKey.length
  );
  
  let offset = 0;
  
  const contentEncoding = encoder.encode("Content-Encoding: ");
  result.set(contentEncoding, offset);
  offset += contentEncoding.length;
  
  result.set(typeBuffer, offset);
  offset += typeBuffer.length;
  
  result[offset++] = 0;
  
  const p256 = encoder.encode("P-256");
  result.set(p256, offset);
  offset += p256.length;
  
  result[offset++] = 0;
  
  result[offset++] = 0;
  result[offset++] = clientPublicKey.length;
  
  result.set(clientPublicKey, offset);
  offset += clientPublicKey.length;
  
  result[offset++] = 0;
  result[offset++] = serverPublicKey.length;
  
  result.set(serverPublicKey, offset);
  
  return result;
}

// Encriptar payload para Web Push
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authKey: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  // Decodifica as chaves (aceita Base64 padrão ou URL-safe)
  const clientPublicKey = base64ToUint8Array(p256dhKey);
  const clientAuthSecret = base64ToUint8Array(authKey);
  
  // Validar tamanhos esperados
  if (clientPublicKey.length !== 65) {
    console.error(`[SEND-PUSH] ⚠️ p256dh tem ${clientPublicKey.length} bytes, esperado 65`);
  }
  if (clientAuthSecret.length !== 16) {
    console.error(`[SEND-PUSH] ⚠️ auth tem ${clientAuthSecret.length} bytes, esperado 16`);
  }
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  
  const serverPublicKeyRaw = await crypto.subtle.exportKey("raw", serverKeyPair.publicKey);
  const serverPublicKey = new Uint8Array(serverPublicKeyRaw);
  
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey.buffer.slice(clientPublicKey.byteOffset, clientPublicKey.byteOffset + clientPublicKey.byteLength) as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientKey },
    serverKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);
  
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const ikm = await hkdf(clientAuthSecret, sharedSecret, authInfo, 32);
  
  const contentInfo = createInfo("aesgcm", clientPublicKey, serverPublicKey);
  const contentKey = await hkdf(salt, ikm, contentInfo, 16);
  
  const nonceInfo = createInfo("nonce", clientPublicKey, serverPublicKey);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);
  
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);
  const paddingLength = 0;
  const paddedPayload = new Uint8Array(2 + paddingLength + payloadBytes.length);
  paddedPayload[0] = (paddingLength >> 8) & 0xff;
  paddedPayload[1] = paddingLength & 0xff;
  paddedPayload.set(payloadBytes, 2 + paddingLength);
  
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentKey.buffer.slice(contentKey.byteOffset, contentKey.byteOffset + contentKey.byteLength) as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce.buffer.slice(nonce.byteOffset, nonce.byteOffset + nonce.byteLength) as ArrayBuffer },
    aesKey,
    paddedPayload.buffer.slice(paddedPayload.byteOffset, paddedPayload.byteOffset + paddedPayload.byteLength) as ArrayBuffer
  );
  
  return {
    ciphertext: new Uint8Array(ciphertext),
    salt,
    serverPublicKey,
  };
}

// Criar JWT para VAPID
async function createVapidJwt(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: expiration,
    sub: "mailto:contato@mecapp.com.br",
  };
  
  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Decodificar chaves VAPID
  const privateKeyBytes = base64ToUint8Array(vapidPrivateKey);
  const publicKeyBytes = base64ToUint8Array(vapidPublicKey);
  
  // Extrair x, y da chave pública (formato uncompressed: 0x04 || x[32] || y[32])
  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);
  
  // Importar via JWK (mais confiável que PKCS8 no Deno)
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: uint8ArrayToBase64Url(x),
    y: uint8ArrayToBase64Url(y),
    d: uint8ArrayToBase64Url(privateKeyBytes),
  };
  
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  
  const dataToSign = new TextEncoder().encode(unsignedToken);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    dataToSign.buffer.slice(dataToSign.byteOffset, dataToSign.byteOffset + dataToSign.byteLength) as ArrayBuffer
  );
  
  const signatureRaw = derToRaw(new Uint8Array(signature));
  const signatureB64 = uint8ArrayToBase64Url(signatureRaw);
  
  return `${unsignedToken}.${signatureB64}`;
}

// Converter assinatura DER para raw
function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length === 64) {
    return der;
  }
  
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error("Invalid DER signature");
  
  const totalLength = der[offset++];
  if (totalLength & 0x80) throw new Error("Long form length not supported");
  
  if (der[offset++] !== 0x02) throw new Error("Invalid DER signature - r");
  let rLength = der[offset++];
  let rOffset = offset;
  offset += rLength;
  
  if (der[offset++] !== 0x02) throw new Error("Invalid DER signature - s");
  let sLength = der[offset++];
  let sOffset = offset;
  
  let r = der.slice(rOffset, rOffset + rLength);
  let s = der.slice(sOffset, sOffset + sLength);
  
  while (r.length > 32 && r[0] === 0) r = r.slice(1);
  while (s.length > 32 && s[0] === 0) s = s.slice(1);
  
  const result = new Uint8Array(64);
  result.set(r, 32 - r.length);
  result.set(s, 64 - s.length);
  
  return result;
}

// Enviar notificação push
async function sendPushNotification(
  endpoint: string,
  p256dhKey: string,
  authKey: string,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    console.log(`[SEND-PUSH] 🔐 Encriptando payload...`);
    const { ciphertext, salt, serverPublicKey } = await encryptPayload(payload, p256dhKey, authKey);
    
    console.log(`[SEND-PUSH] 🔑 Criando VAPID JWT...`);
    const jwt = await createVapidJwt(endpoint, vapidPublicKey, vapidPrivateKey);
    
    const headers: HeadersInit = {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Encryption": `salt=${uint8ArrayToBase64Url(salt)}`,
      "Crypto-Key": `dh=${uint8ArrayToBase64Url(serverPublicKey)};p256ecdsa=${vapidPublicKey}`,
      "Authorization": `WebPush ${jwt}`,
      "TTL": "86400",
    };
    
    console.log(`[SEND-PUSH] 🌐 Enviando para ${endpoint.substring(0, 50)}...`);
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength) as ArrayBuffer,
    });
    
    if (response.ok || response.status === 201) {
      return { success: true, statusCode: response.status };
    }
    
    const errorText = await response.text().catch(() => "");
    console.log(`[SEND-PUSH] ⚠️ Response ${response.status}: ${errorText.substring(0, 100)}`);
    return { success: false, statusCode: response.status, error: errorText };
  } catch (error) {
    console.error(`[SEND-PUSH] 💥 Exceção:`, error);
    return { success: false, error: safeMessageFromError(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[SEND-PUSH] 🔔 Iniciando envio de notificações push`);

  // Variáveis para registro no histórico (declaradas fora do try)
  let sent = 0;
  let failed = 0;
  let totalSubscriptions = 0;
  let filterUsed = "all";
  let notificationTitle = "";
  let notificationBody = "";

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("[SEND-PUSH] ❌ VAPID keys não configuradas");
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[SEND-PUSH] ✅ VAPID keys encontradas");
    console.log(`[SEND-PUSH] 🔑 VAPID Public: ${vapidPublicKey.substring(0, 20)}...`);

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser();
    if (claimsError || !claimsData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", claimsData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SendPushRequest = await req.json();
    filterUsed = body.filter || "all";
    notificationTitle = body.notification?.title || "";
    notificationBody = body.notification?.body || "";
    
    console.log("[SEND-PUSH] 📨 Filter:", filterUsed, "Title:", notificationTitle);

    if (!body.notification?.title || !body.notification?.body) {
      return new Response(
        JSON.stringify({ error: "notification.title and notification.body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar subscriptions
    let subscriptionsQuery = supabaseAdmin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh_key, auth_key")
      .eq("is_active", true);

    if (body.user_ids && body.user_ids.length > 0) {
      subscriptionsQuery = subscriptionsQuery.in("user_id", body.user_ids);
    } else if (body.filter && body.filter !== "all") {
      let userIdsQuery;
      
      if (body.filter === "trial") {
        userIdsQuery = supabaseAdmin
          .from("assinaturas")
          .select("user_id")
          .eq("plano_tipo", "trial")
          .eq("status", "trialing")
          .gt("data_fim", new Date().toISOString());
      } else if (body.filter === "trial_expiring") {
        const twoDaysFromNow = new Date();
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
        userIdsQuery = supabaseAdmin
          .from("assinaturas")
          .select("user_id")
          .eq("plano_tipo", "trial")
          .eq("status", "trialing")
          .lt("data_fim", twoDaysFromNow.toISOString())
          .gt("data_fim", new Date().toISOString());
      } else if (body.filter === "expired") {
        userIdsQuery = supabaseAdmin
          .from("assinaturas")
          .select("user_id")
          .eq("plano_tipo", "trial")
          .lt("data_fim", new Date().toISOString());
      } else if (body.filter === "paid") {
        userIdsQuery = supabaseAdmin
          .from("assinaturas")
          .select("user_id")
          .eq("status", "active")
          .not("plano_tipo", "in", "(trial,admin)");
      } else if (body.filter === "admin") {
        userIdsQuery = supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
      }

      if (userIdsQuery) {
        const { data: userIds } = await userIdsQuery;
        if (userIds && userIds.length > 0) {
          subscriptionsQuery = subscriptionsQuery.in(
            "user_id",
            userIds.map((u: { user_id: string }) => u.user_id)
          );
        } else {
          // Registrar no histórico mesmo sem usuários
          await supabaseAdmin.from("admin_notifications").insert({
            tipo: "push_enviado",
            titulo: "Push notification enviada",
            mensagem: `"${notificationTitle}" - 0 usuários encontrados`,
            dados: { 
              filter: filterUsed, 
              sent: 0, 
              failed: 0, 
              total_subscriptions: 0,
              notification: { title: notificationTitle, body: notificationBody }
            },
          });
          
          return new Response(
            JSON.stringify({ success: true, message: "No users found", sent: 0, failed: 0 }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const { data: subscriptions, error: subsError } = await subscriptionsQuery;

    if (subsError) {
      console.error("[SEND-PUSH] ❌ Erro subscriptions:", subsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[SEND-PUSH] ℹ️ Nenhuma subscription encontrada");
      
      // Registrar no histórico
      await supabaseAdmin.from("admin_notifications").insert({
        tipo: "push_enviado",
        titulo: "Push notification enviada",
        mensagem: `"${notificationTitle}" - 0 subscriptions`,
        dados: { 
          filter: filterUsed, 
          sent: 0, 
          failed: 0, 
          total_subscriptions: 0,
          notification: { title: notificationTitle, body: notificationBody }
        },
      });
      
      return new Response(
        JSON.stringify({ success: true, message: "No subscriptions", sent: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    totalSubscriptions = subscriptions.length;
    console.log(`[SEND-PUSH] 📱 ${totalSubscriptions} subscriptions encontradas`);

    // Para cada user_id único, inserir registro na tabela notifications
    const uniqueUserIds = [...new Set(subscriptions.map((s) => s.user_id))];
    const notificationRecords = uniqueUserIds.map((userId) => ({
      user_id: userId,
      title: body.notification.title,
      body: body.notification.body,
      url: body.notification.url || "/dashboard",
      type: body.notification.data?.type || "geral",
    }));

    const { data: insertedNotifications } = await supabaseAdmin
      .from("notifications")
      .insert(notificationRecords)
      .select("id, user_id");

    // Mapear notification_id por user_id para incluir no payload
    const notifIdByUser: Record<string, string> = {};
    if (insertedNotifications) {
      for (const n of insertedNotifications) {
        notifIdByUser[n.user_id] = n.id;
      }
    }

    for (const sub of subscriptions) {
      const notificationPayload = JSON.stringify({
        title: body.notification.title,
        body: body.notification.body,
        icon: body.notification.icon || "/pwa-192x192.png",
        badge: body.notification.badge || "/pwa-192x192.png",
        notification_id: notifIdByUser[sub.user_id] || null,
        data: { url: body.notification.url || "/dashboard" },
      });
      console.log(`[SEND-PUSH] 📤 Enviando para user ${sub.user_id}...`);
      console.log(`[SEND-PUSH] 📍 Endpoint: ${sub.endpoint.includes("apple") ? "Apple" : sub.endpoint.includes("fcm") ? "FCM" : "Outro"}`);
      
      try {
        const result = await sendPushNotification(
          sub.endpoint,
          sub.p256dh_key,
          sub.auth_key,
          notificationPayload,
          vapidPublicKey,
          vapidPrivateKey
        );
        
        if (result.success) {
          console.log(`[SEND-PUSH] ✅ Sucesso user ${sub.user_id} status=${result.statusCode}`);
          sent++;
        } else {
          console.error(`[SEND-PUSH] ❌ Falha user ${sub.user_id} status=${result.statusCode}: ${result.error}`);
          failed++;

          if (result.statusCode === 410 || result.statusCode === 404) {
            console.log(`[SEND-PUSH] 🗑️ Desativando subscription ${sub.id}`);
            await supabaseAdmin
              .from("push_subscriptions")
              .update({ is_active: false })
              .eq("id", sub.id);
          }
        }
      } catch (subError) {
        console.error(`[SEND-PUSH] 💥 Erro inesperado user ${sub.user_id}:`, subError);
        failed++;
      }
    }

    // SEMPRE registrar no histórico
    await supabaseAdmin.from("admin_notifications").insert({
      tipo: "push_enviado",
      titulo: "Push notification enviada",
      mensagem: `"${notificationTitle}" - ${sent}/${totalSubscriptions} dispositivos`,
      dados: { 
        filter: filterUsed, 
        sent, 
        failed, 
        total_subscriptions: totalSubscriptions,
        notification: { title: notificationTitle, body: notificationBody }
      },
    });

    console.log(`[SEND-PUSH] ⏱️ ${Date.now() - startTime}ms - Sent: ${sent}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ success: true, total: totalSubscriptions, sent, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SEND-PUSH] ❌ Erro geral:", error);
    
    // Registrar erro no histórico também
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabaseAdmin.from("admin_notifications").insert({
        tipo: "push_enviado",
        titulo: "Push notification - ERRO",
        mensagem: `"${notificationTitle || "?"}" - Erro: ${safeMessageFromError(error)}`,
        dados: { 
          filter: filterUsed, 
          sent, 
          failed, 
          total_subscriptions: totalSubscriptions,
          error: safeMessageFromError(error)
        },
      });
    } catch (logError) {
      console.error("[SEND-PUSH] ❌ Erro ao registrar no histórico:", logError);
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

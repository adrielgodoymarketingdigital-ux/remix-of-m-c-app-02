import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DispatchRequest {
  event_type: string;
  payload: Record<string, unknown>;
}

function safeMessageFromError(err: unknown): string {
  if (!err) return "unknown";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return "unknown"; }
}

// Template engine: substitui {{variavel}} por valores do payload
function hydrateTemplate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = payload[key];
    if (value === undefined || value === null) return "";
    if (typeof value === "number") return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    return String(value);
  });
}

// ============ Web Push utilities (inline) ============

function base64ToUint8Array(base64String: string): Uint8Array {
  let base64 = base64String.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (base64.length % 4)) % 4;
  base64 += "=".repeat(padding);
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function uint8ArrayToBase64Url(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) { result.set(arr, offset); offset += arr.length; }
  return result;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey("raw", ikm.buffer.slice(ikm.byteOffset, ikm.byteOffset + ikm.byteLength) as ArrayBuffer, { name: "HKDF" }, false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer, info: info.buffer.slice(info.byteOffset, info.byteOffset + info.byteLength) as ArrayBuffer }, keyMaterial, length * 8);
  return new Uint8Array(derivedBits);
}

function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const typeBuffer = encoder.encode(type);
  const result = new Uint8Array(18 + typeBuffer.length + 1 + 5 + 1 + 2 + clientPublicKey.length + 2 + serverPublicKey.length);
  let offset = 0;
  const ce = encoder.encode("Content-Encoding: ");
  result.set(ce, offset); offset += ce.length;
  result.set(typeBuffer, offset); offset += typeBuffer.length;
  result[offset++] = 0;
  const p256 = encoder.encode("P-256");
  result.set(p256, offset); offset += p256.length;
  result[offset++] = 0;
  result[offset++] = 0; result[offset++] = clientPublicKey.length;
  result.set(clientPublicKey, offset); offset += clientPublicKey.length;
  result[offset++] = 0; result[offset++] = serverPublicKey.length;
  result.set(serverPublicKey, offset);
  return result;
}

async function encryptPayload(payload: string, p256dhKey: string, authKey: string) {
  const clientPublicKey = base64ToUint8Array(p256dhKey);
  const clientAuthSecret = base64ToUint8Array(authKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const serverKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublicKeyRaw = await crypto.subtle.exportKey("raw", serverKeyPair.publicKey);
  const serverPublicKey = new Uint8Array(serverPublicKeyRaw);
  const clientKey = await crypto.subtle.importKey("raw", clientPublicKey.buffer.slice(clientPublicKey.byteOffset, clientPublicKey.byteOffset + clientPublicKey.byteLength) as ArrayBuffer, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecretBits = await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, serverKeyPair.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBits);
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const ikm = await hkdf(clientAuthSecret, sharedSecret, authInfo, 32);
  const contentInfo = createInfo("aesgcm", clientPublicKey, serverPublicKey);
  const contentKey = await hkdf(salt, ikm, contentInfo, 16);
  const nonceInfo = createInfo("nonce", clientPublicKey, serverPublicKey);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(2 + payloadBytes.length);
  paddedPayload[0] = 0; paddedPayload[1] = 0;
  paddedPayload.set(payloadBytes, 2);
  const aesKey = await crypto.subtle.importKey("raw", contentKey.buffer.slice(contentKey.byteOffset, contentKey.byteOffset + contentKey.byteLength) as ArrayBuffer, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce.buffer.slice(nonce.byteOffset, nonce.byteOffset + nonce.byteLength) as ArrayBuffer }, aesKey, paddedPayload.buffer.slice(paddedPayload.byteOffset, paddedPayload.byteOffset + paddedPayload.byteLength) as ArrayBuffer);
  return { ciphertext: new Uint8Array(ciphertext), salt, serverPublicKey };
}

function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length === 64) return der;
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error("Invalid DER");
  der[offset++]; // total length
  if (der[offset++] !== 0x02) throw new Error("Invalid DER r");
  let rLength = der[offset++]; let rOffset = offset; offset += rLength;
  if (der[offset++] !== 0x02) throw new Error("Invalid DER s");
  let sLength = der[offset++]; let sOffset = offset;
  let r = der.slice(rOffset, rOffset + rLength);
  let s = der.slice(sOffset, sOffset + sLength);
  while (r.length > 32 && r[0] === 0) r = r.slice(1);
  while (s.length > 32 && s[0] === 0) s = s.slice(1);
  const result = new Uint8Array(64);
  result.set(r, 32 - r.length);
  result.set(s, 64 - s.length);
  return result;
}

async function createVapidJwt(endpoint: string, vapidPublicKey: string, vapidPrivateKey: string): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: expiration, sub: "mailto:contato@mecapp.com.br" };
  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  const privateKeyBytes = base64ToUint8Array(vapidPrivateKey);
  const publicKeyBytes = base64ToUint8Array(vapidPublicKey);
  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);
  const jwk = { kty: "EC", crv: "P-256", x: uint8ArrayToBase64Url(x), y: uint8ArrayToBase64Url(y), d: uint8ArrayToBase64Url(privateKeyBytes) };
  const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const dataToSign = new TextEncoder().encode(unsignedToken);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, dataToSign.buffer.slice(dataToSign.byteOffset, dataToSign.byteOffset + dataToSign.byteLength) as ArrayBuffer);
  const signatureRaw = derToRaw(new Uint8Array(signature));
  return `${unsignedToken}.${uint8ArrayToBase64Url(signatureRaw)}`;
}

async function sendWebPush(endpoint: string, p256dhKey: string, authKey: string, payloadStr: string, vapidPublicKey: string, vapidPrivateKey: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const { ciphertext, salt, serverPublicKey } = await encryptPayload(payloadStr, p256dhKey, authKey);
    const jwt = await createVapidJwt(endpoint, vapidPublicKey, vapidPrivateKey);
    const headers: HeadersInit = {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Encryption": `salt=${uint8ArrayToBase64Url(salt)}`,
      "Crypto-Key": `dh=${uint8ArrayToBase64Url(serverPublicKey)};p256ecdsa=${vapidPublicKey}`,
      "Authorization": `WebPush ${jwt}`,
      "TTL": "86400",
    };
    const response = await fetch(endpoint, { method: "POST", headers, body: ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength) as ArrayBuffer });
    if (response.ok || response.status === 201) return { success: true, statusCode: response.status };
    const errorText = await response.text().catch(() => "");
    return { success: false, statusCode: response.status, error: errorText };
  } catch (error) {
    return { success: false, error: safeMessageFromError(error) };
  }
}

// ============ Main handler ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[DISPATCH-EVENT] 🚀 Iniciando processamento de evento");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    console.log(`[DISPATCH-EVENT] 🔑 Service key primeiros 20 chars: ${supabaseServiceKey?.substring(0, 20)}`);
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    // Criar cliente admin (service role) para operações privilegiadas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body
    const { event_type, payload = {} }: DispatchRequest = await req.json();
    console.log(`[DISPATCH-EVENT] 📦 Evento: ${event_type}, Payload: ${JSON.stringify(payload)}`);

    // Verificar se é chamada do sistema (service role key) ou usuário autenticado
    const token = authHeader.replace("Bearer ", "");
    const isSystemCall = token === supabaseServiceKey;
    let userId: string;

    if (isSystemCall) {
      // Para chamadas de sistema, usar o admin como alvo
      // O target das regras (admin) determina quem recebe
      userId = "system";
      console.log(`[DISPATCH-EVENT] 🔑 Chamada de sistema para user: ${userId}`);
    } else {
      // Chamada de usuário autenticado
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
      if (userError || !userData.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = userData.user.id;

      // Verificar plano do usuário - notificações automáticas apenas para Profissional, Admin ou Trial
      const { data: assinatura } = await supabaseAdmin
        .from("assinaturas")
        .select("plano_tipo, status")
        .eq("user_id", userId)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const planosPermitidos = ["profissional_mensal", "profissional_anual", "admin", "trial"];
      if (!assinatura || !planosPermitidos.includes(assinatura.plano_tipo)) {
        console.log(`[DISPATCH-EVENT] ⏭️ Plano "${assinatura?.plano_tipo || 'nenhum'}" não tem acesso a notificações automáticas`);
        return new Response(JSON.stringify({ skipped: true, reason: "plan_not_eligible" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Buscar regras ativas para este evento
    const { data: allRules, error: rulesError } = await supabaseAdmin
      .from("notification_rules")
      .select("*")
      .eq("event_type", event_type)
      .eq("active", true);

    if (rulesError) {
      console.error("[DISPATCH-EVENT] ❌ Erro ao buscar regras:", rulesError);
      throw rulesError;
    }

    // Filtrar regras por condition (se existir)
    const rules = (allRules || []).filter((rule) => {
      if (!rule.condition) return true;
      const cond = typeof rule.condition === "string" ? JSON.parse(rule.condition) : rule.condition;
      return Object.entries(cond).every(([key, value]) => {
        return String(payload[key]) === String(value);
      });
    });

    if (rules.length === 0) {
      console.log(`[DISPATCH-EVENT] ℹ️ Nenhuma regra ativa/matching para ${event_type} (payload: ${JSON.stringify(payload)})`);
      return new Response(JSON.stringify({ sent: 0, reason: "no_rules" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anti-duplicidade: verificar se já enviou notificação com MESMO título hidratado nos últimos 5s
    const dedupWindowAgo = new Date(Date.now() - 5 * 1000).toISOString();
    const expectedTitles = rules.map((r) => hydrateTemplate(r.title_template, payload));

    const { data: recentNotif } = await supabaseAdmin
      .from("notifications")
      .select("id, title")
      .eq("user_id", userId)
      .eq("type", event_type)
      .gte("created_at", dedupWindowAgo)
      .limit(10);

    if (recentNotif && recentNotif.length > 0) {
      const isDuplicate = recentNotif.some((n) => expectedTitles.includes(n.title));
      if (isDuplicate) {
        console.log(`[DISPATCH-EVENT] ⏭️ Duplicata ignorada para ${event_type} (mesmo título em 10s)`);
        return new Response(JSON.stringify({ skipped: true, reason: "duplicate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`[DISPATCH-EVENT] 📋 ${rules.length} regra(s) encontrada(s)`);

    let totalSent = 0;
    let totalFailed = 0;

    for (const rule of rules) {
      const title = hydrateTemplate(rule.title_template, payload);
      const body_text = hydrateTemplate(rule.body_template, payload);
      const url = hydrateTemplate(rule.url_template || "/", payload);

      // Determinar usuários alvo
      let targetUserIds: string[] = [];

      if (rule.target === "owner") {
        targetUserIds = [userId];
      } else if (rule.target === "admin") {
        const { data: admins } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        targetUserIds = (admins || []).map((a: { user_id: string }) => a.user_id);
      }

      if (targetUserIds.length === 0) {
        console.log(`[DISPATCH-EVENT] ⚠️ Nenhum usuário alvo para regra ${rule.id}`);
        continue;
      }

      // Filtrar usuários por preferências de notificação
      const { data: userPrefs } = await supabaseAdmin
        .from("user_notification_preferences")
        .select("user_id, preferences")
        .in("user_id", targetUserIds);

      const prefsMap = new Map<string, Record<string, boolean>>();
      if (userPrefs) {
        for (const up of userPrefs) {
          prefsMap.set(up.user_id, up.preferences as Record<string, boolean>);
        }
      }

      const pushEligibleUserIds = targetUserIds.filter((uid) => {
        const prefs = prefsMap.get(uid);
        if (!prefs) return true;
        // Check general event preference
        if (prefs[event_type] === false) return false;
        // For SERVICE_ORDER_UPDATED, also check per-status preference
        if (event_type === "SERVICE_ORDER_UPDATED" && payload.status) {
          const statusKey = `SERVICE_ORDER_STATUS_${payload.status}`;
          if (prefs[statusKey] === false) return false;
        }
        return true;
      });

      const pushSkippedUserIds = targetUserIds.filter((uid) => !pushEligibleUserIds.includes(uid));
      if (pushSkippedUserIds.length > 0) {
        console.log(`[DISPATCH-EVENT] ⏭️ ${pushSkippedUserIds.length} usuário(s) optaram por não receber ${event_type}`);
      }

      // Buscar subscriptions ativas dos usuários elegíveis
      const { data: subscriptions } = pushEligibleUserIds.length > 0
        ? await supabaseAdmin
            .from("push_subscriptions")
            .select("id, user_id, endpoint, p256dh_key, auth_key")
            .eq("is_active", true)
            .in("user_id", pushEligibleUserIds)
        : { data: [] };

      // Enviar push diretamente via Web Push (sem chamar outra edge function)
      if (vapidPublicKey && vapidPrivateKey && subscriptions && subscriptions.length > 0) {
        const pushPayload = JSON.stringify({
          title,
          body: body_text,
          icon: "/pwa-192x192.png",
          badge: "/pwa-192x192.png",
          url,
          sound: (rule as { sound?: string }).sound || "default",
          data: { event_type, notification_id: crypto.randomUUID() },
        });

        for (const sub of subscriptions) {
          try {
            const result = await sendWebPush(
              sub.endpoint,
              sub.p256dh_key,
              sub.auth_key,
              pushPayload,
              vapidPublicKey,
              vapidPrivateKey
            );

            if (result.success) {
              totalSent++;
              console.log(`[DISPATCH-EVENT] ✅ Push enviado para ${sub.user_id}`);
            } else {
              totalFailed++;
              console.log(`[DISPATCH-EVENT] ❌ Falha push para ${sub.user_id}: ${result.statusCode} ${(result.error || "").substring(0, 100)}`);
              // Desativar subscription se 410 Gone
              if (result.statusCode === 410 || result.statusCode === 404) {
                await supabaseAdmin
                  .from("push_subscriptions")
                  .update({ is_active: false })
                  .eq("id", sub.id);
                console.log(`[DISPATCH-EVENT] 🗑️ Subscription desativada: ${sub.id}`);
              }
            }
          } catch (pushErr) {
            totalFailed++;
            console.error(`[DISPATCH-EVENT] 💥 Erro push:`, safeMessageFromError(pushErr));
          }
        }
      } else if (!subscriptions || subscriptions.length === 0) {
        console.log(`[DISPATCH-EVENT] ⚠️ Nenhuma subscription ativa para os alvos elegíveis`);
      }

      // Registrar no histórico de notificações (para todos os alvos, mesmo os que optaram por não receber push)
      const notifInserts = targetUserIds.map((uid) => ({
        user_id: uid,
        title,
        body: body_text,
        url,
        type: event_type,
        sent_at: new Date().toISOString(),
      }));

      const { error: notifError } = await supabaseAdmin
        .from("notifications")
        .insert(notifInserts);

      if (notifError) {
        console.error("[DISPATCH-EVENT] ⚠️ Erro ao salvar histórico:", notifError);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[DISPATCH-EVENT] ✅ Concluído em ${elapsed}ms. Enviados: ${totalSent}, Falhas: ${totalFailed}`);

    return new Response(
      JSON.stringify({ sent: totalSent, failed: totalFailed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[DISPATCH-EVENT] 💥 Erro:", safeMessageFromError(error));
    return new Response(
      JSON.stringify({ error: safeMessageFromError(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

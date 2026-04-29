import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hydrateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
}

function safeMessageFromError(err: unknown): string {
  if (!err) return "unknown";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return "unknown"; }
}

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
  der[offset++];
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, body: bodyText, url, event_key, template_vars = {} } = await req.json();
    console.log("[NOTIFY-ADMIN] Recebido:", { title, event_key });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Buscar preferências de notificação do admin
    const { data: configAdmin } = await supabaseAdmin
      .from("configuracoes_admin")
      .select("preferencias_notificacao")
      .limit(1)
      .maybeSingle();
    // deno-lint-ignore no-explicit-any
    const prefs = (configAdmin?.preferencias_notificacao as Record<string, any>) || {};

    // Verificar se evento está desabilitado pelo admin
    if (event_key && prefs[event_key] === false) {
      console.log(`[NOTIFY-ADMIN] ⏭️ Evento ${event_key} desabilitado pelo usuário`);
      return new Response(JSON.stringify({ sent: 0, reason: "disabled_by_user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Usar textos personalizados do banco se existirem
    const tituloFinal = prefs[`${event_key}_titulo`]
      ? hydrateTemplate(String(prefs[`${event_key}_titulo`]), template_vars)
      : title;
    const corpoFinal = prefs[`${event_key}_corpo`]
      ? hydrateTemplate(String(prefs[`${event_key}_corpo`]), template_vars)
      : bodyText;

    // Buscar user_ids com role=admin
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminIds = (admins || []).map((a: { user_id: string }) => a.user_id);
    console.log("[NOTIFY-ADMIN] Admins encontrados:", adminIds);

    if (adminIds.length === 0) {
      console.log("[NOTIFY-ADMIN] Nenhum admin encontrado");
      return new Response(JSON.stringify({ sent: 0, failed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar subscriptions ativas dos admins
    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh_key, auth_key")
      .eq("is_active", true)
      .in("user_id", adminIds);
    console.log("[NOTIFY-ADMIN] Subscriptions encontradas:", subscriptions?.length || 0);

    let totalSent = 0;
    let totalFailed = 0;

    if (vapidPublicKey && vapidPrivateKey && subscriptions && subscriptions.length > 0) {
      const pushPayload = JSON.stringify({
        title: tituloFinal,
        body: corpoFinal,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        url: url || "/",
        data: { notification_id: crypto.randomUUID() },
      });

      for (const sub of subscriptions) {
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
          console.log(`[NOTIFY-ADMIN] ✅ Push enviado para ${sub.user_id}`);
        } else {
          totalFailed++;
          console.log(`[NOTIFY-ADMIN] ❌ Falha push ${sub.user_id}: ${result.statusCode} ${(result.error || "").substring(0, 100)}`);
          if (result.statusCode === 410 || result.statusCode === 404) {
            await supabaseAdmin
              .from("push_subscriptions")
              .update({ is_active: false })
              .eq("id", sub.id);
          }
        }
      }
    }

    // Salvar no histórico de notificações
    if (adminIds.length > 0) {
      await supabaseAdmin.from("notifications").insert(
        adminIds.map((uid: string) => ({
          user_id: uid,
          title: tituloFinal,
          body: corpoFinal,
          url: url || "/",
          type: "ADMIN_NOTIFICATION",
          sent_at: new Date().toISOString(),
        }))
      );
    }

    console.log(`[NOTIFY-ADMIN] ✅ Concluído. Enviados: ${totalSent}, Falhas: ${totalFailed}`);

    return new Response(
      JSON.stringify({ sent: totalSent, failed: totalFailed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[NOTIFY-ADMIN] 💥 Erro:", safeMessageFromError(error));
    return new Response(
      JSON.stringify({ error: safeMessageFromError(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

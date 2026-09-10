/**
 * Validação server-side do Cloudflare Turnstile — usada nas Edge Functions
 * de checkout (create-pagarme-subscription, create-pix-order), que NÃO
 * passam pelo GoTrue e por isso não ganham a verificação automática que o
 * Supabase Auth já faz no signUp. Mitigação ao ataque de carding de
 * 2026-09-09. Requer a secret TURNSTILE_SECRET_KEY configurada nas Edge
 * Functions (separada da secret do painel Authentication, que só vale pro
 * signUp/signIn nativos).
 */
export async function validarTurnstile(
  token: string | undefined,
  remoteIp?: string,
): Promise<boolean> {
  if (!token) return false;

  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.error("[TURNSTILE] TURNSTILE_SECRET_KEY não configurada");
    return false;
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = await res.json().catch(() => ({}));
    return data?.success === true;
  } catch (error) {
    console.error("[TURNSTILE] Erro ao validar token", error);
    return false;
  }
}

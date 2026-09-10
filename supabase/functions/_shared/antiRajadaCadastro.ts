import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Mitigação rápida contra o ataque de carding detectado em 2026-09-09:
 * contas recém-criadas em rajada testando cartões via assinatura paga.
 *
 * NÃO é definitivo (não olha IP, não distingue humano de bot além do timing)
 * — é uma barreira rápida pra conter a rajada enquanto uma solução mais
 * completa (Turnstile no cadastro/checkout) não entra. Ver o diagnóstico do
 * incidente na conversa do dia pra contexto completo.
 *
 * Regra: se 2+ contas com MENOS de 1h de cadastro já geraram uma assinatura
 * Pagar.me nos últimos 10 minutos, bloqueia a PRÓXIMA tentativa vinda de uma
 * conta igualmente nova — antes de processar qualquer cobrança.
 */

const JANELA_TENTATIVAS_MIN = 10;
const IDADE_CONTA_MAX_HORAS = 1;
const LIMITE_TENTATIVAS = 2;

const MOTIVO_BLOQUEIO =
  "Bloqueio automático (rate limit anti-fraude 2026-09-09): rajada de assinaturas pagas detectada em contas com menos de 1h de cadastro.";

function horasDesde(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

/**
 * Retorna true se a requisição do usuário `userId` deve ser BLOQUEADA antes
 * de processar a cobrança. Só se aplica a contas com menos de 1h de vida —
 * clientes antigos nunca são afetados por esta checagem.
 */
export async function detectarRajadaSuspeita(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
): Promise<boolean> {
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: contaAtual } = await supabaseAdmin.auth.admin.getUserById(userId);
  const criadoEmAtual = contaAtual?.user?.created_at;
  if (!criadoEmAtual) return false;
  if (horasDesde(criadoEmAtual) > IDADE_CONTA_MAX_HORAS) return false;

  const desde = new Date(Date.now() - JANELA_TENTATIVAS_MIN * 60_000).toISOString();
  const { data: recentes } = await supabaseAdmin
    .from("assinaturas")
    .select("user_id")
    .eq("payment_provider", "pagarme")
    .gte("updated_at", desde);

  if (!recentes || recentes.length === 0) return false;

  let contasNovasComAssinatura = 0;
  for (const row of recentes) {
    if (row.user_id === userId) continue; // não conta a própria requisição atual
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    const criadoEm = u?.user?.created_at;
    if (criadoEm && horasDesde(criadoEm) <= IDADE_CONTA_MAX_HORAS) {
      contasNovasComAssinatura++;
    }
  }

  return contasNovasComAssinatura >= LIMITE_TENTATIVAS;
}

/** Marca a conta como suspeita: mesmo mecanismo de bloqueio do admin-block-user, com tipo "indeterminado" (não sofre o auto-desbloqueio de "ate_assinar"). */
export async function marcarContaSuspeita(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
): Promise<void> {
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  await supabaseAdmin
    .from("assinaturas")
    .update({
      bloqueado_admin: true,
      bloqueado_tipo: "indeterminado",
      bloqueado_admin_motivo: MOTIVO_BLOQUEIO,
      bloqueado_admin_em: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

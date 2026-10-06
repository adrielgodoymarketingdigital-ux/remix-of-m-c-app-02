/**
 * Regras puras do envio de "Registrar Nova Compra" (Origem de Dispositivos):
 * resultado explícito, mensagem de erro, reaproveitamento do que foi criado na
 * sessão do diálogo, trava de duplo envio, limite de tempo antes de escrever e
 * dimensão da assinatura exportada. Sem dependências (testado com Deno em
 * scripts/testes-compra-falha/).
 *
 * Caso real (out/2026, Android/PWA): 4 tentativas criaram pessoa e dispositivo,
 * a compra não gravou e o diálogo fechou e limpou o formulário como num sucesso.
 */

export const MENSAGEM_FALHA_COMPRA = "Não foi possível registrar a compra. Seus dados continuam aqui, tente de novo.";

export type ResultadoCompra<T> =
  | { ok: true; compra: T }
  | FalhaCompra;

export type FalhaCompra = { ok: false; mensagem: string; detalhe: string | null };

/** Guarda de tipo (o projeto não usa strictNullChecks, então `!r.ok` não estreita a união). */
export function compraFalhou(resultado: ResultadoCompra<unknown> | null | undefined): resultado is FalhaCompra {
  return resultado?.ok === false;
}

/** O diálogo só fecha (e limpa o formulário) quando a compra foi gravada. */
export function deveFecharDialogo(resultado: ResultadoCompra<unknown> | null | undefined): boolean {
  return resultado?.ok === true;
}

interface ErroComCampos {
  code?: unknown;
  message?: unknown;
  status?: unknown;
  name?: unknown;
}

/** Erro qualquer (PostgREST, fetch, timeout) → mensagem fixa + motivo técnico resumido. */
export function montarMensagemErroCompra(erro: unknown): { mensagem: string; detalhe: string | null } {
  const e = (erro && typeof erro === "object" ? erro : {}) as ErroComCampos;
  const codigo = typeof e.code === "string" ? e.code : null;
  const status = typeof e.status === "number" ? e.status : null;
  const texto = typeof e.message === "string" ? e.message : typeof erro === "string" ? erro : "";

  let detalhe: string | null;
  if (texto.includes("check_origem")) detalhe = "Selecione apenas uma origem (pessoa OU fornecedor).";
  else if (e.name === "TempoEsgotado") detalhe = "O aparelho demorou para confirmar a sessão. Verifique a internet e tente de novo.";
  else if (/failed to fetch|networkerror|load failed|network request failed/i.test(texto)) detalhe = "Sem conexão com o servidor.";
  else if (status === 413 || /payload too large|request entity too large/i.test(texto)) detalhe = "Dados grandes demais para enviar (fotos/assinaturas).";
  else if (status === 401 || /jwt|não autenticado|not authenticated/i.test(texto)) detalhe = "Sessão expirada. Saia e entre de novo no app.";
  else if (codigo || texto) detalhe = [codigo, texto].filter(Boolean).join(": ").slice(0, 160);
  else detalhe = null;

  return { mensagem: MENSAGEM_FALHA_COMPRA, detalhe };
}

// ── Reaproveitamento do que foi criado na sessão do diálogo ────────────────

export interface CriadosNaSessao {
  pessoaId?: string | null;
  dispositivoId?: string | null;
}

/**
 * Ids usados na tentativa: os do formulário; se algum estiver vazio e houver um
 * registro criado nesta sessão do diálogo (pessoa/dispositivo pelos "+ Novo"),
 * reaproveita esse em vez de deixar órfão ou criar outro. Nunca apaga nada.
 */
export function idsParaTentativa(
  formulario: { tipo_origem?: string; pessoa_id?: string | null; dispositivo_id?: string | null },
  criados: CriadosNaSessao,
): { pessoaId: string | null; dispositivoId: string | null } {
  const pessoaId = formulario.tipo_origem === "terceiro" ? (formulario.pessoa_id || criados.pessoaId || null) : null;
  const dispositivoId = formulario.dispositivo_id || criados.dispositivoId || null;
  return { pessoaId, dispositivoId };
}

/** Registros criados nesta sessão que ficaram sem compra (só para o log de diagnóstico). */
export function criadosSemCompra(criados: CriadosNaSessao, compraGravada: boolean): string[] {
  if (compraGravada) return [];
  const pendentes: string[] = [];
  if (criados.pessoaId) pendentes.push(`pessoa ${criados.pessoaId}`);
  if (criados.dispositivoId) pendentes.push(`dispositivo ${criados.dispositivoId}`);
  return pendentes;
}

// ── Trava de duplo envio ───────────────────────────────────────────────────

export interface TravaEnvio {
  emAndamento: boolean;
}

/** true = pode enviar (e a trava fica fechada); false = já há um envio rodando, ignorar o clique. */
export function iniciarEnvio(trava: TravaEnvio): boolean {
  if (trava.emAndamento) return false;
  trava.emAndamento = true;
  return true;
}

export function finalizarEnvio(trava: TravaEnvio): void {
  trava.emAndamento = false;
}

// ── Limite de tempo (só antes de qualquer escrita) ─────────────────────────

export class TempoEsgotado extends Error {
  constructor(etapa: string, ms: number) {
    super(`${etapa}: sem resposta em ${Math.round(ms / 1000)}s`);
    this.name = "TempoEsgotado";
  }
}

/** Rejeita com TempoEsgotado se `promessa` não terminar em `ms`. Usar só em etapas sem escrita. */
export function comLimiteDeTempo<T>(promessa: Promise<T>, ms: number, etapa: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new TempoEsgotado(etapa, ms)), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

// ── Tamanho do envio e da assinatura ───────────────────────────────────────

/** Tamanho em KB do corpo JSON que vai para o Supabase. */
export function tamanhoPayloadKB(dados: unknown): number {
  const bytes = new TextEncoder().encode(JSON.stringify(dados ?? null)).length;
  return Math.round((bytes / 1024) * 10) / 10;
}

export const ASSINATURA_LARGURA_MAX = 600;
export const ASSINATURA_ALTURA_MAX = 200;

/**
 * Dimensão da assinatura exportada: a recortada (que no celular cresce com o
 * devicePixelRatio: ~1000×257 px em DPR 3) reduzida proporcionalmente para caber
 * em 600×200, nunca ampliada.
 */
export function dimensaoAssinaturaExportada(
  largura: number,
  altura: number,
  maxLargura = ASSINATURA_LARGURA_MAX,
  maxAltura = ASSINATURA_ALTURA_MAX,
): { largura: number; altura: number; reduzida: boolean } {
  if (!(largura > 0) || !(altura > 0)) return { largura: 0, altura: 0, reduzida: false };
  const escala = Math.min(1, maxLargura / largura, maxAltura / altura);
  if (escala >= 1) return { largura, altura, reduzida: false };
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
    reduzida: true,
  };
}

// Limite de estoque baixo da loja (tabela configuracao_estoque, fase 2).
// Funções puras: o hook useConfiguracaoEstoque só faz a consulta e chama estas.

/** Teto do limite; o banco tem o mesmo CHECK (0 a 1000). */
export const LIMITE_BAIXO_MAXIMO = 1000;

export interface LeituraConfiguracaoEstoque {
  /** Limite salvo pelo dono; null = sem configuração (cada tela usa o padrão dela). */
  limiteBaixo: number | null;
  /** false quando a tabela ainda não existe no banco (front publicado antes da migration). */
  tabelaDisponivel: boolean;
}

export const SEM_CONFIGURACAO: LeituraConfiguracaoEstoque = { limiteBaixo: null, tabelaDisponivel: true };

interface ErroPostgrest {
  code?: string | null;
  message?: string | null;
}

/**
 * Tabela inexistente: PostgREST 12 responde PGRST205 ("Could not find the table ...
 * in the schema cache"); versões antigas e o Postgres respondem 42P01.
 */
export function ehTabelaAusente(erro: ErroPostgrest | null | undefined): boolean {
  if (!erro) return false;
  if (erro.code === "PGRST205" || erro.code === "42P01") return true;
  const msg = erro.message ?? "";
  return msg.includes("configuracao_estoque") && (msg.includes("schema cache") || msg.includes("does not exist"));
}

/** Limite vindo do banco: só inteiro de 0 ao teto; o resto vira "sem configuração". */
function limiteDoBanco(valor: unknown): number | null {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= LIMITE_BAIXO_MAXIMO
    ? valor
    : null;
}

/**
 * Interpreta a resposta de `select limite_baixo ... maybeSingle()`. Nunca lança:
 * qualquer erro cai no padrão de cada tela (o aviso é só visual), sem toast.
 */
export function interpretarLeitura(
  dados: { limite_baixo?: unknown } | null | undefined,
  erro: ErroPostgrest | null | undefined,
): LeituraConfiguracaoEstoque {
  if (erro) return { limiteBaixo: null, tabelaDisponivel: !ehTabelaAusente(erro) };
  return { limiteBaixo: limiteDoBanco(dados?.limite_baixo), tabelaDisponivel: true };
}

export type ResultadoCampoLimite =
  | { ok: true; valor: number | null }
  | { ok: false };

/**
 * Texto do campo "avisar quando restar X ou menos".
 * Vazio = voltar ao padrão (null). Aceita só inteiro de 0 ao teto.
 */
export function validarCampoLimite(texto: string): ResultadoCampoLimite {
  const limpo = texto.trim();
  if (limpo === "") return { ok: true, valor: null };
  if (!/^\d+$/.test(limpo)) return { ok: false };
  const valor = Number(limpo);
  return valor <= LIMITE_BAIXO_MAXIMO ? { ok: true, valor } : { ok: false };
}

/** Valor que vai para o banco a partir do campo e da opção "não avisar". */
export function limiteParaSalvar(texto: string, naoAvisar: boolean): ResultadoCampoLimite {
  return naoAvisar ? { ok: true, valor: 0 } : validarCampoLimite(texto);
}

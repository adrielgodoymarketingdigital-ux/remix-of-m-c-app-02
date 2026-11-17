/**
 * Gera a próxima ocorrência de uma conta recorrente depois de um pagamento.
 * Função única, usada por todos os caminhos que quitam uma conta (useContas.ts).
 *
 * - Conta não recorrente (pelo que o app já sabe): nenhuma chamada ao banco.
 * - Recorrente: relê a conta no banco e só gera se o status REAL for pago/recebido
 *   (no modelo novo quem calcula é o gatilho sync_conta_from_pagamentos).
 * - Dia fixo: deduzido das datas anteriores da série (diaFixoDaSerie).
 * - Não duplica: confere no banco se a ocorrência já existe antes de inserir, e
 *   gerações da mesma conta na mesma aba rodam em fila (clique duplo).
 * - Nunca lança: erro vira { status: "erro" } e o pagamento já feito fica como está.
 *
 * Recebe o cliente do Supabase por parâmetro (testes usam um Supabase falso).
 */
import {
  deveGerarProxima,
  diaFixoDaSerie,
  normalizarNomeConta,
  ocorrenciaJaExiste,
  type ContaRecorrencia,
} from "./recorrencia.ts";

/** O mínimo do cliente do Supabase usado aqui (o cliente real serve). */
export interface ClienteSupabaseContas {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(tabela: string): any;
}

export type ResultadoProximaRecorrente =
  | { status: "ignorada"; motivo: "nao_recorrente" | "nao_quitada" | "ja_quitada_antes" | "virtual" | "nao_encontrada" }
  | { status: "ja_existe"; data: string }
  | { status: "gerada"; data: string; ano: number; mes: number }
  | { status: "erro"; mensagem: string };

export interface EntradaProximaRecorrente {
  contaId: string;
  /** Recorrente segundo o que o app já tem (lista, formulário). Diferente de true = nada é feito. */
  recorrenteLocal: boolean | null | undefined;
  /** Dono das contas (resolvedUserId ?? user.id): a próxima nasce com este user_id. */
  targetUserId: string;
  /** A conta já estava quitada antes desta ação (pagar de novo não gera nada). */
  quitadaAntes?: boolean;
}

/** Colunas da conta de origem lidas no banco (as que a próxima copia + as da decisão). */
export const COLUNAS_CONTA_ORIGEM =
  "id, user_id, empresa_id, nome, tipo, valor, data, status, recorrente, categoria, descricao, fornecedor_id, compra_estoque, usa_historico_pagamentos";

type LinhaConta = ContaRecorrencia & {
  valor: number;
  categoria?: string | null;
  descricao?: string | null;
  fornecedor_id?: string | null;
  compra_estoque?: boolean | null;
};

const p2 = (n: number) => String(n).padStart(2, "0");

/** Primeiro dia do mês, `meses` meses antes (texto YYYY-MM-DD). */
function inicioMesAnterior(data: string, meses: number): string {
  const [a, m] = data.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 - meses, 1));
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-01`;
}

/** Último dia do mês seguinte (texto YYYY-MM-DD). */
function fimMesSeguinte(data: string): string {
  const [a, m] = data.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(a, m + 1, 0));
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

const mensagemErro = (e: unknown): string =>
  (e && typeof e === "object" && "message" in e && String((e as { message: unknown }).message)) || String(e);

// Uma geração por conta de origem de cada vez (nesta aba): a segunda espera a
// primeira e encontra a próxima já criada.
const filaPorConta = new Map<string, Promise<unknown>>();

export function gerarProximaRecorrente(
  cliente: ClienteSupabaseContas,
  entrada: EntradaProximaRecorrente,
): Promise<ResultadoProximaRecorrente> {
  // Antes de qualquer chamada: conta não recorrente segue exatamente como antes.
  if (entrada.recorrenteLocal !== true) return Promise.resolve({ status: "ignorada", motivo: "nao_recorrente" });
  if (entrada.contaId.startsWith("venda_")) return Promise.resolve({ status: "ignorada", motivo: "virtual" });
  if (entrada.quitadaAntes) return Promise.resolve({ status: "ignorada", motivo: "ja_quitada_antes" });

  const anterior = filaPorConta.get(entrada.contaId) ?? Promise.resolve();
  const atual = anterior.then(() => gerar(cliente, entrada));
  filaPorConta.set(entrada.contaId, atual);
  atual.finally(() => {
    if (filaPorConta.get(entrada.contaId) === atual) filaPorConta.delete(entrada.contaId);
  });
  return atual;
}

async function gerar(cliente: ClienteSupabaseContas, entrada: EntradaProximaRecorrente): Promise<ResultadoProximaRecorrente> {
  try {
    // 1. Estado REAL da conta (o gatilho do banco já recalculou o status).
    const { data: conta, error: erroConta } = await cliente
      .from("contas")
      .select(COLUNAS_CONTA_ORIGEM)
      .eq("id", entrada.contaId)
      .maybeSingle();
    if (erroConta) return { status: "erro", mensagem: mensagemErro(erroConta) };
    if (!conta) return { status: "ignorada", motivo: "nao_encontrada" };
    const origem = conta as LinhaConta;
    if (origem.recorrente !== true) return { status: "ignorada", motivo: "nao_recorrente" };
    if (!deveGerarProxima(origem)) return { status: "ignorada", motivo: "nao_quitada" };

    // 2. Ocorrências da série por perto: 3 meses antes (dia fixo) até o fim do
    //    mês seguinte (já existe a próxima?). Mesma regra de filial de antes.
    const dataOrigem = String(origem.data).slice(0, 10);
    let consulta = cliente
      .from("contas")
      .select("id, user_id, empresa_id, nome, tipo, data, recorrente")
      .eq("user_id", entrada.targetUserId)
      .eq("tipo", origem.tipo)
      .eq("recorrente", true)
      .gte("data", inicioMesAnterior(dataOrigem, 3))
      .lte("data", fimMesSeguinte(dataOrigem));
    consulta = origem.empresa_id
      ? consulta.or(`empresa_id.eq.${origem.empresa_id},empresa_id.is.null`)
      : consulta.is("empresa_id", null);
    const { data: proximas, error: erroSerie } = await consulta;
    if (erroSerie) return { status: "erro", mensagem: mensagemErro(erroSerie) };

    const serie = { user_id: entrada.targetUserId, empresa_id: origem.empresa_id ?? null, nome: origem.nome, tipo: origem.tipo };
    const nome = normalizarNomeConta(origem.nome);
    const linhas = ((proximas || []) as LinhaConta[]).filter((c) => c.id !== origem.id);
    const datasSerie = linhas
      .filter((c) => normalizarNomeConta(c.nome) === nome && String(c.data).slice(0, 10) <= dataOrigem)
      .map((c) => String(c.data));
    const proxima = deveGerarProxima(origem, diaFixoDaSerie([dataOrigem, ...datasSerie]));
    if (!proxima) return { status: "ignorada", motivo: "nao_quitada" };

    // 3. Já existe? Não insere.
    if (ocorrenciaJaExiste(serie, proxima, linhas)) return { status: "ja_existe", data: proxima.data };

    // 4. Insere com os mesmos campos de antes (useContas, marcarComoPaga) + o
    //    modelo da conta de origem. valor_pago/data_pagamento ficam no default (0 / null).
    const { error: erroInsert } = await cliente.from("contas").insert({
      nome: origem.nome,
      tipo: origem.tipo,
      valor: origem.valor,
      data: proxima.data,
      status: "pendente",
      recorrente: true,
      categoria: origem.categoria || null,
      descricao: origem.descricao || null,
      fornecedor_id: origem.fornecedor_id || null,
      empresa_id: origem.empresa_id ?? null,
      user_id: entrada.targetUserId,
      ...(origem.compra_estoque ? { compra_estoque: true } : {}),
      // Só envia quando true (default da coluna é false): conta antiga = payload de antes.
      ...(origem.usa_historico_pagamentos ? { usa_historico_pagamentos: true } : {}),
    });
    if (erroInsert) return { status: "erro", mensagem: mensagemErro(erroInsert) };

    return { status: "gerada", data: proxima.data, ano: proxima.ano, mes: proxima.mes };
  } catch (e) {
    return { status: "erro", mensagem: mensagemErro(e) };
  }
}

export interface AvisoProximaRecorrente {
  title: string;
  description: string;
  variant?: "destructive";
}

/** Toast do resultado: sucesso SÓ quando gerou; erro claro dizendo que o pagamento ficou. */
export function avisoDaProximaRecorrente(r: ResultadoProximaRecorrente, nomeConta: string): AvisoProximaRecorrente | null {
  if (r.status === "gerada") {
    const mes = new Date(r.ano, r.mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { title: "Conta recorrente gerada", description: `A próxima parcela de "${nomeConta}" foi criada para ${mes}.` };
  }
  if (r.status === "erro") {
    return {
      title: "Próxima conta recorrente não foi gerada",
      description: `O pagamento foi registrado, mas não foi possível criar a próxima parcela de "${nomeConta}". Cadastre-a manualmente. (${r.mensagem})`,
      variant: "destructive",
    };
  }
  return null;
}

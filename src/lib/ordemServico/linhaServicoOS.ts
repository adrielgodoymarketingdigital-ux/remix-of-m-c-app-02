import type { ServicoRealizado } from "../../types/ordem-servico";

/**
 * Campos opcionais da linha de serviço da OS (avarias.servicos_realizados)
 * para serviço repetido / quantidade. Nenhuma OS existente tem esses campos:
 * ausentes, a linha vale como sempre (quantidade 1, sem vínculo a dispositivo).
 * `preco`, `custo` e `lucro` continuam sendo o TOTAL da linha — quem soma
 * linhas (relatórios, dashboard, comissão %) não precisa conhecer a quantidade.
 */
export type CamposNovosLinhaServico = Pick<
  ServicoRealizado,
  "linha_id" | "quantidade" | "preco_unitario" | "custo_unitario" | "dispositivo_ref"
>;

// Parâmetros como `object` (e não interfaces só com campos opcionais) para
// aceitar a linha de qualquer OS, inclusive a antiga, sem nenhum campo novo.

/** Quantidade da linha: inteiro ≥ 1; ausente ou inválida vale 1. */
export function quantidadeLinhaServico(s: object | null | undefined): number {
  const q = Number((s as { quantidade?: unknown } | null | undefined)?.quantidade);
  return Number.isInteger(q) && q >= 1 ? q : 1;
}

/** Cópia da linha com `quantidade` sempre preenchida (ausente vira 1). */
export function normalizarLinhaServico<T extends object>(s: T): T & { quantidade: number } {
  return { ...s, quantidade: quantidadeLinhaServico(s) };
}

/** Nome para impressão/recibo: "3x Formatação" quando quantidade > 1; senão só o nome. */
export function nomeLinhaServico(s: { nome?: string | null; quantidade?: unknown }): string {
  const nome = s.nome ?? "";
  const q = quantidadeLinhaServico(s);
  return q > 1 ? `${q}x ${nome}` : nome;
}

/** Chave React da linha: linha_id quando existe, senão o índice (o id do serviço pode se repetir). */
export function chaveLinhaServico(s: object, indice: number): string {
  const linhaId = (s as { linha_id?: unknown }).linha_id;
  return typeof linhaId === "string" && linhaId !== "" ? linhaId : String(indice);
}

/**
 * Lê da linha salva só os campos novos válidos, para o assistente preservá-los
 * ao reabrir e regravar a OS. Devolve undefined quando a linha não tem nenhum
 * (toda OS antiga) — assim o que é gravado continua idêntico ao de hoje.
 */
export function extrairCamposNovosLinhaServico(s: unknown): CamposNovosLinhaServico | undefined {
  if (!s || typeof s !== "object") return undefined;
  const o = s as Record<string, unknown>;
  const campos: CamposNovosLinhaServico = {};
  if (typeof o.linha_id === "string" && o.linha_id !== "") campos.linha_id = o.linha_id;
  if (o.quantidade !== undefined && o.quantidade !== null) campos.quantidade = quantidadeLinhaServico(o);
  if (typeof o.preco_unitario === "number" && Number.isFinite(o.preco_unitario)) campos.preco_unitario = o.preco_unitario;
  if (typeof o.custo_unitario === "number" && Number.isFinite(o.custo_unitario)) campos.custo_unitario = o.custo_unitario;
  if (typeof o.dispositivo_ref === "string" && o.dispositivo_ref !== "") campos.dispositivo_ref = o.dispositivo_ref;
  return Object.keys(campos).length > 0 ? campos : undefined;
}

// ---------------------------------------------------------------------------
// Linha no FORMULÁRIO da OS (assistente). Lá o objeto é o Servico do catálogo,
// cujo `quantidade` é do CATÁLOGO — a quantidade da linha mora só em
// `linha_os`. `preco`, `custo` e `peca_valor` do formulário são o TOTAL da
// linha (como é gravado), para que as somas de hoje (valorLinhaServico,
// resumo, total da OS, comissão %) continuem certas sem conhecer a quantidade.
// ---------------------------------------------------------------------------

export interface LinhaServicoForm {
  id: string;
  nome: string;
  preco: number;
  custo?: number | null;
  peca_valor?: number;
  linha_os?: CamposNovosLinhaServico;
}

const centavos = (v: number): number => Math.round(v * 100) / 100;

/** Quantidade da linha do formulário (de linha_os; sem ela, 1). */
export function quantidadeLinhaForm(s: object): number {
  return quantidadeLinhaServico((s as { linha_os?: CamposNovosLinhaServico }).linha_os);
}

/** Nome com "3x" para a linha do formulário (ignora o `quantidade` do catálogo). */
export function nomeLinhaForm(s: { nome: string; linha_os?: CamposNovosLinhaServico }): string {
  return nomeLinhaServico({ nome: s.nome, quantidade: quantidadeLinhaForm(s) });
}

/**
 * Chave da linha no formulário: linha_id quando existe, senão o id do serviço.
 * Sem linha_id é exatamente a chave de hoje (o seletor não deixava repetir).
 */
export function chaveLinhaForm(s: { id: string; linha_os?: CamposNovosLinhaServico }): string {
  return s.linha_os?.linha_id || s.id;
}

/** Preço e custo UNITÁRIOS da linha (custo = peça quando houver peca_valor). */
export function unitariosLinhaForm(s: LinhaServicoForm): { quantidade: number; precoUnitario: number; custoUnitario: number } {
  const quantidade = quantidadeLinhaForm(s);
  const custoTotal = Number(s.peca_valor ?? s.custo) || 0;
  return {
    quantidade,
    precoUnitario: s.linha_os?.preco_unitario ?? centavos((Number(s.preco) || 0) / quantidade),
    custoUnitario: s.linha_os?.custo_unitario ?? centavos(custoTotal / quantidade),
  };
}

/**
 * Grava na linha os valores unitários e a quantidade, recalculando os totais
 * (preco, custo e — se a linha usa peca_valor — peca_valor). Garante linha_id.
 */
export function definirLinhaForm<T extends LinhaServicoForm>(
  s: T,
  valores: { quantidade?: number; precoUnitario?: number; custoUnitario?: number },
  novoLinhaId: () => string,
): T & { linha_os: CamposNovosLinhaServico } {
  const atual = unitariosLinhaForm(s);
  const quantidade = quantidadeLinhaServico({ quantidade: valores.quantidade ?? atual.quantidade });
  const precoUnitario = valores.precoUnitario ?? atual.precoUnitario;
  const custoUnitario = valores.custoUnitario ?? atual.custoUnitario;
  const custoTotal = centavos(custoUnitario * quantidade);
  return {
    ...s,
    preco: centavos(precoUnitario * quantidade),
    custo: custoTotal,
    ...(s.peca_valor !== undefined ? { peca_valor: custoTotal } : {}),
    linha_os: {
      ...s.linha_os,
      linha_id: s.linha_os?.linha_id || novoLinhaId(),
      quantidade,
      preco_unitario: precoUnitario,
      custo_unitario: custoUnitario,
    },
  };
}

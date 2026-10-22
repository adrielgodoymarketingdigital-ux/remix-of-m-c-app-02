/**
 * Plano da importação de uma NF-e de compra (etapa 2: só calcula e mostra;
 * nada é gravado). Para cada item: o que fazer (vincular / cadastrar como novo
 * / ignorar), quantidade inteira que entra no estoque, custo por unidade e a
 * previsão do custo médio; no fim, o resumo e as pendências.
 *
 * Dinheiro sempre em CENTAVOS inteiros; produtos de decimais (vUnCom × qCom,
 * qCom × fator) em BigInt exato, arredondando meio-para-cima só no fim.
 * Nunca soma de float.
 *
 * Custo por unidade (padrão):
 *   (vUnCom × qCom + vFrete + vSeg + vOutro + vIPI + vICMSST + vFCPST − vDesc) ÷ quantidade final
 * arredondado em centavos. O lojista pode digitar outro custo por item.
 *
 * Sem React nem imports "@/": testado com Deno em scripts/testes-xml-compra/.
 */
import { calcularCustoMedio } from "../estoque/custoMedio.ts";
import { decimalParaCentavos, type ItemNfe, type ResultadoLeituraNfe } from "./lerXmlNfe.ts";
import type { DadosTributaveisItem } from "./dadosTributaveisNfe.ts";
import type { CandidatoEstoque, SugestaoVinculo, TipoCadastro } from "./sugestaoVinculo.ts";

// ---------------------------------------------------------------------------
// Decimais exatos
// ---------------------------------------------------------------------------

interface Escalado {
  valor: bigint;
  casas: number;
}

const pot10 = (n: number) => 10n ** BigInt(n);

function escalar(inteiro: string, fracao: string): Escalado {
  return { valor: BigInt(inteiro + fracao), casas: fracao.length };
}

/** Decimal do XML ("2.5000"). */
function lerDecimalXml(v: string): Escalado | null {
  const m = /^(\d{1,15})(?:\.(\d{1,10}))?$/.exec(v);
  return m ? escalar(m[1], m[2] ?? "") : null;
}

/** Digitado pelo lojista: "12", "12,5", "12.5" (sem separador de milhar). */
export function lerDecimalUsuario(texto: string, maxCasas: number): Escalado | null {
  const m = new RegExp(`^(\\d{1,9})(?:[.,](\\d{1,${maxCasas}}))?$`).exec(texto.trim());
  return m ? escalar(m[1], m[2] ?? "") : null;
}

/** num ÷ den arredondando meio-para-cima (num, den ≥ 0). */
const dividirArredondando = (num: bigint, den: bigint) => (2n * num + den) / (2n * den);

function escaladoParaTexto(e: Escalado): string {
  if (e.casas === 0) return e.valor.toString();
  const s = e.valor.toString().padStart(e.casas + 1, "0");
  const inteiro = s.slice(0, -e.casas);
  const fracao = s.slice(-e.casas).replace(/0+$/, "");
  return fracao ? `${inteiro}.${fracao}` : inteiro;
}

const ehZero = (e: Escalado) => e.valor === 0n;

/** "12,50" → 1250; vazio → null; inválido → NaN. */
export function lerCustoUsuario(texto: string): number | null {
  if (!texto.trim()) return null;
  const e = lerDecimalUsuario(texto, 2);
  if (!e) return NaN;
  return Number(e.valor * pot10(2 - e.casas));
}

export const centavosParaTexto = (c: number) => (c / 100).toFixed(2).replace(".", ",");

// ---------------------------------------------------------------------------
// Quantidade e fator
// ---------------------------------------------------------------------------

/** Unidades que já são "1 unidade de estoque" (fator 1 por padrão). */
const UNIDADES_SIMPLES = new Set(["UN", "UND", "UNID", "UNIDADE", "PC", "PCS", "PÇ", "PCA", "PECA", "PEÇA", "U"]);
const unidadeSimples = (u: string) => UNIDADES_SIMPLES.has(u.trim().toUpperCase());

export interface FatorSugerido {
  fator: string;
  /** "tributavel" = veio de qTrib ÷ qCom (ex.: 1 CX = 12 UN). */
  origem: "tributavel" | null;
}

/** Fator padrão: qTrib ÷ qCom quando a unidade tributável é diferente e a conta dá inteiro > 1. */
export function sugerirFator(item: Pick<ItemNfe, "uCom" | "qCom">, trib?: DadosTributaveisItem | null): FatorSugerido {
  const q = lerDecimalXml(item.qCom);
  const qt = trib?.qTrib ? lerDecimalXml(trib.qTrib) : null;
  if (!q || !qt || ehZero(q) || !trib?.uTrib) return { fator: "1", origem: null };
  if (trib.uTrib.trim().toUpperCase() === item.uCom.trim().toUpperCase()) return { fator: "1", origem: null };
  // qt/q exato: (qt.valor/10^qt.casas) ÷ (q.valor/10^q.casas)
  const num = qt.valor * pot10(q.casas);
  const den = q.valor * pot10(qt.casas);
  if (num % den !== 0n) return { fator: "1", origem: null };
  const fator = num / den;
  return fator > 1n ? { fator: fator.toString(), origem: "tributavel" } : { fator: "1", origem: null };
}

export interface ResultadoQuantidade {
  /** Quantidade final inteira (> 0) que entra no estoque; null = com erro. */
  inteira: number | null;
  /** qCom × fator exato, como texto ("18", "1.5"). */
  calculada: string;
  erro: string | null;
  /** Mostrar os campos de quantidade/fator (fracionado, caixa ou fator ≠ 1). */
  precisaAjuste: boolean;
}

export function calcularQuantidade(item: Pick<ItemNfe, "uCom" | "qCom">, fatorTexto: string, quantidadeManual: string): ResultadoQuantidade {
  const q = lerDecimalXml(item.qCom);
  const f = lerDecimalUsuario(fatorTexto || "1", 4);
  const fracionado = !!q && q.valor % pot10(q.casas) !== 0n;
  const precisaAjuste = fracionado || !unidadeSimples(item.uCom) || (fatorTexto.trim() !== "" && fatorTexto.trim() !== "1");

  if (!q) return { inteira: null, calculada: "", erro: "Quantidade da nota inválida.", precisaAjuste: true };
  if (!f || ehZero(f)) return { inteira: null, calculada: "", erro: "Fator de conversão inválido (use um número maior que zero, ex.: 12).", precisaAjuste: true };

  const produto: Escalado = { valor: q.valor * f.valor, casas: q.casas + f.casas };
  const calculada = escaladoParaTexto(produto);

  if (quantidadeManual.trim()) {
    const m = lerDecimalUsuario(quantidadeManual, 4);
    if (!m || m.valor % pot10(m.casas) !== 0n || ehZero(m)) {
      return { inteira: null, calculada, erro: "A quantidade a entrar no estoque precisa ser um número inteiro maior que zero.", precisaAjuste: true };
    }
    return { inteira: Number(m.valor / pot10(m.casas)), calculada, erro: null, precisaAjuste: true };
  }

  if (ehZero(produto)) return { inteira: null, calculada, erro: "Quantidade zero.", precisaAjuste: true };
  if (produto.valor % pot10(produto.casas) !== 0n) {
    return {
      inteira: null,
      calculada,
      erro: `Quantidade ${calculada.replace(".", ",")} não é inteira. O estoque só aceita inteiros: ajuste o fator ou informe a quantidade.`,
      precisaAjuste: true,
    };
  }
  return { inteira: Number(produto.valor / pot10(produto.casas)), calculada, erro: null, precisaAjuste };
}

// ---------------------------------------------------------------------------
// Custo
// ---------------------------------------------------------------------------

export interface ParcelaCusto {
  rotulo: string;
  centavos: number;
  sinal: 1 | -1;
}

export interface ResultadoCusto {
  /** Total do item (soma das parcelas), em centavos. */
  totalCentavos: number;
  /** Total ÷ quantidade final, em centavos; null sem quantidade válida. */
  unitarioCentavos: number | null;
  parcelas: ParcelaCusto[];
  erro: string | null;
}

const centavos = (v: string) => (v ? decimalParaCentavos(v) ?? 0 : 0);

export function calcularCustoItem(item: ItemNfe, quantidade: number | null): ResultadoCusto {
  const vUn = lerDecimalXml(item.vUnCom);
  const q = lerDecimalXml(item.qCom);
  if (!vUn || !q) return { totalCentavos: 0, unitarioCentavos: null, parcelas: [], erro: "Valor unitário ou quantidade da nota inválidos." };

  // vUnCom × qCom em centavos, exato: (vUn × q × 100) ÷ 10^(casas) arredondado.
  const produtos = Number(dividirArredondando(vUn.valor * q.valor * 100n, pot10(vUn.casas + q.casas)));
  const parcelas: ParcelaCusto[] = [
    { rotulo: "Produtos (valor unitário × quantidade da nota)", centavos: produtos, sinal: 1 },
    { rotulo: "Frete", centavos: centavos(item.vFrete), sinal: 1 },
    { rotulo: "Seguro", centavos: centavos(item.vSeg), sinal: 1 },
    { rotulo: "Outras despesas", centavos: centavos(item.vOutro), sinal: 1 },
    { rotulo: "IPI", centavos: centavos(item.vIPI), sinal: 1 },
    { rotulo: "ICMS-ST", centavos: centavos(item.vST), sinal: 1 },
    { rotulo: "FCP-ST", centavos: centavos(item.vFCPST), sinal: 1 },
    { rotulo: "Desconto", centavos: centavos(item.vDesc), sinal: -1 },
  ].filter((p, i) => i === 0 || p.centavos > 0) as ParcelaCusto[];

  const total = parcelas.reduce((s, p) => s + p.sinal * p.centavos, 0);
  if (total < 0) return { totalCentavos: total, unitarioCentavos: null, parcelas, erro: "O desconto é maior que o valor do item." };
  const unitario = quantidade && quantidade > 0 ? Number(dividirArredondando(BigInt(total), BigInt(quantidade))) : null;
  return { totalCentavos: total, unitarioCentavos: unitario, parcelas, erro: null };
}

/** Custo médio previsto (mesma regra da RPC registrar_entrada_estoque), em centavos. */
export function preverCustoMedio(candidato: Pick<CandidatoEstoque, "quantidade" | "custo">, quantidade: number, custoUnitarioCentavos: number): number {
  return Math.round(calcularCustoMedio(candidato.quantidade, candidato.custo, quantidade, custoUnitarioCentavos / 100) * 100);
}

// ---------------------------------------------------------------------------
// Decisão por item e linha do plano
// ---------------------------------------------------------------------------

export type AcaoItem = "vincular" | "novo" | "ignorar";

export interface DecisaoItem {
  acao: AcaoItem;
  /** Produto/peça escolhido (sugestão ou troca manual). */
  vinculo: CandidatoEstoque | null;
  /** Ao vincular, de onde veio: sugestão automática ou escolha manual. */
  origemVinculo: SugestaoVinculo["motivo"] | "manual" | null;
  tipoNovo: TipoCadastro;
  fator: string;
  /** Vazio = usa qCom × fator. */
  quantidadeManual: string;
  /** Vazio = usa o custo calculado. */
  custoManual: string;
  /** null = segue a opção geral "Atualizar custo médio". */
  atualizarCustoMedio: boolean | null;
}

export const ehAparelho = (item: Pick<ItemNfe, "imeisSugeridos">) => item.imeisSugeridos.length > 0;

/** Sugestão vira proposta (o lojista vê e pode trocar); sem sugestão = cadastrar como novo. */
export function decisaoInicial(item: ItemNfe, sugestao: SugestaoVinculo | null, trib?: DadosTributaveisItem | null): DecisaoItem {
  return {
    acao: sugestao ? "vincular" : "novo",
    vinculo: sugestao?.candidato ?? null,
    origemVinculo: sugestao?.motivo ?? null,
    tipoNovo: "produto",
    fator: sugerirFator(item, trib).fator,
    quantidadeManual: "",
    custoManual: "",
    atualizarCustoMedio: null,
  };
}

export type SituacaoLinha = "importar" | "ignorado" | "aparelho" | "erro";

export interface LinhaPlano {
  nItem: number;
  xProd: string;
  situacao: SituacaoLinha;
  decisao: DecisaoItem;
  quantidade: ResultadoQuantidade;
  custo: ResultadoCusto;
  /** Custo final por unidade (digitado ou calculado), centavos. */
  custoUnitarioCentavos: number | null;
  custoTotalCentavos: number | null;
  /** Só vínculo: custo atual do cadastro e custo depois da entrada (centavos). */
  custoAtualCentavos: number | null;
  custoDepoisCentavos: number | null;
  atualizaCustoMedio: boolean;
  erros: string[];
}

export function montarLinha(item: ItemNfe, decisao: DecisaoItem, atualizarCustoMedioGeral: boolean): LinhaPlano {
  const quantidade = calcularQuantidade(item, decisao.fator, decisao.quantidadeManual);
  const custo = calcularCustoItem(item, quantidade.inteira);
  const base = {
    nItem: item.nItem,
    xProd: item.xProd,
    decisao,
    quantidade,
    custo,
    custoUnitarioCentavos: null,
    custoTotalCentavos: null,
    custoAtualCentavos: null,
    custoDepoisCentavos: null,
    atualizaCustoMedio: false,
    erros: [] as string[],
  };

  if (ehAparelho(item)) return { ...base, situacao: "aparelho" };
  if (decisao.acao === "ignorar") return { ...base, situacao: "ignorado" };

  const erros: string[] = [];
  if (decisao.acao === "vincular" && !decisao.vinculo) erros.push("Escolha o produto a vincular.");
  if (quantidade.erro) erros.push(quantidade.erro);

  let unitario: number | null = custo.unitarioCentavos;
  const manual = lerCustoUsuario(decisao.custoManual);
  if (manual !== null) {
    if (Number.isNaN(manual)) erros.push("Custo digitado inválido (use, por exemplo, 12,50).");
    unitario = Number.isNaN(manual) ? null : manual;
  } else if (custo.erro) {
    erros.push(custo.erro);
  }

  const vinculado = decisao.acao === "vincular" ? decisao.vinculo : null;
  const atualiza = !!vinculado && (decisao.atualizarCustoMedio ?? atualizarCustoMedioGeral);
  const custoAtual = vinculado && vinculado.custo !== null ? Math.round(vinculado.custo * 100) : null;
  let custoDepois: number | null = null;
  if (vinculado && quantidade.inteira !== null && unitario !== null) {
    custoDepois = atualiza ? preverCustoMedio(vinculado, quantidade.inteira, unitario) : custoAtual;
  }

  return {
    ...base,
    situacao: erros.length ? "erro" : "importar",
    custoUnitarioCentavos: unitario,
    custoTotalCentavos: unitario !== null && quantidade.inteira !== null ? unitario * quantidade.inteira : null,
    custoAtualCentavos: custoAtual,
    custoDepoisCentavos: custoDepois,
    atualizaCustoMedio: atualiza,
    erros,
  };
}

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

export interface PendenciaImportacao {
  nItem?: number;
  texto: string;
}

export interface ResumoImportacao {
  notaInvalida: boolean;
  numero: string;
  serie: string;
  chave: string;
  fornecedor: string;
  fornecedorDocumento: string | null;
  totalItens: number;
  aImportar: number;
  vinculados: number;
  novos: number;
  ignorados: number;
  aparelhos: number;
  comErro: number;
  /** Soma das quantidades inteiras dos itens a importar. */
  unidades: number;
  custoTotalCentavos: number;
  pendencias: PendenciaImportacao[];
  /** Não bloqueiam (ex.: dois itens no mesmo produto). */
  avisos: PendenciaImportacao[];
  /** Tudo certo para a etapa de gravar (que ainda não existe). */
  prontoParaGravar: boolean;
}

export function resumirImportacao(resultado: ResultadoLeituraNfe, linhas: LinhaPlano[]): ResumoImportacao {
  const nota = resultado.nota;
  const vazio: ResumoImportacao = {
    notaInvalida: true,
    numero: nota?.numero ?? "",
    serie: nota?.serie ?? "",
    chave: nota?.chave ?? "",
    fornecedor: nota?.emitente.nome ?? "",
    fornecedorDocumento: nota?.emitente.cnpj ?? nota?.emitente.cpf ?? null,
    totalItens: resultado.itens.length,
    aImportar: 0,
    vinculados: 0,
    novos: 0,
    ignorados: 0,
    aparelhos: 0,
    comErro: 0,
    unidades: 0,
    custoTotalCentavos: 0,
    pendencias: [],
    avisos: [],
    prontoParaGravar: false,
  };
  if (!resultado.ok || !nota) return vazio;

  // PONTO DA ETAPA DE GRAVAR: antes de liberar a confirmação, consultar se a
  // chave de acesso (nota.chave) já foi importada por este dono
  // (compras_xml_importadas, UNIQUE (user_id, chave_acesso)) e, se sim, entrar
  // em `pendencias` ("Esta nota já foi importada em dd/mm"). A RPC de gravação
  // confere de novo (a constraint é a garantia de verdade).

  const r: ResumoImportacao = { ...vazio, notaInvalida: false };
  const porProduto = new Map<string, number[]>();
  for (const l of linhas) {
    if (l.situacao === "aparelho") r.aparelhos++;
    else if (l.situacao === "ignorado") r.ignorados++;
    else if (l.situacao === "erro") {
      r.comErro++;
      for (const e of l.erros) r.pendencias.push({ nItem: l.nItem, texto: e });
    } else {
      r.aImportar++;
      if (l.decisao.acao === "vincular") r.vinculados++;
      else r.novos++;
      r.unidades += l.quantidade.inteira ?? 0;
      r.custoTotalCentavos += l.custoTotalCentavos ?? 0;
      if (l.decisao.acao === "vincular" && l.decisao.vinculo) {
        const chave = `${l.decisao.vinculo.tipo}:${l.decisao.vinculo.id}`;
        porProduto.set(chave, [...(porProduto.get(chave) ?? []), l.nItem]);
      }
    }
  }
  for (const itens of porProduto.values()) {
    if (itens.length > 1) r.avisos.push({ texto: `Os itens ${itens.join(", ")} estão vinculados ao mesmo produto (as quantidades somam).` });
  }
  if (r.aImportar === 0 && r.comErro === 0) r.pendencias.push({ texto: "Nenhum item marcado para importar." });
  r.prontoParaGravar = r.pendencias.length === 0;
  return r;
}

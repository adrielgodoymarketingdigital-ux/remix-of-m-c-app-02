/**
 * Lógica da tela "Personalizar recibo de venda" que não depende de React:
 * agrupamento dos interruptores, contadores dos textos, detecção de
 * alterações e o que a prévia ainda não desenha. Testado com Deno em
 * scripts/testes-recibo-venda-novo/reciboVendaConfigTela.test.ts.
 */
import {
  CAMPOS_TEXTO_RECIBO_VENDA,
  type CampoTextoReciboVenda,
  contarCaracteresVisiveis,
  type InterruptorReciboVenda,
  LIMITES_TEXTOS_RECIBO_VENDA,
  limparTextoRecibo,
  normalizarReciboVendaConfig,
  RECIBO_VENDA_CONFIG_PADRAO,
  type TextosReciboVenda,
  VERSAO_RECIBO_VENDA_CONFIG,
} from "./reciboVendaConfig.ts";
import type { ReciboVendaModelo } from "./reciboVendaModelo.ts";

// ── Interruptores agrupados ─────────────────────────────────────────────────

export type GrupoInterruptoresReciboVenda = "cabecalho" | "cliente" | "itens" | "valores" | "garantiaAssinaturas" | "rodape";

/** Ordem da tela. Cada um dos 17 interruptores aparece em exatamente um grupo. */
export const GRUPOS_INTERRUPTORES_RECIBO_VENDA: readonly { id: GrupoInterruptoresReciboVenda; interruptores: readonly InterruptorReciboVenda[] }[] = [
  { id: "cabecalho", interruptores: ["logo", "contatos_cabecalho", "qr", "loja_cnpj"] },
  { id: "cliente", interruptores: ["cliente_cpf", "cliente_telefone", "cliente_endereco"] },
  { id: "itens", interruptores: ["fotos_itens", "detalhes_aparelho", "valor_unitario"] },
  { id: "valores", interruptores: ["descontos", "troca", "parcelas"] },
  { id: "garantiaAssinaturas", interruptores: ["garantias", "assinaturas", "vendedor"] },
  { id: "rodape", interruptores: ["rodape"] },
];

/** O que o recibo sempre mostra (não vira interruptor). Chaves de texto da tela. */
export const SEMPRE_APARECE_RECIBO_VENDA = ["numeroData", "itens", "total", "formaPagamento", "seloCancelada"] as const;

// ── Contadores ──────────────────────────────────────────────────────────────

const SEM_LIMITE = Number.MAX_SAFE_INTEGER;

export interface ContagemTextoRecibo {
  caracteres: number;
  linhas: number;
  maxCaracteres: number;
  maxLinhas: number;
  passouCaracteres: boolean;
  passouLinhas: boolean;
  passou: boolean;
}

/**
 * Contagem ao vivo do que vai ser gravado: o texto já limpo como na gravação
 * (espaços e linhas em branco a mais não contam), sem cortar, para a pessoa ver
 * que passou do limite em vez de perder texto calada.
 */
export function contarTextoRecibo(campo: CampoTextoReciboVenda, texto: unknown): ContagemTextoRecibo {
  const { caracteres: maxCaracteres, linhas: maxLinhas } = LIMITES_TEXTOS_RECIBO_VENDA[campo];
  const limpo = limparTextoRecibo(texto, SEM_LIMITE, SEM_LIMITE);
  const caracteres = contarCaracteresVisiveis(limpo);
  const linhas = limpo === "" ? 0 : limpo.split("\n").length;
  const passouCaracteres = caracteres > maxCaracteres;
  const passouLinhas = linhas > maxLinhas;
  return { caracteres, linhas, maxCaracteres, maxLinhas, passouCaracteres, passouLinhas, passou: passouCaracteres || passouLinhas };
}

const objetoSimples = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/** Textos do rascunho como a tela tem (qualquer coisa que não seja texto = ""). */
function textosDoRascunho(rascunho: unknown): Record<CampoTextoReciboVenda, unknown> {
  const textos = objetoSimples(rascunho) && objetoSimples(rascunho.textos) ? rascunho.textos : {};
  return Object.fromEntries(CAMPOS_TEXTO_RECIBO_VENDA.map((k) => [k, textos[k]])) as Record<CampoTextoReciboVenda, unknown>;
}

/** Campos acima do limite (o Salvar fica desligado enquanto houver algum). */
export function textosPassandoDoLimite(rascunho: unknown): CampoTextoReciboVenda[] {
  const textos = textosDoRascunho(rascunho);
  return CAMPOS_TEXTO_RECIBO_VENDA.filter((k) => contarTextoRecibo(k, textos[k]).passou);
}

// ── Alterações ──────────────────────────────────────────────────────────────

/**
 * Forma comparável: interruptores normalizados e textos limpos SEM corte (um
 * texto que passou do limite não pode parecer igual ao salvo). Versão inválida
 * ou lixo = padrão, como na normalização.
 */
function formaComparavel(x: unknown): string {
  const cfg = normalizarReciboVendaConfig(x);
  const versaoOk = objetoSimples(x) && (x.versao === undefined || x.versao === VERSAO_RECIBO_VENDA_CONFIG);
  const brutos = textosDoRascunho(versaoOk ? x : null);
  const textos = Object.fromEntries(
    CAMPOS_TEXTO_RECIBO_VENDA.map((k) => [k, limparTextoRecibo(brutos[k], SEM_LIMITE, SEM_LIMITE)]),
  ) as unknown as TextosReciboVenda;
  return JSON.stringify({ mostrar: cfg.mostrar, textos });
}

/** true quando salvar o rascunho mudaria o recibo salvo (só espaços a mais não contam). */
export function haAlteracoesReciboVendaConfig(salvo: unknown, rascunho: unknown): boolean {
  return formaComparavel(salvo) !== formaComparavel(rascunho);
}

/** true quando o rascunho já é o padrão ("Restaurar padrão" não teria efeito). */
export function rascunhoEhPadraoReciboVenda(rascunho: unknown): boolean {
  return !haAlteracoesReciboVendaConfig(RECIBO_VENDA_CONFIG_PADRAO, rascunho);
}

// ── Prévia ──────────────────────────────────────────────────────────────────

export type ItemForaDaPrevia = "assinaturas" | "rodape" | "topo" | "observacoes" | "politicaTroca";

/**
 * O que o ReciboVendaNovo de hoje ainda não desenha (chega na Fase 4):
 * assinaturas/rodapé desligados (o componente espera os blocos) e os blocos
 * de texto novos.
 */
export function itensForaDaPrevia(m: ReciboVendaModelo): ItemForaDaPrevia[] {
  const fora: ItemForaDaPrevia[] = [];
  if (m.assinaturas === null) fora.push("assinaturas");
  if (m.rodape === null) fora.push("rodape");
  if (m.textos?.topo) fora.push("topo");
  if (m.textos?.observacoes) fora.push("observacoes");
  if (m.textos?.politicaTroca) fora.push("politicaTroca");
  return fora;
}

/**
 * Modelo que o ReciboVendaNovo de hoje desenha sem quebrar: assinaturas e
 * rodapé desligados viram blocos vazios (a prévia os esconde por CSS).
 */
export function modeloDesenhavelNaPrevia(m: ReciboVendaModelo): ReciboVendaModelo {
  if (m.assinaturas !== null && m.rodape !== null) return m;
  return {
    ...m,
    assinaturas: m.assinaturas ?? { vendedor: "", comprador: "" },
    rodape: m.rodape ?? { agradecimento: "", frase: "", contatos: [] },
  };
}

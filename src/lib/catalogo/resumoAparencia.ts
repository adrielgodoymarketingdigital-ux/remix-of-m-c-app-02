// Resumo da aparência do Catálogo (tela do computador, passo Aparência): só o que o catálogo online
// (CatalogoOnline) realmente aplica, com as MESMAS regras de lá. Nada de "fonte" nem "layout": o
// template não tem fonte, e `layout`/`tamanhoFonte`/`layoutGrid` não são lidos pelo catálogo online.
// Só tipos aqui (o deno test roda sem o alias @/): a lista de templates (TEMPLATES_PADRAO) chega por parâmetro.
import type { ConfiguracaoCatalogo, TemplatesCatalogo } from "@/types/catalogo";

/** Template em uso: o salvo ou, se o id não existir, o primeiro (mesma regra do CatalogoOnline). */
export function templateEmUso(templates: readonly TemplatesCatalogo[], templateId: string | null | undefined): TemplatesCatalogo {
  return templates.find((t) => t.id === templateId) ?? templates[0];
}

export type ChaveCor = "primaria" | "cabecalho" | "fundo" | "texto";

export interface CorEmUso {
  chave: ChaveCor;
  hex: string;
  /** true quando vem de uma cor personalizada (aba Visual), e não do template. */
  personalizada: boolean;
}

type CamposCor = Pick<
  ConfiguracaoCatalogo,
  "templateId" | "corPrimariaPersonalizada" | "corHeaderPersonalizada" | "corFundoPersonalizada" | "corTextoPersonalizada"
>;

/** As 4 cores que o catálogo online usa (preço/destaques, cabeçalho, fundo e texto). */
export function coresEmUso(templates: readonly TemplatesCatalogo[], config: CamposCor): CorEmUso[] {
  const t = templateEmUso(templates, config.templateId);
  const cabecalhoPersonalizado = config.corHeaderPersonalizada || config.corPrimariaPersonalizada;
  return [
    { chave: "primaria", hex: config.corPrimariaPersonalizada || t.cores.primaria, personalizada: Boolean(config.corPrimariaPersonalizada) },
    { chave: "cabecalho", hex: cabecalhoPersonalizado || t.cores.primaria, personalizada: Boolean(cabecalhoPersonalizado) },
    { chave: "fundo", hex: config.corFundoPersonalizada || t.cores.fundo, personalizada: Boolean(config.corFundoPersonalizada) },
    { chave: "texto", hex: config.corTextoPersonalizada || t.cores.texto, personalizada: Boolean(config.corTextoPersonalizada) },
  ];
}

/** Bolinhas do cartão do template: as cores do próprio template (sem as personalizadas). */
export function coresDoTemplate(t: TemplatesCatalogo): string[] {
  return [t.cores.primaria, t.cores.secundaria, t.cores.destaque];
}

export type CabecalhoEmUso = "imagem" | "simples" | "gradiente" | "minimalista";

/**
 * Cabeçalho que o catálogo online desenha: com imagem de fundo, ela manda; sem imagem, "Com imagem
 * de fundo" cai na cor sólida (o switch do CatalogoOnline não tem caso para "imagem").
 */
export function cabecalhoEmUso(config: Partial<Pick<ConfiguracaoCatalogo, "imagemFundoUrl" | "estiloHeader">>): CabecalhoEmUso {
  if (config.imagemFundoUrl) return "imagem";
  if (config.estiloHeader === "gradiente" || config.estiloHeader === "minimalista") return config.estiloHeader;
  return "simples";
}

export type LogoEmUso = "oculto" | "proprio" | "loja" | "nenhum";

export function logoEmUso(
  config: Partial<Pick<ConfiguracaoCatalogo, "mostrarLogo" | "logoPersonalizadoUrl">>,
  logoDaLoja: string | null | undefined,
): LogoEmUso {
  if (config.mostrarLogo === false) return "oculto";
  if (config.logoPersonalizadoUrl) return "proprio";
  if (logoDaLoja) return "loja";
  return "nenhum";
}

export interface CartoesEmUso {
  borda: "arredondada" | "quadrada" | "sutil";
  sombra: "nenhuma" | "leve" | "media" | "forte";
  espacamento: "compacto" | "normal" | "amplo";
}

/** Padrões iguais aos do CatalogoOnline (default dos switches). */
export function cartoesEmUso(config: Partial<Pick<ConfiguracaoCatalogo, "bordaCards" | "sombraCards" | "espacamentoCards">>): CartoesEmUso {
  const borda = config.bordaCards === "quadrada" || config.bordaCards === "sutil" ? config.bordaCards : "arredondada";
  const sombra =
    config.sombraCards === "nenhuma" || config.sombraCards === "leve" || config.sombraCards === "forte" ? config.sombraCards : "media";
  const espacamento =
    config.espacamentoCards === "compacto" || config.espacamentoCards === "amplo" ? config.espacamentoCards : "normal";
  return { borda, sombra, espacamento };
}

/** Escolher um template: o mesmo que a ConfiguracaoTemplates faz (só troca o templateId). */
export function escolherTemplate<C extends Pick<ConfiguracaoCatalogo, "templateId">>(config: C, templateId: string): C {
  return { ...config, templateId };
}

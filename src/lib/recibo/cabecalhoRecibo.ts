/**
 * Cabeçalho dos recibos de venda: logo à esquerda e os dados da loja ao lado
 * (em vez de empilhados), para o recibo ficar mais baixo e gastar menos papel.
 * Um só lugar para todos os recibos de venda — PDV, histórico de Vendas,
 * Dispositivos vendidos (HTML) e o PDF (que usa só as contas de encaixe).
 * Sem React nem navegador: testado com Deno em scripts/testes-recibo-cabecalho/.
 *
 * Sem logo (não cadastrado ou "mostrar logo" desligado), os dados usam a
 * largura toda, centralizados, como antes. Logo muito alto ou muito largo é
 * limitado pela altura e pela largura máximas do formato, sem distorcer.
 */

export type FormatoRecibo = "a4" | "80mm" | "58mm";

/** Caixa máxima do logo por formato (mm). O logo cabe nela sem distorcer. */
export const LIMITES_LOGO_MM: Record<FormatoRecibo, { larguraMm: number; alturaMm: number }> = {
  "58mm": { larguraMm: 14, alturaMm: 14 },
  "80mm": { larguraMm: 22, alturaMm: 22 },
  a4: { larguraMm: 30, alturaMm: 22 },
};

/**
 * Faixa escura (recibo de Dispositivos): letras do tamanho que ela já usava e,
 * no A4, logo até 12mm de altura (o limite de antes era 44px ≈ 11,6mm) — a faixa não fica mais alta que antes.
 */
export const FONTES_CABECALHO_COMPACTO_PX: Record<FormatoRecibo, { nome: number; linha: number }> = {
  "58mm": { nome: 11, linha: 8 },
  "80mm": { nome: 12, linha: 9 },
  a4: { nome: 14, linha: 9 },
};
export const ALTURA_LOGO_COMPACTO_A4_MM = 12;

/** Espaço entre o logo e os dados (mm). */
export const ESPACO_LOGO_DADOS_MM: Record<FormatoRecibo, number> = { "58mm": 1.5, "80mm": 2, a4: 4 };

/** Tamanho das letras do cabeçalho (px, como o resto dos recibos HTML). */
export const FONTES_CABECALHO_PX: Record<FormatoRecibo, { nome: number; linha: number }> = {
  "58mm": { nome: 11, linha: 9 },
  "80mm": { nome: 13, linha: 11 },
  a4: { nome: 18, linha: 11 },
};

export interface DadosLojaCabecalho {
  nome_loja?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
}

const texto = (v: string | null | undefined) => (typeof v === "string" ? v.trim() : "");

export type CampoLoja = "cnpj" | "endereco" | "telefone" | "whatsapp" | "email";
export const TODOS_CAMPOS_LOJA: CampoLoja[] = ["cnpj", "endereco", "telefone", "whatsapp", "email"];

/**
 * Linhas de dados da loja ao lado do nome, sempre nesta ordem; campos vazios
 * ficam de fora. `campos` limita quais entram (cada recibo mantém os que já
 * mostrava — os de Dispositivos não têm WhatsApp nem e-mail).
 */
export function linhasDadosLoja(loja: DadosLojaCabecalho | null | undefined, campos: CampoLoja[] = TODOS_CAMPOS_LOJA): string[] {
  if (!loja) return [];
  const valor: Record<CampoLoja, string> = {
    cnpj: texto(loja.cnpj) && `CNPJ: ${texto(loja.cnpj)}`,
    endereco: texto(loja.endereco),
    telefone: texto(loja.telefone) && `Tel: ${texto(loja.telefone)}`,
    whatsapp: texto(loja.whatsapp) && `WhatsApp: ${texto(loja.whatsapp)}`,
    email: texto(loja.email),
  };
  return TODOS_CAMPOS_LOJA.filter((c) => campos.includes(c) && valor[c]).map((c) => valor[c]);
}

/** Campos do cabeçalho dos recibos de Dispositivos vendidos (HTML e PDF A4), os mesmos de antes. */
export const CAMPOS_LOJA_RECIBO_DISPOSITIVO: CampoLoja[] = ["cnpj", "endereco", "telefone"];
/** PDF térmico (58/80mm) de Dispositivos: só CNPJ e telefone, como antes (endereço longo dobraria a altura). */
export const CAMPOS_LOJA_PDF_TERMICO: CampoLoja[] = ["cnpj", "telefone"];

/**
 * Tamanho do logo dentro da caixa máxima do formato, mantendo a proporção da
 * imagem (o maior que couber). Medidas inválidas → null (segue sem logo).
 */
export function encaixarLogo(larguraOriginal: number, alturaOriginal: number, formato: FormatoRecibo): { larguraMm: number; alturaMm: number } | null {
  if (!Number.isFinite(larguraOriginal) || !Number.isFinite(alturaOriginal) || larguraOriginal <= 0 || alturaOriginal <= 0) return null;
  const { larguraMm, alturaMm } = LIMITES_LOGO_MM[formato];
  const escala = Math.min(larguraMm / larguraOriginal, alturaMm / alturaOriginal);
  const arred = (v: number) => Math.round(v * 100) / 100;
  return { larguraMm: arred(larguraOriginal * escala), alturaMm: arred(alturaOriginal * escala) };
}

export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EntradaCabecalhoRecibo {
  /** URL ou data URI do logo; null/vazio = sem logo. */
  logoSrc: string | null | undefined;
  nomeLoja: string | null | undefined;
  /** Normalmente linhasDadosLoja(...); vazio quando "mostrar dados da loja" está desligado. */
  linhas: string[];
}

/**
 * HTML do cabeçalho (sem o título "RECIBO DE VENDA", que cada recibo mantém).
 * O mesmo HTML serve para os três formatos: o tamanho vem de cssCabecalhoRecibo.
 * Logo que não carrega some sem deixar espaço vazio.
 */
export function montarCabecalhoReciboHtml(e: EntradaCabecalhoRecibo): string {
  const logo = texto(e.logoSrc);
  const dados =
    `<div class="recibo-cab-dados">` +
    `<div class="recibo-cab-nome">${escaparHtml(texto(e.nomeLoja))}</div>` +
    e.linhas.map((l) => `<div class="recibo-cab-linha">${escaparHtml(l)}</div>`).join("") +
    `</div>`;
  if (!logo) return `<div class="recibo-cab recibo-cab--sem-logo">${dados}</div>`;
  return (
    `<div class="recibo-cab recibo-cab--com-logo">` +
    `<div class="recibo-cab-logo"><img src="${escaparHtml(logo)}" alt="Logo da Loja" ` +
    `onerror="this.parentNode.style.display='none';this.parentNode.parentNode.className='recibo-cab recibo-cab--sem-logo'" /></div>` +
    dados +
    `</div>`
  );
}

export interface OpcoesCssCabecalho {
  /** Seletor que limita as regras (ex.: a prévia dentro de um diálogo). */
  escopo?: string;
  /** "escuro": texto claro, para a faixa escura do recibo de Dispositivos (logo num quadro branco). */
  tema?: "claro" | "escuro";
  /** Letras menores e logo A4 mais baixo (FONTES_CABECALHO_COMPACTO_PX). */
  compacto?: boolean;
}

/** CSS do cabeçalho para um formato. Só classes recibo-cab-*: não mexe no corpo do recibo. */
export function cssCabecalhoRecibo(formato: FormatoRecibo, opcoes: OpcoesCssCabecalho = {}): string {
  const s = opcoes.escopo ? `${opcoes.escopo} ` : "";
  const { larguraMm } = LIMITES_LOGO_MM[formato];
  const alturaMm = opcoes.compacto && formato === "a4" ? ALTURA_LOGO_COMPACTO_A4_MM : LIMITES_LOGO_MM[formato].alturaMm;
  const espaco = ESPACO_LOGO_DADOS_MM[formato];
  const fonte = (opcoes.compacto ? FONTES_CABECALHO_COMPACTO_PX : FONTES_CABECALHO_PX)[formato];
  const termico = formato !== "a4";
  const escuro = opcoes.tema === "escuro";
  const corNome = escuro ? "#ffffff" : "#000";
  const corLinha = escuro ? "#d5dbe3" : "#000";
  return `
    ${s}.recibo-cab { display: flex; align-items: flex-start; gap: ${espaco}mm; width: 100%; }
    ${s}.recibo-cab--com-logo { text-align: left; }
    ${s}.recibo-cab--sem-logo { display: block; text-align: ${escuro ? "left" : "center"}; }
    ${s}.recibo-cab-logo { flex: 0 0 auto; max-width: ${larguraMm}mm;${escuro ? " background: #ffffff; padding: 1mm; border-radius: 1mm;" : ""} }
    ${s}.recibo-cab-logo img { display: block; width: auto; height: auto; max-width: ${larguraMm}mm; max-height: ${alturaMm}mm; object-fit: contain; margin: 0; }
    ${s}.recibo-cab-dados { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
    ${s}.recibo-cab-nome { font-size: ${fonte.nome}px; font-weight: 900; line-height: 1.2; color: ${corNome}; margin: 0; }
    ${s}.recibo-cab-linha { font-size: ${fonte.linha}px; font-weight: ${termico ? 700 : 600}; line-height: 1.3; color: ${corLinha}; margin: 0; }
  `;
}

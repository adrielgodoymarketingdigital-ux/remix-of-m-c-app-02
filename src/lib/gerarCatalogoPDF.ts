import jsPDF from "jspdf";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import type { ItemCatalogo } from "@/types/catalogo-item";
import { formatCurrency } from "./formatters";
import { ConfiguracaoCatalogo, TEMPLATES_PADRAO, CONFIG_PADRAO } from "@/types/catalogo";
import {
  agruparItensParaPdf,
  coresCatalogoPdf,
  corTextoSobre,
  encaixarProporcional,
  formatarGarantia,
  gradePdf,
  GrupoPdf,
  hexParaRgb,
  itemPodeIrParaPdf,
  luminancia,
  misturar,
  precoParaPdf,
  Rgb,
  textoSeguroPdf,
  totalItensGrupos,
} from "./catalogo/itensParaPdf";

/** Só os dados públicos da loja que o PDF usa. */
type DadosLojaPdf = Pick<ConfiguracaoLoja, "nome_loja" | "telefone" | "whatsapp" | "email" | "logo_url">;

interface CatalogoOptions {
  /** Itens já selecionados (ver itensParaPdf), na ordem da prévia. */
  itens: ItemCatalogo[];
  configuracaoLoja: DadosLojaPdf | null;
  config?: ConfiguracaoCatalogo;
}

export interface ImagemCarregada {
  dataUrl: string;
  formato: "PNG" | "JPEG";
  largura: number;
  altura: number;
}

export type CarregarImagem = (url: string, uso: "logo" | "foto") => Promise<ImagemCarregada | null>;

const PT_MM = 0.3528;
const BRANCO: Rgb = [255, 255, 255];
const PRETO: Rgb = [0, 0, 0];
const VERDE: Rgb = [22, 163, 74];
const VERMELHO: Rgb = [220, 38, 38];
const ROXO: Rgb = [147, 51, 234];
const CORES_CONDICAO: Record<string, Rgb> = {
  novo: [34, 197, 94],
  semi_novo: [59, 130, 246],
  usado: [249, 115, 22],
};
const ROTULO_CONDICAO: Record<string, string> = { novo: "Novo", semi_novo: "Semi-novo", usado: "Usado" };

function moeda(valor: number): string {
  return textoSeguroPdf(formatCurrency(valor));
}

function reticencias(doc: jsPDF, texto: string, maxLargura: number): string {
  if (doc.getTextWidth(texto) <= maxLargura) return texto;
  let t = texto;
  while (t.length > 0 && doc.getTextWidth(`${t}...`) > maxLargura) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

function linhasLimitadas(doc: jsPDF, texto: string, maxLargura: number, maxLinhas: number): string[] {
  const linhas = doc.splitTextToSize(texto, maxLargura) as string[];
  if (linhas.length <= maxLinhas) return linhas;
  const r = linhas.slice(0, maxLinhas);
  r[maxLinhas - 1] = reticencias(doc, linhas.slice(maxLinhas - 1).join(" "), maxLargura);
  return r;
}

async function carregarTodas(
  urls: { url: string; uso: "logo" | "foto" }[],
  carregar: CarregarImagem,
): Promise<Map<string, ImagemCarregada | null>> {
  const mapa = new Map<string, ImagemCarregada | null>();
  const fila = urls.filter((u, i) => urls.findIndex((x) => x.url === u.url) === i);
  const trabalhar = async () => {
    for (let prox = fila.shift(); prox; prox = fila.shift()) {
      try {
        mapa.set(prox.url, await carregar(prox.url, prox.uso));
      } catch {
        mapa.set(prox.url, null);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, trabalhar));
  return mapa;
}

/**
 * Monta o PDF sem baixar. Devolve null quando não há item válido (nunca gera
 * PDF vazio). Separado de gerarCatalogoPDF para poder ser testado fora do
 * navegador com um carregador de imagem falso.
 */
export async function montarDocumentoCatalogoPDF(
  options: CatalogoOptions,
  carregarImagem: CarregarImagem,
): Promise<{ doc: jsPDF; totalItens: number } | null> {
  const { configuracaoLoja } = options;
  const config: ConfiguracaoCatalogo = { ...CONFIG_PADRAO, ...(options.config || {}) };
  const textos = { ...CONFIG_PADRAO.textos, ...(config.textos || {}) };

  // Defesa extra: mesmo que a tela mande item oculto ou vendido, ele não entra.
  const itens = options.itens.filter(itemPodeIrParaPdf);
  const grupos: GrupoPdf[] = agruparItensParaPdf(itens, config.categoriasCatalogo);
  const totalItens = totalItensGrupos(grupos);
  if (totalItens === 0) return null;

  const template = TEMPLATES_PADRAO.find((t) => t.id === config.templateId) || TEMPLATES_PADRAO[0];
  const coresHex = coresCatalogoPdf(config, template);
  const corPrimaria = hexParaRgb(coresHex.primaria, hexParaRgb(template.cores.primaria));
  const corHeader = hexParaRgb(coresHex.header, corPrimaria);
  const corFundo = hexParaRgb(coresHex.fundo, BRANCO);
  const corTexto = hexParaRgb(coresHex.texto, [31, 41, 55]);
  const textoHeader = corTextoSobre(corHeader);
  const fundoEscuro = luminancia(corFundo) < 0.5;
  const fundoCard = fundoEscuro ? misturar(corFundo, BRANCO, 0.07) : BRANCO;
  const corSuave = misturar(corTexto, fundoCard, 0.45);
  const corLinha = misturar(fundoCard, corTexto, 0.14);
  const fundoFoto = misturar(fundoCard, corTexto, 0.05);
  // Preço na cor primária, a não ser que ela some no fundo do card.
  const corPreco = Math.abs(luminancia(corPrimaria) - luminancia(fundoCard)) < 0.25 ? corTexto : corPrimaria;

  const mostrarLogo = config.mostrarLogo !== false;
  const mostrarContato = config.mostrarContato !== false;
  const mostrarRodape = config.mostrarRodape !== false;
  const mostrarSubtitulo = config.mostrarSubtitulo !== false;
  const mostrarMarca = config.mostrarMarca !== false;

  // ---------- Imagens ----------
  const logoUrl = mostrarLogo ? config.logoPersonalizadoUrl || configuracaoLoja?.logo_url || null : null;
  const fotoDoItem = (item: ItemCatalogo) => item.fotos?.find(Boolean) || item.foto_url || null;
  const pedidos: { url: string; uso: "logo" | "foto" }[] = [];
  if (logoUrl) pedidos.push({ url: logoUrl, uso: "logo" });
  for (const g of grupos) {
    for (const item of g.itens) {
      const f = fotoDoItem(item);
      if (f) pedidos.push({ url: f, uso: "foto" });
    }
  }
  const imagens = await carregarTodas(pedidos, carregarImagem);
  const logo = logoUrl ? imagens.get(logoUrl) || null : null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 15;

  const desenharImagem = (img: ImagemCarregada, x: number, y: number, maxW: number, maxH: number, alias: string) => {
    const t = encaixarProporcional(img.largura, img.altura, maxW, maxH);
    if (t.largura <= 0) return;
    doc.addImage(img.dataUrl, img.formato, x + (maxW - t.largura) / 2, y + (maxH - t.altura) / 2, t.largura, t.altura, alias, "FAST");
  };

  const contatos: string[] = [];
  if (mostrarContato) {
    if (configuracaoLoja?.telefone) contatos.push(`Tel: ${configuracaoLoja.telefone}`);
    if (configuracaoLoja?.whatsapp) contatos.push(`WhatsApp: ${configuracaoLoja.whatsapp}`);
    if (configuracaoLoja?.email) contatos.push(configuracaoLoja.email);
  }
  const textoContatos = textoSeguroPdf(contatos.join("  |  "));
  const dataAtual = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const textoRodape = mostrarRodape ? textoSeguroPdf((textos.rodape || "").replace("{data}", dataAtual)) : "";
  const nomeLoja = textoSeguroPdf(configuracaoLoja?.nome_loja);

  // ==================== CAPA ====================
  doc.setFillColor(...corHeader);
  doc.rect(0, 0, W, H, "F");
  const faixa = misturar(corHeader, textoHeader, 0.18);
  doc.setFillColor(...faixa);
  doc.rect(0, 0, W, 6, "F");
  doc.rect(0, H - 6, W, 6, "F");

  let cy = 92;
  if (logo) {
    const t = encaixarProporcional(logo.largura, logo.altura, 110, 48);
    const pad = 7;
    const pw = t.largura + pad * 2;
    const ph = t.altura + pad * 2;
    const px = (W - pw) / 2;
    const py = 42;
    doc.setFillColor(...BRANCO);
    doc.roundedRect(px, py, pw, ph, 4, 4, "F");
    doc.addImage(logo.dataUrl, logo.formato, px + pad, py + pad, t.largura, t.altura, "logo", "FAST");
    cy = py + ph + 26;
  }

  doc.setTextColor(...textoHeader);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  const titulo = textoSeguroPdf(textos.tituloCapa) || nomeLoja || "Catálogo";
  for (const linha of linhasLimitadas(doc, titulo, W - 40, 3)) {
    doc.text(linha, W / 2, cy, { align: "center" });
    cy += 26 * PT_MM * 1.2;
  }

  if (mostrarSubtitulo && textos.subtituloCapa) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    cy += 1;
    for (const linha of linhasLimitadas(doc, textoSeguroPdf(textos.subtituloCapa), W - 50, 2)) {
      doc.text(linha, W / 2, cy, { align: "center" });
      cy += 13 * PT_MM * 1.3;
    }
  }

  cy += 6;
  doc.setDrawColor(...textoHeader);
  doc.setLineWidth(0.6);
  doc.line(W / 2 - 35, cy, W / 2 + 35, cy);
  cy += 14;

  if (nomeLoja && nomeLoja !== titulo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(reticencias(doc, nomeLoja, W - 40), W / 2, cy, { align: "center" });
    cy += 10;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${totalItens} ${totalItens === 1 ? "item" : "itens"}`, W / 2, cy, { align: "center" });

  doc.setFontSize(9.5);
  if (textoContatos) {
    const linhas = linhasLimitadas(doc, textoContatos, W - 30, 2);
    let yc = H - 22 - (linhas.length - 1) * 4.5;
    for (const l of linhas) {
      doc.text(l, W / 2, yc, { align: "center" });
      yc += 4.5;
    }
  }
  if (textoRodape) {
    doc.setFontSize(9);
    doc.text(reticencias(doc, textoRodape, W - 30), W / 2, H - (textoContatos ? 36 : 22), { align: "center" });
  }

  // ==================== PÁGINAS DE ITENS ====================
  const H_HDR = 22;
  const temRodapePagina = Boolean(textoContatos || textoRodape);
  const H_FTR = temRodapePagina ? 12 : 0;
  const topo = H_HDR + 7;
  const base = H - H_FTR - 7;
  const { colunas, linhas } = gradePdf(config.layoutGrid);
  const gap = config.espacamentoCards === "compacto" ? 3 : config.espacamentoCards === "amplo" ? 7 : 5;
  const temGrupos = grupos.some((g) => g.nome !== null);
  const alturaTitulo = temGrupos ? 10 : 0;
  const cardW = (W - 2 * M - gap * (colunas - 1)) / colunas;
  const cardH = (base - topo - alturaTitulo - gap * (linhas - 1)) / linhas;
  const raio = config.bordaCards === "quadrada" ? 0 : config.bordaCards === "sutil" ? 1 : 3;
  const sombra = config.sombraCards === "nenhuma" ? 0 : config.sombraCards === "leve" ? 0.6 : config.sombraCards === "forte" ? 1.4 : 0.9;
  const corSombra = misturar(corFundo, PRETO, config.sombraCards === "forte" ? 0.2 : 0.1);

  const ret = (x: number, y: number, w: number, h: number, r: number) => {
    if (r > 0) doc.roundedRect(x, y, w, h, r, r, "F");
    else doc.rect(x, y, w, h, "F");
  };

  const novaPagina = () => {
    doc.addPage();
    doc.setFillColor(...corFundo);
    doc.rect(0, 0, W, H, "F");
    doc.setFillColor(...corHeader);
    doc.rect(0, 0, W, H_HDR, "F");

    let xNome = M;
    if (logo) {
      const t = encaixarProporcional(logo.largura, logo.altura, 34, 13);
      const pad = 1.5;
      doc.setFillColor(...BRANCO);
      doc.roundedRect(M, (H_HDR - t.altura) / 2 - pad, t.largura + pad * 2, t.altura + pad * 2, 1.5, 1.5, "F");
      doc.addImage(logo.dataUrl, logo.formato, M + pad, (H_HDR - t.altura) / 2, t.largura, t.altura, "logo", "FAST");
      xNome = M + t.largura + pad * 2 + 5;
    }
    doc.setTextColor(...textoHeader);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(reticencias(doc, nomeLoja || titulo, W - M - xNome - 30), xNome, H_HDR / 2 + 1.6);

    if (temRodapePagina) {
      doc.setFillColor(...corHeader);
      doc.rect(0, H - H_FTR, W, H_FTR, "F");
      doc.setTextColor(...textoHeader);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const yF = H - H_FTR / 2 + 1.2;
      if (textoContatos && textoRodape) {
        const larguraRodape = Math.min(doc.getTextWidth(textoRodape), 70);
        doc.text(reticencias(doc, textoRodape, 70), M, yF);
        doc.text(reticencias(doc, textoContatos, W - 2 * M - larguraRodape - 8), W - M, yF, { align: "right" });
      } else {
        doc.text(reticencias(doc, textoContatos || textoRodape, W - 2 * M), W / 2, yF, { align: "center" });
      }
    }
  };

  const badge = (texto: string, x: number, y: number, cor: Rgb, s: number, corTxt: Rgb = BRANCO): number => {
    const f = 6.2 * s;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(f);
    const w = doc.getTextWidth(texto) + 3 * s;
    const h = f * PT_MM + 2.2 * s;
    doc.setFillColor(...cor);
    doc.roundedRect(x, y, w, h, 1, 1, "F");
    doc.setTextColor(...corTxt);
    doc.text(texto, x + 1.5 * s, y + h / 2 + f * PT_MM * 0.35);
    return w;
  };

  const desenharCard = (item: ItemCatalogo, x: number, y: number, w: number, h: number) => {
    const s = Math.max(0.78, Math.min(1.35, w / 87));
    const pad = Math.max(2.5, 3 * s);
    const isDevice = item.tipo_item === "dispositivo";

    if (sombra > 0) {
      doc.setFillColor(...corSombra);
      ret(x + sombra, y + sombra, w, h, raio);
    }
    doc.setFillColor(...fundoCard);
    ret(x, y, w, h, raio);
    doc.setDrawColor(...corLinha);
    doc.setLineWidth(0.2);
    if (raio > 0) doc.roundedRect(x, y, w, h, raio, raio, "S");
    else doc.rect(x, y, w, h, "S");

    // Preço (de baixo para cima)
    const preco = precoParaPdf(item, config.mostrarPrecos);
    const alturaPreco = 15 * s;
    const precoTopo = y + h - pad - alturaPreco;
    const alturaTextoMin = 17 * s;

    // Foto
    const fotoW = w - pad * 2;
    const fotoH = Math.max(10, Math.min(fotoW, h - pad * 2 - alturaPreco - alturaTextoMin));
    const fx = x + pad;
    const fy = y + pad;
    doc.setFillColor(...fundoFoto);
    ret(fx, fy, fotoW, fotoH, Math.min(raio, 2));
    const urlFoto = fotoDoItem(item);
    const foto = urlFoto ? imagens.get(urlFoto) || null : null;
    if (foto) {
      desenharImagem(foto, fx + 1, fy + 1, fotoW - 2, fotoH - 2, urlFoto as string);
    } else {
      doc.setTextColor(...corSuave);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5 * s);
      doc.text("Sem foto", fx + fotoW / 2, fy + fotoH / 2 + 1, { align: "center" });
    }

    // Selos sobre a foto
    let bx = fx + 1.5;
    const by = fy + 1.5;
    if (isDevice && config.mostrarCondicao !== false && item.condicao && ROTULO_CONDICAO[item.condicao]) {
      bx += badge(ROTULO_CONDICAO[item.condicao], bx, by, CORES_CONDICAO[item.condicao], s) + 1.2;
    }
    if (!isDevice) {
      badge(item.tipo_item === "produto" ? "Produto" : "Peça", bx, by, ROXO, s);
    }
    if (config.mostrarQuantidade && item.quantidade > 1) {
      const txt = `${item.quantidade} un.`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2 * s);
      const wq = doc.getTextWidth(txt) + 3 * s;
      badge(txt, fx + fotoW - 1.5 - wq, by, misturar(fundoCard, corTexto, 0.12), s, corTexto);
    }
    if (preco.tipo === "promocional" && config.mostrarDesconto !== false) {
      const hb = 6.2 * s * PT_MM + 2.2 * s;
      badge(`-${preco.descontoPercentual}%`, fx + 1.5, fy + fotoH - 1.5 - hb, VERMELHO, s);
    }

    // Textos entre a foto e o preço; o que não couber é omitido (nunca sobrepõe).
    const larguraTexto = w - pad * 2;
    const limite = precoTopo - 1;
    let ty = fy + fotoH + 2.2 * s;
    const escrever = (texto: string, tamanho: number, negrito: boolean, cor: Rgb, maxLinhas: number) => {
      if (!texto) return;
      doc.setFont("helvetica", negrito ? "bold" : "normal");
      doc.setFontSize(tamanho);
      const fmm = tamanho * PT_MM;
      for (const linha of linhasLimitadas(doc, texto, larguraTexto, maxLinhas)) {
        if (ty + fmm * 1.15 > limite) return;
        doc.setTextColor(...cor);
        doc.text(linha, x + pad, ty + fmm * 0.85);
        ty += fmm * 1.2;
      }
      ty += 0.4 * s;
    };

    if (isDevice && item.marca && mostrarMarca) {
      escrever(textoSeguroPdf(item.marca).toUpperCase(), 6.5 * s, false, corSuave, 1);
      escrever(textoSeguroPdf(item.modelo || item.nome), 9.5 * s, true, corTexto, 2);
    } else {
      escrever(textoSeguroPdf(isDevice ? item.modelo || item.nome : item.nome), 9.5 * s, true, corTexto, 2);
    }

    if (isDevice) {
      const specs: string[] = [];
      if (config.mostrarCapacidade !== false && item.capacidade_gb) specs.push(`${item.capacidade_gb}GB`);
      if (config.mostrarBateria && item.saude_bateria) specs.push(`Bateria ${item.saude_bateria}%`);
      if (config.mostrarCor !== false && item.cor) specs.push(textoSeguroPdf(item.cor));
      escrever(specs.join("  ·  "), 7 * s, false, corSuave, 1);
      if (config.mostrarGarantia && item.garantia) {
        const tempo = item.tempo_garantia || 0;
        const txt = tempo > 0 ? (textos.textoGarantia || "Garantia de {tempo}").replace("{tempo}", formatarGarantia(tempo)) : "Com garantia";
        escrever(textoSeguroPdf(txt), 7 * s, true, VERDE, 1);
      }
    }

    // Bloco de preço
    doc.setDrawColor(...corLinha);
    doc.setLineWidth(0.2);
    doc.line(x + pad, precoTopo, x + w - pad, precoTopo);
    const yValor = y + h - pad - 0.6;
    const fValor = 12 * s;
    const fRotulo = 6 * s;
    const fRiscado = 7.5 * s;
    if (preco.tipo === "consulte") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5 * s);
      doc.setTextColor(...corSuave);
      doc.text("Consulte", x + pad, yValor - 1.2 * s);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fValor);
      doc.setTextColor(...(preco.tipo === "promocional" ? VERDE : corPreco));
      doc.text(reticencias(doc, moeda(preco.valor), larguraTexto), x + pad, yValor);
      let yAcima = yValor - fValor * PT_MM * 1.15;
      if (preco.tipo === "promocional") {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fRiscado);
        doc.setTextColor(...corSuave);
        const original = moeda(preco.original);
        doc.text(original, x + pad, yAcima);
        const wo = doc.getTextWidth(original);
        doc.setDrawColor(...corSuave);
        doc.setLineWidth(0.3);
        const yRisco = yAcima - fRiscado * PT_MM * 0.33;
        doc.line(x + pad - 0.3, yRisco, x + pad + wo + 0.3, yRisco);
        yAcima -= fRiscado * PT_MM * 1.2;
      }
      const rotulo = textoSeguroPdf(textos.textoPreco);
      if (rotulo && yAcima - fRotulo * PT_MM > precoTopo + 0.3) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fRotulo);
        doc.setTextColor(...corSuave);
        doc.text(reticencias(doc, rotulo, larguraTexto), x + pad, yAcima);
      }
    }
  };

  const desenharTitulo = (grupo: GrupoPdf, y: number, continuacao: boolean) => {
    const cor = hexParaRgb(grupo.cor, corPrimaria);
    doc.setFillColor(...cor);
    doc.circle(M + 2, y + 4.2, 1.8, "F");
    doc.setTextColor(...corTexto);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const nome = reticencias(doc, textoSeguroPdf(grupo.nome) + (continuacao ? " (continuação)" : ""), W - 2 * M - 30);
    doc.text(nome, M + 6, y + 5.6);
    const wn = doc.getTextWidth(nome);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...corSuave);
    doc.text(`(${grupo.itens.length})`, M + 6 + wn + 2, y + 5.6);
  };

  let y = topo;
  novaPagina();
  for (const grupo of grupos) {
    let idx = 0;
    while (idx < grupo.itens.length) {
      const tituloAqui = grupo.nome !== null ? alturaTitulo : 0;
      if (y + tituloAqui + cardH > base + 0.01) {
        novaPagina();
        y = topo;
      }
      if (grupo.nome !== null) {
        desenharTitulo(grupo, y, idx > 0);
        y += alturaTitulo;
      }
      while (idx < grupo.itens.length && y + cardH <= base + 0.01) {
        const linha = grupo.itens.slice(idx, idx + colunas);
        linha.forEach((item, c) => desenharCard(item, M + c * (cardW + gap), y, cardW, cardH));
        idx += colunas;
        y += cardH + gap;
      }
    }
    y += 2;
  }

  // Numeração (depois, porque só agora sabemos o total de páginas)
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 2; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setTextColor(...textoHeader);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Página ${p - 1} de ${totalPaginas - 1}`, W - M, H_HDR / 2 + 1.4, { align: "right" });
  }

  return { doc, totalItens };
}

/** Carrega uma imagem no navegador já convertida para PNG (logo) ou JPEG (foto), com o tamanho real. */
async function carregarImagemNavegador(url: string, uso: "logo" | "foto"): Promise<ImagemCarregada | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = objUrl;
      });
      const largura = img.naturalWidth;
      const altura = img.naturalHeight;
      if (!largura || !altura) return null;
      const max = uso === "logo" ? 1000 : 700;
      const escala = Math.min(1, max / Math.max(largura, altura));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(largura * escala));
      canvas.height = Math.max(1, Math.round(altura * escala));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      if (uso === "foto") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const formato = uso === "logo" ? "PNG" : "JPEG";
      const dataUrl = canvas.toDataURL(formato === "PNG" ? "image/png" : "image/jpeg", 0.85);
      return { dataUrl, formato, largura, altura };
    } finally {
      URL.revokeObjectURL(objUrl);
    }
  } catch (error) {
    console.error("Erro ao carregar imagem do catálogo:", error);
    return null;
  }
}

/**
 * Gera e baixa o PDF. Devolve quantos itens foram para o PDF; 0 = nada foi
 * baixado (lista vazia).
 */
export async function gerarCatalogoPDF(options: CatalogoOptions): Promise<number> {
  const resultado = await montarDocumentoCatalogoPDF(options, carregarImagemNavegador);
  if (!resultado) return 0;
  const nomeLoja = options.configuracaoLoja?.nome_loja?.toLowerCase().replace(/\s+/g, "-") || "catalogo";
  resultado.doc.save(`catalogo-${nomeLoja}-${new Date().toISOString().split("T")[0]}.pdf`);
  return resultado.totalItens;
}

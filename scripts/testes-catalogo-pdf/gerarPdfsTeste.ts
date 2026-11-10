// Gera PDFs de conferência visual do Catálogo com dados FICTÍCIOS (sem rede, sem Supabase).
// Uso: deno run -A --no-check --node-modules-dir=manual scripts/testes-catalogo-pdf/gerarPdfsTeste.ts /tmp/catalogo-pdf-testes
// As imagens são PNGs gerados aqui, com círculos: se algo for esticado, o círculo vira elipse.
import { deflateSync } from "node:zlib";
import { Buffer } from "node:buffer";
import { montarDocumentoCatalogoPDF, type ImagemCarregada } from "../../src/lib/gerarCatalogoPDF.ts";
import { itensParaPdf } from "../../src/lib/catalogo/itensParaPdf.ts";
import { CONFIG_PADRAO, type ConfiguracaoCatalogo } from "../../src/types/catalogo.ts";
import type { ItemCatalogo } from "../../src/types/catalogo-item.ts";

const saida = Deno.args[0];
if (!saida) throw new Error("informe a pasta de saída");
await Deno.mkdir(saida, { recursive: true });

// ---------- PNG mínimo ----------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(tipo: string, dados: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + dados.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, dados.length);
  out.set(new TextEncoder().encode(tipo), 4);
  out.set(dados, 8);
  dv.setUint32(8 + dados.length, crc32(out.subarray(4, 8 + dados.length)));
  return out;
}
type Px = (x: number, y: number) => [number, number, number];
function png(w: number, h: number, px: Px): string {
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 3 + 1) + 1 + x * 3);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const partes = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(deflateSync(raw))),
    chunk("IEND", new Uint8Array()),
  ];
  return `data:image/png;base64,${Buffer.concat(partes).toString("base64")}`;
}
const circulo = (w: number, h: number, fundo: [number, number, number], cor: [number, number, number], borda?: [number, number, number]): Px =>
  (x, y) => {
    const r = Math.min(w, h) * 0.38;
    const d = Math.hypot(x - w / 2, y - h / 2);
    if (borda && (x < 6 || y < 6 || x >= w - 6 || y >= h - 6)) return borda;
    return d < r ? cor : fundo;
  };

const IMAGENS: Record<string, ImagemCarregada> = {};
const registrar = (url: string, w: number, h: number, px: Px) => {
  IMAGENS[url] = { dataUrl: png(w, h, px), formato: "PNG", largura: w, altura: h };
};
// Logo largo 4:1 com um círculo à esquerda e faixa laranja.
registrar("fake://logo-largo.png", 800, 200, (x, y) => {
  if (Math.hypot(x - 100, y - 100) < 80) return [234, 88, 12];
  if (x > 220 && x < 760 && y > 70 && y < 130) return [30, 41, 59];
  return [255, 255, 255];
});
registrar("fake://celular.png", 300, 500, circulo(300, 500, [226, 232, 240], [37, 99, 235], [100, 116, 139]));
registrar("fake://capa.png", 400, 400, circulo(400, 400, [254, 243, 199], [217, 119, 6], [180, 83, 9]));
registrar("fake://tela.png", 500, 300, circulo(500, 300, [220, 252, 231], [22, 163, 74], [21, 128, 61]));

const carregarFalso = (url: string) => Promise.resolve(IMAGENS[url] ?? null);

// ---------- Dados fictícios ----------
const loja = {
  nome_loja: "Loja Fictícia Celulares",
  telefone: "(11) 4000-0000",
  whatsapp: "(11) 90000-0000",
  email: "contato@lojaficticia.local",
  logo_url: null as string | null,
};

const base = { quantidade: 1, created_at: "2026-11-01T00:00:00Z", fotos: [] as string[] };
const disp = (id: string, e: Partial<ItemCatalogo>): ItemCatalogo => ({
  ...base, id, tipo_item: "dispositivo", nome: `${e.marca} ${e.modelo}`, vendido: false, ...e,
});
const prod = (id: string, e: Partial<ItemCatalogo>): ItemCatalogo => ({ ...base, id, tipo_item: "produto", nome: "", ...e });
const peca = (id: string, e: Partial<ItemCatalogo>): ItemCatalogo => ({ ...base, id, tipo_item: "peca", nome: "", ...e });

const iphone = disp("d1", {
  marca: "Apple", modelo: "iPhone 15 Pro Max", tipo_dispositivo: "Celular", cor: "Titânio Natural", capacidade_gb: 256,
  condicao: "semi_novo", garantia: true, tempo_garantia: 3, saude_bateria: 92, preco: 6499, preco_promocional: 5899,
  fotos: ["fake://celular.png"],
});
const capinha = prod("p1", { nome: "Capinha Silicone Magsafe iPhone 15 Pro Max Transparente Antiamarelamento", preco: 89.9, fotos: ["fake://capa.png"], quantidade: 12 });
const tela = peca("c1", { nome: "Tela Frontal Samsung A54 Original", preco: null, fotos: ["fake://tela.png"] });

const misto: ItemCatalogo[] = [
  iphone,
  disp("d2", { marca: "Samsung", modelo: "Galaxy S24 Ultra", condicao: "novo", capacidade_gb: 512, cor: "Preto", preco: 7999, garantia: true, tempo_garantia: 12 }),
  disp("d3", { marca: "Motorola", modelo: "Moto G84", condicao: "usado", capacidade_gb: 128, cor: "Azul", preco: 999, preco_promocional: 999, fotos: ["fake://celular.png"] }),
  disp("d4", { marca: "Apple", modelo: "iPhone 11", condicao: "usado", preco: 1500, vendido: true }), // vendido: não entra
  disp("d5", { marca: "Xiaomi", modelo: "Redmi Note 13", condicao: "novo", preco: 1299, exibir_no_catalogo: false }), // oculto: não entra
  capinha,
  prod("p2", { nome: "Carregador Turbo 25W USB-C", preco: 129, preco_promocional: 99, fotos: ["fake://capa.png"] }),
  prod("p3", { nome: "Película 3D Vidro 📱 iPhone 13", preco: 39.9 }),
  prod("p4", { nome: "Fone Bluetooth", preco: 0 }),
  tela,
  peca("c2", { nome: "Bateria iPhone 12", preco: 249, fotos: ["fake://tela.png"] }),
  peca("c3", { nome: "Conector de Carga Moto G84", preco: 59, preco_promocional: 70 }),
];

const cfg = (e: Partial<ConfiguracaoCatalogo> = {}): ConfiguracaoCatalogo => ({ ...CONFIG_PADRAO, ...e });

const cenarios: { nome: string; itens: ItemCatalogo[]; config: ConfiguracaoCatalogo; logo?: string | null; selecao?: string[] }[] = [
  { nome: "01-um-dispositivo-promo-sem-logo", itens: [iphone], config: cfg() },
  { nome: "02-um-produto-logo-largo", itens: [capinha], config: cfg(), logo: "fake://logo-largo.png" },
  { nome: "03-uma-peca-sem-preco", itens: [tela], config: cfg({ templateId: "natureza" }), logo: "fake://logo-largo.png" },
  {
    nome: "04-misto-categorias-logo-largo",
    itens: misto,
    logo: "fake://logo-largo.png",
    config: cfg({
      categoriasCatalogo: [
        { id: "k1", nome: "Celulares", cor: "#2563eb", itemIds: ["d1", "d2", "d3", "d4", "d5"] },
        { id: "k2", nome: "Acessórios", cor: "#d97706", itemIds: ["p1", "p2", "p3"] },
        { id: "k3", nome: "Categoria vazia", itemIds: [] },
      ],
    }),
  },
  {
    nome: "05-cores-personalizadas-3x3-logo-personalizado",
    itens: misto,
    logo: null,
    config: cfg({
      layoutGrid: "3x3", itensPerPage: 9,
      logoPersonalizadoUrl: "fake://logo-largo.png",
      corPrimariaPersonalizada: "#be123c", corHeaderPersonalizada: "#111827",
      corFundoPersonalizada: "#fff1f2", corTextoPersonalizada: "#4c0519",
      textos: { ...CONFIG_PADRAO.textos, tituloCapa: "Ofertas de Novembro", subtituloCapa: "Seminovos revisados com garantia" },
    }),
  },
  {
    nome: "06-escuro-sem-contato-rodape-subtitulo-marca-logo",
    itens: misto,
    logo: "fake://logo-largo.png",
    selecao: ["d1", "d2", "p2", "c1", "d4"],
    config: cfg({ templateId: "escuro", mostrarLogo: false, mostrarContato: false, mostrarRodape: false, mostrarSubtitulo: false, mostrarMarca: false, layoutGrid: "2x2", itensPerPage: 4 }),
  },
  {
    nome: "07-cabecalho-claro-1x1",
    itens: [iphone, capinha],
    logo: "fake://logo-largo.png",
    config: cfg({ layoutGrid: "1x1", itensPerPage: 1, corHeaderPersonalizada: "#fde68a" }),
  },
];

const resumo: string[] = [];
for (const c of cenarios) {
  const itensPdf = itensParaPdf(c.itens, c.selecao ?? []);
  const r = await montarDocumentoCatalogoPDF(
    { itens: itensPdf, configuracaoLoja: { ...loja, logo_url: c.logo ?? null }, config: c.config },
    carregarFalso,
  );
  if (!r) throw new Error(`${c.nome}: esperava PDF`);
  const caminho = `${saida}/${c.nome}.pdf`;
  await Deno.writeFile(caminho, new Uint8Array(r.doc.output("arraybuffer")));
  resumo.push(`${c.nome}: ${r.totalItens} itens, ${r.doc.getNumberOfPages()} páginas`);
}

// Lista vazia: não gera PDF.
const vazio = itensParaPdf([disp("x", { marca: "A", modelo: "B", vendido: true }), prod("y", { nome: "Z", exibir_no_catalogo: false })], []);
const rVazio = await montarDocumentoCatalogoPDF({ itens: vazio, configuracaoLoja: loja, config: cfg() }, carregarFalso);
const rVazioDireto = await montarDocumentoCatalogoPDF({ itens: [prod("y", { nome: "Z", exibir_no_catalogo: false })], configuracaoLoja: loja, config: cfg() }, carregarFalso);
resumo.push(`08-lista-vazia: itensParaPdf=${vazio.length}, montarDocumento=${rVazio === null ? "null (sem PDF)" : "GEROU PDF!"}, oculto passado direto=${rVazioDireto === null ? "null (sem PDF)" : "GEROU PDF!"}`);

await Deno.writeTextFile(`${saida}/resumo.txt`, resumo.join("\n") + "\n");
console.log(resumo.join("\n"));

// Gera TODOS os relatórios exportados de Produtos e Peças com dados FICTÍCIOS e
// confere a opção "Mostrar custo e lucro". Não toca em banco.
// Rodar: bash scripts/relatorio-sem-custo/run.sh [pasta-de-saída]
//
// Modos (argv[3]):
//   antes  → só a chamada padrão (sem opção), para comparar com o código antigo.
//   depois → padrão, ligado (true) e desligado (false) + conferência de vazamento.
//
// Data fixa: o PDF leva a data de geração (texto e metadado). Com o relógio
// parado, dois PDFs iguais saem com os mesmos bytes e dá para comparar com cmp.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import type { ItemEstoque } from "@/types/produto";
import type { CategoriaProduto } from "@/types/categoria-produto";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import {
  exportarMaisVendidosPDF,
  exportarMenosEstoquePDF,
  exportarProdutosPDF,
  gerarCategoriasPDF,
} from "@/lib/exportarProdutosPDF";
import { gerarCategoriasWorkbook } from "@/lib/produtos/exportarCategoriasExcel";
import { agruparPorCategoria } from "@/lib/produtos/exportarPorCategoria";

const saida = process.argv[2] ?? ".";
const modo = process.argv[3] === "antes" ? "antes" : "depois";

// ── Relógio parado ───────────────────────────────────────────────────────
const FIXO = Date.UTC(2026, 10, 24, 15, 0, 0);
const DataReal = Date;
class DataFixa extends DataReal {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(FIXO);
    else super(...(args as [number]));
  }
  static now() {
    return FIXO;
  }
}
globalThis.Date = DataFixa as DateConstructor;

// ── doc.save → guarda os bytes em vez de baixar ─────────────────────────
// jsPDF.API são os "plugins": o construtor copia por cima dos métodos de fábrica.
let ultimoPdf: Uint8Array | null = null;
// O /ID do PDF é aleatório: fixo aqui para dar para comparar byte a byte.
const bytesDoPdf = (doc: jsPDF) => {
  doc.setFileId("0".repeat(32));
  return new Uint8Array(doc.output("arraybuffer"));
};
(jsPDF.API as unknown as { save: (nome: string) => void }).save = function (this: jsPDF) {
  ultimoPdf = bytesDoPdf(this);
};
async function capturar(fn: () => Promise<unknown>): Promise<Uint8Array> {
  ultimoPdf = null;
  await fn();
  if (!ultimoPdf) throw new Error("o gerador não chamou doc.save");
  return ultimoPdf;
}

// ── Dados fictícios (centavos "estranhos" no custo para não bater com preço/venda) ──
const cat = (id: string, nome: string, cor: string, pai: string | null = null): CategoriaProduto => ({
  id, nome, cor, categoria_pai_id: pai, user_id: "loja-ficticia", created_at: "2026-01-01T00:00:00Z",
});
const categorias: CategoriaProduto[] = [
  cat("cap", "Capas", "#22aa55"),
  cat("cap-ip", "iPhone", "#2255aa", "cap"),
  cat("tel", "Telas", "#aa2222"),
  cat("car", "Carregadores", "#555555"),
];
const nomeCat = (id: string | null) => categorias.find((c) => c.id === id)?.nome;
const prod = (id: string, nome: string, categoria_id: string | null, quantidade: number, custo: number, preco: number, sku?: string): ItemEstoque => ({
  id, nome, tipo: "produto", sku: sku ?? null, quantidade, custo, preco, lucro: preco - custo,
  created_at: "2026-01-01T00:00:00Z", categoria_id, categoria_nome: nomeCat(categoria_id),
});
const peca = (id: string, nome: string, categoria_id: string | null, quantidade: number, custo: number, preco: number, codigo_barras?: string): ItemEstoque => ({
  id, nome, tipo: "peca", codigo_barras, quantidade, custo, preco, created_at: "2026-01-01T00:00:00Z",
  categoria_id, categoria_nome: nomeCat(categoria_id),
});
const itens: ItemEstoque[] = [
  prod("1", "Capa generica transparente", "cap", 10, 3.17, 15, "CAP-001"),
  prod("2", "Capa iPhone 15 silicone", "cap-ip", 4, 12.43, 49.9, "CAP-IP15"),
  prod("3", "Capa iPhone 13 couro", "cap-ip", 0, 20.71, 79.9, "CAP-IP13"),
  peca("4", "Tela iPhone 11 incell", "tel", 3, 120.37, 280, "7891234567890"),
  peca("5", "Tela Galaxy A54 original", "tel", 1, 350.53, 650),
  prod("6", "Carregador 20W USB-C", "car", 8, 25.19, 69.9, "CAR-20W"),
  prod("7", "Pelicula 3D", null, 25, 1.61, 20),
];
const contagemVendas: Record<string, number> = { "1": 12, "2": 5, "4": 3, "6": 9 };
const config = { nome_loja: "Loja Ficticia de Teste", telefone: "(11) 0000-0000" } as ConfiguracaoLoja;
const grupos = agruparPorCategoria(itens, categorias);

// ── Geração ─────────────────────────────────────────────────────────────
type Variante = "padrao" | "ligado" | "desligado";
const variantes: Variante[] = modo === "antes" ? ["padrao"] : ["padrao", "ligado", "desligado"];
const opcaoDe = (v: Variante) => (v === "padrao" ? undefined : { mostrarCustoELucro: v === "ligado" });

type Relatorio = "completo" | "menos-estoque" | "mais-vendidos" | "categoria-pdf" | "categoria-xlsx";
const gerados: Record<Variante, Partial<Record<Relatorio, Uint8Array>>> = { padrao: {}, ligado: {}, desligado: {} };

// Chamadas como o app faz. A opção vai no último parâmetro; no modo "antes"
// ela não é passada (o código antigo não a conhece).
type Qualquer = (...a: unknown[]) => Promise<unknown>;
for (const v of variantes) {
  const op = opcaoDe(v);
  const extra = op ? [op] : [];
  const pasta = join(saida, v);
  mkdirSync(pasta, { recursive: true });

  gerados[v].completo = await capturar(() => (exportarProdutosPDF as unknown as Qualquer)(itens, config, ...extra));
  // Menor estoque e Mais vendidos não recebem a opção (não mostram custo/lucro).
  gerados[v]["menos-estoque"] = await capturar(() => exportarMenosEstoquePDF(itens, config, null));
  gerados[v]["mais-vendidos"] = await capturar(() => exportarMaisVendidosPDF(itens, contagemVendas, config));
  const docCat = await (gerarCategoriasPDF as unknown as Qualquer)(grupos, config, { ...(op ?? {}) }) as jsPDF;
  gerados[v]["categoria-pdf"] = bytesDoPdf(docCat);
  const wb = (gerarCategoriasWorkbook as unknown as (...a: unknown[]) => XLSX.WorkBook)(grupos, config.nome_loja ?? "", "24/11/2026", ...extra);
  gerados[v]["categoria-xlsx"] = new Uint8Array(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

  for (const [rel, bytes] of Object.entries(gerados[v])) {
    writeFileSync(join(pasta, `${rel}.${rel.endsWith("xlsx") ? "xlsx" : "pdf"}`), bytes!);
  }
}

if (modo === "antes") {
  console.log(`antes: ${Object.keys(gerados.padrao).length} arquivos em ${saida}/padrao`);
  process.exit(0);
}

// ── Conferência ─────────────────────────────────────────────────────────
const br = (n: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

// Valores que revelam margem (custo e lucro em todas as formas que aparecem).
const proibidos = new Set<number>();
for (const i of itens) {
  [i.custo, i.custo * i.quantidade, i.preco - i.custo, (i.preco - i.custo) * i.quantidade].forEach((n) => proibidos.add(r2(n)));
}
for (const g of grupos) [g.custo, g.lucro].forEach((n) => proibidos.add(r2(n)));
const totCusto = itens.reduce((s, i) => s + i.custo * i.quantidade, 0);
const totVenda = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
[totCusto, totVenda - totCusto].forEach((n) => proibidos.add(r2(n)));
proibidos.delete(0); // item com estoque 0 tem custo/lucro total 0; 0 também é quantidade válida.

// Valores que PODEM aparecer (não podem coincidir com os proibidos, senão o teste não prova nada).
const permitidos = new Set<number>();
for (const i of itens) [i.preco, i.preco * i.quantidade, i.quantidade].forEach((n) => permitidos.add(r2(n)));
for (const g of grupos) [g.venda, g.quantidade, g.itens.length].forEach((n) => permitidos.add(r2(n)));
permitidos.add(r2(totVenda));
Object.values(contagemVendas).forEach((n) => permitidos.add(n));
const colisao = [...proibidos].filter((n) => permitidos.has(n));
if (colisao.length) throw new Error(`dados fictícios mal escolhidos, colidem: ${colisao.join(", ")}`);

const PALAVRAS = /custo|lucro|margem|investido/i;

/** Texto de todas as strings do PDF (jsPDF grava sem compressão). */
function textoPdf(bytes: Uint8Array): string {
  const bruto = Buffer.from(bytes).toString("latin1");
  const partes: string[] = [];
  const re = /\(((?:\\[\s\S]|[^\\)])*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bruto))) {
    partes.push(
      m[1]
        .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
        .replace(/\\(.)/g, "$1"),
    );
  }
  return partes.join("\n").replace(/\u00a0/g, " ");
}
/** Valor "1.234,56" no texto, sem pegar pedaço de outro número. */
const temValor = (texto: string, n: number) =>
  new RegExp(`(^|[^\\d.,])${br(n).replace(/\./g, "\\.")}(?![\\d])`, "m").test(texto);

interface Achado { palavras: string[]; valores: number[] }
function conferirPdf(bytes: Uint8Array): Achado {
  const bruto = Buffer.from(bytes).toString("latin1");
  const texto = textoPdf(bytes);
  if (texto.length < 50) throw new Error("não consegui extrair texto do PDF");
  const palavras = [...new Set([...(bruto.match(new RegExp(PALAVRAS.source, "gi")) ?? []), ...(texto.match(new RegExp(PALAVRAS.source, "gi")) ?? [])].map((p) => p.toLowerCase()))];
  return { palavras, valores: [...proibidos].filter((n) => temValor(texto, n)) };
}
function conferirXlsx(bytes: Uint8Array): Achado & { abas: string[] } {
  const wb = XLSX.read(bytes, { type: "buffer" });
  const palavras = new Set<string>();
  const valores = new Set<number>();
  for (const nome of wb.SheetNames) {
    (nome.match(new RegExp(PALAVRAS.source, "gi")) ?? []).forEach((p) => palavras.add(`aba:${p.toLowerCase()}`));
    const ws = wb.Sheets[nome];
    for (const [ref, cel] of Object.entries(ws)) {
      if (ref.startsWith("!")) continue;
      const c = cel as XLSX.CellObject;
      if (typeof c.v === "string") (c.v.match(new RegExp(PALAVRAS.source, "gi")) ?? []).forEach((p) => palavras.add(p.toLowerCase()));
      if (typeof c.v === "number" && proibidos.has(r2(c.v))) valores.add(r2(c.v));
    }
  }
  return { palavras: [...palavras], valores: [...valores], abas: wb.SheetNames };
}

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? "OK  " : "FALHA"} ${msg}`);
  if (!cond) falhas++;
};
const conferir = (rel: Relatorio, b: Uint8Array) => (rel === "categoria-xlsx" ? conferirXlsx(b) : conferirPdf(b));

console.log(`Valores proibidos com a opção desligada (${proibidos.size}): ${[...proibidos].sort((a, b) => a - b).map(br).join(" | ")}\n`);

// Mostram custo/lucro hoje → ligado tem de ter; desligado não pode ter nada.
for (const rel of ["completo", "categoria-pdf", "categoria-xlsx"] as Relatorio[]) {
  const lig = conferir(rel, gerados.ligado[rel]!);
  const des = conferir(rel, gerados.desligado[rel]!);
  ok(lig.palavras.includes("custo") && lig.palavras.includes("lucro") && lig.valores.length > 0,
    `${rel} LIGADO tem custo/lucro (palavras: ${lig.palavras.join(",")}; ${lig.valores.length} valores)`);
  ok(des.palavras.length === 0, `${rel} DESLIGADO sem palavras de custo/lucro${des.palavras.length ? ": " + des.palavras.join(",") : ""}`);
  ok(des.valores.length === 0, `${rel} DESLIGADO sem valores de custo/lucro${des.valores.length ? ": " + des.valores.map(br).join(",") : ""}`);
  // O que fica: preço de venda e total de venda.
  const textoDes = rel === "categoria-xlsx" ? "" : textoPdf(gerados.desligado[rel]!);
  if (rel !== "categoria-xlsx") {
    ok(itens.every((i) => temValor(textoDes, i.preco)) && temValor(textoDes, totVenda),
      `${rel} DESLIGADO mantém preço de venda e venda total`);
  } else {
    const x = conferirXlsx(gerados.desligado[rel]!);
    ok(x.abas.length === grupos.length + 1, `${rel} DESLIGADO mantém Resumo + ${grupos.length} abas (${x.abas.join(" / ")})`);
  }
}
// Não mostram custo/lucro nem hoje → igual em todas as variantes, e sem nada de custo.
for (const rel of ["menos-estoque", "mais-vendidos"] as Relatorio[]) {
  const a = conferir(rel, gerados.padrao[rel]!);
  ok(a.palavras.length === 0 && a.valores.length === 0, `${rel} não tem custo/lucro em nenhuma variante (nada a esconder)`);
}

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);

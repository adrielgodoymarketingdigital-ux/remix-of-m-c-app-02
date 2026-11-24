// Gera um PDF e um XLSX de exemplo do "relatório por categoria" com dados FICTÍCIOS.
// Não toca em banco. Rodar: bash scripts/exportar-categorias/run.sh <pasta-de-saída>
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import type { ItemEstoque } from "@/types/produto";
import type { CategoriaProduto } from "@/types/categoria-produto";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { gerarCategoriasPDF } from "@/lib/exportarProdutosPDF";
import { gerarCategoriasWorkbook } from "@/lib/produtos/exportarCategoriasExcel";
import {
  SEM_CATEGORIA,
  agruparPorCategoria,
  alternarCategoria,
  filtrarItens,
  totaisGerais,
} from "@/lib/produtos/exportarPorCategoria";

const saida = process.argv[2] ?? ".";

const cat = (id: string, nome: string, cor: string, pai: string | null = null): CategoriaProduto => ({
  id, nome, cor, categoria_pai_id: pai, user_id: "loja-ficticia", created_at: "2026-01-01T00:00:00Z",
});
const categorias: CategoriaProduto[] = [
  cat("cap", "Capas", "#22aa55"),
  cat("cap-ip", "iPhone", "#2255aa", "cap"),
  cat("cap-sam", "Samsung", "#aa5522", "cap"),
  cat("tel", "Telas", "#aa2222"),
  cat("car", "Carregadores", "#555555"),
];

const prod = (id: string, nome: string, categoria_id: string | null, quantidade: number, custo: number, preco: number, sku?: string): ItemEstoque => ({
  id, nome, tipo: "produto", sku: sku ?? null, quantidade, custo, preco, lucro: preco - custo,
  created_at: "2026-01-01T00:00:00Z", categoria_id,
});
const peca = (id: string, nome: string, categoria_id: string | null, quantidade: number, custo: number, preco: number, codigo_barras?: string): ItemEstoque => ({
  id, nome, tipo: "peca", codigo_barras, quantidade, custo, preco, created_at: "2026-01-01T00:00:00Z", categoria_id,
});

const itens: ItemEstoque[] = [
  prod("1", "Capa genérica transparente", "cap", 10, 3, 15, "CAP-001"),
  prod("2", "Capa iPhone 15 silicone", "cap-ip", 4, 12.5, 49.9, "CAP-IP15"),
  prod("3", "Capa iPhone 13 couro", "cap-ip", 0, 20, 79.9, "CAP-IP13"),
  prod("4", "Capa Galaxy S23", "cap-sam", 6, 8, 35),
  peca("5", "Tela iPhone 11 incell", "tel", 3, 120, 280, "7891234567890"),
  peca("6", "Tela Galaxy A54 original", "tel", 1, 350, 650),
  prod("7", "Carregador 20W USB-C", "car", 8, 25, 69.9, "CAR-20W"),
  prod("8", "Película 3D", null, 25, 1.5, 20),
];

// Seleção: Capas (com subcategorias), desmarca Samsung; Telas; Sem categoria. Carregadores fica de fora.
let selecao = alternarCategoria(new Set(), "cap", categorias);
selecao = alternarCategoria(selecao, "cap-sam", categorias);
selecao = alternarCategoria(selecao, "tel", categorias);
selecao = alternarCategoria(selecao, SEM_CATEGORIA, categorias);

const filtrados = filtrarItens(itens, selecao, categorias);
const grupos = agruparPorCategoria(filtrados, categorias);
const total = totaisGerais(grupos);

const config = { nome_loja: "Loja Fictícia de Teste", telefone: "(11) 0000-0000" } as ConfiguracaoLoja;

const doc = await gerarCategoriasPDF(grupos, config);
writeFileSync(join(saida, "exemplo-por-categoria.pdf"), Buffer.from(doc.output("arraybuffer")));

const wb = gerarCategoriasWorkbook(grupos, config.nome_loja ?? "", "24/11/2026");
writeFileSync(join(saida, "exemplo-por-categoria.xlsx"), XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

console.log(JSON.stringify({
  grupos: grupos.map((g) => ({ nome: g.nome, itens: g.itens.length, quantidade: g.quantidade, custo: g.custo, venda: g.venda, lucro: g.lucro })),
  total,
}, null, 2));

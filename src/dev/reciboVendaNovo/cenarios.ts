/**
 * Cenários da página de teste do recibo novo (só desenvolvimento:
 * dev/recibo-venda-novo.html, fora do build). Dados 100% fictícios.
 *
 * Cada cenário monta a entrada por um dos adaptadores reais: entradaDoPDV
 * (recibo logo após o PDV) ou entradaDasLinhas (recibo reaberto). Os cenários
 * reabertos também trazem as tabelas para o Playwright simular o Supabase e
 * passar por carregarReciboVenda.
 */
import type { DadosReciboPDV } from "@/components/pdv/DialogReciboPDV";
import {
  type DadosVendaCarregados,
  entradaDasLinhas,
  entradaDoPDV,
  type EntradaReciboVenda,
  type ExtrasPDVParaRecibo,
  type LinhaVendaRecibo,
  type LojaReciboEntrada,
} from "@/lib/vendas/reciboVendaModelo";

const svg = (conteudo: string, w = 120, h = 120) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${conteudo}</svg>`)}`;

/** Celular desenhado (foto fictícia, sem rede). */
const fotoCelular = (corTela: string, corCorpo = "#1f2430") =>
  svg(
    `<rect x="34" y="6" width="52" height="108" rx="10" fill="${corCorpo}"/>` +
      `<rect x="38" y="12" width="44" height="96" rx="7" fill="${corTela}"/>` +
      `<circle cx="60" cy="40" r="14" fill="#ffffff" fill-opacity=".25"/>` +
      `<circle cx="60" cy="72" r="14" fill="#ffffff" fill-opacity=".18"/>`,
  );
const fotoCapinha = svg(`<rect x="30" y="10" width="60" height="100" rx="12" fill="#e2483d"/><circle cx="48" cy="28" r="9" fill="#fff" fill-opacity=".5"/>`);

export const FOTO_IPHONE_17 = fotoCelular("#5b3df5");
export const FOTO_IPHONE_13 = fotoCelular("#1e7bff", "#2a2f3a");

const logo = (texto: string, destaque: string) =>
  svg(
    `<rect width="260" height="90" fill="#ffffff"/>` +
      `<text x="20" y="58" font-family="Arial" font-size="40" font-weight="800" textLength="220" lengthAdjust="spacingAndGlyphs" fill="#0b1429">${texto}<tspan fill="#1f63f0">${destaque}</tspan></text>`,
    260,
    90,
  );

export const LOJA_COMPLETA: LojaReciboEntrada = {
  nome_loja: "Loja Exemplo Celulares",
  logo_url: logo("Loja", "Exemplo"),
  cnpj: "00.000.000/0001-00",
  endereco: "Rua Fictícia, 100 - Centro - Cidade Teste/SP - CEP: 00000-000",
  telefone: "(11) 3000-0000",
  whatsapp: "(11) 90000-0000",
  email: "contato@lojaexemplo.test",
  site: "www.lojaexemplo.test",
  instagram: "@lojaexemplo",
  facebook: "lojaexemplo",
};

const LOJA_MODELO: LojaReciboEntrada = {
  nome_loja: "iFix Pro",
  logo_url: logo("iFix", "Pro"),
  cnpj: "56.042.168/0001-14",
  endereco: "Rua das Tecnologias, 123 - Centro - Araraquara/SP - CEP: 14801-320",
  telefone: "(98) 3724-2121",
  whatsapp: "(98) 3723-6221",
  email: "ifixproararaoficial@gmail.com",
  site: "www.ifixpro.com.br",
  instagram: "@ifixpro",
};

const DATA = "2026-10-24T21:55:00.000Z"; // 24/10/2026 18:55 em Brasília
const ORIGEM = "https://appmec.in";

const TERMO = {
  config: null,
  modelos: null,
};

// ── Recibo logo após o PDV ──────────────────────────────────────────────────

const pdv = (dados: DadosReciboPDV, extras: Partial<ExtrasPDVParaRecibo> = {}): EntradaReciboVenda =>
  entradaDoPDV(dados, { loja: LOJA_COMPLETA, termo: TERMO, origemApp: ORIGEM, vendedorNome: "Vendedor Teste", ...extras });

const basePDV = (over: Partial<DadosReciboPDV>): DadosReciboPDV => ({
  itens: [],
  cliente: null,
  subtotal: 0,
  descontoManual: 0,
  descontoCupom: 0,
  total: 0,
  formaPagamento: "pix",
  data: DATA,
  grupoVendaId: "grupo-ficticio",
  numeroVenda: "VD-000101",
  ...over,
});

const iphone17 = {
  id: "item-1",
  tipo: "dispositivo" as const,
  nome: "Apple iPhone 17",
  preco: 4900,
  custo: 0,
  quantidade: 1,
  estoque: 1,
  cor: "Preto",
  capacidade_gb: 256,
  condicao: "usado",
  imei_dispositivo: "350000000000017",
  tempo_garantia: 3,
};

const clienteTeste = { id: "c1", nome: "Cliente Teste da Silva", cpf: "000.000.000-00", telefone: "(11) 90000-1111" } as DadosReciboPDV["cliente"];

// ── Recibo reaberto (linhas de `vendas`) ────────────────────────────────────

let seq = 0;
const linha = (over: Partial<LinhaVendaRecibo>): LinhaVendaRecibo => ({
  id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
  tipo: "dispositivo",
  dispositivo_id: "d-iphone15",
  quantidade: 1,
  total: 0,
  forma_pagamento: "pix",
  data: DATA,
  numero_venda: "VD-000102",
  funcionario_id: "f-1",
  ...over,
});

const PRODUTOS_BANCO: DadosVendaCarregados["produtos"] = {
  "d-iphone15": { marca: "Apple", modelo: "iPhone 15", cor: "Azul", capacidade_gb: 128, condicao: "semi_novo", imei: "350000000000015", fotoUrl: FOTO_IPHONE_17 },
  "p-pelicula": { nome: "Película 3D", sku: "PEL-3D" },
};

export interface CenarioRecibo {
  id: string;
  titulo: string;
  entrada: EntradaReciboVenda;
  /** Cenários reabertos: dados e tabelas para simular o Supabase. */
  banco?: { vendaId: string; grupoVenda: string; dados: DadosVendaCarregados; tabelas: Record<string, Record<string, unknown>[]> };
}

/** Tabelas do Supabase equivalentes aos dados carregados (para o Playwright responder às consultas). */
function tabelasDe(dados: DadosVendaCarregados, grupo: string): Record<string, Record<string, unknown>[]> {
  const ehDisp = (id: string) => dados.linhas.some((l) => l.dispositivo_id === id);
  const produtos = Object.entries(dados.produtos);
  return {
    vendas: dados.linhas.map(({ valor_conta_receber: _conta, ...l }) => ({ ...l, grupo_venda: grupo, cliente_id: dados.cliente ? "cliente-1" : null, deleted_at: null })),
    clientes: dados.cliente ? [{ id: "cliente-1", ...dados.cliente }] : [],
    dispositivos: [
      ...produtos.filter(([id]) => ehDisp(id)).map(([id, p]) => ({ id, marca: p.marca, modelo: p.modelo, cor: p.cor, capacidade_gb: p.capacidade_gb, condicao: p.condicao, imei: p.imei, numero_serie: p.numero_serie ?? null, fotos: p.fotoUrl ? [p.fotoUrl] : [], foto_url: null })),
      ...(dados.troca
        ? [{ id: "d-troca", marca: dados.troca.aparelho?.marca, modelo: dados.troca.aparelho?.modelo, capacidade_gb: dados.troca.aparelho?.capacidadeGb ?? null, cor: dados.troca.aparelho?.cor ?? null, imei: dados.troca.aparelho?.imei ?? null, condicao: dados.troca.condicao ?? null, fotos: dados.troca.fotoUrl ? [dados.troca.fotoUrl] : [], foto_url: null }]
        : []),
    ],
    produtos: produtos.filter(([id]) => dados.linhas.some((l) => l.produto_id === id)).map(([id, p]) => ({ id, nome: p.nome, sku: p.sku ?? null, fotos: p.fotoUrl ? [p.fotoUrl] : [] })),
    pecas: [],
    loja_funcionarios: dados.vendedorNome ? [{ id: "f-1", nome: dados.vendedorNome }] : [],
    contas: dados.linhas.filter((l) => l.valor_conta_receber != null).map((l) => ({ descricao: `venda_id:${l.id}`, valor: l.valor_conta_receber, tipo: "receber" })),
    vendas_trocas: dados.troca
      ? [{ grupo_venda: grupo, valor_entrada: dados.troca.valorEntrada, cancelada: dados.troca.cancelada, dispositivo_entrada_id: "d-troca", valor_devolvido: dados.troca.valorDevolvido ?? 0, forma_devolucao: dados.troca.formaDevolucao ?? null }]
      : [],
  };
}

function reaberto(id: string, titulo: string, dados: DadosVendaCarregados, loja: LojaReciboEntrada = LOJA_COMPLETA): CenarioRecibo {
  const grupo = `grupo-${id}`;
  return {
    id,
    titulo,
    entrada: entradaDasLinhas(dados, { loja, termo: TERMO, origemApp: ORIGEM }),
    banco: { vendaId: dados.linhas[0].id, grupoVenda: grupo, dados, tabelas: tabelasDe(dados, grupo) },
  };
}

// a receber 4x: 5.000 − 100 de desconto − 2.000 de troca → 4 × 725 (como o PDV grava).
const linhasAReceber4x = [1, 2, 3, 4].map((k) =>
  linha({
    forma_pagamento: "a_receber",
    total: 1250,
    valor_desconto_manual: 25,
    valor_troca: 500,
    parcela_numero: k,
    total_parcelas: 4,
    tempo_garantia: 6,
    data_prevista_recebimento: ["2026-11-24", "2026-12-24", "2027-01-24", "2027-02-24"][k - 1],
    valor_conta_receber: 725,
  }),
);

const trocaIphone13 = {
  aparelho: { marca: "Apple", modelo: "iPhone 13 Pro Max", capacidadeGb: 256, cor: "Grafite", imei: "350000000000013" },
  valorEntrada: 2000,
  cancelada: false,
  valorDevolvido: 0,
  formaDevolucao: null,
  condicao: "usado",
  fotoUrl: FOTO_IPHONE_13,
};

export const CENARIOS: CenarioRecibo[] = [
  {
    id: "item-unico",
    titulo: "Item único (PIX)",
    entrada: pdv(basePDV({ itens: [iphone17], cliente: clienteTeste, subtotal: 4900, total: 4900 }), { fotos: { "item-1": FOTO_IPHONE_17 } }),
  },
  {
    id: "varios-itens",
    titulo: "Vários itens (débito)",
    entrada: pdv(
      basePDV({
        itens: [
          { ...iphone17, id: "i1", tempo_garantia: 12 },
          { id: "i2", tipo: "produto", nome: "Capinha Silicone", preco: 45, custo: 0, quantidade: 2, estoque: 10 },
          { id: "i3", tipo: "peca", nome: "Película de Vidro 3D", preco: 30, custo: 0, quantidade: 1, estoque: 10 },
        ],
        cliente: clienteTeste,
        subtotal: 5020,
        total: 5020,
        formaPagamento: "debito",
      }),
      { fotos: { i1: FOTO_IPHONE_17, i2: fotoCapinha } },
    ),
  },
  {
    id: "com-troca",
    titulo: "Com troca (PIX)",
    entrada: pdv(basePDV({ itens: [iphone17], cliente: clienteTeste, subtotal: 4900, total: 2900, troca: trocaIphone13 }), {
      fotos: { "item-1": FOTO_IPHONE_17 },
      fotoTroca: FOTO_IPHONE_13,
      condicaoTroca: "usado",
    }),
  },
  reaberto("a-receber-4x", "A receber 4x com troca e desconto (reaberto)", {
    linhas: linhasAReceber4x,
    cliente: { nome: "Cliente Teste da Silva", cpf: "000.000.000-00", telefone: "(11) 90000-1111", endereco: "Rua Inventada, 50 - Bairro Teste" },
    produtos: PRODUTOS_BANCO,
    troca: trocaIphone13,
    vendedorNome: "Vendedor Teste",
  }),
  {
    id: "credito-parcelado",
    titulo: "Crédito parcelado 3x",
    entrada: pdv(basePDV({ itens: [{ ...iphone17, preco: 3000, tempo_garantia: 0 }], cliente: clienteTeste, subtotal: 3000, total: 3000, formaPagamento: "credito_parcelado", numeroParcelas: 3 })),
  },
  reaberto("pagamento-duplo", "Pagamento duplo: PIX + a receber 2x (reaberto)", {
    linhas: [
      linha({ total: 1800, forma_pagamento: "pix", segunda_forma_pagamento: "a_receber", valor_segunda_forma: 700, tempo_garantia: 3 }),
      linha({ tipo: "produto", dispositivo_id: null, produto_id: "p-pelicula", total: 100, forma_pagamento: "pix", segunda_forma_pagamento: "a_receber", valor_segunda_forma: 0 }),
      ...[1, 2].map((k) =>
        linha({ total: 350, forma_pagamento: "a_receber", observacoes: "pagamento_duplo_secundario", parcela_numero: k, total_parcelas: 2, data_prevista_recebimento: `2026-1${k}-10` }),
      ),
    ],
    cliente: { nome: "Cliente Teste da Silva", cpf: "000.000.000-00" },
    produtos: PRODUTOS_BANCO,
    troca: null,
    vendedorNome: "Vendedor Teste",
  }),
  {
    id: "desconto",
    titulo: "Desconto e cupom",
    entrada: pdv(
      basePDV({
        itens: [{ ...iphone17, preco: 2500, nome: "Samsung Galaxy S23", cor: "Verde", capacidade_gb: 128, condicao: "semi_novo", imei_dispositivo: "350000000000023" }],
        cliente: clienteTeste,
        subtotal: 2500,
        descontoManual: 150,
        descontoCupom: 50,
        cupom: { id: "cp", codigo: "BEMVINDO" } as DadosReciboPDV["cupom"],
        total: 2300,
        formaPagamento: "dinheiro",
      }),
      { fotos: { "item-1": fotoCelular("#2aa772", "#cfd6cf") } },
    ),
  },
  {
    id: "sem-logo",
    titulo: "Loja sem logo",
    entrada: pdv(basePDV({ itens: [iphone17], cliente: clienteTeste, subtotal: 4900, total: 4900 }), { loja: { ...LOJA_COMPLETA, logo_url: null } }),
  },
  {
    id: "sem-redes",
    titulo: "Loja sem redes, site, catálogo nem WhatsApp (sem QR)",
    entrada: pdv(basePDV({ itens: [iphone17], cliente: null, subtotal: 4900, total: 4900 }), {
      loja: { nome_loja: "Loja Simples", cnpj: "00.000.000/0001-00", endereco: "Rua Fictícia, 100 - Cidade Teste/SP", telefone: "(11) 3000-0000", email: "contato@lojasimples.test" },
      vendedorNome: null,
    }),
  },
  reaberto("cancelada", "Venda cancelada com troca (reaberto)", {
    linhas: [linha({ total: 4900, forma_pagamento: "pix", cancelada: true, data_cancelamento: "2026-10-25T13:00:00Z", motivo_cancelamento: "Cliente desistiu da compra", valor_troca: 2000, tempo_garantia: 3 })],
    cliente: { nome: "Cliente Teste da Silva" },
    produtos: PRODUTOS_BANCO,
    troca: { ...trocaIphone13, cancelada: true },
    vendedorNome: null,
  }),
  {
    id: "modelo",
    titulo: "Dados do modelo de referência (comparação com o PNG)",
    entrada: entradaDoPDV(
      basePDV({
        itens: [{ ...iphone17, imei_dispositivo: "", tempo_garantia: 0 }],
        cliente: null,
        subtotal: 4900,
        total: 2900,
        formaPagamento: "a_receber",
        numeroVenda: "VD-000012",
        troca: { aparelho: { marca: "Apple", modelo: "iPhone 13 Pro Max", imei: "36719919110001131" }, valorEntrada: 2000, cancelada: false },
      }),
      { loja: LOJA_MODELO, termo: TERMO, origemApp: ORIGEM, fotos: { "item-1": FOTO_IPHONE_17 }, fotoTroca: FOTO_IPHONE_13, condicaoTroca: "usado" },
    ),
  },
];

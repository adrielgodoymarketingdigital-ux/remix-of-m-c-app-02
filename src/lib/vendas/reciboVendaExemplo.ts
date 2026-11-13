/**
 * Venda de exemplo do recibo de venda (dados 100% fictícios, fotos e logo em
 * SVG embutido, sem rede). Usada pela prévia da tela "Personalizar recibo de
 * venda" e pelos cenários da página de teste (src/dev/reciboVendaNovo/cenarios.ts).
 *
 * Puro (sem React nem Supabase): testado com Deno em scripts/testes-recibo-venda-novo/.
 */
import {
  type ClienteReciboEntrada,
  type DadosPDVParaRecibo,
  type DadosVendaCarregados,
  entradaDasLinhas,
  entradaDoPDV,
  type EntradaReciboVenda,
  type LinhaVendaRecibo,
  type LojaReciboEntrada,
  type TrocaReciboEntrada,
} from "./reciboVendaModelo.ts";

const svg = (conteudo: string, w = 120, h = 120) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${conteudo}</svg>`)}`;

/** Celular desenhado (foto fictícia, sem rede). */
export const fotoCelular = (corTela: string, corCorpo = "#1f2430") =>
  svg(
    `<rect x="34" y="6" width="52" height="108" rx="10" fill="${corCorpo}"/>` +
      `<rect x="38" y="12" width="44" height="96" rx="7" fill="${corTela}"/>` +
      `<circle cx="60" cy="40" r="14" fill="#ffffff" fill-opacity=".25"/>` +
      `<circle cx="60" cy="72" r="14" fill="#ffffff" fill-opacity=".18"/>`,
  );
export const FOTO_CAPINHA = svg(`<rect x="30" y="10" width="60" height="100" rx="12" fill="#e2483d"/><circle cx="48" cy="28" r="9" fill="#fff" fill-opacity=".5"/>`);

export const FOTO_IPHONE_17 = fotoCelular("#5b3df5");
export const FOTO_IPHONE_13 = fotoCelular("#1e7bff", "#2a2f3a");

export const logoExemplo = (texto: string, destaque: string) =>
  svg(
    `<rect width="260" height="90" fill="#ffffff"/>` +
      `<text x="20" y="58" font-family="Arial" font-size="40" font-weight="800" textLength="220" lengthAdjust="spacingAndGlyphs" fill="#0b1429">${texto}<tspan fill="#1f63f0">${destaque}</tspan></text>`,
    260,
    90,
  );

export const LOJA_EXEMPLO: LojaReciboEntrada = {
  nome_loja: "Loja Exemplo Celulares",
  logo_url: logoExemplo("Loja", "Exemplo"),
  cnpj: "00.000.000/0001-00",
  endereco: "Rua Fictícia, 100 - Centro - Cidade Teste/SP - CEP: 00000-000",
  telefone: "(11) 3000-0000",
  whatsapp: "(11) 90000-0000",
  email: "contato@lojaexemplo.test",
  site: "www.lojaexemplo.test",
  instagram: "@lojaexemplo",
  facebook: "lojaexemplo",
};

/** 24/10/2026 18:55 em Brasília. */
export const DATA_EXEMPLO = "2026-10-24T21:55:00.000Z";
export const ORIGEM_EXEMPLO = "https://appmec.in";

/** Aparelho do carrinho do PDV (campos de DadosReciboPDV). */
export const ITEM_IPHONE_17 = {
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

export const CLIENTE_EXEMPLO = { id: "c1", nome: "Cliente Teste da Silva", cpf: "000.000.000-00", telefone: "(11) 90000-1111" };

export const TROCA_EXEMPLO = {
  aparelho: { marca: "Apple", modelo: "iPhone 13 Pro Max", capacidadeGb: 256, cor: "Grafite", imei: "350000000000013" },
  valorEntrada: 2000,
  cancelada: false,
  valorDevolvido: 0,
  formaDevolucao: null,
  condicao: "usado",
  fotoUrl: FOTO_IPHONE_13,
};

// ── Exemplos da prévia ──────────────────────────────────────────────────────

export const EXEMPLOS_RECIBO_VENDA = ["simples", "com-garantia", "com-troca", "parcelado", "cancelada"] as const;
export type IdExemploReciboVenda = (typeof EXEMPLOS_RECIBO_VENDA)[number];

export interface ContextoExemploRecibo {
  /** Loja real (nome, logo, contatos); vazia = loja de exemplo. */
  loja?: LojaReciboEntrada | null;
  termo?: EntradaReciboVenda["termo"];
  origemApp?: string;
}

const clienteComEndereco: ClienteReciboEntrada = { ...CLIENTE_EXEMPLO, endereco: "Rua Inventada, 50 - Bairro Teste" };
const VENDEDOR = "Vendedor Exemplo";

const pdvExemplo = (over: Partial<DadosPDVParaRecibo>): DadosPDVParaRecibo => ({
  itens: [],
  cliente: clienteComEndereco,
  subtotal: 0,
  descontoManual: 0,
  descontoCupom: 0,
  total: 0,
  formaPagamento: "pix",
  data: DATA_EXEMPLO,
  numeroVenda: "VD-000101",
  ...over,
});

const capinha = { id: "i2", tipo: "produto" as const, nome: "Capinha Silicone", preco: 45, quantidade: 2 };
const pelicula = { id: "i3", tipo: "peca" as const, nome: "Película de Vidro 3D", preco: 30, quantidade: 1 };

/** Recibo de exemplo com a loja de quem está configurando. */
export function entradaExemploRecibo(id: IdExemploReciboVenda, ctx: ContextoExemploRecibo = {}): EntradaReciboVenda {
  const loja = ctx.loja ?? LOJA_EXEMPLO;
  const extras = { loja, termo: ctx.termo ?? null, origemApp: ctx.origemApp ?? ORIGEM_EXEMPLO, vendedorNome: VENDEDOR };
  switch (id) {
    case "simples":
      // Só produto e peça (sem aparelho = sem termo), com desconto e cupom.
      return entradaDoPDV(
        pdvExemplo({ itens: [capinha, pelicula], subtotal: 120, descontoManual: 10, descontoCupom: 5, cupom: { codigo: "BEMVINDO" }, total: 105, formaPagamento: "dinheiro" }),
        { ...extras, fotos: { i2: FOTO_CAPINHA } },
      );
    case "com-garantia":
      return entradaDoPDV(
        pdvExemplo({ itens: [{ ...ITEM_IPHONE_17, tempo_garantia: 12 }, capinha], subtotal: 4990, total: 4990, formaPagamento: "debito" }),
        { ...extras, fotos: { "item-1": FOTO_IPHONE_17, i2: FOTO_CAPINHA } },
      );
    case "com-troca":
      return entradaDoPDV(pdvExemplo({ itens: [ITEM_IPHONE_17], subtotal: 4900, total: 2900, troca: TROCA_EXEMPLO as TrocaReciboEntrada }), {
        ...extras,
        fotos: { "item-1": FOTO_IPHONE_17 },
        fotoTroca: FOTO_IPHONE_13,
        condicaoTroca: "usado",
      });
    case "parcelado":
      // A receber 4x: 3.000 − 100 de desconto → 4 × 725.
      return entradaDoPDV(
        pdvExemplo({ itens: [{ ...ITEM_IPHONE_17, preco: 3000, tempo_garantia: 6 }], subtotal: 3000, descontoManual: 100, total: 2900, formaPagamento: "a_receber" }),
        {
          ...extras,
          fotos: { "item-1": FOTO_IPHONE_17 },
          parcelasReceber: ["2026-11-24", "2026-12-24", "2027-01-24", "2027-02-24"].map((vencimento) => ({ valor: 725, vencimento })),
        },
      );
    case "cancelada":
      return entradaDasLinhas(vendaCancelada, { loja, termo: extras.termo, origemApp: extras.origemApp });
  }
}

const linhaCancelada: LinhaVendaRecibo = {
  id: "00000000-0000-4000-8000-0000000000c1",
  tipo: "dispositivo",
  dispositivo_id: "d-iphone15",
  quantidade: 1,
  total: 4900,
  forma_pagamento: "pix",
  data: DATA_EXEMPLO,
  numero_venda: "VD-000102",
  funcionario_id: "f-1",
  cancelada: true,
  data_cancelamento: "2026-10-25T13:00:00Z",
  motivo_cancelamento: "Cliente desistiu da compra",
  valor_troca: 2000,
  tempo_garantia: 3,
};

const vendaCancelada: DadosVendaCarregados = {
  linhas: [linhaCancelada],
  cliente: clienteComEndereco,
  produtos: {
    "d-iphone15": { marca: "Apple", modelo: "iPhone 15", cor: "Azul", capacidade_gb: 128, condicao: "semi_novo", imei: "350000000000015", fotoUrl: FOTO_IPHONE_17 },
  },
  troca: { ...(TROCA_EXEMPLO as TrocaReciboEntrada), cancelada: true },
  vendedorNome: VENDEDOR,
};

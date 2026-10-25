/**
 * Cenários da página de teste dos DIÁLOGOS reais de recibo (PDV, reimpressão
 * em Vendas, Dispositivos vendidos) — só desenvolvimento, fora do build.
 * A mesma venda descrita como o PDV entrega (DadosReciboPDV), como as linhas
 * do banco (tabelas que o Playwright devolve no lugar do Supabase) e como as
 * telas de Vendas e Dispositivos passam para os diálogos. Dados 100% fictícios.
 *
 * Não importa nada do recibo novo: o mesmo arquivo roda na main para a
 * comparação main × branch.
 */
import type { DadosReciboPDV } from "@/components/pdv/DialogReciboPDV";
import type { DialogReimprimirReciboVenda } from "@/components/dispositivos/DialogReimprimirReciboVenda";
import type { Venda } from "@/types/venda";

type VendaDispositivo = NonNullable<Parameters<typeof DialogReimprimirReciboVenda>[0]["venda"]>;
type Linha = Record<string, unknown>;

export const USUARIO_TESTE = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
export const BASE_LOCAL = "http://127.0.0.1:8197";

const svg = (conteudo: string, w = 120, h = 120) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${conteudo}</svg>`)}`;
const LOGO = svg(`<rect width="260" height="90" fill="#fff"/><text x="20" y="58" font-family="Arial" font-size="40" font-weight="800" fill="#0b1429" textLength="220" lengthAdjust="spacingAndGlyphs">Loja<tspan fill="#1f63f0">Exemplo</tspan></text>`, 260, 90);
const FOTO_CELULAR = svg(`<rect x="34" y="6" width="52" height="108" rx="10" fill="#1f2430"/><rect x="38" y="12" width="44" height="96" rx="7" fill="#5b3df5"/>`);
const FOTO_TROCA = svg(`<rect x="34" y="6" width="52" height="108" rx="10" fill="#2a2f3a"/><rect x="38" y="12" width="44" height="96" rx="7" fill="#1e7bff"/>`);
const IMAGEM_QUEBRADA = `${BASE_LOCAL}/nao-existe-imagem-teste.png`;

const LOJA: Linha = {
  id: "cfg-1",
  user_id: USUARIO_TESTE.id,
  empresa_id: null,
  created_at: "2026-01-01T00:00:00Z",
  nome_loja: "Loja Exemplo Celulares",
  logo_url: LOGO,
  cnpj: "00.000.000/0001-00",
  endereco: "Rua Fictícia, 100 - Centro - Cidade Teste/SP",
  telefone: "(11) 3000-0000",
  whatsapp: "(11) 90000-0000",
  email: "contato@lojaexemplo.test",
  site: "www.lojaexemplo.test",
  instagram: "@lojaexemplo",
  facebook: null,
  catalogo_ativo: false,
  catalogo_slug: null,
  layout_pdv_config: null,
  layout_vendas_config: null,
  layout_dispositivos_config: null,
  termo_garantia_dispositivo_config: null,
};

const DATA = "2026-10-24T21:55:00.000Z";
const CLIENTE = { id: "cli-1", nome: "Cliente Teste da Silva", cpf: "000.000.000-00", telefone: "(11) 90000-1111", endereco: "Rua Inventada, 50" };
const IPHONE = { id: "disp-1", tipo: "Celular", marca: "Apple", modelo: "iPhone 15", cor: "Azul", capacidade_gb: 128, condicao: "semi_novo", imei: "350000000000015", imei2: null, numero_serie: null, garantia: true, tempo_garantia: 3, fotos: [FOTO_CELULAR], foto_url: null, checklist: null };
const PELICULA = { id: "prod-1", nome: "Película 3D", sku: "PEL-3D", fotos: [] };
const TROCA_APARELHO = { id: "disp-troca", tipo: "Celular", marca: "Apple", modelo: "iPhone 13 Pro Max", cor: "Grafite", capacidade_gb: 256, condicao: "usado", imei: "350000000000013", imei2: null, fotos: [FOTO_TROCA], foto_url: null };

export interface CenarioDialogo {
  id: string;
  titulo: string;
  grupo: string;
  pdv: DadosReciboPDV;
  tabelas: Record<string, Linha[]>;
  vendaVendas: Venda;
  grupoVendas: Venda[];
  vendaDispositivo: VendaDispositivo;
}

interface Montagem {
  id: string;
  titulo: string;
  linhas: Linha[];
  pdv: Omit<DadosReciboPDV, "data" | "grupoVendaId" | "numeroVenda" | "empresaId" | "cliente"> & { cliente?: DadosReciboPDV["cliente"] };
  dispositivos?: Linha[];
  produtos?: Linha[];
  troca?: Linha | null;
  contas?: Linha[];
  loja?: Partial<Linha>;
  vendedor?: boolean;
}

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

function montar(m: Montagem): CenarioDialogo {
  const grupo = `grupo-${m.id}`;
  // Linha solta (Record): os cenários acrescentam colunas diferentes (observacoes, valor_troca...).
  const vendas: Linha[] = m.linhas.map((l) => ({
    id: uuid(),
    grupo_venda: grupo,
    cliente_id: CLIENTE.id,
    data: DATA,
    numero_venda: "VD-000555",
    quantidade: 1,
    tipo: "dispositivo",
    dispositivo_id: IPHONE.id,
    produto_id: null,
    peca_id: null,
    forma_pagamento: "pix",
    funcionario_id: m.vendedor === false ? null : "func-1",
    deleted_at: null,
    cancelada: false,
    empresa_id: null,
    imei_dispositivo: IPHONE.imei,
    tempo_garantia: 3,
    ...l,
  }));
  const dispositivos = m.dispositivos ?? [IPHONE];
  const produtos = m.produtos ?? [PELICULA];
  const principais = vendas.filter((v) => v.observacoes !== "pagamento_duplo_secundario");
  const juntar = (v: Linha): Venda => {
    const disp = dispositivos.find((d) => d.id === v.dispositivo_id);
    const prod = produtos.find((p) => p.id === v.produto_id);
    return {
      ...(v as unknown as Venda),
      clientes: { nome: CLIENTE.nome, telefone: CLIENTE.telefone },
      dispositivos: disp ? { tipo: String(disp.tipo), marca: String(disp.marca), modelo: String(disp.modelo) } : null,
      produtos: prod ? { nome: String(prod.nome), sku: (prod.sku as string) ?? null } : null,
    };
  };
  const grupoVendas = principais.map(juntar);
  const primeira = principais[0];
  const disp = dispositivos.find((d) => d.id === primeira.dispositivo_id) ?? IPHONE;
  return {
    id: m.id,
    titulo: m.titulo,
    grupo,
    pdv: { ...m.pdv, cliente: m.pdv.cliente === undefined ? (CLIENTE as unknown as DadosReciboPDV["cliente"]) : m.pdv.cliente, data: DATA, grupoVendaId: grupo, numeroVenda: "VD-000555", empresaId: null },
    tabelas: {
      configuracoes_loja: [{ ...LOJA, ...m.loja }],
      user_roles: [],
      loja_funcionarios: m.vendedor === false ? [] : [{ id: "func-1", nome: "Vendedor Teste" }],
      vendas,
      clientes: [CLIENTE],
      dispositivos: [...dispositivos, ...(m.troca ? [TROCA_APARELHO] : [])],
      produtos,
      pecas: [],
      contas: (m.contas ?? []).map((c, i) => ({ tipo: "receber", ...c, descricao: `venda_id:${vendas[i].id}` })),
      vendas_trocas: m.troca ? [{ grupo_venda: grupo, cancelada: false, dispositivo_entrada_id: TROCA_APARELHO.id, valor_devolvido: 0, forma_devolucao: null, ...m.troca }] : [],
      dispositivo_imeis: [],
    },
    vendaVendas: grupoVendas[0],
    grupoVendas,
    vendaDispositivo: {
      id: String(primeira.id),
      quantidade: 1,
      total: Number(primeira.total),
      forma_pagamento: String(primeira.forma_pagamento),
      data: DATA,
      cliente_nome: CLIENTE.nome,
      cliente_telefone: CLIENTE.telefone,
      cliente_cpf: CLIENTE.cpf,
      cliente_endereco: CLIENTE.endereco,
      dispositivo_marca: String(disp.marca),
      dispositivo_modelo: String(disp.modelo),
      dispositivo_tipo: String(disp.tipo),
      dispositivo_imei: String(disp.imei ?? ""),
      dispositivo_cor: disp.cor as string,
      dispositivo_capacidade_gb: disp.capacidade_gb as number,
      dispositivo_condicao: disp.condicao as string,
      dispositivo_garantia: true,
      dispositivo_tempo_garantia: Number(primeira.tempo_garantia ?? 0),
      empresa_id: null,
    } as VendaDispositivo,
  };
}

const itemIphone = (preco: number, extra: Partial<DadosReciboPDV["itens"][number]> = {}): DadosReciboPDV["itens"][number] => ({
  id: IPHONE.id, tipo: "dispositivo", nome: "Apple iPhone 15", preco, custo: 0, quantidade: 1, estoque: 1,
  dispositivo_id: IPHONE.id, imei_dispositivo: IPHONE.imei, imei: IPHONE.imei, condicao: "semi_novo", tempo_garantia: 3, ...extra,
});

const pix = { formaPagamento: "pix", nomeFormaPagamento: "PIX" } as const;

export const CENARIOS_DIALOGOS: CenarioDialogo[] = [
  montar({
    id: "simples",
    titulo: "Venda simples (PIX)",
    linhas: [{ total: 4900 }],
    pdv: { itens: [itemIphone(4900)], subtotal: 4900, descontoManual: 0, descontoCupom: 0, total: 4900, ...pix },
  }),
  montar({
    id: "troca",
    titulo: "Com troca (PIX)",
    linhas: [{ total: 4900, valor_troca: 2000 }],
    troca: { valor_entrada: 2000 },
    pdv: {
      itens: [itemIphone(4900)], subtotal: 4900, descontoManual: 0, descontoCupom: 0, total: 2900, ...pix,
      troca: { aparelho: { marca: "Apple", modelo: "iPhone 13 Pro Max", capacidadeGb: 256, cor: "Grafite", imei: "350000000000013" }, valorEntrada: 2000, cancelada: false, valorDevolvido: 0, formaDevolucao: null },
    },
  }),
  montar({
    id: "parcelada",
    titulo: "A receber 4x com troca e desconto",
    linhas: ["2026-11-24", "2026-12-24", "2027-01-24", "2027-02-24"].map((d, k) => ({
      total: 1250, valor_desconto_manual: 25, valor_troca: 500, forma_pagamento: "a_receber", parcela_numero: k + 1, total_parcelas: 4, data_prevista_recebimento: d, tempo_garantia: 6,
    })),
    troca: { valor_entrada: 2000 },
    contas: [725, 725, 725, 725].map((valor) => ({ valor })),
    pdv: {
      itens: [itemIphone(5000, { tempo_garantia: 6 })], subtotal: 5000, descontoManual: 100, descontoCupom: 0, total: 2900, formaPagamento: "a_receber", nomeFormaPagamento: "A Receber",
      troca: { aparelho: { marca: "Apple", modelo: "iPhone 13 Pro Max", capacidadeGb: 256, cor: "Grafite", imei: "350000000000013" }, valorEntrada: 2000, cancelada: false, valorDevolvido: 0, formaDevolucao: null },
    },
  }),
  montar({
    id: "duplo",
    titulo: "Pagamento duplo: PIX + a receber 2x",
    linhas: [
      { total: 1800, segunda_forma_pagamento: "a_receber", valor_segunda_forma: 700 },
      { tipo: "produto", dispositivo_id: null, produto_id: PELICULA.id, imei_dispositivo: null, tempo_garantia: null, total: 100, segunda_forma_pagamento: "a_receber", valor_segunda_forma: 0 },
      ...[1, 2].map((k) => ({ total: 350, forma_pagamento: "a_receber", observacoes: "pagamento_duplo_secundario", parcela_numero: k, total_parcelas: 2, data_prevista_recebimento: `2026-1${k}-10` })),
    ],
    pdv: {
      itens: [itemIphone(1800), { id: PELICULA.id, tipo: "produto", nome: "Película 3D", preco: 100, custo: 0, quantidade: 1, estoque: 5, produto_id: PELICULA.id }],
      subtotal: 1900, descontoManual: 0, descontoCupom: 0, total: 1900, ...pix,
      pagamentoDuplo: { valorPrimeira: 1200, segundaForma: "a_receber", nomeSegundaForma: "A Receber", valorSegunda: 700 },
    },
  }),
  montar({
    id: "desconto",
    titulo: "Desconto manual (dinheiro)",
    linhas: [{ total: 2500, valor_desconto_manual: 150, forma_pagamento: "dinheiro" }],
    pdv: { itens: [itemIphone(2500)], subtotal: 2500, descontoManual: 150, descontoCupom: 0, total: 2350, formaPagamento: "dinheiro", nomeFormaPagamento: "Dinheiro" },
  }),
  montar({
    id: "garantia",
    titulo: "Garantia de 12 meses com termo da loja",
    linhas: [{ total: 6200, tempo_garantia: 12, forma_pagamento: "credito" }],
    loja: {
      termo_garantia_dispositivo_config: {
        modo: "livre",
        termo_com_garantia: "TERMO DE GARANTIA\n\nLoja: {{loja}}\nComprador: {{cliente}}\nAparelho: {{dispositivo}} (IMEI {{imei}})\nValor pago: {{valor}}\n\nGarantia de {{garantia_meses}} meses a partir de {{data_venda}}.\nNão cobre quedas, líquidos ou mau uso.",
        termo_sem_garantia: "Venda sem garantia contratual.",
      },
    },
    pdv: { itens: [itemIphone(6200, { tempo_garantia: 12 })], subtotal: 6200, descontoManual: 0, descontoCupom: 0, total: 6200, formaPagamento: "credito", nomeFormaPagamento: "Cartão de Crédito" },
  }),
  montar({
    id: "sem-logo",
    titulo: "Loja sem logo",
    linhas: [{ total: 4900 }],
    loja: { logo_url: null },
    pdv: { itens: [itemIphone(4900)], subtotal: 4900, descontoManual: 0, descontoCupom: 0, total: 4900, ...pix },
  }),
  montar({
    id: "imagem-quebrada",
    titulo: "Logo e foto que não carregam",
    linhas: [{ total: 4900 }],
    loja: { logo_url: IMAGEM_QUEBRADA },
    dispositivos: [{ ...IPHONE, fotos: [IMAGEM_QUEBRADA] }],
    pdv: { itens: [itemIphone(4900)], subtotal: 4900, descontoManual: 0, descontoCupom: 0, total: 4900, ...pix },
  }),
];

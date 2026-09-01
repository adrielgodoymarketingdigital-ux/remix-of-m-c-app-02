// "Primeiros Passos" — card leve e não-bloqueante no topo do Dashboard.
// Pergunta o perfil do negócio e mostra um checklist CURTO (1–3 itens),
// marcado automaticamente quando o usuário faz a ação DE VERDADE.

export type TipoNegocioPP = "assistencia" | "produtos" | "dispositivos" | "tudo";

export const TIPOS_NEGOCIO_PP: TipoNegocioPP[] = [
  "assistencia",
  "produtos",
  "dispositivos",
  "tudo",
];

export interface OpcaoTipoNegocio {
  slug: TipoNegocioPP;
  label: string;
  /** nome do ícone lucide-react usado no card */
  icone: "Wrench" | "Package" | "Smartphone" | "LayoutGrid";
}

// Ordem = ordem dos botões no card.
export const OPCOES_TIPO_NEGOCIO: OpcaoTipoNegocio[] = [
  { slug: "assistencia", label: "Assistência Técnica", icone: "Wrench" },
  { slug: "produtos", label: "Venda de Produtos/Peças", icone: "Package" },
  { slug: "dispositivos", label: "Venda de Dispositivos", icone: "Smartphone" },
  { slug: "tudo", label: "Faço de Tudo", icone: "LayoutGrid" },
];

// Identificadores dos itens de checklist. Cada um deriva de uma ação REAL
// (tabela de produção), nunca de dado fake/is_teste.
export type ItemChecklistId =
  | "criar_os"
  | "cadastrar_produto"
  | "venda_pdv"
  | "cadastrar_dispositivo"
  | "venda_dispositivo"
  | "fazer_venda";

export interface DefinicaoItemChecklist {
  id: ItemChecklistId;
  label: string;
  /** nome do ícone lucide-react */
  icone: "ClipboardList" | "Package" | "ShoppingCart" | "Smartphone" | "DollarSign";
  /** rota para onde o item leva ao ser clicado */
  rota: string;
  /**
   * Como saber se está concluído, a partir dos contadores derivados das
   * tabelas reais (ver usePrimeirosPassos).
   */
  concluidoQuando: keyof ContadoresReais;
}

/** Contadores "existe pelo menos 1?" derivados direto das tabelas de produção. */
export interface ContadoresReais {
  temOsReal: boolean;
  temProdutoOuPeca: boolean;
  temDispositivo: boolean;
  temVendaProduto: boolean;
  temVendaDispositivo: boolean;
  temVendaQualquer: boolean;
}

const ITENS: Record<ItemChecklistId, DefinicaoItemChecklist> = {
  criar_os: {
    id: "criar_os",
    label: "Crie sua primeira Ordem de Serviço",
    icone: "ClipboardList",
    rota: "/os",
    concluidoQuando: "temOsReal",
  },
  cadastrar_produto: {
    id: "cadastrar_produto",
    label: "Cadastre seu primeiro produto",
    icone: "Package",
    rota: "/produtos",
    concluidoQuando: "temProdutoOuPeca",
  },
  venda_pdv: {
    id: "venda_pdv",
    label: "Faça sua primeira venda no PDV",
    icone: "ShoppingCart",
    rota: "/pdv",
    concluidoQuando: "temVendaProduto",
  },
  cadastrar_dispositivo: {
    id: "cadastrar_dispositivo",
    label: "Cadastre seu primeiro dispositivo",
    icone: "Smartphone",
    rota: "/dispositivos",
    concluidoQuando: "temDispositivo",
  },
  venda_dispositivo: {
    id: "venda_dispositivo",
    label: "Registre sua primeira venda",
    icone: "DollarSign",
    rota: "/vendas",
    concluidoQuando: "temVendaDispositivo",
  },
  fazer_venda: {
    id: "fazer_venda",
    label: "Faça sua primeira venda",
    icone: "DollarSign",
    rota: "/pdv",
    concluidoQuando: "temVendaQualquer",
  },
};

// Checklist por perfil — SEMPRE curto (máx. 3). "tudo" é fixo em 3, não a
// concatenação de todos.
const CHECKLIST_POR_TIPO: Record<TipoNegocioPP, ItemChecklistId[]> = {
  assistencia: ["criar_os"],
  produtos: ["cadastrar_produto", "venda_pdv"],
  dispositivos: ["cadastrar_dispositivo", "venda_dispositivo"],
  tudo: ["criar_os", "cadastrar_produto", "fazer_venda"],
};

export function getItensChecklist(tipo: TipoNegocioPP): DefinicaoItemChecklist[] {
  return CHECKLIST_POR_TIPO[tipo].map((id) => ITENS[id]);
}

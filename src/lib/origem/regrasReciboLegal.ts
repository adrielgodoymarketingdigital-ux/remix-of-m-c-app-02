// Validações de cada ponto de "Gerar recibo legal", copiadas da origin/main (b44e6a5)
// SEM unificar: quem gerava continua gerando, quem era bloqueado continua bloqueado,
// com os mesmos textos (pt-BR, como eram). O orquestrador recebe estas regras do chamador.
import { validarConfiguracaoParaRecibos } from "@/lib/configuracaoLoja/validarParaRecibos";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import type { OrigemPessoa } from "@/types/origem";
import type { CompraParaRecibo, DispositivoParaRecibo } from "./buscarCompraParaRecibo";

/** Mensagem de bloqueio exatamente como a tela mostrava. */
export interface FalhaRecibo {
  titulo: string;
  descricao?: string;
  /** Botão "Configurar" (→ /configuracoes), como a TabelaCompras tinha. */
  configurar?: boolean;
}

export type VendedorRecibo = Partial<OrigemPessoa> & { nome: string };

/** Campos da loja que a validação lê (ConfiguracaoLoja tem estes e mais). */
export type LojaValidavel = Partial<ConfiguracaoLoja> | null;

export interface RegrasReciboLegal {
  /** Identifica o ponto (só para log/teste). */
  ponto: "lista_dispositivos" | "cartao_dispositivo" | "lista_compras" | "detalhes_compra";
  /** De onde vem a filial da loja: a tela usava compra.empresa_id ou dispositivo.empresa_id. */
  empresaDa: "compra" | "dispositivo";
  /** Detalhes mandava só 5 campos da loja ao PDF; as outras telas mandavam a configuração inteira. */
  lojaNoPdf: "completa" | "basica";
  validarLoja: (loja: LojaValidavel) => FalhaRecibo | null;
  resolverVendedor: (compra: CompraParaRecibo) => { vendedor: VendedorRecibo } | { falha: FalhaRecibo };
  validarDispositivo: (dispositivo: DispositivoParaRecibo) => FalhaRecibo | null;
  falhaCompraNaoEncontrada: FalhaRecibo;
  falhaDispositivoNaoEncontrado: FalhaRecibo;
  /** Erro inesperado (rede, storage...), com o texto que a tela usava. */
  falhaInesperada: (mensagem: string | undefined) => FalhaRecibo;
}

const semValidacao = () => null;

// ---------- vendedor ----------

/** Card e lista de Dispositivos: exige origem_pessoas com nome E CPF/CNPJ (fornecedor fica bloqueado). */
const vendedorComNomeECpf = (compra: CompraParaRecibo): { vendedor: VendedorRecibo } | { falha: FalhaRecibo } => {
  const p = compra.origem_pessoas;
  if (!p?.nome || !p?.cpf_cnpj) {
    return { falha: { titulo: "Dados do vendedor incompletos", descricao: "Por favor, complete os dados do vendedor (Nome e CPF/CNPJ)" } };
  }
  return { vendedor: { ...p, nome: p.nome } };
};

// ---------- as 4 telas ----------

/** TabelaDispositivos (lista de Dispositivos). */
export const REGRAS_LISTA_DISPOSITIVOS: RegrasReciboLegal = {
  ponto: "lista_dispositivos",
  empresaDa: "dispositivo",
  lojaNoPdf: "completa",
  validarLoja: (config) => {
    const camposFaltando: string[] = [];
    if (!config?.nome_loja) camposFaltando.push("Nome da loja");
    if (!config?.razao_social) camposFaltando.push("Razão social");
    if (!config?.cnpj) camposFaltando.push("CNPJ");
    if (!config?.endereco) camposFaltando.push("Endereço");
    if (!config?.telefone) camposFaltando.push("Telefone");
    if (camposFaltando.length === 0) return null;
    return { titulo: "Dados da loja incompletos", descricao: `Por favor, complete os seguintes campos nas configurações: ${camposFaltando.join(", ")}` };
  },
  resolverVendedor: vendedorComNomeECpf,
  validarDispositivo: semValidacao,
  falhaCompraNaoEncontrada: { titulo: "Erro", descricao: "Não foi possível encontrar os dados da compra" },
  falhaDispositivoNaoEncontrado: { titulo: "Erro ao gerar recibo", descricao: "Dispositivo não encontrado" },
  falhaInesperada: (m) => ({ titulo: "Erro ao gerar recibo", descricao: m || "Erro desconhecido" }),
};

/** CardDispositivo (cartão de Dispositivos). */
export const REGRAS_CARTAO_DISPOSITIVO: RegrasReciboLegal = {
  ponto: "cartao_dispositivo",
  empresaDa: "dispositivo",
  lojaNoPdf: "completa",
  validarLoja: (config) => {
    const validacao = validarConfiguracaoParaRecibos(config as ConfiguracaoLoja | null);
    if (validacao.valido) return null;
    return { titulo: "Dados da loja incompletos", descricao: `Complete os seguintes campos: ${validacao.camposFaltando.join(", ")}. Acesse Configurações para preencher.` };
  },
  resolverVendedor: vendedorComNomeECpf,
  validarDispositivo: semValidacao,
  falhaCompraNaoEncontrada: { titulo: "Erro", descricao: "Não foi possível encontrar os dados da compra" },
  falhaDispositivoNaoEncontrado: { titulo: "Erro ao gerar recibo", descricao: "Dispositivo não encontrado" },
  falhaInesperada: (m) => ({ titulo: "Erro ao gerar recibo", descricao: m || "Erro desconhecido" }),
};

/**
 * Tabela de compras (TabelaCompras; a mesma regra vale para TabelaComprasDesktop e
 * ListaComprasMobile, que não geravam). Vendedor nunca bloqueia: pessoa, ou o
 * fornecedor, ou "Vendedor não identificado".
 */
export const REGRAS_LISTA_COMPRAS: RegrasReciboLegal = {
  ponto: "lista_compras",
  empresaDa: "compra",
  lojaNoPdf: "completa",
  validarLoja: (config) => {
    if (!config) return { titulo: "Configure os dados da loja primeiro" };
    const validacao = validarConfiguracaoParaRecibos(config as ConfiguracaoLoja);
    if (validacao.valido) return null;
    return { titulo: `Complete os dados da loja antes de gerar recibos. Faltam: ${validacao.camposFaltando.join(", ")}`, configurar: true };
  },
  // Igual ao original: `compra.origem_pessoas || { nome: fornecedor || "Vendedor não identificado", ... }`.
  resolverVendedor: (compra) => ({
    vendedor: (compra.origem_pessoas as VendedorRecibo | null | undefined) || {
      nome: compra.fornecedores?.nome || "Vendedor não identificado",
      cpf_cnpj: "",
      endereco: "",
      telefone: "",
    },
  }),
  validarDispositivo: semValidacao,
  falhaCompraNaoEncontrada: { titulo: "Erro ao gerar recibo" },
  falhaDispositivoNaoEncontrado: { titulo: "Erro ao buscar dados do dispositivo" },
  falhaInesperada: (m) => ({ titulo: m || "Erro ao gerar recibo" }),
};

/** DialogVisualizacaoCompra (detalhes da compra). */
export const REGRAS_DETALHES_COMPRA: RegrasReciboLegal = {
  ponto: "detalhes_compra",
  empresaDa: "compra",
  lojaNoPdf: "basica",
  validarLoja: (config) => {
    if (!config) {
      return { titulo: "Erro ao buscar configuração", descricao: "Não foi possível encontrar as configurações da loja. Configure os dados da loja primeiro." };
    }
    const validacao = validarConfiguracaoParaRecibos(config as ConfiguracaoLoja);
    if (validacao.valido) return null;
    return {
      titulo: "Dados da loja incompletos",
      descricao: `Por favor, complete os seguintes campos nas configurações: ${validacao.camposFaltando.join(", ")}. Clique para configurar.`,
    };
  },
  resolverVendedor: (compra) => {
    let vendedor: VendedorRecibo;
    if (compra.pessoa_id) {
      if (!compra.origem_pessoas) {
        return { falha: { titulo: "Erro ao buscar vendedor", descricao: "Não foi possível encontrar os dados do vendedor" } };
      }
      vendedor = compra.origem_pessoas as VendedorRecibo;
    } else if (compra.fornecedor_id) {
      vendedor = { nome: compra.fornecedores?.nome || "Fornecedor não identificado", cpf_cnpj: "", endereco: "", telefone: "" };
    } else {
      return { falha: { titulo: "Erro", descricao: "Compra sem pessoa ou fornecedor associado" } };
    }
    if (!vendedor.nome) {
      return { falha: { titulo: "Dados do vendedor incompletos", descricao: "Por favor, complete o nome do vendedor" } };
    }
    return { vendedor };
  },
  validarDispositivo: (dispositivo) => {
    const camposFaltandoDispositivo: string[] = [];
    if (!dispositivo.marca) camposFaltandoDispositivo.push("Marca");
    if (!dispositivo.modelo) camposFaltandoDispositivo.push("Modelo");
    if (!dispositivo.tipo) camposFaltandoDispositivo.push("Tipo");
    if (camposFaltandoDispositivo.length === 0) return null;
    return { titulo: "Dados do dispositivo incompletos", descricao: `Por favor, complete os seguintes campos: ${camposFaltandoDispositivo.join(", ")}` };
  },
  falhaCompraNaoEncontrada: { titulo: "Erro ao gerar recibo", descricao: "Erro ao gerar recibo legal" },
  falhaDispositivoNaoEncontrado: { titulo: "Erro ao buscar dispositivo", descricao: "Não foi possível encontrar os dados do dispositivo" },
  falhaInesperada: (m) => ({ titulo: "Erro ao gerar recibo", descricao: m || "Erro ao gerar recibo legal" }),
};

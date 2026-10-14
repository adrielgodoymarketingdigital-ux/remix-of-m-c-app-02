/**
 * Dados do cliente compartilhados entre o cadastro em Clientes e a aba Cliente
 * da OS (os mesmos campos, em CamposDadosCliente). Módulo puro, testado com Deno
 * em scripts/testes-cadastro-cliente/.
 *
 * Endereço: clientes.endereco guarda a rua/logradouro e cada parte tem a sua
 * coluna (numero, bairro, cidade, estado, cep — migration
 * 20261014120000_clientes_campos_endereco.sql). Cliente antigo tem só
 * `endereco` (o texto inteiro, digitado livre) e as colunas novas vazias.
 */
import { aplicarMascaraCNPJ, aplicarMascaraCPF } from "../mascaras.ts";

/** Colunas de endereço de clientes além de `endereco` (a rua). */
export const CAMPOS_ENDERECO_CLIENTE = ["numero", "bairro", "cidade", "estado", "cep"] as const;
export type CampoEnderecoCliente = (typeof CAMPOS_ENDERECO_CLIENTE)[number];

/** Mesma máscara do campo "CPF / CNPJ" da OS: até 11 dígitos é CPF, acima disso CNPJ. */
export function mascararDocumento(valor: string): string {
  return valor.replace(/\D/g, "").length <= 11 ? aplicarMascaraCPF(valor) : aplicarMascaraCNPJ(valor);
}

/**
 * Campo único "CPF / CNPJ" → colunas cpf e cnpj de clientes. O documento digitado
 * vai para a coluna do tipo dele; a outra coluna mantém o que já estava gravado
 * (cliente antigo pode ter os dois).
 */
export function documentoParaColunas(
  documento: string,
  atual?: { cpf?: string | null; cnpj?: string | null } | null,
): { cpf: string; cnpj: string } {
  const doc = documento.trim();
  const ehCnpj = doc.replace(/\D/g, "").length > 11;
  if (!doc) {
    // Apagou o documento: limpa o que aparecia no campo (CPF, ou CNPJ se não havia CPF).
    if (atual?.cpf) return { cpf: "", cnpj: atual?.cnpj ?? "" };
    return { cpf: "", cnpj: "" };
  }
  return ehCnpj
    ? { cpf: atual?.cpf ?? "", cnpj: doc }
    : { cpf: doc, cnpj: atual?.cnpj ?? "" };
}

/** O que mostrar no campo "CPF / CNPJ" ao editar: o CPF, ou o CNPJ se não houver CPF. */
export function documentoDoCliente(cliente: { cpf?: string | null; cnpj?: string | null } | null | undefined): string {
  return cliente?.cpf || cliente?.cnpj || "";
}

// ── Gravação do cliente pela OS (criarOuAtualizarCliente) ──────────────────

export interface DadosClienteOS {
  nome: string;
  telefone: string;
  cpf: string;
  /** Rua / logradouro. */
  endereco: string;
  dataNascimento: string;
  /**
   * Partes do endereço. Ausente (undefined) = a tela não tem o campo e a coluna
   * não é tocada (OS simplificada); string vazia = o campo existe e foi apagado.
   */
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

export type ClienteRowOS = {
  nome: string | null;
  telefone: string | null;
  cpf: string | null;
  endereco: string | null;
  data_nascimento: string | null;
} & Partial<Record<CampoEnderecoCliente, string | null>>;

/** Linha a gravar em clientes a partir da tela da OS (só com as partes que a tela enviou). */
export function payloadClienteOS(dados: DadosClienteOS): ClienteRowOS {
  const payload: ClienteRowOS = {
    nome: dados.nome,
    telefone: dados.telefone,
    cpf: dados.cpf,
    endereco: dados.endereco,
    data_nascimento: dados.dataNascimento || null,
  };
  for (const campo of CAMPOS_ENDERECO_CLIENTE) {
    const valor = dados[campo];
    if (valor !== undefined) payload[campo] = valor.trim() || null;
  }
  return payload;
}

/** O cliente gravado difere do que a OS vai gravar? Só compara as colunas que vão no payload. */
export function clienteAlterado(atual: Partial<ClienteRowOS>, payload: ClienteRowOS): boolean {
  return (Object.keys(payload) as (keyof ClienteRowOS)[]).some((campo) =>
    campo === "data_nascimento"
      ? (atual.data_nascimento ?? null) !== (payload.data_nascimento ?? null)
      : (atual[campo] ?? "") !== (payload[campo] ?? ""),
  );
}

/**
 * Dados do cliente compartilhados entre o cadastro em Clientes e a aba Cliente
 * da OS (os mesmos campos, em CamposDadosCliente). Módulo puro, testado com Deno
 * em scripts/testes-cadastro-cliente/.
 *
 * A tabela clientes só tem UMA coluna de endereço (texto). CEP, número, bairro,
 * cidade e estado não têm coluna própria: no cadastro de Clientes eles são
 * gravados juntos em `endereco`, num texto legível ("Rua X, 123 - Bairro -
 * Cidade/UF - CEP 00000-000"), e separados de novo ao editar.
 */
import { aplicarMascaraCNPJ, aplicarMascaraCPF } from "../mascaras.ts";

export interface PartesEndereco {
  /** Rua / logradouro. */
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

export const ENDERECO_VAZIO: PartesEndereco = { endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "" };

const SEPARADOR = " - ";
const CEP_FINAL = /^CEP (\d{5}-?\d{3})$/;
const CIDADE_UF = /^(.*)\/([A-Z]{2})?$/;
const NUMERO = /^(\d+[A-Za-z]?|s\/n|S\/N|s\/nº|S\/Nº)$/;

/** Junta as partes num texto só, para a coluna clientes.endereco. Partes vazias ficam de fora. */
export function montarEnderecoCliente(p: PartesEndereco): string {
  const t = (s: string) => (s ?? "").trim();
  const rua = t(p.endereco);
  const numero = t(p.numero);
  const bairro = t(p.bairro);
  const cidade = t(p.cidade);
  const estado = t(p.estado).toUpperCase();
  const cep = t(p.cep);
  const partes: string[] = [];
  const ruaNumero = [rua, numero].filter(Boolean).join(", ");
  if (ruaNumero) partes.push(ruaNumero);
  if (bairro) partes.push(bairro);
  // Cidade sempre com a barra ("Cidade/UF", ou "Cidade/" sem UF): é o que a
  // distingue do bairro na hora de separar.
  if (cidade || estado) partes.push(`${cidade}/${estado}`);
  if (cep) partes.push(`CEP ${cep}`);
  return partes.join(SEPARADOR);
}

function separarSemConferir(texto: string): PartesEndereco {
  const segmentos = texto.split(SEPARADOR);
  const r: PartesEndereco = { ...ENDERECO_VAZIO };

  const ultimoCep = segmentos.length > 0 ? CEP_FINAL.exec(segmentos[segmentos.length - 1]) : null;
  if (ultimoCep) {
    r.cep = ultimoCep[1];
    segmentos.pop();
  }
  const cidadeUf = segmentos.length > 1 ? CIDADE_UF.exec(segmentos[segmentos.length - 1]) : null;
  if (cidadeUf) {
    r.cidade = cidadeUf[1];
    r.estado = cidadeUf[2] ?? "";
    segmentos.pop();
  }
  if (segmentos.length > 1) r.bairro = segmentos.pop() as string;

  const ruaNumero = segmentos.join(SEPARADOR);
  const i = ruaNumero.lastIndexOf(", ");
  const possivelNumero = i >= 0 ? ruaNumero.slice(i + 2) : "";
  if (i > 0 && NUMERO.test(possivelNumero)) {
    r.endereco = ruaNumero.slice(0, i);
    r.numero = possivelNumero;
  } else {
    r.endereco = ruaNumero;
  }
  return r;
}

/**
 * Separa o texto de clientes.endereco nas partes do formulário. Só separa quando
 * dá para remontar exatamente o mesmo texto; senão (endereço digitado livre, de
 * antes desta tela), tudo fica em "Endereço (Rua)" — salvar sem mexer nunca
 * altera o que já está gravado.
 */
export function separarEnderecoCliente(texto: string | null | undefined): PartesEndereco {
  const original = (texto ?? "").trim();
  if (!original) return { ...ENDERECO_VAZIO };
  const partes = separarSemConferir(original);
  return montarEnderecoCliente(partes) === original ? partes : { ...ENDERECO_VAZIO, endereco: original };
}

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

import { supabase } from "@/integrations/supabase/client";

export interface DadosClienteOS {
  nome: string;
  telefone: string;
  cpf: string;
  endereco: string;
  dataNascimento: string;
}

/**
 * Cria ou atualiza o cliente vinculado a uma OS, com isolamento por user_id.
 * - Se `clienteSelecionadoId` foi informado (autocomplete) e não é edição, atualiza esse cliente.
 * - Se `clienteIdExistente` foi informado (edição de OS), atualiza esse cliente.
 * - Caso contrário, cria um novo cliente.
 * Retorna o id do cliente resultante.
 */
export async function criarOuAtualizarCliente(
  effectiveUserId: string,
  dados: DadosClienteOS,
  clienteSelecionadoId: string | null,
  clienteIdExistente: string | null | undefined
): Promise<string> {
  const payload = {
    nome: dados.nome,
    telefone: dados.telefone,
    cpf: dados.cpf,
    endereco: dados.endereco,
    data_nascimento: dados.dataNascimento || null,
  };

  if (clienteSelecionadoId && !clienteIdExistente) {
    const { error } = await supabase
      .from("clientes")
      .update(payload)
      .eq("id", clienteSelecionadoId)
      .eq("user_id", effectiveUserId);

    if (error) throw error;
    return clienteSelecionadoId;
  }

  if (clienteIdExistente) {
    const { error } = await supabase
      .from("clientes")
      .update(payload)
      .eq("id", clienteIdExistente)
      .eq("user_id", effectiveUserId);

    if (error) throw error;
    return clienteIdExistente;
  }

  const { data: clienteData, error } = await supabase
    .from("clientes")
    .insert({ ...payload, user_id: effectiveUserId })
    .select()
    .single();

  if (error) throw error;
  return clienteData.id;
}

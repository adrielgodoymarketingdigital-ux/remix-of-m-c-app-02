import { supabase } from "@/integrations/supabase/client";

export interface DadosClienteOS {
  nome: string;
  telefone: string;
  cpf: string;
  endereco: string;
  dataNascimento: string;
}

type ClienteRow = {
  nome: string | null;
  telefone: string | null;
  cpf: string | null;
  endereco: string | null;
  data_nascimento: string | null;
};

function clienteAlterado(atual: ClienteRow, payload: ClienteRow): boolean {
  return (
    (atual.nome ?? "") !== (payload.nome ?? "") ||
    (atual.telefone ?? "") !== (payload.telefone ?? "") ||
    (atual.cpf ?? "") !== (payload.cpf ?? "") ||
    (atual.endereco ?? "") !== (payload.endereco ?? "") ||
    (atual.data_nascimento ?? null) !== (payload.data_nascimento ?? null)
  );
}

async function atualizarSeAlterado(
  clienteId: string,
  effectiveUserId: string,
  payload: ClienteRow
): Promise<void> {
  const { data: atual } = await supabase
    .from("clientes")
    .select("nome, telefone, cpf, endereco, data_nascimento")
    .eq("id", clienteId)
    .eq("user_id", effectiveUserId)
    .single();

  if (!atual || !clienteAlterado(atual, payload)) return;

  const { error } = await supabase
    .from("clientes")
    .update(payload)
    .eq("id", clienteId)
    .eq("user_id", effectiveUserId);

  if (error) throw error;
}

export async function criarOuAtualizarCliente(
  effectiveUserId: string,
  dados: DadosClienteOS,
  clienteSelecionadoId: string | null,
  clienteIdExistente: string | null | undefined
): Promise<string> {
  const payload: ClienteRow = {
    nome: dados.nome,
    telefone: dados.telefone,
    cpf: dados.cpf,
    endereco: dados.endereco,
    data_nascimento: dados.dataNascimento || null,
  };

  // Se o usuário selecionou um cliente diferente do cliente atual da OS,
  // apenas trocar o vínculo — não atualizar dados de nenhum cliente
  if (clienteSelecionadoId && clienteIdExistente && clienteSelecionadoId !== clienteIdExistente) {
    return clienteSelecionadoId;
  }

  if (clienteSelecionadoId && !clienteIdExistente) {
    await atualizarSeAlterado(clienteSelecionadoId, effectiveUserId, payload);
    return clienteSelecionadoId;
  }

  if (clienteIdExistente) {
    await atualizarSeAlterado(clienteIdExistente, effectiveUserId, payload);
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

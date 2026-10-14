import { supabase } from "@/integrations/supabase/client";
import { ClienteRowOS, DadosClienteOS, clienteAlterado, payloadClienteOS } from "@/lib/clientes/dadosCliente";

export type { DadosClienteOS } from "@/lib/clientes/dadosCliente";

async function atualizarSeAlterado(
  clienteId: string,
  effectiveUserId: string,
  payload: ClienteRowOS
): Promise<void> {
  const { data: atual } = await supabase
    .from("clientes")
    .select("*")
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
  // Partes do endereço (número, bairro…) só entram se a tela as enviou: quem não
  // tem esses campos (OS simplificada) não apaga o que já está no cadastro.
  const payload = payloadClienteOS(dados);

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

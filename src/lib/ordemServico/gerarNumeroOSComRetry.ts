import { supabase } from "@/integrations/supabase/client";

/**
 * Gera um número de OS único via RPC `generate_os_number`, repassando ao callback de
 * inserção e tentando novamente em caso de colisão (erro 23505), até `maxTentativas`.
 * Retorna o número de OS usado com sucesso pelo `inserir`.
 */
export async function gerarNumeroOSComRetry(
  effectiveUserId: string,
  inserir: (numeroOS: string) => Promise<{ error: any }>,
  maxTentativas = 5
): Promise<string> {
  let numeroOS: string | null = null;
  let insertError: any = null;

  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    const { data: novoNumeroOS, error: numeroError } = await supabase.rpc(
      "generate_os_number",
      { p_user_id: effectiveUserId }
    );

    if (numeroError) throw numeroError;

    numeroOS = novoNumeroOS;

    const { error } = await inserir(numeroOS!);

    if (!error) {
      insertError = null;
      break;
    }

    if (error.code === "23505") {
      console.log(`⚠️ [OS] Tentativa ${tentativa + 1}: número ${numeroOS} já existe, gerando novo...`);
      insertError = error;
      continue;
    }

    throw error;
  }

  if (insertError) throw insertError;

  return numeroOS!;
}

/**
 * Hora do servidor para o app, pela função agora_servidor() do banco
 * (migration 20261118120000). Enquanto a migration não for aplicada, ou se a
 * leitura falhar, vale o relógio do aparelho, como sempre foi.
 */
import { supabase } from "@/integrations/supabase/client";
import { criarRelogioServidor } from "./relogioServidor.core.ts";

// agora_servidor() ainda não está nos tipos gerados do banco.
type ClienteComRpc = {
  rpc: (funcao: string) => PromiseLike<{ data: unknown; error: unknown }>;
};

async function lerHoraServidor(): Promise<unknown> {
  const { data, error } = await (supabase as unknown as ClienteComRpc).rpc("agora_servidor");
  if (error) throw error;
  return data;
}

const relogio = criarRelogioServidor({ lerHoraServidor });

// Só começa a ouvir no primeiro uso: telas públicas nunca chamam a função.
let ouvindoVoltaATela = false;
function ouvirVoltaATela(): void {
  if (ouvindoVoltaATela || typeof document === "undefined") return;
  ouvindoVoltaATela = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void relogio.sincronizar({ forcar: true });
  });
}

export const relogioServidor = {
  ...relogio,
  sincronizar(opcoes?: { forcar?: boolean }): Promise<void> {
    ouvirVoltaATela();
    return relogio.sincronizar(opcoes);
  },
};

export type AvisoAdmin = {
  tipo: string;
  titulo: string;
  mensagem: string;
  dados: Record<string, unknown>;
};

export type ClienteAvisos = {
  from(tabela: "admin_notifications"): {
    insert(aviso: AvisoAdmin): PromiseLike<{ error: { code?: string; message: string } | null }>;
  };
};

// O aviso ao admin é acessório: se não gravar (CHECK do tipo, rede...), vai
// só para o log, com o tipo e o motivo (sem e-mail nem os dados do aviso), e
// a resposta do webhook e o resto do fluxo seguem iguais.
export async function registrarAviso(supabaseAdmin: ClienteAvisos, aviso: AvisoAdmin) {
  try {
    const { error } = await supabaseAdmin.from("admin_notifications").insert(aviso);
    if (error) avisoNaoGravado(aviso.tipo, [error.code, error.message].filter(Boolean).join(" "));
  } catch (err) {
    avisoNaoGravado(aviso.tipo, err instanceof Error ? err.message : String(err));
  }
}

// Uma linha só, no formato do log() do index.ts: fácil de filtrar no painel.
function avisoNaoGravado(tipo: string, motivo: string) {
  console.error(`[HOTMART-WEBHOOK] ❌ Aviso ao admin não gravado - ${JSON.stringify({ tipo, motivo })}`);
}

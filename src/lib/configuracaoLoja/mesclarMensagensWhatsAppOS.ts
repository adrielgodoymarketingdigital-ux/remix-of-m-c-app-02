// configuracoes_loja.mensagens_whatsapp_os guarda, na MESMA coluna, os modelos
// por status (slug), o "os_tracking" e as chaves "marketing_*". Cada tela só
// conhece uma parte: grava sempre mesclando sobre o valor recém-lido da linha,
// para uma tela não apagar as chaves da outra. Pura (testada com Deno).

export function mesclarMensagensWhatsAppOS(
  noBanco: unknown,
  novas: Record<string, string | undefined> | null | undefined,
): Record<string, string> {
  const base: Record<string, string> = {};
  if (noBanco && typeof noBanco === "object" && !Array.isArray(noBanco)) {
    for (const [k, v] of Object.entries(noBanco as Record<string, unknown>)) {
      if (typeof v === "string") base[k] = v;
    }
  }
  for (const [k, v] of Object.entries(novas ?? {})) {
    // undefined = "não mexer nesta chave".
    if (typeof v === "string") base[k] = v;
  }
  return base;
}

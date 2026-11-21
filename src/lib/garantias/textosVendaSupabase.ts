/**
 * garantias_textos_venda pelo supabase-js: só SELECT e INSERT (as policies não
 * deixam o app alterar nem apagar um texto congelado).
 */
import type { RepositorioTextosVenda } from "./vendaGarantia.ts";

// A tabela ainda não está nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteSupabase = { from: (tabela: string) => any };

export function repositorioTextosSupabase(cliente: ClienteSupabase): RepositorioTextosVenda {
  const tabela = () => cliente.from("garantias_textos_venda");
  return {
    async buscar(userId, md5) {
      const { data, error } = await tabela().select("id, texto").eq("user_id", userId).eq("texto_md5", md5).limit(1);
      if (error) throw error;
      const linha = (data ?? [])[0];
      return linha ? { id: String(linha.id), texto: String(linha.texto) } : null;
    },
    async inserir(userId, texto) {
      const { data, error } = await tabela().insert({ user_id: userId, texto }).select("id").single();
      if (error) throw error;
      return { id: String(data.id) };
    },
  };
}

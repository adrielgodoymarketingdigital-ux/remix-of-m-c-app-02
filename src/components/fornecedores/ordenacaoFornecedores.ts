// Ordenação local por nome da lista de fornecedores no computador. Sem consulta ao banco.
// "padrao" devolve a lista exatamente na ordem recebida (a mesma de hoje).

export type OrdemNomeFornecedor = "padrao" | "asc" | "desc";

/** Ciclo do clique no cabeçalho: padrão → crescente → decrescente → padrão. */
export function proximaOrdemNome(atual: OrdemNomeFornecedor): OrdemNomeFornecedor {
  if (atual === "padrao") return "asc";
  if (atual === "asc") return "desc";
  return "padrao";
}

const comparador = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

export function ordenarFornecedoresPorNome<T extends { nome: string | null | undefined }>(
  lista: readonly T[],
  ordem: OrdemNomeFornecedor,
): T[] {
  if (ordem === "padrao") return lista as T[];
  const sinal = ordem === "asc" ? 1 : -1;
  // sort é estável: nomes iguais mantêm a ordem original entre si.
  return [...lista].sort((a, b) => sinal * comparador.compare((a.nome ?? "").trim(), (b.nome ?? "").trim()));
}

// Supabase em memória para os testes das edge functions: só o que elas usam
// (select/eq/is/maybeSingle/update/insert/delete). `falhar` simula erro do banco.
type Linha = Record<string, unknown>;
type Op = "select" | "update" | "insert" | "delete";

export function bancoFake(
  tabelas: Record<string, Linha[]>,
  falhar: (tabela: string, op: Op, payload: Linha) => string | null = () => null,
) {
  const from = (tabela: string) => {
    let op: Op = "select";
    let payload: Linha = {};
    const filtros: [string, unknown][] = [];
    const linhas = () => (tabelas[tabela] ??= []).filter((r) => filtros.every(([c, v]) => r[c] === v));
    const executar = () => {
      const erro = falhar(tabela, op, payload);
      if (erro) return { data: null, error: { message: erro } };
      if (op === "update") linhas().forEach((r) => Object.assign(r, payload));
      if (op === "insert") (tabelas[tabela] ??= []).push({ ...payload });
      if (op === "delete") {
        const apagar = new Set(linhas());
        tabelas[tabela] = tabelas[tabela].filter((r) => !apagar.has(r));
      }
      return { data: op === "select" ? linhas() : null, error: null };
    };
    // deno-lint-ignore no-explicit-any
    const b: any = {
      select: () => b,
      eq: (c: string, v: unknown) => (filtros.push([c, v]), b),
      is: (c: string, v: unknown) => (filtros.push([c, v]), b),
      update: (p: Linha) => ((op = "update"), (payload = p), b),
      insert: (p: Linha) => ((op = "insert"), (payload = p), b),
      delete: () => ((op = "delete"), b),
      maybeSingle: () => {
        const r = executar();
        return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error });
      },
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, erro),
    };
    return b;
  };
  return { from };
}

/** fetch falso que registra as chamadas e responde com o status pedido (ou lança). */
export function fetchFake(resposta: number | Error, aoChamar?: (url: string, init?: RequestInit) => void) {
  const chamadas: { url: string; method?: string }[] = [];
  const fn = ((url: string, init?: RequestInit) => {
    chamadas.push({ url, method: init?.method });
    aoChamar?.(url, init);
    if (resposta instanceof Error) return Promise.reject(resposta);
    return Promise.resolve(new Response('{"message":"resposta de teste"}', { status: resposta }));
  }) as typeof fetch;
  return { fn, chamadas };
}

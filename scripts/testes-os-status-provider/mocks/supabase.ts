// Supabase simulado que CONTA requisições (como a aba Network) e emite eventos de login como
// o auth-js 2.80: INITIAL_SESSION para cada ouvinte novo; SIGNED_IN ao voltar à aba.
type Sessao = { user: { id: string } } | null;
export const contagem: Record<string, number> = {};
const conta = (k: string) => { contagem[k] = (contagem[k] ?? 0) + 1; };
export function zerarContagem() { for (const k of Object.keys(contagem)) delete contagem[k]; }

let sessao: Sessao = { user: { id: "dono-A" } };
const ouvintes = new Set<(ev: string, s: Sessao) => void>();
export function emitir(ev: string, novaSessao?: Sessao) {
  if (novaSessao !== undefined) sessao = novaSessao;
  for (const cb of [...ouvintes]) cb(ev, sessao);
}

// Banco: status por dono.
export const banco: Record<string, Array<Record<string, unknown>>> = {
  "dono-A": [
    { id: "a1", user_id: "dono-A", slug: "pendente", nome: "Aguardando peça", cor: "#111111", ordem: 1, ativo: true, is_sistema: true },
    { id: "a2", user_id: "dono-A", slug: "em_andamento", nome: "Na bancada", cor: "#222222", ordem: 2, ativo: true, is_sistema: true },
    { id: "a3", user_id: "dono-A", slug: "orcamento", nome: "Orçamento", cor: "#333333", ordem: 3, ativo: false, is_sistema: false },
  ],
  "dono-B": [
    { id: "b1", user_id: "dono-B", slug: "pendente", nome: "Fila da loja B", cor: "#bbbbbb", ordem: 1, ativo: true, is_sistema: true },
  ],
};

function consulta(tabela: string) {
  const filtros: Record<string, unknown> = {};
  let op = "select";
  let payload: Record<string, unknown> | null = null;
  const exec = () => {
    conta(`${tabela}:${op}`);
    if (tabela === "os_status_config" && op === "select") {
      const lista = (banco[String(filtros.user_id)] ?? []).slice().sort((a, b) => Number(a.ordem) - Number(b.ordem));
      return { data: lista, error: null };
    }
    if (tabela === "os_status_config" && op === "update") {
      for (const lista of Object.values(banco)) for (const s of lista) if (s.id === filtros.id) Object.assign(s, payload);
      return { data: null, error: null };
    }
    return { data: null, error: null }; // loja_funcionarios / empresa_usuarios: não é funcionário nem gerente
  };
  const q: Record<string, unknown> = {
    select: () => q, order: () => q, insert: () => { op = "insert"; return q; },
    update: (p: Record<string, unknown>) => { op = "update"; payload = p; return q; },
    delete: () => { op = "delete"; return q; },
    eq: (c: string, v: unknown) => { filtros[c] = v; return q; },
    maybeSingle: () => Promise.resolve(exec()),
    then: (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) => Promise.resolve(exec()).then(ok, err),
  };
  return q;
}

export const supabase = {
  from: (t: string) => consulta(t),
  auth: {
    getUser: async () => { conta("auth/v1/user"); return { data: { user: sessao?.user ?? null } }; },
    getSession: async () => ({ data: { session: sessao } }),
    onAuthStateChange: (cb: (ev: string, s: Sessao) => void) => {
      ouvintes.add(cb);
      queueMicrotask(() => cb("INITIAL_SESSION", sessao));
      return { data: { subscription: { unsubscribe: () => ouvintes.delete(cb) } } };
    },
  },
};

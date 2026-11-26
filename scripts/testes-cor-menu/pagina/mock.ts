// Dados fictícios (cópia do mock do Dashboard + cor do menu). Nenhuma requisição chega ao Supabase.
// ?tema=claro|escuro  ?visao=cliente|admin|funcionario  ?cor=1  ?queda=1
// ?plano=ativo|vencido|carencia|atrasado  ?carregando=1  ?sino=N
// ?menu=1f2937 (menu_cor gravada na loja, sem #)  ?lembrada=4a0e1c (cor no localStorage)
// ?filial=1 (dono com linha de filial)  ?porta=NNNN (porta da cópia da main)

const PORTA_DE_TESTE = new URLSearchParams(location.search).get("porta") ?? "8104";
if (location.port !== PORTA_DE_TESTE) {
  // Em outra porta, limpar o localStorage apagaria a sessão real daquela origem.
  document.body.textContent = `Abra esta página pela porta ${PORTA_DE_TESTE}.`;
  throw new Error("Página de teste fora da porta própria");
}

const q = new URLSearchParams(location.search);
const AGORA = Date.parse("2026-11-24T15:00:00-03:00");
const UID = "11111111-1111-4111-8111-111111111111";
const DONO = "22222222-2222-4222-8222-222222222222";

const funcionario = q.get("visao") === "funcionario";
const admin = q.get("visao") === "admin";
const queda = q.get("queda") === "1";
const plano = q.get("plano") ?? "ativo";
const carregando = q.get("carregando") === "1";
const dono = funcionario ? DONO : UID;
const baseOut = queda ? 300 : 200;
const baseNov = queda ? 150 : 300;
const despesaNov = queda ? 12000 : 0;
const despesaOut = queda ? 1000 : 0;
let naoLidas = Number(q.get("sino") ?? 12);

// O relógio começa em 24/11, a data das capturas, para o mês fictício ter 24 dias de dados.
const DataReal = Date;
const desvio = AGORA - DataReal.now();
class DataFicticia extends DataReal {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(DataReal.now() + desvio);
    else super(...(args as [number]));
  }
  static now() {
    return DataReal.now() + desvio;
  }
}
window.Date = DataFicticia as DateConstructor;

type Linha = Record<string, unknown>;
const dt = (m: number, d: number, h = 12) =>
  `2026-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00-03:00`;
const onda = (d: number) => 1 + 0.45 * Math.sin(d / 2.3) + (d % 5) * 0.08;

function montarBanco(): Record<string, Linha[]> {
  const vendas: Linha[] = [];
  const venda = (m: number, d: number, total: number, custo: number, tipo = "produto") =>
    vendas.push({ id: `v${vendas.length}`, user_id: dono, tipo, total, custo_unitario: custo, quantidade: 1, forma_pagamento: "pix", recebido: true, data: dt(m, d), data_recebimento: null, cancelada: false, deleted_at: null, parcela_numero: null, total_parcelas: null, valor_desconto_manual: 0, valor_desconto_cupom: 0, observacoes: null, peca_id: null, produto_id: null, grupo_venda: null });
  for (let d = 1; d <= 31; d++) { const v = baseOut * onda(d); venda(10, d, v, v * 0.55); venda(10, d, v * 0.4, v * 0.25, "dispositivo"); }
  for (let d = 1; d <= 24; d++) { const v = baseNov * onda(d); venda(11, d, v, v * 0.55); venda(11, d, v * 0.4, v * 0.25, "dispositivo"); }
  if (queda) venda(11, 24, 50, 600);

  const ordens: Linha[] = [];
  const os = (m: number, d: number, total: number, status: string, criada = dt(m, d)) =>
    ordens.push({ id: `o${ordens.length}`, numero_os: `${ordens.length + 1}`, user_id: dono, is_teste: false, deleted_at: null, status, total, servico_id: null, avarias: { servicos_realizados: [{ custo: total * 0.3 }] }, data_saida: status === "entregue" ? dt(m, d, 14) : null, created_at: criada, empresa_id: null });
  for (let d = 1; d <= 24; d += 2) os(11, d, baseNov * 1.5, "entregue");
  for (let d = 1; d <= 31; d += 2) os(10, d, baseOut * 1.5, "entregue");
  for (let i = 0; i < 31; i++) os(11, 1, 100, "em_andamento", dt(11, i < 25 ? 2 : 24));

  const contas: Linha[] = [];
  const conta = (id: string, valor: number, data: string) =>
    contas.push({ id, user_id: dono, tipo: "pagar", status: "pago", categoria: "Aluguel", nome: "Aluguel", valor, data, data_pagamento: data, os_numero: null, empresa_id: null });
  if (despesaNov) conta("c1", despesaNov, "2026-11-05");
  if (despesaOut) conta("c2", despesaOut, "2026-10-05");

  const notifications: Linha[] = [];
  for (let i = 0; i < Math.min(naoLidas, 50); i++) {
    const quando = new DataReal(AGORA - i * 3600e3).toISOString();
    notifications.push({ id: `n${i}`, user_id: UID, title: `Nova OS #${1000 - i} criada`, body: "iPhone 13 de Cliente Fictício entrou na bancada.", url: "/os", type: "SERVICE_ORDER_CREATED", sent_at: quando, opened_at: null, created_at: quando });
  }

  const planoFree = plano === "vencido";
  const statusPlano = plano === "atrasado" ? "past_due" : "active";
  const dataFim = planoFree ? "2026-10-01T12:00:00Z" : plano === "carencia" ? "2026-11-23T12:00:00Z" : "2027-03-21T12:00:00Z";
  const coresApp = q.get("cor") === "1"
    ? { card_faturamento_from: "#7c2d92", card_faturamento_via: "#be185d", card_faturamento_to: "#ea580c" }
    : null;
  const menu = q.get("menu");
  const cores = menu ? { ...(coresApp ?? {}), menu_cor: `#${menu}`, recibo_cabecalho_cor: "#7f1d1d" } : coresApp;

  return {
    vendas,
    contas,
    ordens_servico: ordens,
    notifications,
    assinaturas: [{ id: "a1", user_id: dono, plano_tipo: planoFree ? "free" : "profissional_mensal", plano_anterior: planoFree ? "profissional_mensal" : null, status: statusPlano, data_inicio: "2026-01-01T12:00:00Z", data_fim: dataFim, created_at: "2026-01-01T12:00:00Z" }],
    profiles: [{ id: UID, user_id: UID, nome: "Adriana Fictícia", email: "adriana@teste.invalid", idioma: "pt-BR", mercado: "BR", moeda: "BRL", pais: "BR", fuso_horario: "America/Sao_Paulo", onboarding_concluido: true }],
    configuracoes_loja: [
      { id: "cfg-m", user_id: dono, empresa_id: null, cores_personalizadas: cores, nome_loja: "Loja Fictícia" },
      ...(q.get("filial") === "1" ? [{ id: "cfg-f", user_id: dono, empresa_id: "filial-1", cores_personalizadas: { tracking_config: { cor_fundo: "#111111" } }, nome_loja: "Filial Fictícia" }] : []),
    ],
    loja_funcionarios: funcionario
      ? [{ id: "f1", funcionario_user_id: UID, loja_user_id: DONO, dono_id: DONO, ativo: true, nome: "Adriana", cargo: "Atendente", permissoes: { modulos: { dashboard: true, configuracoes: false, ordem_servico: true }, recursos: { ver_lucros: true, ver_custos: true }, dados: {} } }]
      : [],
    user_roles: admin ? [{ user_id: UID, role: "admin" }] : [],
    clientes: Array.from({ length: 162 }, (_, i) => ({ id: `cl${i}`, user_id: dono, deleted_at: null })),
    produtos: [
      ...Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, user_id: dono, deleted_at: null, nome: `Produto ${i}` })),
      { id: "apagado", user_id: dono, deleted_at: "2026-10-01T00:00:00Z", nome: "Apagado" },
    ],
    user_onboarding: [{ user_id: UID, onboarding_completed: true }],
  };
}

function filtrar(linhas: Linha[], url: URL): Linha[] {
  let saida = linhas;
  const valorEm = (x: Linha, k: string) => String(x[k]);
  const dataEm = (x: Linha, k: string) => Date.parse(String(x[k]));
  for (const [k, v] of url.searchParams.entries()) {
    if (["select", "order", "limit", "offset", "or", "and"].includes(k)) continue;
    if (saida.length && !(k in saida[0])) continue;
    if (v.startsWith("eq.")) saida = saida.filter((x) => valorEm(x, k) === v.slice(3));
    else if (v.startsWith("neq.")) saida = saida.filter((x) => valorEm(x, k) !== v.slice(4));
    else if (v === "is.null") saida = saida.filter((x) => x[k] == null);
    else if (v.startsWith("in.(")) {
      const lista = v.slice(4, -1).split(",").map((s) => s.replace(/"/g, ""));
      saida = saida.filter((x) => lista.includes(valorEm(x, k)));
    } else if (v.startsWith("gte.") && /data|created/.test(k)) {
      const limite = Date.parse(v.slice(4));
      saida = saida.filter((x) => dataEm(x, k) >= limite);
    } else if (v.startsWith("lte.") && /data|created/.test(k)) {
      const s = v.slice(4);
      const limite = Date.parse(s.length === 10 ? `${s}T23:59:59.999-03:00` : s);
      saida = saida.filter((x) => dataEm(x, k) <= limite);
    }
  }
  // or=(and(data.gte.X,data.lte.Y),...): vale o 1º intervalo, no campo de data da própria linha.
  const intervalo = url.searchParams.get("or")?.match(/gte\.([^,)]+),[a-z_.]*?lte\.([^,)]+)/);
  if (intervalo) {
    const [, de, ate] = intervalo;
    const a = Date.parse(de.length === 10 ? `${de}T00:00:00-03:00` : de);
    const b = Date.parse(ate.length === 10 ? `${ate}T23:59:59.999-03:00` : ate);
    saida = saida.filter((x) => {
      const t = Date.parse(String(x.data_saida || x.data_pagamento || x.data || x.created_at));
      return t >= a && t <= b;
    });
  }
  const limite = url.searchParams.get("limit");
  return limite ? saida.slice(0, Number(limite)) : saida;
}

const banco = montarBanco();
(window as unknown as { __banco: unknown; __gravacoes: unknown[] }).__banco = banco;
(window as unknown as { __gravacoes: unknown[] }).__gravacoes = [];
// Com ?carregando=1 estas tabelas nunca respondem; as de identidade respondem para a tela montar.
const TABELAS_DOS_NUMEROS = ["vendas", "ordens_servico", "contas", "clientes", "produtos"];

const json = (corpo: unknown, status = 200, cabecalhos: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json", ...cabecalhos } });
const usuario = { id: UID, aud: "authenticated", role: "authenticated", email: "adriana@teste.invalid", user_metadata: { full_name: "Adriana Fictícia" }, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" };

const fetchReal = window.fetch.bind(window);
window.fetch = async (entrada, init) => {
  const pedido = entrada instanceof Request ? entrada : null;
  const url = new URL(pedido ? pedido.url : String(entrada), location.href);
  if (url.origin === location.origin) return fetchReal(entrada, init);

  const metodo = (init?.method ?? pedido?.method ?? "GET").toUpperCase();
  if (url.hostname === "economia.awesomeapi.com.br") {
    return json({ USDBRL: { ask: "5.4383", bid: "5.43", pctChange: queda ? "0.42" : "-0.05" } });
  }
  if (url.pathname.startsWith("/auth/v1/user")) return json(usuario);
  if (url.pathname.startsWith("/auth/v1/logout")) return new Response(null, { status: 204 });
  if (url.pathname.startsWith("/auth/v1/recover")) return json({});

  const rest = url.pathname.match(/^\/rest\/v1\/(.+)$/);
  if (rest && !rest[1].startsWith("rpc/")) {
    const tabela = rest[1];
    if (carregando && TABELAS_DOS_NUMEROS.includes(tabela)) return new Promise<Response>(() => {});
    if (q.get("lento") === "1" && tabela === "configuracoes_loja" && metodo === "GET") return new Promise<Response>(() => {});
    if (metodo === "PATCH" && tabela === "configuracoes_loja") {
      const corpo = JSON.parse(String(init?.body ?? "{}"));
      const alvo = filtrar(banco.configuracoes_loja, url);
      alvo.forEach((l) => Object.assign(l, corpo));
      (window as unknown as { __gravacoes: unknown[] }).__gravacoes.push({ busca: url.search, corpo });
      return new Response(null, { status: 204 });
    }
    if (metodo === "PATCH") {
      if (tabela === "notifications") {
        const lidas = filtrar(banco.notifications, url);
        lidas.forEach((n) => { n.opened_at = new Date().toISOString(); });
        naoLidas = Math.max(0, naoLidas - lidas.length);
      }
      return new Response(null, { status: 204 });
    }
    if (metodo !== "GET" && metodo !== "HEAD") return new Response(null, { status: 204 });
    const linhas = filtrar(banco[tabela] ?? [], url);
    if (metodo === "HEAD") {
      const total = tabela === "notifications" ? naoLidas : linhas.length;
      return new Response(null, { status: 200, headers: { "content-range": `0-${Math.max(total - 1, 0)}/${total}` } });
    }
    const aceita = new Headers(init?.headers ?? pedido?.headers).get("accept") ?? "";
    if (aceita.includes("vnd.pgrst.object")) {
      return linhas.length ? json(linhas[0]) : json({ code: "PGRST116", message: "no rows" }, 406);
    }
    return json(linhas, 200, { "content-range": `0-${linhas.length}/${linhas.length}` });
  }
  if (rest || url.pathname.startsWith("/functions/")) return json([]);

  console.warn("[teste.local] requisição externa bloqueada:", url.href);
  throw new TypeError("Rede bloqueada na página de teste");
};

// Sempre começa do zero: identidade, tema e ocultar valores não vazam de um cenário para o outro.
localStorage.clear();
sessionStorage.clear();
const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const EXPIRA = 1900000000;
localStorage.setItem("sb-qztuzcchknptrvkdmdph-auth-token", JSON.stringify({
  access_token: `${b64({ alg: "HS256" })}.${b64({ sub: UID, exp: EXPIRA, role: "authenticated", aud: "authenticated" })}.x`,
  refresh_token: "r",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: EXPIRA,
  user: usuario,
}));
localStorage.setItem("theme", q.get("tema") === "escuro" ? "dark" : "light");
localStorage.setItem("mec_tutorial_completed", "true");
localStorage.setItem("banner_nfe_fechado_ate", String(1900000000000));
if (q.get("lembrada")) localStorage.setItem("mecapp_cor_menu", `#${q.get("lembrada")}`);

// Captcha simulado: em "Trocar senha" esta página não prova nada sobre o Turnstile real.
window.turnstile = {
  render(_alvo, opcoes) {
    setTimeout(() => (opcoes.callback as (token: string) => void)("token-ficticio"), 20);
    return "w";
  },
  reset() {},
  remove() {},
};

export {};

// Cores de cada plano (cards da aba "Ver planos" e colunas da aba "Comparar planos").
// Temas dos cards. Básico neutro, Intermediário neon azul (mais escolhido),
// Profissional violeta e Ultra dourado sobre preto (os dois níveis premium).
export type Tema = {
  borda: string; // degradê da borda (cards sem neon girando)
  fundo: string;
  halo: string; // cor do halo atrás do card
  haloSempre?: boolean;
  luz: string; // luz no topo
  linha: string; // linha fina no topo
  preco: string;
  centavos: string;
  equivale: string;
  botao: string;
  check: string;
  selo: string;
  rotulo?: string;
  coluna: string; // leve tinta da coluna na tabela de comparação
};

export const temas: Record<string, Tema> = {
  neutro: {
    coluna: "bg-white/[0.015]",
    borda: "bg-gradient-to-b from-white/20 via-white/[0.06] to-white/[0.03]",
    fundo: "bg-slate-900",
    halo: "rgba(59,130,246,0.45)",
    luz: "from-white/[0.06]",
    linha: "via-white/40",
    preco: "text-white",
    centavos: "text-white",
    equivale: "text-sky-300",
    botao: "border border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/10",
    check: "bg-white/10 text-sky-300",
    selo: "",
  },
  azul: {
    coluna: "bg-brand-500/[0.09]",
    borda: "",
    fundo: "bg-slate-950",
    halo: "rgba(59,130,246,0.45)",
    haloSempre: true,
    luz: "from-brand-600/30",
    linha: "via-sky-300",
    preco: "bg-gradient-to-b from-white via-sky-100 to-brand-400 bg-clip-text text-transparent",
    centavos: "text-sky-200",
    equivale: "text-sky-300",
    botao:
      "bg-gradient-to-r from-brand-600 via-brand-500 to-sky-500 text-white shadow-[0_0_0_1px_rgba(125,211,252,0.4),0_12px_32px_-8px_rgba(59,130,246,0.8)] hover:shadow-[0_0_0_1px_rgba(125,211,252,0.7),0_16px_40px_-8px_rgba(59,130,246,1)]",
    check: "bg-brand-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.8)]",
    selo: "bg-gradient-to-r from-brand-600 to-sky-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)]",
    rotulo: "Mais escolhido",
  },
  violeta: {
    coluna: "bg-violet-500/[0.08]",
    borda: "bg-gradient-to-br from-violet-400/80 via-indigo-500/30 to-fuchsia-400/50",
    fundo: "bg-[linear-gradient(160deg,#1e1b4b_0%,#0f0a24_45%,#0b0b14_100%)]",
    halo: "rgba(139,92,246,0.45)",
    luz: "from-violet-500/25",
    linha: "via-violet-300",
    preco: "bg-gradient-to-b from-white via-violet-100 to-violet-400 bg-clip-text text-transparent",
    centavos: "text-violet-200",
    equivale: "text-violet-300",
    botao:
      "bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 text-white shadow-[0_0_0_1px_rgba(196,181,253,0.35),0_12px_32px_-10px_rgba(139,92,246,0.9)] hover:shadow-[0_0_0_1px_rgba(196,181,253,0.6),0_16px_40px_-10px_rgba(139,92,246,1)]",
    check: "bg-violet-500 text-white shadow-[0_0_10px_rgba(139,92,246,0.8)]",
    selo: "border border-violet-300/40 bg-violet-500/15 text-violet-100",
    rotulo: "Premium",
  },
  ouro: {
    coluna: "bg-amber-400/[0.06]",
    borda: "bg-gradient-to-br from-amber-200 via-amber-500/40 to-yellow-300/80",
    fundo: "bg-[linear-gradient(160deg,#1c1508_0%,#0c0a06_45%,#050505_100%)]",
    halo: "rgba(245,158,11,0.35)",
    luz: "from-amber-400/20",
    linha: "via-amber-200",
    preco: "bg-gradient-to-b from-amber-50 via-amber-200 to-amber-500 bg-clip-text text-transparent",
    centavos: "text-amber-200",
    equivale: "text-amber-300",
    botao:
      "bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 text-amber-950 shadow-[0_0_0_1px_rgba(253,230,138,0.5),0_12px_32px_-10px_rgba(245,158,11,0.8)] hover:shadow-[0_0_0_1px_rgba(253,230,138,0.8),0_16px_40px_-10px_rgba(245,158,11,1)]",
    check: "bg-gradient-to-br from-amber-200 to-amber-500 text-amber-950 shadow-[0_0_10px_rgba(245,158,11,0.6)]",
    selo: "bg-gradient-to-r from-amber-200 to-amber-400 text-amber-950 shadow-[0_0_18px_rgba(245,158,11,0.5)]",
    rotulo: "Novo · Multi lojas",
  },
};

export const temaDo = (p: { destaque?: boolean; nome: string }) =>
  p.destaque ? temas.azul : p.nome === "Profissional" ? temas.violeta : p.nome === "Ultra" ? temas.ouro : temas.neutro;


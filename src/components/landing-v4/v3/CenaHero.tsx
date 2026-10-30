import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Celular } from "../components/Hero";
import { MensagemWhatsApp } from "../components/MensagemWhatsApp";
import { Rodizio, type Tela } from "../components/Rodizio";
import { StatusOS } from "../components/StatusOS";
import { useTemaClaro } from "./tema";

// VERSÃO 3/4 - cena do topo no estilo da referência do Adriel (2026-10-29):
// painel do computador inclinado em 3D com as telas reais trocando, celular inclinado na frente com o
// acompanhamento da OS, status da OS no alto e a mensagem do WhatsApp com uma seta.
// É um "palco" de 1152 x 660 px que é reduzido proporcionalmente (transform: scale) para caber na largura,
// então a composição fica igual em qualquer computador ou tablet.
// Animações: só transform e opacidade. Entrada em sequência, flutuação, e o mouse inclina a cena de leve
// (cada camada se move numa profundidade diferente). Com "reduzir movimento" fica tudo parado.

// Dois arranjos da mesma cena: "largo" (computador e tablet) e "estreito" (celular, em pé).
// No estreito os cartões ficam maiores (s) para continuar legíveis depois da redução.
type Pos = { left: number; top: number };
const ARRANJOS = {
  largo: {
    w: 1152,
    h: 660,
    bola: { left: -64, top: 96, size: 544 },
    painel: { left: 232, top: 34, w: 790 },
    icone: { left: 92, top: 62 },
    celular: { left: 70, top: 150, w: 236 },
    status: { left: 900, top: 96, s: 1.12 },
    seta: { left: 1010, top: 262 },
    whats: { left: 868, top: 372, s: 1.08 },
    sizes: "(min-width: 1024px) 790px, 70vw",
  },
  estreito: {
    w: 620,
    h: 730,
    bola: { left: -120, top: 250, size: 470 },
    painel: { left: 96, top: 92, w: 510 },
    icone: { left: 20, top: 104 },
    celular: { left: 44, top: 262, w: 200 },
    status: { left: 292, top: 0, s: 1.3 },
    seta: { left: 528, top: 372 },
    whats: { left: 262, top: 470, s: 1.32 },
    sizes: "85vw",
  },
} as const;
const pos = (p: Pos) => ({ left: p.left, top: p.top });

// Camada que se move com o mouse conforme a profundidade (px de deslocamento máximo)
function Camada({ prof, className = "", style, children }: { prof: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div
      className={`cena-camada absolute ${className}`}
      style={{ ...style, "--prof": `${prof}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}

function IconeGrafico() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
      <rect x="5" y="17" width="5" height="10" rx="2" fill="#2563eb" />
      <rect x="13.5" y="11" width="5" height="16" rx="2" fill="#2563eb" />
      <rect x="22" y="5" width="5" height="22" rx="2" fill="#2563eb" />
    </svg>
  );
}

export function CenaHero({
  telasComputador,
  acompanhamento,
  onTroca,
  rotulo,
  arranjo = "largo",
}: {
  arranjo?: keyof typeof ARRANJOS;
  telasComputador: Tela[];
  acompanhamento: Tela;
  onTroca: (i: number) => void;
  rotulo: string;
}) {
  const claro = useTemaClaro();
  const A = ARRANJOS[arranjo];
  const LARGURA = A.w;
  const ALTURA = A.h;
  const caixa = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  // mede antes de pintar (sem salto de layout) e acompanha mudanças de largura
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setEscala(Math.min(1, el.clientWidth / LARGURA));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [LARGURA]);

  // o mouse inclina a cena: grava -1..1 em variáveis CSS (sem re-render)
  const quadro = useRef(0);
  const aoMover = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const my = ((e.clientY - r.top) / r.height) * 2 - 1;
    cancelAnimationFrame(quadro.current);
    quadro.current = requestAnimationFrame(() => {
      palco.current?.style.setProperty("--mx", mx.toFixed(3));
      palco.current?.style.setProperty("--my", my.toFixed(3));
    });
  }, []);
  const aoSair = useCallback(() => {
    palco.current?.style.setProperty("--mx", "0");
    palco.current?.style.setProperty("--my", "0");
  }, []);

  return (
    <div ref={caixa} className="relative w-full" style={{ aspectRatio: `${LARGURA} / ${ALTURA}` }} onPointerMove={aoMover} onPointerLeave={aoSair}>
      <div
        ref={palco}
        className="cena-palco absolute left-0 top-0 origin-top-left"
        style={{ width: LARGURA, height: ALTURA, transform: `scale(${escala})` }}
      >
        {/* Fundo: bola azul atrás do celular */}
        <Camada prof={6} style={{ ...pos(A.bola), width: A.bola.size, height: A.bola.size }}>
          <div
            aria-hidden="true"
            className={`h-full w-full rounded-full bg-gradient-to-br from-brand-500 via-blue-500 to-cyan-400 ${claro ? "opacity-90" : "opacity-35"}`}
          />
        </Camada>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 bottom-0 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.22),transparent)]"
        />

        {/* Painel do computador inclinado */}
        <Camada prof={10} style={{ ...pos(A.painel), width: A.painel.w }}>
          <div className="cena-subir" style={{ "--d": "0ms" } as CSSProperties}>
            <div className="cena-inclinar-painel">
              <div className="hud rounded-2xl border t-borda t-sup p-2 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.45),0_0_80px_-20px_rgba(34,211,238,0.3)]">
                <div className="flex items-center gap-2 px-3 pb-2 pt-1 font-mono text-[12px] t-txt-4">
                  <span className="h-3 w-3 rounded-full bg-rose-400/80" aria-hidden="true" />
                  <span className="h-3 w-3 rounded-full bg-amber-300/80" aria-hidden="true" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400/80" aria-hidden="true" />
                  <span className="ml-3" aria-hidden="true">
                    mécapp / <span key={rotulo} className="anim-entrar inline-block">{rotulo}</span>
                  </span>
                  <span className="ml-auto flex items-center gap-1.5 t-ok">
                    <span className="anim-pulso h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                    online
                  </span>
                </div>
                <div className="relative overflow-hidden rounded-lg">
                  <Rodizio
                    telas={telasComputador}
                    prioridade
                    intervalo={3800}
                    sizes={A.sizes}
                    onTroca={onTroca}
                    className="aspect-[1258/677] bg-white"
                  />
                  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[12%]">
                    <div className="anim-varrer h-full w-full bg-gradient-to-b from-transparent via-cyan-300/20 to-transparent" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Camada>

        {/* Ícone de gráfico flutuando */}
        <Camada prof={22} style={pos(A.icone)}>
          <div className="cena-entrar-esq" style={{ "--d": "500ms" } as CSSProperties}>
            <div className="anim-flutuar-3 flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-slate-200/70 bg-white shadow-xl shadow-slate-900/10">
              <IconeGrafico />
            </div>
          </div>
        </Camada>

        {/* Celular inclinado na frente, com o acompanhamento da OS */}
        <Camada prof={26} className="z-10" style={{ ...pos(A.celular), width: A.celular.w }}>
          <div className="cena-entrar-esq" style={{ "--d": "200ms" } as CSSProperties}>
            <div className="cena-inclinar-celular">
              <div className="anim-flutuar-2 rounded-[2.5rem] shadow-[30px_40px_60px_-20px_rgba(15,23,42,0.45)]">
                <Celular prioridade telas={[acompanhamento]} />
              </div>
            </div>
          </div>
        </Camada>

        {/* Status da OS no alto, à direita */}
        <Camada prof={18} className="z-10" style={pos(A.status)}>
          <div className="cena-cair" style={{ "--d": "650ms" } as CSSProperties}>
            <div className="anim-flutuar">
              <div className="origin-top-left" style={{ transform: `rotate(-2deg) scale(${A.status.s})` }}>
                <StatusOS />
              </div>
            </div>
          </div>
        </Camada>

        {/* Seta curva apontando para a mensagem */}
        <Camada prof={14} className="z-10" style={pos(A.seta)}>
          <div className="cena-entrar-dir" style={{ "--d": "1100ms" } as CSSProperties}>
            <svg viewBox="0 0 60 90" className="cena-seta h-[90px] w-[60px] text-brand-600" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M30 4c22 10 26 40 6 74" />
              <path d="M22 70l14 10 6-16" />
            </svg>
          </div>
        </Camada>

        {/* Mensagem do WhatsApp com o link de acompanhamento */}
        <Camada prof={20} className="z-10" style={pos(A.whats)}>
          <div className="cena-entrar-dir" style={{ "--d": "900ms" } as CSSProperties}>
            <div className="anim-flutuar-3">
            <div className="relative origin-top-left" style={{ transform: `scale(${A.whats.s})` }}>
              <span className="absolute -right-1 -top-1 z-10 flex h-3.5 w-3.5" aria-hidden="true">
                <span className="anim-pulso absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
              </span>
              <MensagemWhatsApp />
            </div>
            </div>
          </div>
        </Camada>
      </div>
    </div>
  );
}

// Três destaques embaixo da cena (como na referência)
const destaques = [
  {
    titulo: "Sistema completo",
    texto: "Gerencie estoque, vendas e OS",
    cor: "bg-blue-500/10 text-blue-500",
    icone: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  },
  {
    titulo: "No celular e computador",
    texto: "Acesse de onde estiver",
    cor: "bg-violet-500/10 text-violet-500",
    icone: (
      <>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
      </>
    ),
  },
  {
    titulo: "Mais produtividade",
    texto: "Organize e cresça sua assistência",
    cor: "bg-emerald-500/10 text-emerald-500",
    icone: (
      <>
        <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </>
    ),
  },
];

export function DestaquesHero({ className = "" }: { className?: string }) {
  return (
    <ul className={`grid gap-4 sm:grid-cols-3 sm:gap-6 ${className}`}>
      {destaques.map((d, i) => (
        <li
          key={d.titulo}
          className="anim-entrar flex items-center gap-4"
          style={{ "--d": `${1200 + i * 120}ms` } as CSSProperties}
        >
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${d.cor}`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {d.icone}
            </svg>
          </span>
          <span>
            <span className="block font-display font-semibold t-txt">{d.titulo}</span>
            <span className="block text-sm t-txt-3">{d.texto}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

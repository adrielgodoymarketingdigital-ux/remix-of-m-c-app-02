import { cn } from "@/lib/utils";

interface BannerFinanceiroProps {
  className?: string;
}

/**
 * Faixa de abertura da tela Financeiro: título da página + frase de apoio,
 * com uma ilustração leve (carteira, moeda e barras) feita em SVG inline.
 * A ilustração é só enfeite: não representa nenhum dado.
 */
export function BannerFinanceiro({ className }: BannerFinanceiroProps) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-2xl px-5 py-6 sm:px-8 sm:py-8 text-white",
        "bg-gradient-to-br from-sidebar-accent via-sidebar-background to-primary",
        "shadow-[0_10px_30px_-12px_hsl(var(--primary)/0.45)]",
        className,
      )}
    >
      {/* brilho diagonal de fundo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/3 -z-10 h-72 w-72 rotate-45 rounded-[3rem] bg-white/[0.04]"
      />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-white/65">
            Financeiro
          </h1>
          <p className="mt-3 text-[1.375rem] leading-tight sm:text-3xl lg:text-4xl font-bold tracking-tight text-balance">
            Gestão completa de contas,{" "}
            <span className="text-sidebar-primary">lucros e custos</span>
          </p>
        </div>

        <IlustracaoCarteira className="h-24 w-[34%] max-w-[180px] shrink-0 sm:h-32 lg:h-36" />
      </div>
    </section>
  );
}

function IlustracaoCarteira({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 180 130"
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <defs>
        <linearGradient id="fin-carteira" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b8cff" />
          <stop offset="0.65" stopColor="#0b2350" />
        </linearGradient>
        <linearGradient id="fin-cartao" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8fd0ff" />
          <stop offset="1" stopColor="#2374ea" />
        </linearGradient>
        <linearGradient id="fin-barra" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6bb5ff" />
          <stop offset="1" stopColor="#0752cf" />
        </linearGradient>
      </defs>

      {/* carteira */}
      <g transform="rotate(-6 70 70)">
        <rect x="22" y="22" width="100" height="22" rx="7" fill="url(#fin-cartao)" transform="rotate(-6 72 33)" />
        <rect x="12" y="34" width="118" height="78" rx="14" fill="url(#fin-carteira)" stroke="#639cff" strokeWidth="2" />
        <rect x="98" y="58" width="32" height="24" rx="8" fill="#0b2350" stroke="#639cff" strokeWidth="1.5" />
        <circle cx="110" cy="70" r="4" fill="#639cff" />
      </g>

      {/* moeda */}
      <circle cx="58" cy="100" r="22" fill="#12306a" stroke="#4d8dff" strokeWidth="3" />
      {/* cifrão desenhado (traço, não texto) */}
      <path
        d="M65 91c-2-3-5-4-8-4-4 0-7 2-7 5.5 0 7.5 15 4.5 15 12.5 0 3.5-3.5 6-8 6-3.5 0-6.5-1.5-8-4.5M57.5 83v34"
        fill="none"
        stroke="#99c8ff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* barras */}
      <rect x="128" y="88" width="13" height="42" rx="4" fill="url(#fin-barra)" />
      <rect x="145" y="66" width="13" height="64" rx="4" fill="url(#fin-barra)" />
      <rect x="162" y="40" width="13" height="90" rx="4" fill="url(#fin-barra)" />
    </svg>
  );
}

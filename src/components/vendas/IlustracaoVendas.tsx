import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Ilustração decorativa do cabeçalho de Vendas: sacola azul sobre duas barras,
 * num quadrado azul-claro. SVG próprio (sem ícone/fonte externa).
 */
export function IlustracaoVendas({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const corpo = `ilv-corpo-${id}`;
  const lateral = `ilv-lateral-${id}`;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[22px] min-[391px]:rounded-[25px]",
        "bg-[linear-gradient(145deg,#E8F1FF,#D9E8FF)] dark:bg-[linear-gradient(145deg,hsl(var(--primary)/0.18),hsl(var(--primary)/0.08))]",
        "h-[85px] w-[85px] min-[391px]:h-[105px] min-[391px]:w-[105px] md:h-[125px] md:w-[125px]",
        className,
      )}
    >
      <svg viewBox="0 0 105 105" className="h-full w-full">
        <defs>
          <linearGradient id={corpo} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4C8DFF" />
            <stop offset="1" stopColor="#1554F5" />
          </linearGradient>
          <linearGradient id={lateral} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1D4ED8" />
            <stop offset="1" stopColor="#1E3A8A" />
          </linearGradient>
        </defs>

        {/* Barras */}
        <rect x="17" y="56" width="12" height="32" rx="6" fill="#A8D1FF" />
        <rect x="36" y="39" width="12" height="49" rx="6" fill="#84BCFF" />

        {/* Sacola (levemente inclinada, com sombra) */}
        <g transform="rotate(-6 70 50)" style={{ filter: "drop-shadow(0 8px 8px rgba(36,107,255,.25))" }}>
          <path d="M60 22 a10 10 0 0 1 20 0 v8" fill="none" stroke="#1554F5" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M84 30 l5 3 l3 43 l-5 3 z" fill={`url(#${lateral})`} />
          <rect x="50" y="30" width="38" height="49" rx="7" fill={`url(#${corpo})`} />
          <path d="M60 22 v8 M80 22 v8" stroke="#0F3BB8" strokeWidth="4.5" strokeLinecap="round" />
          {/* Detalhe branco */}
          <path d="M59 45 h20 v4 a10 10 0 0 1 -20 0 z" fill="#fff" opacity=".95" />
        </g>
      </svg>
    </div>
  );
}

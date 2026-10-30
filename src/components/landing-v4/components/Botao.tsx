import { forwardRef, type ReactNode } from "react";
import { IconeSeta } from "./Icones";

// Botão do MecApp: retângulo de cantos 12px, azul da marca, Sora.
// Microinterações: sobe 2px e ganha brilho no hover, afunda no clique, seta anda para a direita.
const base =
  "group brilho inline-flex items-center justify-center gap-2 rounded-xl font-display font-semibold transition-[transform,background-color,border-color,box-shadow] duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]";

const variantes = {
  principal: "bg-brand-600 text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.8)] hover:bg-brand-700",
  contorno: "border border-slate-300 bg-white text-slate-900 hover:border-slate-400",
  branco: "bg-white text-brand-700 shadow-[0_10px_24px_-12px_rgba(2,6,23,0.5)]",
} as const;

const tamanhos = {
  md: "h-11 px-4 text-sm",
  lg: "h-14 whitespace-nowrap px-7 text-base max-[359px]:px-4",
} as const;

type Props = {
  href: string;
  children: ReactNode;
  variante?: keyof typeof variantes;
  tamanho?: keyof typeof tamanhos;
  seta?: boolean;
  className?: string;
  tabIndex?: number;
};

export const Botao = forwardRef<HTMLAnchorElement, Props>(function Botao(
  { href, children, variante = "principal", tamanho = "lg", seta, className = "", tabIndex },
  ref,
) {
  return (
    <a ref={ref} href={href} tabIndex={tabIndex} className={`${base} ${variantes[variante]} ${tamanhos[tamanho]} ${className}`}>
      {children}
      {seta && <IconeSeta className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />}
    </a>
  );
});

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TextoAjustadoProps {
  children: ReactNode;
  /** Quantidade de caracteres do texto exibido (ex.: "R$ 1.234.567,89" = 15). */
  caracteres: number;
  /** Limites da fonte, em px. */
  min: number;
  max: number;
  /** Tamanho usado por navegadores sem container query (iOS < 16). */
  classeReserva: string;
  className?: string;
  /** Classes da área medida (ex.: espaço reservado à direita). */
  classeContainer?: string;
}

/**
 * Valor numa linha só que diminui a fonte para caber na largura disponível
 * (container query `cqw`), entre `min` e `max` — sem cortar dígitos.
 * Largura média de um caractere em Inter extrabold ≈ 0,57em (medido com "R$ 1.234.567,89").
 */
export function TextoAjustado({ children, caracteres, min, max, classeReserva, className, classeContainer }: TextoAjustadoProps) {
  const porCaractere = 100 / (Math.max(caracteres, 1) * 0.57);
  return (
    <span className={cn("block min-w-0", classeContainer)}>
      <span className="block min-w-0 [container-type:inline-size]">
      <span
        className={cn("block whitespace-nowrap", classeReserva, className)}
        style={{ fontSize: `clamp(${min}px, ${porCaractere.toFixed(2)}cqw, ${max}px)` }}
      >
        {children}
      </span>
      </span>
    </span>
  );
}

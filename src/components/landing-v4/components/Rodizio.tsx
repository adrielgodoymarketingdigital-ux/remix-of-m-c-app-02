import { useEffect, useRef, useState } from "react";

// Troca sozinha entre várias telas reais do app (cruzando com opacidade + leve zoom, só transform/opacity).
// - A 1ª tela fica no fluxo normal (dá o tamanho e é a imagem que carrega primeiro); as outras ficam por cima.
// - As outras telas só são carregadas depois de ~2,5 s, para não atrasar a abertura da página.
// - Só troca enquanto está visível na tela; com "reduzir movimento" fica parada na 1ª tela.
export type Tela = { src: string; srcSet?: string; w: number; h: number; alt: string; rotulo?: string };

export function Rodizio({
  telas,
  intervalo = 3500,
  prioridade = false,
  sizes,
  onTroca,
  className = "",
}: {
  telas: Tela[];
  intervalo?: number;
  prioridade?: boolean;
  sizes?: string;
  onTroca?: (i: number) => void;
  className?: string;
}) {
  const [atual, setAtual] = useState(0);
  const [carregarTodas, setCarregarTodas] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const varias = telas.length > 1;

  useEffect(() => {
    if (!varias) return;
    const t = window.setTimeout(() => setCarregarTodas(true), 2500);
    return () => window.clearTimeout(t);
  }, [varias]);

  useEffect(() => {
    if (!varias || !carregarTodas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = caixa.current;
    let relogio = 0;
    const ligar = () => {
      if (relogio) return;
      relogio = window.setInterval(() => setAtual((v) => (v + 1) % telas.length), intervalo);
    };
    const desligar = () => {
      window.clearInterval(relogio);
      relogio = 0;
    };
    const obs = new IntersectionObserver(([e]) => (e.isIntersecting ? ligar() : desligar()));
    if (el) obs.observe(el);
    return () => {
      obs.disconnect();
      desligar();
    };
  }, [varias, carregarTodas, intervalo, telas.length]);

  useEffect(() => onTroca?.(atual), [atual, onTroca]);

  return (
    <div ref={caixa} className={`relative overflow-hidden ${className}`}>
      {telas.map((t, i) => {
        if (i > 0 && !carregarTodas) return null;
        const ativa = i === atual;
        return (
          <img
            key={t.src}
            src={t.src}
            srcSet={t.srcSet}
            sizes={sizes}
            width={t.w}
            height={t.h}
            alt={t.alt}
            aria-hidden={!ativa}
            fetchPriority={i === 0 && prioridade ? "high" : undefined}
            loading={i === 0 && prioridade ? "eager" : "lazy"}
            decoding="async"
            className={`block h-full w-full object-cover object-top transition-[opacity,transform] duration-700 ease-out ${
              i === 0 ? "relative" : "absolute inset-0"
            } ${ativa ? "scale-100 opacity-100" : "scale-[1.03] opacity-0"}`}
          />
        );
      })}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

// Troca sozinha entre várias telas reais do app (cruzando com opacidade + leve zoom, só transform/opacity).
// - A 1ª tela fica no fluxo normal (dá o tamanho e é a imagem que carrega primeiro); as outras ficam por cima.
// - As outras telas só são carregadas depois que a 1ª terminou de baixar, a página terminou de carregar e o
//   navegador ficou livre (e nunca antes de ~2,5 s), para não disputar a internet com a abertura da página.
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
  const [primeiraPronta, setPrimeiraPronta] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const primeira = useRef<HTMLImageElement>(null);
  const varias = telas.length > 1;

  // A 1ª imagem pode já estar pronta (cache) antes do onLoad ser ligado
  useEffect(() => {
    if (primeira.current?.complete) setPrimeiraPronta(true);
  }, []);

  useEffect(() => {
    if (!varias || !primeiraPronta) return;
    let cancelado = false;
    let idOcioso = 0;
    let relogio = 0;
    const liberar = () => {
      if (!cancelado) setCarregarTodas(true);
    };
    // Espera a página terminar de carregar e o navegador ficar livre
    const quandoLivre = () => {
      if (typeof window.requestIdleCallback === "function") idOcioso = window.requestIdleCallback(liberar, { timeout: 3000 });
      else relogio = window.setTimeout(liberar, 200);
    };
    // Mínimo de 2,5 s (o mesmo de antes), para o carrossel começar a girar no mesmo momento em rede rápida
    const minimo = window.setTimeout(() => {
      if (document.readyState === "complete") quandoLivre();
      else window.addEventListener("load", quandoLivre, { once: true });
    }, 2500);
    return () => {
      cancelado = true;
      window.clearTimeout(minimo);
      window.clearTimeout(relogio);
      if (idOcioso && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idOcioso);
      window.removeEventListener("load", quandoLivre);
    };
  }, [varias, primeiraPronta]);

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
            ref={i === 0 ? primeira : undefined}
            onLoad={i === 0 ? () => setPrimeiraPronta(true) : undefined}
            onError={i === 0 ? () => setPrimeiraPronta(true) : undefined}
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

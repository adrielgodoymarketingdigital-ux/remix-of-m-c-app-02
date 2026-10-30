import { useEffect, useRef, useState, type CSSProperties } from "react";

// Fundador: foto real + história (texto da landing atual, resumido). "Mais de 6 anos" confirmado no brief.
// Contador animado SÓ neste número verdadeiro.

function Contador({ ate, duracao = 700 }: { ate: number; duracao?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [valor, setValor] = useState(ate);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    setValor(0);
    let quadro = 0;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        const inicio = performance.now();
        const passo = (t: number) => {
          const p = Math.min(1, (t - inicio) / duracao);
          setValor(Math.round(ate * (1 - Math.pow(1 - p, 3))));
          if (p < 1) quadro = requestAnimationFrame(passo);
        };
        quadro = requestAnimationFrame(passo);
      },
      { threshold: 0.6 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(quadro);
    };
  }, [ate, duracao]);

  return (
    <span ref={ref} className="tabular-nums">
      {valor}
    </span>
  );
}

export function Fundador() {
  return (
    <section aria-labelledby="fundador-titulo" className="overflow-hidden bg-slate-50 py-24 md:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <div data-reveal className="relative lg:col-span-5">
          <img
            src="/img/adriel-fundador-640.webp"
            srcSet="/img/adriel-fundador-640.webp 640w, /img/adriel-fundador-960.webp 960w"
            sizes="(min-width: 1024px) 460px, 92vw"
            width={640}
            height={962}
            alt="Adriel, fundador do MécApp, segurando dois iPhones"
            loading="lazy"
            decoding="async"
            className="block h-auto w-full max-w-md rounded-3xl object-cover"
          />
          <div
            data-reveal
            style={{ "--i": 2 } as CSSProperties}
            className="absolute -bottom-6 right-0 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-xl shadow-slate-900/10 sm:right-6 lg:-right-8"
          >
            <p className="font-display text-4xl font-bold text-slate-950">
              +<Contador ate={6} /> anos
            </p>
            <p className="text-sm text-slate-600">no balcão de uma assistência técnica</p>
          </div>
        </div>

        <div className="lg:col-span-7">
          <p data-reveal className="text-sm font-semibold text-brand-600">
            Quem fez o MécApp
          </p>
          <h2
            id="fundador-titulo"
            data-reveal
            style={{ "--i": 1 } as CSSProperties}
            className="mt-3 font-display text-4xl font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl"
          >
            Feito por quem vive o dia a dia de uma assistência.
          </h2>
          <div data-reveal style={{ "--i": 2 } as CSSProperties} className="mt-6 space-y-4 text-lg leading-relaxed text-slate-600">
            <p>
              Meu nome é Adriel. Há mais de 6 anos eu vivo a rotina de uma assistência técnica: loja cheia, cliente cobrando,
              aparelho entrando e saindo… e no fim do dia a dúvida: <strong className="text-slate-950">eu tive lucro ou só trabalhei muito?</strong>
            </p>
            <p>
              Os sistemas que eu testei eram complicados, caros e feitos por quem nunca pisou numa bancada. Então eu criei o
              MécApp: simples, direto e pensado para o dia a dia real da loja.
            </p>
          </div>
          <blockquote
            data-reveal
            style={{ "--i": 3 } as CSSProperties}
            className="mt-8 border-l-2 border-brand-600 pl-5 font-display text-xl font-semibold text-slate-950"
          >
            “Se ele transformou a minha assistência, pode transformar a sua também.”
            <footer className="mt-2 font-sans text-sm font-medium text-slate-500">Adriel, fundador do MécApp</footer>
          </blockquote>
        </div>
      </div>
    </section>
  );
}

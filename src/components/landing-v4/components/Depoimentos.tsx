import { LINKS } from "../links";
import { Botao } from "./Botao";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// Depoimentos REAIS em mural (grade em colunas, estilo Pinterest): todos aparecem de uma vez, cada print no tamanho dele.
// No celular aparecem os 3 primeiros e um botão mostra o resto. Nomes, logos e telefones foram borrados.
// As frases em destaque são transcrições literais das mensagens dos prints (nada inventado).

type Depo = {
  frase: string;
  origem: string;
  midia: ReactNode;
};

// Print de conversa sobre o fundo do WhatsApp, no tamanho natural (sem espaço vazio em volta)
function Print({ src, w, h, alt }: { src: string; w: number; h: number; alt: string }) {
  return (
    <div className="bg-[#EFEAE2] p-3 sm:p-4">
      <img src={src} width={w} height={h} alt={alt} loading="lazy" decoding="async" className="block h-auto w-full rounded-[0.5rem]" />
    </div>
  );
}

function IconeWhatsApp({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.5-.3Z" />
    </svg>
  );
}

function Video({ aoTocar }: { aoTocar: (tocando: boolean) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [tocando, setTocando] = useState(false);
  // A capa só é baixada quando a seção chega perto da tela (o tamanho do vídeo já é fixo pela proporção,
  // então nada pula quando ela aparece). O vídeo em si continua só baixando ao clicar (preload="none").
  const [perto, setPerto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setPerto(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setPerto(true);
          obs.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div className="relative bg-slate-900">
      <video
        ref={ref}
        src="/video/depoimento.mp4"
        poster={perto ? "/img/depo-video-capa.webp" : undefined}
        preload="none"
        playsInline
        controls={tocando}
        width={540}
        height={774}
        className="block aspect-[4/5] h-auto w-full object-cover object-top"
        onPlay={() => aoTocar(true)}
        onPause={() => aoTocar(false)}
        onEnded={() => aoTocar(false)}
        aria-label="Vídeo: áudios de um cliente no WhatsApp contando como está usando o MécApp"
      />
      {!tocando && (
        <button
          type="button"
          onClick={() => {
            setTocando(true);
            ref.current?.play();
          }}
          className="group absolute inset-0 flex items-end justify-start bg-gradient-to-t from-slate-950/60 via-transparent p-4"
          aria-label="Assistir ao depoimento em vídeo"
        >
          <span className="flex items-center gap-3 rounded-full bg-white py-2 pl-2 pr-5 font-display text-sm font-semibold text-slate-950 shadow-[0_10px_15px_-3px_rgb(0_0_0/0.1),0_4px_6px_-4px_rgb(0_0_0/0.1)] transition-transform duration-300 group-hover:scale-105">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white">
              <svg viewBox="0 0 20 20" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M6 4.5v11l9-5.5-9-5.5Z" />
              </svg>
            </span>
            Ouvir o cliente
          </span>
        </button>
      )}
    </div>
  );
}

// cta: no celular, mostra também um botão de teste grátis logo depois da lista (usado na v3/v4).
// O card de chamada "Seja o próximo" aparece em todas as versões, no fim da 3ª coluna.
export function Depoimentos({ cta = false }: { cta?: boolean }) {
  const [todos, setTodos] = useState(false);

  const depoimentos: Depo[] = [
    {
      frase: "Melhor sistema que tem. Tô testando hoje e já me surpreendeu bastante.",
      origem: "Story de um lojista",
      midia: (
        <img
          src="/img/depo-story-tablet.webp"
          width={560}
          height={1000}
          alt="Story de um cliente com o MécApp aberto no tablet da bancada"
          loading="lazy"
          decoding="async"
          className="block aspect-[4/5] h-auto w-full object-cover object-[50%_20%]"
        />
      ),
    },
    {
      frase: "Gostei muito. Tem tudo que preciso.",
      origem: "Lojista, pelo WhatsApp",
      midia: <Print src="/img/depo-whatsapp-1.webp" w={760} h={362} alt="Conversa no WhatsApp: cliente responde que gostou muito e que o sistema tem tudo o que precisa" />,
    },
    {
      frase: "Áudios de um cliente contando como está usando o sistema.",
      origem: "Lojista, pelo WhatsApp",
      midia: <Video aoTocar={() => {}} />,
    },
    {
      frase: "Vocês respondem rápido e dão a maior atenção.",
      origem: "Lojista, pelo WhatsApp",
      midia: (
        <Print
          src="/img/depo-whatsapp-5.webp"
          w={760}
          h={212}
          alt="Conversa no WhatsApp: cliente elogia que a equipe responde rápido e dá atenção e espera uma parceria de longa duração"
        />
      ),
    },
    {
      frase: "Muito bom, bem fácil de mexer.",
      origem: "Lojista, pelo WhatsApp",
      midia: <Print src="/img/depo-whatsapp-4.webp" w={860} h={130} alt="Conversa no WhatsApp: cliente diz que gostou muito do aplicativo, muito bom e bem fácil de mexer" />,
    },
    {
      frase: "Eu já uso e recomendo. Suporte top.",
      origem: "Lojista, pelo WhatsApp",
      midia: <Print src="/img/depo-whatsapp-3.webp" w={700} h={75} alt="Conversa no WhatsApp: cliente diz que já usa o sistema e recomenda o suporte" />,
    },
  ];

  // índices de depoimentos em cada coluna (story + "fácil de mexer" | vídeo + "recomendo" | "tudo que preciso" + "respondem rápido" + card de chamada)
  const colunas = [
    [0, 4],
    [2, 5],
    [1, 3],
  ];
  // ordem em que aparecem no celular (coluna por coluna); os 3 primeiros ficam visíveis
  const ordemCelular = colunas.flat();

  return (
    <section aria-labelledby="depo-titulo" className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p
            data-reveal
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600"
          >
            <span className="relative flex h-4 w-4">
              <span aria-hidden="true" className="anel absolute inset-0 rounded-full bg-emerald-400/50" />
              <IconeWhatsApp className="relative h-4 w-4 text-emerald-500" />
            </span>
            Mensagens reais de lojistas
          </p>
          <h2
            id="depo-titulo"
            data-reveal
            style={{ "--i": 1 } as CSSProperties}
            className="mt-5 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl"
          >
            Quem usa tem essas <span className="text-brand-600">reações e depoimentos.</span>
          </h2>
        </div>

        {/* Mural em 3 colunas montadas à mão para ficarem com alturas parecidas.
            Abaixo de 1024px as colunas viram "contents" e os cards fluem em 2 colunas (ou 1 no celular). */}
        <div className="mt-14 sm:columns-2 sm:gap-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-4">
          {colunas.map((col, c) => (
            <div key={c} className="contents lg:flex lg:flex-col lg:gap-4">
              {col.map((n, r) => {
                const d = depoimentos[n];
                return (
                  <article
                    key={d.frase}
                    data-reveal="zoom"
                    style={{ "--i": c + r * 2 } as CSSProperties}
                    className={`mb-4 break-inside-avoid overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 transition-transform duration-300 hover:-translate-y-1 lg:mb-0 ${
                      ordemCelular.indexOf(n) >= 3 && !todos ? "hidden sm:block" : "block"
                    }`}
                  >
                    <div className="overflow-hidden border-b border-slate-200">{d.midia}</div>
                    <figure className="p-5 sm:p-6">
                      <blockquote className="font-display text-lg font-semibold leading-snug text-slate-950">“{d.frase}”</blockquote>
                      <figcaption className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
                          <IconeWhatsApp className="h-3.5 w-3.5 text-emerald-500" />
                        </span>
                        {d.origem}
                      </figcaption>
                    </figure>
                  </article>
                );
              })}
              {c === 2 && (
                // card de chamada no fim da 3ª coluna (no celular aparece depois de todos os depoimentos)
                <div
                  data-reveal="zoom"
                  style={{ "--i": 5 } as CSSProperties}
                  className={`relative mb-4 break-inside-avoid overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-blue-600 to-indigo-700 p-6 text-white shadow-[0_24px_48px_-24px_rgba(37,99,235,0.7)] sm:p-7 lg:mb-0 ${
                    todos ? "block" : "hidden sm:block"
                  }`}
                >
                  <span aria-hidden="true" className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.25),transparent)]" />
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                    <span className="reflexo-auto absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  </span>
                  <p className="relative font-display text-2xl font-bold leading-tight">Seja o próximo lojista a mandar uma mensagem dessas.</p>
                  <p className="relative mt-2 text-sm text-blue-100">24h de acesso para testar os principais recursos · Cancele a qualquer momento</p>
                  <Botao href={LINKS.testeGratis} variante="branco" seta className="relative mt-6 w-full !bg-white">
                    Quero isso na minha loja
                  </Botao>
                </div>
              )}
            </div>
          ))}
        </div>

        {!todos && (
          <div className="flex justify-center sm:hidden">
            <button
              type="button"
              onClick={() => setTodos(true)}
              className="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-white px-5 font-display text-sm font-semibold text-slate-950 transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-slate-400"
            >
              Ver mais {depoimentos.length - 3} depoimentos
            </button>
          </div>
        )}

        {cta && !todos && (
          <div className="mt-10 flex justify-center sm:hidden">
            <Botao href={LINKS.testeGratis} seta className="w-full">
              Quero isso na minha loja
            </Botao>
          </div>
        )}
      </div>
    </section>
  );
}

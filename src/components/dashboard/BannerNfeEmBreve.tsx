import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

// =====================================================================
// ⚠️  DATA LIMITE DO BANNER "NF-e EM BREVE"  ⚠️
// Depois deste instante o banner some sozinho para todo mundo.
// Para estender a divulgação, altere a data abaixo.
// Para remover de vez: apague este arquivo, as imagens em
// public/banners/nfe-*.webp e o <BannerNfeEmBreve /> do Dashboard.
// =====================================================================
export const BANNER_NFE_DATA_LIMITE = new Date("2026-12-14T23:59:59-03:00");

// Data limite do banner "Disponível nas lojas oficiais".
// null = sem limite. Para definir: new Date("2027-01-31T23:59:59-03:00") (horário de Brasília).
export const BANNER_LOJAS_DATA_LIMITE: Date | null = null;

const STORAGE_KEY = "banner_nfe_fechado_ate";
const DIAS_OCULTO_AO_FECHAR = 7;
const INTERVALO_TROCA_MS = 5000;
// A partir daqui usa a imagem de desktop (3:1); abaixo, a de celular (2:1).
const MIDIA_DESKTOP = "(min-width: 768px)";

interface Slide {
  celular: string;
  desktop: string;
  alt: string;
  limite: Date | null;
}

const SLIDES: Slide[] = [
  { celular: "/banners/nfe-celular.webp", desktop: "/banners/nfe-desktop-3x1.webp", alt: "Em breve: emissão de notas fiscais no sistema", limite: BANNER_NFE_DATA_LIMITE },
  { celular: "/banners/lojas-celular.webp", desktop: "/banners/lojas-desktop-3x1.webp", alt: "Em breve: aplicativo disponível nas lojas oficiais", limite: BANNER_LOJAS_DATA_LIMITE },
];

function fechadoNesteAparelho(): boolean {
  try {
    const ate = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(ate) && ate > Date.now();
  } catch {
    // Armazenamento indisponível: mostra o banner normalmente
    return false;
  }
}

const dentroDoPrazo = (limite: Date | null) => limite === null || Date.now() <= limite.getTime();

function useMidia(consulta: string): boolean {
  const [bate, setBate] = useState(() => typeof window !== "undefined" && window.matchMedia(consulta).matches);
  useEffect(() => {
    const mql = window.matchMedia(consulta);
    const aoMudar = () => setBate(mql.matches);
    aoMudar();
    mql.addEventListener("change", aoMudar);
    return () => mql.removeEventListener("change", aoMudar);
  }, [consulta]);
  return bate;
}

/** Imagem de um banner: a <picture> escolhe celular (2:1) ou desktop (3:1) pela largura da tela. */
function ImagemBanner({ slide, onLoad }: { slide: Slide; onLoad?: () => void }) {
  return (
    <picture>
      <source media={MIDIA_DESKTOP} srcSet={slide.desktop} width={2000} height={667} />
      <img
        src={slide.celular}
        width={1774}
        height={887}
        loading="lazy"
        decoding="async"
        alt={slide.alt}
        draggable={false}
        onLoad={onLoad}
        className="block h-full w-full select-none object-cover"
      />
    </picture>
  );
}

// Proporção fixa (sem pulo de layout): 2:1 no celular, 3:1 no desktop.
// No desktop a largura é limitada a 1020px para a altura não passar de 340px.
const CAIXA = "relative mx-auto mb-6 w-full overflow-hidden rounded-2xl md:max-w-[1020px]";
const PROPORCAO = "aspect-[2/1] md:aspect-[3/1]";

interface BannerNfeEmBreveProps {
  /** Só o dono da loja vê (funcionário e gerente de filial não). */
  visivel: boolean;
}

export function BannerNfeEmBreve({ visivel }: BannerNfeEmBreveProps) {
  const [fechado, setFechado] = useState(fechadoNesteAparelho);

  if (!visivel || fechado) return null;

  const slides = SLIDES.filter((s) => dentroDoPrazo(s.limite));
  if (slides.length === 0) return null;

  const fechar = () => {
    setFechado(true);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + DIAS_OCULTO_AO_FECHAR * 24 * 60 * 60 * 1000));
    } catch {
      // Sem armazenamento: some só até recarregar a página
    }
  };

  return (
    <div className={CAIXA}>
      {slides.length === 1 ? (
        <div className={PROPORCAO}>
          <ImagemBanner slide={slides[0]} />
        </div>
      ) : (
        <CarrosselBanners slides={slides} />
      )}
      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar aviso"
        title="Fechar"
        className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

const BOTAO_SETA = cn(
  "absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/25 backdrop-blur-[2px] transition md:grid",
  "opacity-0 hover:bg-black/65 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
);

/** Estado do carrossel isolado aqui: a troca automática não re-renderiza o Dashboard. */
function CarrosselBanners({ slides }: { slides: Slide[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [atual, setAtual] = useState(0);
  const [segurando, setSegurando] = useState(false);
  const [mouseEmCima, setMouseEmCima] = useState(false);
  const [comFoco, setComFoco] = useState(false);
  const [abaVisivel, setAbaVisivel] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  const reduzirMovimento = useMidia("(prefers-reduced-motion: reduce)");
  // A 2ª imagem em diante só baixa depois que a 1ª terminou (não pesa a abertura do Dashboard).
  const [primeiraCarregou, setPrimeiraCarregou] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    const aoSelecionar = () => setAtual(emblaApi.selectedScrollSnap());
    const aoApertar = () => setSegurando(true);
    const aoSoltar = () => setSegurando(false);
    aoSelecionar();
    emblaApi.on("select", aoSelecionar).on("reInit", aoSelecionar).on("pointerDown", aoApertar).on("pointerUp", aoSoltar);
    return () => {
      emblaApi.off("select", aoSelecionar).off("reInit", aoSelecionar).off("pointerDown", aoApertar).off("pointerUp", aoSoltar);
    };
  }, [emblaApi]);

  useEffect(() => {
    const aoMudarVisibilidade = () => setAbaVisivel(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }, []);

  const pausado = segurando || mouseEmCima || comFoco || !abaVisivel || reduzirMovimento;

  useEffect(() => {
    if (!emblaApi || pausado) return;
    const timer = window.setInterval(() => emblaApi.scrollNext(), INTERVALO_TROCA_MS);
    return () => window.clearInterval(timer);
  }, [emblaApi, pausado, atual]);

  const irPara = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="Novidades"
      className="group"
      onFocus={() => setComFoco(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setComFoco(false); }}
      // "Mouse em cima" só conta para mouse de verdade: no toque o navegador não avisa a saída.
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setMouseEmCima(true); }}
      onPointerLeave={(e) => { setSegurando(false); if (e.pointerType === "mouse") setMouseEmCima(false); }}
      onPointerCancel={() => setSegurando(false)}
    >
      <div ref={emblaRef} className={cn(PROPORCAO, "w-full touch-pan-y overflow-hidden")}>
        <div className="flex h-full">
          {slides.map((s, i) => (
            <div
              key={s.celular}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${slides.length}`}
              className="h-full min-w-0 shrink-0 grow-0 basis-full"
            >
              {i === 0 || primeiraCarregou ? (
                <ImagemBanner slide={s} onLoad={i === 0 ? () => setPrimeiraCarregou(true) : undefined} />
              ) : (
                <div className="h-full w-full bg-[#0B1429]" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Setas (só desktop): aparecem ao passar o mouse e ao focar */}
      <button type="button" onClick={() => emblaApi?.scrollPrev()} aria-label="Banner anterior" className={cn(BOTAO_SETA, "left-3")}>
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => emblaApi?.scrollNext()} aria-label="Próximo banner" className={cn(BOTAO_SETA, "right-3")}>
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Pontinhos: fundo translúcido escuro para ficarem visíveis em qualquer tema */}
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/40 px-2 py-1 backdrop-blur-[2px] md:bottom-3">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => irPara(i)}
            aria-label={`Ir para o banner ${i + 1}`}
            aria-current={atual === i ? "true" : undefined}
            className="grid h-6 w-6 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span className={cn("block h-2 rounded-full bg-white transition-all", atual === i ? "w-5 opacity-100" : "w-2 opacity-50")} />
          </button>
        ))}
      </div>
    </section>
  );
}

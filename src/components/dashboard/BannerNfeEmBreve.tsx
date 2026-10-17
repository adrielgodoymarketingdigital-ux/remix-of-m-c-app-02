import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// =====================================================================
// ⚠️  DATA LIMITE DO BANNER "NF-e EM BREVE"  ⚠️
// Depois deste instante o banner some sozinho para todo mundo.
// Para estender a divulgação, altere a data abaixo.
// Para remover de vez: apague este arquivo, as imagens em
// public/banners/nfe-*.webp e o <BannerNfeEmBreve /> do Dashboard.
// =====================================================================
export const BANNER_NFE_DATA_LIMITE = new Date("2026-12-14T23:59:59-03:00");

// Data limite do banner "Disponível nas lojas oficiais" (só no celular).
// null = sem limite. Para definir: new Date("2027-01-31T23:59:59-03:00") (horário de Brasília).
export const BANNER_LOJAS_DATA_LIMITE: Date | null = null;

const STORAGE_KEY = "banner_nfe_fechado_ate";
const DIAS_OCULTO_AO_FECHAR = 7;
const INTERVALO_TROCA_MS = 5000;
// Mesmo ponto em que a <picture> abaixo troca para a imagem de desktop: o carrossel só existe abaixo dele.
const MIDIA_DESKTOP = "(min-width: 640px)";

const SLIDES_CELULAR = [
  { src: "/banners/nfe-celular.webp", alt: "Em breve: emissão de notas fiscais no sistema", limite: BANNER_NFE_DATA_LIMITE },
  { src: "/banners/lojas-celular.webp", alt: "Em breve: aplicativo disponível nas lojas oficiais", limite: BANNER_LOJAS_DATA_LIMITE },
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

interface BannerNfeEmBreveProps {
  /** Só o dono da loja vê (funcionário e gerente de filial não). */
  visivel: boolean;
}

export function BannerNfeEmBreve({ visivel }: BannerNfeEmBreveProps) {
  const [fechado, setFechado] = useState(fechadoNesteAparelho);
  const desktop = useMidia(MIDIA_DESKTOP);

  if (!visivel || fechado) return null;

  const fechar = () => {
    setFechado(true);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + DIAS_OCULTO_AO_FECHAR * 24 * 60 * 60 * 1000));
    } catch {
      // Sem armazenamento: some só até recarregar a página
    }
  };

  const botaoFechar = (
    <button
      type="button"
      onClick={fechar}
      aria-label="Fechar aviso"
      title="Fechar"
      className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <X className="h-4 w-4" />
    </button>
  );

  // Desktop: exatamente o banner de NF-e de antes.
  if (desktop) {
    if (!dentroDoPrazo(BANNER_NFE_DATA_LIMITE)) return null;
    return (
      <div className="relative mb-6 overflow-hidden rounded-2xl">
        <picture>
          <source media="(min-width: 640px)" srcSet="/banners/nfe-desktop.webp" width={2048} height={768} />
          <img
            src="/banners/nfe-celular.webp"
            width={1774}
            height={887}
            loading="lazy"
            decoding="async"
            alt="Em breve: emissão de notas fiscais no sistema"
            className="block h-auto w-full"
          />
        </picture>
        {botaoFechar}
      </div>
    );
  }

  // Celular: carrossel com os banners ainda no prazo.
  const slides = SLIDES_CELULAR.filter((s) => dentroDoPrazo(s.limite));
  if (slides.length === 0) return null;

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl">
      {slides.length === 1 ? (
        <img
          src={slides[0].src}
          width={1774}
          height={887}
          loading="lazy"
          decoding="async"
          alt={slides[0].alt}
          className="block aspect-[2/1] h-auto w-full"
        />
      ) : (
        <CarrosselBanners slides={slides} />
      )}
      {botaoFechar}
    </div>
  );
}

/** Estado do carrossel isolado aqui: a troca automática não re-renderiza o Dashboard. */
function CarrosselBanners({ slides }: { slides: { src: string; alt: string }[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [atual, setAtual] = useState(0);
  const [segurando, setSegurando] = useState(false);
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

  const pausado = segurando || comFoco || !abaVisivel || reduzirMovimento;

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
      onFocus={() => setComFoco(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setComFoco(false); }}
      onPointerLeave={() => setSegurando(false)}
      onPointerCancel={() => setSegurando(false)}
    >
      <div ref={emblaRef} className="aspect-[2/1] w-full touch-pan-y overflow-hidden">
        <div className="flex h-full">
          {slides.map((s, i) => (
            <div
              key={s.src}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${slides.length}`}
              className="h-full min-w-0 shrink-0 grow-0 basis-full"
            >
              {i === 0 || primeiraCarregou ? (
                <img
                  src={s.src}
                  width={1774}
                  height={887}
                  loading="lazy"
                  decoding="async"
                  alt={s.alt}
                  draggable={false}
                  onLoad={i === 0 ? () => setPrimeiraCarregou(true) : undefined}
                  className="block h-full w-full select-none object-cover"
                />
              ) : (
                <div className="h-full w-full bg-[#0B1429]" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pontinhos: fundo translúcido escuro para ficarem visíveis em qualquer tema */}
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/40 px-2 py-1 backdrop-blur-[2px]">
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

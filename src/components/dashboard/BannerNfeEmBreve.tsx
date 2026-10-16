import { useState } from "react";
import { X } from "lucide-react";

// =====================================================================
// ⚠️  DATA LIMITE DO BANNER "NF-e EM BREVE"  ⚠️
// Depois deste instante o banner some sozinho para todo mundo.
// Para estender a divulgação, altere a data abaixo.
// Para remover de vez: apague este arquivo, as imagens em
// public/banners/nfe-*.webp e o <BannerNfeEmBreve /> do Dashboard.
// =====================================================================
export const BANNER_NFE_DATA_LIMITE = new Date("2026-12-14T23:59:59-03:00");

const STORAGE_KEY = "banner_nfe_fechado_ate";
const DIAS_OCULTO_AO_FECHAR = 7;

function fechadoNesteAparelho(): boolean {
  try {
    const ate = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(ate) && ate > Date.now();
  } catch {
    // Armazenamento indisponível: mostra o banner normalmente
    return false;
  }
}

interface BannerNfeEmBreveProps {
  /** Só o dono da loja vê (funcionário e gerente de filial não). */
  visivel: boolean;
}

export function BannerNfeEmBreve({ visivel }: BannerNfeEmBreveProps) {
  const [fechado, setFechado] = useState(fechadoNesteAparelho);

  if (!visivel || fechado || Date.now() > BANNER_NFE_DATA_LIMITE.getTime()) return null;

  const fechar = () => {
    setFechado(true);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + DIAS_OCULTO_AO_FECHAR * 24 * 60 * 60 * 1000));
    } catch {
      // Sem armazenamento: some só até recarregar a página
    }
  };

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
      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar aviso"
        title="Fechar"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

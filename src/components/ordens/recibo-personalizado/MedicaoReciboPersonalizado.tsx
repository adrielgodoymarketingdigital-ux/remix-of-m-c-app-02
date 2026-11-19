import { useEffect, useMemo, useRef, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { ImpressaoA4Personalizado } from "./ImpressaoA4Personalizado";
import { CSS_MEDICAO_RECIBO_PERSONALIZADO } from "./cssReciboPersonalizado";
import {
  NIVEL_MAXIMO_COMPACTACAO,
  SEM_COMPACTACAO,
  decidirCompactacao,
  type DecisaoCompactacao,
  type MedidasCompactacao,
  type NivelCompactacao,
} from "@/lib/ordemServico/compactacaoReciboPersonalizado";
import { LARGURA_UTIL_MM, TEMPO_MAXIMO_IMAGEM_MS } from "@/lib/ordemServico/paginasReciboPersonalizado";

/**
 * Mede o recibo PERSONALIZADO para decidir se ele precisa compactar para caber
 * em uma folha (regra em lib/ordemServico/compactacaoReciboPersonalizado).
 *
 * Monta uma cópia escondida por nível (0 a 3), com as medidas da impressão
 * (.osr-medicao), numa área própria no <body> — FORA do #print-root: não entra
 * na impressão do computador (.no-print), nem na cópia do Android, nem no PDF
 * do iPhone. Espera logo, assinaturas e fotos carregarem (ou falharem) e as
 * fontes, mede, mede de novo e só decide se as duas medidas baterem.
 * Qualquer erro, tempo esgotado ou medida instável = recibo de sempre (nível 0).
 */

/** Passou disso sem decidir: recibo de sempre (o botão "Imprimir Agora" não fica preso). */
export const TEMPO_MAXIMO_MEDICAO_MS = 6000;
/** Duas medidas seguidas podem diferir no máximo isto (mm); senão mede outra vez. */
const TOLERANCIA_MEDIDA_MM = 0.5;
const TENTATIVAS_MEDIDA = 3;

const NIVEIS = Array.from({ length: NIVEL_MAXIMO_COMPACTACAO + 1 }, (_, i) => i as NivelCompactacao);

type PropsRecibo = Omit<ComponentProps<typeof ImpressaoA4Personalizado>, "compactacao" | "medicao" | "paraCaptura">;

interface Props extends PropsRecibo {
  onDecidir: (decisao: DecisaoCompactacao) => void;
}

function doisQuadros(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function esperarImagem(img: HTMLImageElement): Promise<void> {
  if (img.complete) return Promise.resolve();
  return new Promise((resolve) => {
    const fim = () => {
      clearTimeout(id);
      resolve();
    };
    const id = setTimeout(fim, TEMPO_MAXIMO_IMAGEM_MS);
    img.addEventListener("load", fim, { once: true });
    img.addEventListener("error", fim, { once: true });
  });
}

/** Espera todas as imagens terminarem (carregar ou falhar); repete se a lista mudar (ex.: logo que falhou some). */
async function esperarImagensEstaveis(area: HTMLElement): Promise<boolean> {
  for (let i = 0; i < 4; i++) {
    const imgs = Array.from(area.querySelectorAll("img"));
    await Promise.all(imgs.map(esperarImagem));
    await doisQuadros();
    const depois = Array.from(area.querySelectorAll("img"));
    if (depois.length === imgs.length && depois.every((img, j) => img === imgs[j]) && depois.every((img) => img.complete)) return true;
  }
  return false;
}

/** Medidas (mm) das cópias. Qualquer coisa estranha vira null — e a regra decide pelo recibo de sempre. */
function medirCopias(area: HTMLElement): MedidasCompactacao {
  const alturasPorNivel = NIVEIS.map((nivel) => {
    const recibo = area.querySelector<HTMLElement>(`[data-nivel="${nivel}"] > .impressao-ordem-container`);
    if (!recibo) return null;
    const caixa = recibo.getBoundingClientRect();
    if (caixa.width <= 0) return null;
    return caixa.height / (caixa.width / LARGURA_UTIL_MM);
  });

  let alturaFinalMm: number | null | undefined;
  let alturaAnteriorEFinalMm: number | null | undefined;
  const base = area.querySelector<HTMLElement>(`[data-nivel="0"] > .impressao-ordem-container`);
  if (base) {
    const caixa = base.getBoundingClientRect();
    const pxPorMm = caixa.width / LARGURA_UTIL_MM;
    const blocos = Array.from(base.children).filter((filho) => filho.tagName !== "STYLE");
    const inicioFim = blocos.findIndex((b) => b.classList.contains("osr-assinaturas") || !!b.querySelector(".osr-termo"));
    if (inicioFim < 0) {
      alturaFinalMm = null; // sem termo nem assinaturas
    } else if (pxPorMm > 0) {
      const fundo = blocos[blocos.length - 1].getBoundingClientRect().bottom;
      alturaFinalMm = (fundo - blocos[inicioFim].getBoundingClientRect().top) / pxPorMm;
      alturaAnteriorEFinalMm = inicioFim > 0 ? (fundo - blocos[inicioFim - 1].getBoundingClientRect().top) / pxPorMm : undefined;
    }
  }
  return { alturasPorNivel, alturaFinalMm, alturaAnteriorEFinalMm };
}

function medidasIguais(a: MedidasCompactacao, b: MedidasCompactacao): boolean {
  const perto = (x: number | null | undefined, y: number | null | undefined) =>
    x === y || (typeof x === "number" && typeof y === "number" && Math.abs(x - y) <= TOLERANCIA_MEDIDA_MM);
  return a.alturasPorNivel.every((x, i) => perto(x, b.alturasPorNivel[i]))
    && perto(a.alturaFinalMm, b.alturaFinalMm)
    && perto(a.alturaAnteriorEFinalMm, b.alturaAnteriorEFinalMm);
}

export function MedicaoReciboPersonalizado({ onDecidir, ...recibo }: Props) {
  const area = useMemo(() => {
    const el = document.createElement("div");
    el.className = "no-print osr-area-medicao";
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, {
      position: "fixed", left: "-10000px", top: "0", width: `${LARGURA_UTIL_MM}mm`,
      visibility: "hidden", pointerEvents: "none", zIndex: "-1",
    });
    return el;
  }, []);
  const decidir = useRef(onDecidir);
  decidir.current = onDecidir;

  useEffect(() => {
    document.body.appendChild(area);
    let ativo = true;
    let concluido = false;
    const concluir = (decisao: DecisaoCompactacao) => {
      if (!ativo || concluido) return;
      concluido = true;
      decidir.current(decisao);
    };
    const limite = setTimeout(() => concluir(SEM_COMPACTACAO), TEMPO_MAXIMO_MEDICAO_MS);

    (async () => {
      try {
        await doisQuadros();
        if (!(await esperarImagensEstaveis(area))) return concluir(SEM_COMPACTACAO);
        if (document.fonts?.ready) await document.fonts.ready;
        let anterior = medirCopias(area);
        for (let i = 0; i < TENTATIVAS_MEDIDA && ativo; i++) {
          await doisQuadros();
          const atual = medirCopias(area);
          if (medidasIguais(anterior, atual)) return concluir(decidirCompactacao(atual));
          anterior = atual;
        }
        concluir(SEM_COMPACTACAO); // não estabilizou
      } catch (erro) {
        console.error("[MedicaoReciboPersonalizado] medição falhou — vale o recibo de sempre.", erro);
        concluir(SEM_COMPACTACAO);
      }
    })();

    return () => {
      ativo = false;
      clearTimeout(limite);
      area.remove();
    };
  }, [area]);

  return createPortal(
    <>
      <style>{CSS_MEDICAO_RECIBO_PERSONALIZADO}</style>
      {NIVEIS.map((nivel) => (
        <div key={nivel} data-nivel={nivel}>
          <ImpressaoA4Personalizado {...recibo} medicao compactacao={{ nivel, agrupamento: "nenhum" }} />
        </div>
      ))}
    </>,
    area,
  );
}

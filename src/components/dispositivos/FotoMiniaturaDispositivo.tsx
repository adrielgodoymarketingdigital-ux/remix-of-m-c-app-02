import { useState, type ImgHTMLAttributes } from "react";
import { urlMiniatura } from "@/lib/dispositivos/fotosDispositivoNomes";

interface FotoMiniaturaDispositivoProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "loading" | "decoding" | "onError"> {
  /** URL da foto principal (a que está salva no banco). */
  src: string;
}

/**
 * Foto de dispositivo em listas: usa a miniatura quando existe (fotos v2) e
 * carrega sob demanda. Se a miniatura falhar, cai na foto original.
 * width/height reservam o espaço (padrão 400×400); o tamanho visível vem do className.
 */
export function FotoMiniaturaDispositivo({ src, width = 400, height = 400, ...props }: FotoMiniaturaDispositivoProps) {
  const miniatura = urlMiniatura(src);
  // Guarda para qual foto a miniatura falhou: se o src mudar, tenta a miniatura de novo
  const [falhouPara, setFalhouPara] = useState<string | null>(null);
  const falhou = falhouPara === src;
  const atual = falhou ? src : miniatura;

  return (
    <img
      {...props}
      src={atual}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!falhou && miniatura !== src) {
          console.warn("[fotos-dispositivo] Miniatura não carregou; usando a foto original.", miniatura);
          setFalhouPara(src);
        }
      }}
    />
  );
}

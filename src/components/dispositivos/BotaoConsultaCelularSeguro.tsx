import { useRef, type ComponentProps } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AVISO_CPF_CELULAR_SEGURO,
  consultarImeiNoCelularSeguro,
  MENSAGEM_IMEI_COPIADO,
} from "@/lib/dispositivos/consultaImei";

interface BotaoConsultaCelularSeguroProps {
  imei: string | null | undefined;
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
  classNameIcone?: string;
}

export function BotaoConsultaCelularSeguro({
  imei,
  size = "default",
  className,
  classNameIcone = "h-4 w-4 mr-2",
}: BotaoConsultaCelularSeguroProps) {
  const botaoRef = useRef<HTMLButtonElement>(null);

  const copiarPorSelecao = (texto: string) => {
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.readOnly = true;
    campo.setAttribute("aria-hidden", "true");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    // Dentro do Dialog: fora dele, a trava de foco do Radix tira a seleção do campo.
    const pai = botaoRef.current?.parentElement ?? document.body;
    pai.appendChild(campo);
    try {
      campo.select();
      campo.setSelectionRange(0, texto.length);
      return document.execCommand("copy");
    } finally {
      campo.remove();
      botaoRef.current?.focus({ preventScroll: true });
    }
  };

  const consultar = async () => {
    const resultado = await consultarImeiNoCelularSeguro(imei, {
      escreverNaAreaDeTransferencia: navigator.clipboard
        ? (texto) => navigator.clipboard.writeText(texto)
        : undefined,
      copiarPorSelecao,
      abrirSite: (url) => {
        window.open(url, "_blank", "noopener,noreferrer");
      },
    });

    if (resultado.ok === false) {
      toast.error(resultado.erro);
    } else if (resultado.copiado) {
      toast.success(MENSAGEM_IMEI_COPIADO);
    } else {
      toast.warning(`Não foi possível copiar. Digite o IMEI no Celular Seguro: ${resultado.imei}. ${AVISO_CPF_CELULAR_SEGURO}`);
    }
  };

  return (
    <Button
      ref={botaoRef}
      type="button"
      variant="outline"
      size={size}
      className={className}
      onClick={consultar}
    >
      <ExternalLink className={classNameIcone} />
      Consultar no Celular Seguro
    </Button>
  );
}

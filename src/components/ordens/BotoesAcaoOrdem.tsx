import { Eye, Pencil, Printer, Trash2, MessageSquare, FileText, Tag, RadioTower } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BotoesAcaoOrdemProps {
  onVisualizar: () => void;
  onEditar: () => void;
  onImprimir: () => void;
  onExcluir: () => void;
  onEnviarWhatsApp?: () => void;
  onCompartilhar?: () => void;
  onImprimirTermo?: () => void;
  onImprimirEtiqueta?: () => void;
  termoAtivo?: boolean;
  compacto?: boolean;
}

export const BotoesAcaoOrdem = ({
  onVisualizar,
  onEditar,
  onImprimir,
  onExcluir,
  onEnviarWhatsApp,
  onCompartilhar,
  onImprimirTermo,
  onImprimirEtiqueta,
  termoAtivo,
  compacto = false,
}: BotoesAcaoOrdemProps) => {
  const tamanhoBotao = compacto ? "h-6 w-6 shrink-0" : "h-8 w-8";
  const tamanhoIcone = compacto ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <TooltipProvider>
      <div className={compacto ? "flex max-w-full flex-wrap items-center justify-end gap-0.5" : "flex items-center gap-1"}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onVisualizar}
              className={tamanhoBotao}
            >
              <Eye className={tamanhoIcone} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Visualizar</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onEditar}
              className={tamanhoBotao}
            >
              <Pencil className={tamanhoIcone} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Editar</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onImprimir}
              className={tamanhoBotao}
            >
              <Printer className={tamanhoIcone} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Imprimir OS</TooltipContent>
        </Tooltip>

        {onImprimirEtiqueta && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onImprimirEtiqueta}
                className={`${tamanhoBotao} text-orange-600 hover:text-orange-700 hover:bg-orange-50`}
              >
                <Tag className={tamanhoIcone} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Imprimir Etiqueta</TooltipContent>
          </Tooltip>
        )}

        {termoAtivo && onImprimirTermo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onImprimirTermo}
                className={`${tamanhoBotao} text-purple-600 hover:text-purple-700 hover:bg-purple-50`}
              >
                <FileText className={tamanhoIcone} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Imprimir Termo de Responsabilidade</TooltipContent>
          </Tooltip>
        )}

        {onEnviarWhatsApp && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onEnviarWhatsApp}
                className={`${tamanhoBotao} text-green-600 hover:text-green-700 hover:bg-green-50`}
              >
                <MessageSquare className={tamanhoIcone} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar via WhatsApp</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCompartilhar}
              className={`${tamanhoBotao} text-blue-600 hover:text-blue-700 hover:bg-blue-50`}
            >
              <RadioTower className={tamanhoIcone} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Compartilhar Acompanhamento</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onExcluir}
              className={`${tamanhoBotao} text-destructive hover:text-destructive`}
            >
              <Trash2 className={tamanhoIcone} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Excluir</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

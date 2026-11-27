import { useTranslation } from "react-i18next";
import { Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PreviaWhatsAppAvaliacaoProps {
  /** Mensagem já montada (montarMensagemAvaliacao) com os dados de exemplo. */
  texto: string;
  /** Link que aparece dentro do texto (realçado na prévia). */
  link: string;
  nomeLoja: string;
  logoUrl?: string | null;
  className?: string;
}

export function PreviaWhatsAppAvaliacao({ texto, className }: PreviaWhatsAppAvaliacaoProps) {
  const { t } = useTranslation("marketing");
  return (
    <Card className={cn("overflow-hidden rounded-2xl", className)}>
      <CardHeader className="border-b p-4 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Eye className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">{t("avaliacao.previaTitulo")}</CardTitle>
            <CardDescription>{t("avaliacao.previaSubtitulo")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="rounded-xl bg-[#e7fbe0] dark:bg-[#1f3a2a] p-3 text-sm whitespace-pre-wrap break-words text-foreground">
          {texto}
        </div>
      </CardContent>
    </Card>
  );
}

import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BatteryFull, CheckCheck, EllipsisVertical, Eye, Mic, Phone, Plus, Signal, Store, Wifi } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatadores } from "@/hooks/useFormatadores";
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

/**
 * Prévia da mensagem de avaliação num celular com o chat do WhatsApp.
 * As cores do celular/chat são fixas de propósito (é uma representação do
 * WhatsApp, igual no tema claro e no escuro).
 */
export function PreviaWhatsAppAvaliacao({ texto, link, nomeLoja, logoUrl, className }: PreviaWhatsAppAvaliacaoProps) {
  const { t } = useTranslation("marketing");
  const fmt = useFormatadores();
  const [logoFalhou, setLogoFalhou] = useState(false);
  const hora = useMemo(() => fmt.hora(new Date()), [fmt]);
  const partes = link ? texto.split(link) : [texto];
  const mostrarLogo = !!logoUrl && !logoFalhou;

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
      <CardContent className="bg-gradient-to-b from-primary/5 to-transparent px-4 pb-5 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[2.6rem] border-[10px] border-[#111827] bg-[#111827] shadow-xl">
          {/* Barra de status + ilha dinâmica */}
          <div className="relative flex h-10 items-center justify-between bg-white px-6 text-[13px] font-semibold text-[#111b21]">
            <span>{hora}</span>
            <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-6 w-[92px] -translate-x-1/2 rounded-full bg-[#111827]" />
            <span className="flex items-center gap-1" aria-hidden="true">
              <Signal className="h-3.5 w-3.5" />
              <Wifi className="h-3.5 w-3.5" />
              <BatteryFull className="h-4 w-4" />
            </span>
          </div>

          {/* Cabeçalho do chat */}
          <div className="flex items-center gap-2.5 border-b border-[#e9edef] bg-white px-3 py-2.5 text-[#111b21]">
            <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e1f8e8] text-[#008a5a]">
              {mostrarLogo ? (
                <img src={logoUrl ?? undefined} alt="" className="h-full w-full object-cover" onError={() => setLogoFalhou(true)} />
              ) : (
                <Store className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{nomeLoja}</p>
              <p className="text-[11px] text-[#667781]">{t("avaliacao.contaComercial")}</p>
            </div>
            <Phone className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <EllipsisVertical className="h-5 w-5 shrink-0" aria-hidden="true" />
          </div>

          {/* Conversa */}
          <div
            className="min-h-[320px] bg-[#efeae2] px-3 py-5"
            style={{ backgroundImage: "radial-gradient(rgba(140,120,90,0.14) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
          >
            <div className="ml-auto w-fit max-w-[92%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[13.5px] leading-relaxed text-[#111b21] shadow-sm">
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                {partes.map((parte, i) => (
                  <Fragment key={i}>
                    {parte}
                    {i < partes.length - 1 && <span className="text-[#027eb5] underline underline-offset-2">{link}</span>}
                  </Fragment>
                ))}
              </p>
              <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[#667781]">
                {hora}
                <CheckCheck className="h-4 w-4 text-[#53bdeb]" aria-hidden="true" />
              </p>
            </div>
          </div>

          {/* Barra de digitação */}
          <div className="flex items-center gap-2.5 bg-[#f0f2f5] px-3 py-2.5 text-[#54656f]" aria-hidden="true">
            <Plus className="h-5 w-5 shrink-0" />
            <span className="h-8 flex-1 rounded-full bg-white" />
            <Mic className="h-5 w-5 shrink-0" />
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">{t("avaliacao.previaDescricao")}</p>
      </CardContent>
    </Card>
  );
}

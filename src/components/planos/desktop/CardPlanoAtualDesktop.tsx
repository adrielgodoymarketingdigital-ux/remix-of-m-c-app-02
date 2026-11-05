import type { ReactNode } from "react";
import { CalendarClock, Crown, HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CardPlanoAtualDesktopProps {
  nomePlano: string;
  /** Selo ao lado do título: plano_tipo por extenso ou "PLANO VENCIDO". */
  selo: ReactNode;
  /** "Próxima cobrança em..." ou "Vence em..."; null quando o plano não tem data. */
  vencimento: string | null;
  /** Aviso de plano vencido, abaixo do nome. */
  avisoVencido: string | null;
  dispositivosUsados: number;
  /** -1 = ilimitado. */
  dispositivosLimite: number;
  dispositivosPercentual: number;
  /** Texto do limite por período, quando a conta tem essa regra. */
  textoPeriodo: string | null;
  limiteArmazenamento: string;
  /** Botões existentes do plano, com as mesmas condições do layout do celular. */
  acoes: ReactNode;
}

/** Card "Seu Plano Atual" no computador: plano e dispositivos, armazenamento e ações. */
export function CardPlanoAtualDesktop({
  nomePlano,
  selo,
  vencimento,
  avisoVencido,
  dispositivosUsados,
  dispositivosLimite,
  dispositivosPercentual,
  textoPeriodo,
  limiteArmazenamento,
  acoes,
}: CardPlanoAtualDesktopProps) {
  const ilimitado = dispositivosLimite === -1;

  return (
    <Card className="grid grid-cols-[1.2fr_1fr] items-center gap-x-6 gap-y-4 border-primary/40 bg-gradient-to-r from-card to-primary/5 p-5 min-[1484px]:grid-cols-[1.2fr_0.8fr_auto]">
      <div className="flex min-w-0 items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Crown className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Seu Plano Atual</h2>
            {selo}
          </div>
          <p className="text-lg font-bold leading-snug text-foreground">{nomePlano}</p>
          {vencimento && (
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              {vencimento}
            </p>
          )}
          {avisoVencido && <p className="mt-1 text-sm text-muted-foreground">{avisoVencido}</p>}

          <p className="mt-2 text-[13px] text-muted-foreground">
            <strong className="font-semibold text-foreground">{dispositivosUsados}</strong>
            {ilimitado ? " / ∞ Ilimitados" : ` / ${dispositivosLimite} dispositivos utilizados`}
          </p>
          {textoPeriodo && <p className="text-xs text-muted-foreground">{textoPeriodo}</p>}
          {!ilimitado && (
            <div className="mt-1.5 flex max-w-[320px] items-center gap-2.5">
              <div className="h-2 min-w-0 flex-1 rounded-full bg-muted">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    dispositivosPercentual >= 90 ? "bg-red-500" : dispositivosPercentual >= 70 ? "bg-yellow-500" : "bg-green-500",
                  )}
                  style={{ width: `${Math.min(dispositivosPercentual, 100)}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">{Math.round(dispositivosPercentual)}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-4 border-l border-border pl-6">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-card text-primary ring-1 ring-border">
          <HardDrive className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">Armazenamento</p>
          <p className="text-base font-semibold text-foreground">{limiteArmazenamento}</p>
        </div>
      </div>

      <div className="col-span-2 flex flex-wrap gap-2 min-[1484px]:col-span-1 min-[1484px]:justify-end">{acoes}</div>
    </Card>
  );
}

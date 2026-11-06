import type { ReactNode } from "react";
import { CalendarClock, Crown, Database } from "lucide-react";
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
    <Card className="relative grid grid-cols-[1.2fr_1fr] items-center gap-x-4 gap-y-3 overflow-hidden rounded-xl border-blue-200 bg-gradient-to-r from-card to-blue-100 px-4 py-2.5 dark:border-blue-900 dark:to-blue-950/50 min-[1280px]:grid-cols-[minmax(0,1fr)_auto_auto]">
      <Crown aria-hidden className="pointer-events-none absolute -bottom-6 right-4 h-32 w-32 text-blue-600/[0.07] dark:text-blue-300/[0.06]" />
      <div className="flex min-w-0 items-start gap-3">
        {/* Entre 1280 e 1440 os 3 botões ocupam a linha: sem o ícone, o título e o selo cabem numa linha só. */}
        <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary min-[1280px]:hidden min-[1440px]:grid">
          <Crown className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h2 className="text-[13px] font-semibold leading-5 text-foreground">Seu Plano Atual</h2>
            {selo}
          </div>
          <p className="text-base font-bold leading-tight text-foreground">{nomePlano}</p>
          {vencimento && (
            <p className="flex items-center gap-1.5 text-xs leading-4 text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              {vencimento}
            </p>
          )}
          {avisoVencido && <p className="mt-1 text-sm text-muted-foreground">{avisoVencido}</p>}

          <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
            <strong className="font-semibold text-primary">{dispositivosUsados}</strong>
            {ilimitado ? " / ∞ Ilimitados" : ` / ${dispositivosLimite} dispositivos utilizados`}
          </p>
          {textoPeriodo && <p className="text-xs text-muted-foreground">{textoPeriodo}</p>}
          {!ilimitado && (
            <div className="mt-1 flex max-w-[320px] items-center gap-2.5">
              <div className="h-2 min-w-0 flex-1 rounded-full bg-blue-200/70 dark:bg-muted">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    dispositivosPercentual >= 90 ? "bg-red-500" : dispositivosPercentual >= 70 ? "bg-yellow-500" : "bg-gradient-to-r from-sky-500 to-blue-700",
                  )}
                  style={{ width: `${Math.min(dispositivosPercentual, 100)}%` }}
                />
              </div>
              <span className="text-xs leading-4 tabular-nums text-muted-foreground">{Math.round(dispositivosPercentual)}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-3 border-l border-border pl-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card text-primary ring-1 ring-border">
          <Database className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="whitespace-nowrap text-xs leading-4 text-muted-foreground">Armazenamento</p>
          <p className="text-sm font-semibold text-foreground">{limiteArmazenamento}</p>
        </div>
      </div>

      {/* Botões menores (36px) para caber numa linha só a partir de 1280px; os componentes não mudam. */}
      <div className="relative col-span-2 flex flex-wrap gap-2 min-[1280px]:col-span-1 min-[1280px]:justify-end [&_button]:h-9 [&_button]:px-3 [&_button]:text-[13px]">{acoes}</div>
    </Card>
  );
}

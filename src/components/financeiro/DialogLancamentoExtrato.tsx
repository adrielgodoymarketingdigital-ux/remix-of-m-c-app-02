import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowDownCircle, ArrowUpCircle, CalendarDays, ChevronDown, Coins, FilePlus2, Loader2, MessageSquareText, PlusCircle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseValorMonetarioBR } from "@/lib/formatters";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";
import type { NovoLancamentoExtrato } from "@/hooks/useExtratoFinanceiro";

interface DialogLancamentoExtratoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Grava o lançamento; true = deu certo (o diálogo fecha). */
  onSalvar: (lancamento: NovoLancamentoExtrato) => Promise<boolean>;
}

// Visual do diálogo (referência layout-extrato/referencia-dialog). Só classes.
const FOCO = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#246BFF]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-card";
const ROTULO = "mb-2.5 block text-[13px] font-semibold text-[#101828] dark:text-foreground";
const CAMPO = cn(
  "flex h-[58px] items-center gap-3 rounded-[13px] border border-border bg-card px-[15px] transition",
  "focus-within:border-[#246BFF] focus-within:shadow-[0_0_0_3px_rgba(36,107,255,0.09)] dark:focus-within:border-primary",
  "[&>svg]:h-5 [&>svg]:w-5 [&>svg]:shrink-0 [&>svg]:text-[#66758F] dark:[&>svg]:text-muted-foreground",
);
const INPUT = "h-full min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-[#101828] shadow-none placeholder:text-[#8B98AE] focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-foreground dark:placeholder:text-muted-foreground";
const BOTAO_TIPO = cn(
  "flex h-[54px] items-center justify-center gap-2.5 rounded-[13px] border text-sm font-semibold transition [&>svg]:h-5 [&>svg]:w-5",
  FOCO,
);
const BOTAO_TIPO_INATIVO = "border-border bg-card text-[#101828] hover:bg-muted/60 dark:text-foreground";

const MESES_CURTOS = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

/** "2026-10-16" → "16 de out. de 2026", sem passar por Date (só exibição; o valor continua ISO). */
function formatarDataExtenso(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  const nomeMes = MESES_CURTOS[Number(mes) - 1];
  if (!ano || !nomeMes || !dia) return iso;
  return `${Number(dia)} de ${nomeMes} de ${ano}`;
}

/** Lançamento manual de entrada/saída no Extrato (independe de caixa aberto no PDV). */
export function DialogLancamentoExtrato({ open, onOpenChange, onSalvar }: DialogLancamentoExtratoProps) {
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [data, setData] = useState(dataBrasiliaISO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipo("entrada");
    setValor("");
    setMotivo("");
    setData(dataBrasiliaISO());
  }, [open]);

  const valorNumero = parseValorMonetarioBR(valor);
  const valido = valorNumero > 0 && /^\d{4}-\d{2}-\d{2}$/.test(data);

  const confirmar = async () => {
    if (!valido || salvando) return;
    setSalvando(true);
    const ok = await onSalvar({ tipo, valor: valorNumero, motivo, data, categoria: "manual" });
    setSalvando(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Fundo azul-marinho translúcido com desfoque (classes locais sobre o overlay do projeto) */}
        <DialogOverlay className="bg-[rgba(6,15,32,0.6)] backdrop-blur-[8px]" />
        <DialogPrimitive.Content
          className={cn(
            // Celular: painel que sobe da parte de baixo, rola por dentro (até 95% da tela)
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[95dvh] w-full max-w-[520px] flex-col overflow-y-auto overscroll-contain",
            "rounded-t-[30px] bg-card px-6 pb-[calc(28px+env(safe-area-inset-bottom))] pt-[18px] text-card-foreground shadow-[0_-15px_60px_rgba(0,0,0,0.12)] focus:outline-none",
            "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-10 data-[state=open]:slide-in-from-bottom-10",
            "max-[390px]:px-[18px]",
            // Desktop: caixa centralizada, cantos de 26px, sem alça
            "md:inset-0 md:m-auto md:h-fit md:max-h-[90vh] md:rounded-[26px] md:pb-7 md:pt-7 md:shadow-[0_25px_60px_rgba(6,15,32,0.25)]",
            "md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
          )}
        >
          <div aria-hidden="true" className="mx-auto mb-7 h-[5px] w-12 shrink-0 rounded-full bg-[#AAB2C0] dark:bg-muted-foreground/50 md:hidden" />

          {/* Cabeçalho */}
          <div className="relative flex items-start gap-[15px] max-[390px]:gap-3">
            <div
              aria-hidden="true"
              className="grid h-[65px] w-[65px] shrink-0 place-items-center rounded-[18px] bg-[#EDF3FF] text-[#246BFF] dark:bg-primary/15 dark:text-primary max-[390px]:h-14 max-[390px]:w-14"
            >
              <FilePlus2 className="h-[30px] w-[30px] max-[390px]:h-[26px] max-[390px]:w-[26px]" />
            </div>
            <div className="min-w-0 flex-1 pr-9 pt-0.5">
              <DialogTitle className="text-xl font-extrabold leading-[1.25] tracking-[-0.6px] text-[#101828] dark:text-foreground max-[390px]:text-lg">
                Lançar entrada ou saída
              </DialogTitle>
              <DialogDescription className="mt-2 text-xs leading-[1.7] text-muted-foreground">
                Registra no extrato um valor que entrou ou saiu da empresa e não veio de venda, OS ou conta.
              </DialogDescription>
            </div>
            <DialogPrimitive.Close
              aria-label="Fechar"
              className={cn("absolute -top-2 right-0 grid h-[35px] w-[35px] place-items-center rounded-full bg-[#F1F3F7] text-[#101828] transition hover:bg-[#E6E9F0] dark:bg-muted dark:text-foreground dark:hover:bg-muted/70", FOCO)}
            >
              <X className="h-[19px] w-[19px]" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <div className="mt-8">
            {/* Entrada / Saída (verde para entrada, como o app já usa) */}
            <div role="group" aria-label="Tipo de lançamento" className="mb-7 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                aria-pressed={tipo === "entrada"}
                onClick={() => setTipo("entrada")}
                className={cn(
                  BOTAO_TIPO,
                  tipo === "entrada"
                    ? "border-transparent bg-[linear-gradient(110deg,#16A34A,#22C55E)] text-white shadow-[0_5px_15px_rgba(22,163,74,0.18)]"
                    : BOTAO_TIPO_INATIVO,
                )}
              >
                <ArrowUpCircle aria-hidden="true" />
                Entrada
              </button>
              <button
                type="button"
                aria-pressed={tipo === "saida"}
                onClick={() => setTipo("saida")}
                className={cn(
                  BOTAO_TIPO,
                  tipo === "saida"
                    ? "border-transparent bg-[linear-gradient(110deg,#EF4444,#F97316)] text-white shadow-[0_5px_15px_rgba(239,68,68,0.16)]"
                    : BOTAO_TIPO_INATIVO,
                )}
              >
                <ArrowDownCircle aria-hidden="true" />
                Saída
              </button>
            </div>

            <div className="space-y-[23px]">
              <div>
                <Label htmlFor="lancamento-valor" className={ROTULO}>Valor (R$)</Label>
                <div className={cn(CAMPO, "h-[66px] border-2 border-[#246BFF] dark:border-primary")}>
                  <Coins aria-hidden="true" />
                  <Input
                    id="lancamento-valor"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmar(); }}
                    autoFocus
                    className={cn(INPUT, "text-[23px] font-bold tracking-[-0.5px] placeholder:font-normal")}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="lancamento-data" className={ROTULO}>Data</Label>
                {/* Mesmo campo de data nativo de antes, invisível por cima: só a exibição é por extenso */}
                <div className={cn(CAMPO, "relative")}>
                  <CalendarDays aria-hidden="true" />
                  <span aria-hidden="true" className={cn("min-w-0 flex-1 truncate text-sm", data ? "text-[#101828] dark:text-foreground" : "text-[#8B98AE]")}>
                    {data ? formatarDataExtenso(data) : "Selecione a data"}
                  </span>
                  <ChevronDown aria-hidden="true" />
                  <Input
                    id="lancamento-data"
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* navegador sem showPicker: segue o padrão */ } }}
                    className="absolute inset-0 h-full w-full cursor-pointer rounded-[13px] border-0 opacity-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="lancamento-motivo" className={ROTULO}>Motivo (opcional)</Label>
                <div className={CAMPO}>
                  <MessageSquareText aria-hidden="true" />
                  <Input
                    id="lancamento-motivo"
                    maxLength={200}
                    placeholder={tipo === "entrada" ? "Ex: aporte do sócio" : "Ex: retirada do sócio"}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmar(); }}
                    className={cn(INPUT, "text-sm")}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-9 flex flex-col gap-3">
            <button
              type="button"
              onClick={confirmar}
              disabled={!valido || salvando}
              aria-busy={salvando}
              className={cn(
                "flex h-[58px] w-full shrink-0 items-center justify-center gap-2.5 rounded-[13px] text-[15px] font-bold text-white transition active:scale-[0.98]",
                "disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:active:scale-100 [&>svg]:h-[21px] [&>svg]:w-[21px]",
                tipo === "entrada"
                  ? "bg-[linear-gradient(110deg,#246BFF,#079FD0)] shadow-[0_8px_20px_rgba(36,107,255,0.15)]"
                  : "bg-[linear-gradient(110deg,#EF4444,#F97316)] shadow-[0_8px_20px_rgba(239,68,68,0.12)]",
                FOCO,
              )}
            >
              {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PlusCircle aria-hidden="true" />}
              Lançar {tipo === "entrada" ? "entrada" : "saída"}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
              className={cn(
                "h-[54px] w-full shrink-0 rounded-[13px] border border-border bg-card text-sm font-semibold text-[#101828] transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-55 dark:text-foreground",
                FOCO,
              )}
            >
              Cancelar
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

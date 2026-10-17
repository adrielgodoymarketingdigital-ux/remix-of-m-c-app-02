import { useEffect, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart3, CheckCircle2, Coins, FileText, Loader2, MessageSquareText, Scale, SlidersHorizontal, Wallet, X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { formatCurrency, parseValorMonetarioBR } from "@/lib/formatters";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";
import type { NovoLancamentoExtrato } from "@/hooks/useExtratoFinanceiro";

interface DialogBalancoCaixaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Saldo acumulado do Extrato agora (o do card "Saldo Atual"); null se falhou. */
  buscarSaldoAtual: () => Promise<number | null>;
  /** Grava o ajuste; true = deu certo (o diálogo fecha). */
  onSalvar: (lancamento: NovoLancamentoExtrato) => Promise<boolean>;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

// Visual do diálogo (referência layout-extrato/referencia-balanco; mesmo padrão do diálogo de lançamento). Só classes.
const FOCO = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#246BFF]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-card";
const ROTULO = "mb-2.5 block text-[13px] font-semibold text-[#101828] dark:text-foreground";
const CAMPO = cn(
  "flex h-[58px] items-center gap-3 rounded-[13px] border border-border bg-card px-[15px] transition",
  "focus-within:border-[#246BFF] focus-within:shadow-[0_0_0_3px_rgba(36,107,255,0.09)] dark:focus-within:border-primary",
  "[&>svg]:h-5 [&>svg]:w-5 [&>svg]:shrink-0 [&>svg]:text-[#66758F] dark:[&>svg]:text-muted-foreground",
);
const INPUT = "h-full min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-[#101828] shadow-none placeholder:text-[#8B98AE] focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-foreground dark:placeholder:text-muted-foreground";

/**
 * Balanço do caixa: o usuário informa o saldo real e o sistema lança UM ajuste
 * (entrada ou saída) com a diferença, para o saldo do Extrato bater dali em diante.
 */
export function DialogBalancoCaixa({ open, onOpenChange, buscarSaldoAtual, onSalvar }: DialogBalancoCaixaProps) {
  const [saldoSistema, setSaldoSistema] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [saldoInformado, setSaldoInformado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [contaNoSaldo, setContaNoSaldo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSaldoInformado("");
    setMotivo("");
    setContaNoSaldo(true);
    setSaldoSistema(null);
    setCarregando(true);
    buscarSaldoAtual().then((saldo) => {
      setSaldoSistema(saldo);
      setCarregando(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // parseValorMonetarioBR devolve o valor absoluto; o saldo real pode ser negativo (conta no vermelho).
  const informadoPreenchido = /\d/.test(saldoInformado);
  const informado = (saldoInformado.trim().startsWith("-") ? -1 : 1) * parseValorMonetarioBR(saldoInformado);
  const ajuste = saldoSistema !== null && informadoPreenchido ? centavos(informado - saldoSistema) : null;
  const semDiferenca = ajuste !== null && Math.abs(ajuste) < 0.01;

  const confirmar = async () => {
    if (ajuste === null || semDiferenca || salvando || saldoSistema === null) return;
    setSalvando(true);
    // Recalcula na hora de gravar: se entrou/saiu algo desde a prévia, mostra a prévia nova antes.
    const saldoAgora = await buscarSaldoAtual();
    if (saldoAgora === null) {
      toast.error("Não foi possível conferir o saldo. Tente de novo.");
      setSalvando(false);
      return;
    }
    if (Math.abs(saldoAgora - saldoSistema) >= 0.01) {
      setSaldoSistema(saldoAgora);
      setSalvando(false);
      toast.info("O saldo do sistema mudou enquanto você conferia. Veja o ajuste atualizado e confirme de novo.");
      return;
    }
    const ok = await onSalvar({
      tipo: ajuste > 0 ? "entrada" : "saida",
      valor: Math.abs(ajuste),
      motivo,
      data: dataBrasiliaISO(),
      categoria: "balanco",
      contaNoSaldo,
    });
    setSalvando(false);
    if (ok) onOpenChange(false);
  };

  const erroSaldo = !carregando && saldoSistema === null;

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
            "max-[380px]:px-[18px]",
            // Desktop: caixa centralizada, cantos de 26px, sem alça
            "md:inset-0 md:m-auto md:h-fit md:max-h-[90vh] md:rounded-[26px] md:px-[30px] md:pb-[30px] md:pt-[25px] md:shadow-[0_25px_60px_rgba(6,15,32,0.25)]",
            "md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
          )}
        >
          <div aria-hidden="true" className="mx-auto mb-7 h-[5px] w-12 shrink-0 rounded-full bg-[#AAB2C0] dark:bg-muted-foreground/50 md:hidden" />

          {/* Cabeçalho */}
          <div className="relative flex items-start gap-[15px] max-[380px]:gap-3">
            <div
              aria-hidden="true"
              className="grid h-[65px] w-[65px] shrink-0 place-items-center rounded-[18px] bg-[#EDF3FF] text-[#246BFF] dark:bg-primary/15 dark:text-primary max-[380px]:h-[52px] max-[380px]:w-[52px]"
            >
              <Scale className="h-8 w-8 max-[380px]:h-[26px] max-[380px]:w-[26px]" />
            </div>
            <div className="min-w-0 flex-1 pr-9 pt-0.5">
              <DialogTitle className="text-[21px] font-extrabold leading-[1.3] tracking-[-0.6px] text-[#101828] dark:text-foreground max-[380px]:text-lg">
                Balanço do caixa
              </DialogTitle>
              <DialogDescription className="mt-2 text-xs leading-[1.75] text-muted-foreground max-[380px]:text-[11px]">
                Informe quanto a empresa tem de verdade hoje (banco + caixa). O sistema lança um único ajuste para o
                saldo do extrato bater com esse valor daqui pra frente.
              </DialogDescription>
            </div>
            <DialogPrimitive.Close
              aria-label="Fechar"
              className={cn("absolute -top-2 right-0 grid h-[35px] w-[35px] place-items-center rounded-full bg-[#F1F3F7] text-[#101828] transition hover:bg-[#E6E9F0] dark:bg-muted dark:text-foreground dark:hover:bg-muted/70", FOCO)}
            >
              <X className="h-[19px] w-[19px]" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <div className="mt-7 space-y-[23px]">
            <div>
              <Label htmlFor="balanco-saldo" className={ROTULO}>Saldo real (R$)</Label>
              <div className={cn(CAMPO, "h-[66px] border-2 border-[#246BFF] dark:border-primary")}>
                <Coins aria-hidden="true" />
                <Input
                  id="balanco-saldo"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={saldoInformado}
                  onChange={(e) => setSaldoInformado(e.target.value)}
                  autoFocus
                  aria-describedby={erroSaldo ? "balanco-erro-saldo" : undefined}
                  className={cn(INPUT, "text-[23px] font-bold tracking-[-0.5px] placeholder:font-normal")}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="balanco-motivo" className={ROTULO}>Motivo (opcional)</Label>
              <div className={CAMPO}>
                <MessageSquareText aria-hidden="true" />
                <Input
                  id="balanco-motivo"
                  maxLength={200}
                  placeholder="Ex: Balanço de recomeço, conferência manual"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className={cn(INPUT, "text-[13px]")}
                />
              </div>
            </div>
          </div>

          {/* Cartão do interruptor */}
          <div className="mb-[25px] mt-7 flex items-center gap-[13px] rounded-[15px] border border-border bg-[#FCFDFF] px-[15px] py-[17px] dark:bg-muted/30 max-[380px]:gap-2.5 max-[380px]:px-3">
            <div
              aria-hidden="true"
              className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[13px] bg-[#E8F0FF] text-[#246BFF] dark:bg-primary/15 dark:text-primary max-[380px]:h-10 max-[380px]:w-10"
            >
              <FileText className="h-[23px] w-[23px] max-[380px]:h-5 max-[380px]:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Label htmlFor="balanco-conta-saldo" className="block cursor-pointer text-[13px] font-bold leading-[1.4] text-[#101828] dark:text-foreground">
                Contar no saldo e nos relatórios
              </Label>
              <p id="balanco-conta-saldo-desc" className="mt-[5px] text-[11px] leading-[1.6] text-muted-foreground">
                {contaNoSaldo
                  ? "Esse ajuste entra no Saldo Atual, nos cards de entrada/saída e no Extrato."
                  : "Esse ajuste fica gravado, mas não aparece no saldo, nos cards nem em nenhum relatório financeiro."}
              </p>
            </div>
            <Switch
              id="balanco-conta-saldo"
              checked={contaNoSaldo}
              onCheckedChange={setContaNoSaldo}
              aria-label="Contar no saldo e nos relatórios"
              aria-describedby="balanco-conta-saldo-desc"
              className={cn(
                "h-[27px] w-[47px] border-0 data-[state=checked]:bg-[#246BFF] data-[state=unchecked]:bg-[#CBD5E1] dark:data-[state=checked]:bg-primary dark:data-[state=unchecked]:bg-muted-foreground/40",
                "[&>span]:ml-[3px] [&>span]:h-[21px] [&>span]:w-[21px] [&>span]:bg-white [&>span]:shadow-[0_1px_4px_rgba(0,0,0,0.12)] [&>span[data-state=checked]]:translate-x-5",
                "focus-visible:ring-[3px] focus-visible:ring-[#246BFF]/25 focus-visible:ring-offset-[3px] focus-visible:ring-offset-card",
              )}
            />
          </div>

          {/* Resumo */}
          <div className="rounded-2xl border border-border bg-[#FAFBFD] px-4 py-1 dark:bg-muted/30 max-[380px]:px-3">
            <LinhaResumo icone={Wallet} rotulo="Saldo atual do sistema">
              <span className="text-[#101828] dark:text-foreground">
                {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Carregando saldo" /> : saldoSistema === null ? "Indisponível" : formatCurrency(saldoSistema)}
              </span>
            </LinhaResumo>
            <LinhaResumo icone={BarChart3} rotulo="Saldo informado">
              <span className="text-[#101828] dark:text-foreground">{informadoPreenchido ? formatCurrency(informado) : "—"}</span>
            </LinhaResumo>
            <LinhaResumo icone={SlidersHorizontal} rotulo="Ajuste a ser lançado">
              {ajuste === null ? (
                <span className="text-[#101828] dark:text-foreground">—</span>
              ) : semDiferenca ? (
                <span className="whitespace-normal text-[#101828] dark:text-foreground">Nenhum — o saldo já confere</span>
              ) : (
                <span className={ajuste > 0 ? "text-[#16A34A] dark:text-emerald-400" : "text-[#EF4444] dark:text-red-400"}>
                  {formatCurrency(Math.abs(ajuste))} ({ajuste > 0 ? "entrada" : "saída"})
                </span>
              )}
            </LinhaResumo>
          </div>

          {erroSaldo && (
            <p id="balanco-erro-saldo" role="alert" className="mt-2 text-xs text-destructive">Não foi possível calcular o saldo do sistema. Feche e abra de novo.</p>
          )}

          <div className="mt-[35px] flex flex-col gap-3">
            <button
              type="button"
              onClick={confirmar}
              disabled={ajuste === null || semDiferenca || salvando}
              aria-busy={salvando}
              className={cn(
                "flex h-[58px] w-full shrink-0 items-center justify-center gap-2.5 rounded-[13px] bg-[linear-gradient(110deg,#246BFF,#079FD0)] text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(36,107,255,0.15)] transition active:scale-[0.98]",
                "disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:active:scale-100 [&>svg]:h-[21px] [&>svg]:w-[21px]",
                FOCO,
              )}
            >
              {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
              Confirmar ajuste
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

/** Linha do resumo: ícone cinza, rótulo e valor à direita (o valor desce de linha se não couber). */
function LinhaResumo({ icone: Icone, rotulo, children }: { icone: LucideIcon; rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-[15px] last:border-b-0">
      <div className="flex min-w-[150px] flex-1 items-center gap-3 max-[380px]:gap-2.5">
        <div aria-hidden="true" className="grid h-[37px] w-[37px] shrink-0 place-items-center rounded-[10px] bg-[#EEF2F8] text-[#526580] dark:bg-muted dark:text-muted-foreground">
          <Icone className="h-[19px] w-[19px]" />
        </div>
        <span className="text-xs leading-[1.5] text-muted-foreground max-[380px]:text-[11px]">{rotulo}</span>
      </div>
      <div className="ml-auto whitespace-nowrap text-right text-[13px] font-bold max-[380px]:text-xs">{children}</div>
    </div>
  );
}

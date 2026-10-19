import { useEffect, useState } from "react";
import { Wallet, TrendingUp, TrendingDown, Store, PlusCircle, Scale, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import type { FiltrosPeriodo } from "@/components/financeiro/FiltroPeriodoAvancado";
import { FiltroPeriodoExtrato } from "@/components/financeiro/extrato/FiltroPeriodoExtrato";
import { ListaExtrato } from "@/components/financeiro/ListaExtrato";
import { DialogDetalheExtrato } from "@/components/financeiro/DialogDetalheExtrato";
import { DialogLancamentoExtrato } from "@/components/financeiro/DialogLancamentoExtrato";
import { DialogBalancoCaixa } from "@/components/financeiro/DialogBalancoCaixa";
import { DialogEditarLancamentoExtrato } from "@/components/financeiro/DialogEditarLancamentoExtrato";
import { DialogExcluirLancamentoExtrato } from "@/components/financeiro/DialogExcluirLancamentoExtrato";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  EdicaoLancamentoExtrato,
  EventoExtrato,
  NovoLancamentoExtrato,
  ORIGENS_PDV,
  useExtratoFinanceiro,
} from "@/hooks/useExtratoFinanceiro";
import { nowBrasilia } from "@/lib/dataBrasilia";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";
import { cn } from "@/lib/utils";

// Visual da tela (referência layout-extrato). Só classes.
const FOCO = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#A7C8FF] focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const BOTAO_TOPO = cn(
  "inline-flex h-[46px] items-center justify-center gap-2 whitespace-nowrap rounded-xl px-[13px] text-xs font-semibold transition disabled:pointer-events-none disabled:opacity-50 max-[360px]:px-2 max-[360px]:text-[11px] [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0",
  FOCO,
);

// Barrinhas decorativas dos cards Entradas/Saídas: só enfeite, não representam dados.
const BARRAS_DECORATIVAS = [14, 22, 12, 30, 18, 10, 24, 36, 16, 12, 20, 28, 14, 40, 18, 10, 26];

/**
 * Olho do card Saldo: alterna o mesmo "ocultar valores" do cabeçalho.
 * Precisa ser um componente filho: o OcultarValoresProvider fica dentro do
 * AppLayout, então o hook chamado direto em Extrato() não enxerga o estado.
 */
function BotaoOlhoSaldo() {
  const { valoresOcultos, toggleValores } = useOcultarValores();
  return (
    <button
      type="button"
      onClick={toggleValores}
      aria-label={valoresOcultos ? "Mostrar valores" : "Ocultar valores"}
      aria-pressed={valoresOcultos}
      className={cn("grid h-7 w-7 place-items-center rounded-lg text-[#101828] transition hover:bg-black/5 dark:text-foreground dark:hover:bg-white/10", FOCO)}
    >
      {valoresOcultos ? <EyeOff className="h-[19px] w-[19px]" aria-hidden="true" /> : <Eye className="h-[19px] w-[19px]" aria-hidden="true" />}
    </button>
  );
}

function CardResumo({ tipo, titulo, valor }: { tipo: "entrada" | "saida"; titulo: string; valor: number }) {
  const entrada = tipo === "entrada";
  const Icone = entrada ? TrendingUp : TrendingDown;
  return (
    <section className="min-w-0 overflow-hidden rounded-[18px] border border-border bg-card px-[13px] py-[17px] shadow-[0_5px_18px_rgba(16,24,40,0.035)] max-[390px]:px-[9px] max-[390px]:py-3">
      {/* Valores longos descem para baixo do ícone em vez de estourar o card */}
      <div className="flex flex-wrap items-start gap-2.5 max-[390px]:gap-1.5">
        <div
          aria-hidden="true"
          className={cn(
            "grid h-[43px] w-[43px] shrink-0 place-items-center rounded-[13px] max-[390px]:h-[35px] max-[390px]:w-[35px] [&>svg]:h-[22px] [&>svg]:w-[22px] max-[390px]:[&>svg]:h-[19px] max-[390px]:[&>svg]:w-[19px]",
            entrada ? "bg-[#DFF9E9] text-[#009C4A] dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-[#FFE5E5] text-[#F02828] dark:bg-red-500/15 dark:text-red-400",
          )}
        >
          <Icone />
        </div>
        <div className="min-w-min flex-1">
          <p className="text-xs text-[#101828] dark:text-foreground">{titulo}</p>
          <p
            className={cn(
              "mt-[5px] whitespace-nowrap text-[clamp(16px,3.7vw,25px)] font-extrabold leading-tight tracking-[-0.5px] md:text-[clamp(16px,2.2vw,24px)]",
              entrada ? "text-[#009C4A] dark:text-emerald-400" : "text-[#F02828] dark:text-red-400",
            )}
          >
            <ValorMonetario valor={valor} />
          </p>
          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">No período selecionado</p>
        </div>
      </div>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 170 40" preserveAspectRatio="none" className="mt-[18px] h-10 w-full opacity-80 dark:opacity-50">
        <defs>
          <linearGradient id={`barras-${tipo}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={entrada ? "#00CC75" : "#FF5D72"} />
            <stop offset="1" stopColor={entrada ? "#C8F7DE" : "#FFE0E5"} />
          </linearGradient>
        </defs>
        {BARRAS_DECORATIVAS.map((h, i) => (
          <rect key={i} x={i * 10} y={40 - h} width="6" height={h} rx="2" fill={`url(#barras-${tipo})`} />
        ))}
      </svg>
    </section>
  );
}

/** Mesmo cálculo do preset "mes_atual" de FiltroPeriodoAvancado — usado só pro estado inicial. */
function periodoMesAtual(): FiltrosPeriodo {
  const hoje = nowBrasilia();
  const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const fimMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0));
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { dataInicio: fmt(inicioMes), dataFim: fmt(fimMes) };
}

export default function Extrato() {
  const [filtro, setFiltro] = useState<FiltrosPeriodo>(periodoMesAtual);
  const [somentePDV, setSomentePDV] = useState(false);
  const [eventoDetalhe, setEventoDetalhe] = useState<EventoExtrato | null>(null);
  const [eventoEditando, setEventoEditando] = useState<EventoExtrato | null>(null);
  const [eventoExcluindo, setEventoExcluindo] = useState<EventoExtrato | null>(null);
  const [lancamentoAberto, setLancamentoAberto] = useState(false);
  const [balancoAberto, setBalancoAberto] = useState(false);
  const origensLista = somentePDV ? ORIGENS_PDV : undefined;
  const {
    resumo,
    carregandoResumo,
    carregarResumo,
    eventos,
    carregandoLista,
    temMais,
    carregarLista,
    carregarMais,
    identidadeCarregando,
    buscarSaldoAtual,
    criarLancamento,
    atualizarLancamento,
    excluirLancamento,
  } = useExtratoFinanceiro();

  // Lançamento manual e ajuste de balanço: grava e recarrega cards + lista.
  const salvarLancamento = async (lancamento: NovoLancamentoExtrato) => {
    const ok = await criarLancamento(lancamento);
    if (!ok) return false;
    toast.success(lancamento.categoria === "balanco" ? "Balanço lançado — saldo ajustado" : "Lançamento registrado");
    carregarResumo(filtro);
    carregarLista(filtro, 0, origensLista);
    return true;
  };

  // Editar valor/data/conta-no-saldo de um lançamento manual ou de balanço já gravado.
  const salvarEdicaoLancamento = async (edicao: EdicaoLancamentoExtrato) => {
    const ok = await atualizarLancamento(edicao);
    if (!ok) return false;
    toast.success("Lançamento atualizado");
    carregarResumo(filtro);
    carregarLista(filtro, 0, origensLista);
    return true;
  };

  // Excluir: o saldo/cards recalculam sozinhos (somam direto da tabela), só recarrega.
  const confirmarExclusaoLancamento = async (evento: EventoExtrato) => {
    setEventoExcluindo(null);
    const ok = await excluirLancamento(evento.referencia_id);
    if (!ok) return;
    toast.success("Lançamento excluído");
    carregarResumo(filtro);
    carregarLista(filtro, 0, origensLista);
  };

  useEffect(() => {
    if (identidadeCarregando || !filtro.dataInicio || !filtro.dataFim) return;
    carregarResumo(filtro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identidadeCarregando, filtro.dataInicio, filtro.dataFim]);

  // O filtro "Só PDV" restringe só a lista; os cards continuam com o total do período.
  useEffect(() => {
    if (identidadeCarregando || !filtro.dataInicio || !filtro.dataFim) return;
    carregarLista(filtro, 0, origensLista);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identidadeCarregando, filtro.dataInicio, filtro.dataFim, somentePDV]);

  return (
    <AppLayout>
      <main className="flex-1 p-6 overflow-auto">
        {/* No desktop usa a área toda ao lado do menu, expandido ou recolhido (sem teto) */}
        <div className="max-w-5xl lg:max-w-none mx-auto flex flex-col gap-6">
          {/* Título + ações. lg:pt-6: os botões encostam na borda direita e o
              olho flutuante do layout (BotaoOcultarValores, fixed top-4 right-4,
              só no desktop) ficaria por cima de "Lançar entrada/saída" */}
          <div className="order-1 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between lg:pt-6">
            <div className="min-w-0">
              <h1 className="text-[32px] font-extrabold leading-tight tracking-[-1px] text-[#0B1429] dark:text-foreground">Extrato</h1>
              <p className="mt-1.5 max-w-[350px] text-[13px] leading-[1.6] text-muted-foreground">
                Todo o dinheiro que entrou e saiu da loja, como um extrato bancário.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
              <button
                type="button"
                onClick={() => setBalancoAberto(true)}
                disabled={identidadeCarregando}
                className={cn(BOTAO_TOPO, "border border-border bg-card text-[#101828] shadow-[0_5px_15px_rgba(16,24,40,0.04)] hover:bg-muted/60 dark:text-foreground")}
              >
                <Scale className="text-[#246BFF] dark:text-primary" aria-hidden="true" />
                Balanço do caixa
              </button>
              <button
                type="button"
                onClick={() => setLancamentoAberto(true)}
                disabled={identidadeCarregando}
                className={cn(BOTAO_TOPO, "bg-[linear-gradient(110deg,#246BFF,#079FD0)] text-white shadow-[0_5px_15px_rgba(36,107,255,0.18)] hover:brightness-105")}
              >
                <PlusCircle aria-hidden="true" />
                Lançar entrada/saída
              </button>
            </div>
          </div>

          {/* Cards: no celular, Saldo em cima e Entradas/Saídas lado a lado; no desktop, 3 colunas como antes */}
          <div className="order-3 grid grid-cols-2 gap-3 md:order-2 md:grid-cols-3 md:gap-4">
            <section className="relative col-span-2 rounded-[20px] border border-[#DBE7FF] bg-[linear-gradient(135deg,#F0F6FF,#FFFFFF_65%)] px-[18px] py-[22px] shadow-[0_7px_22px_rgba(16,24,40,0.045)] dark:border-primary/25 dark:bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_65%)] md:col-span-1">
              <div
                aria-hidden="true"
                className="absolute right-[18px] top-[22px] grid h-[51px] w-[51px] place-items-center rounded-[15px] bg-[#E5EFFF] text-[#246BFF] dark:bg-primary/15 dark:text-primary md:h-11 md:w-11"
              >
                <Wallet className="h-[25px] w-[25px] md:h-[22px] md:w-[22px]" />
              </div>
              <div className="flex items-center gap-[9px] pr-[62px]">
                <span className="text-sm font-semibold text-[#101828] dark:text-foreground">Saldo Atual</span>
                <BotaoOlhoSaldo />
              </div>
              <div className="mt-[13px] whitespace-nowrap pr-[62px] text-[clamp(24px,6.9vw,40px)] font-extrabold leading-tight tracking-[-1px] text-[#0B1429] dark:text-foreground md:pr-0 md:text-[28px]">
                <ValorMonetario valor={resumo?.saldo_atual ?? 0} />
              </div>
              <p className="mt-[9px] text-xs text-muted-foreground">Acumulado desde o início</p>
            </section>

            <CardResumo
              tipo="entrada"
              titulo="Entradas"
              valor={resumo?.entradas_periodo ?? 0}
            />
            <CardResumo
              tipo="saida"
              titulo="Saídas"
              valor={resumo?.saidas_periodo ?? 0}
            />
          </div>

          <div className="order-2 md:order-3">
            <FiltroPeriodoExtrato
              onFiltrar={setFiltro}
              loading={carregandoResumo || carregandoLista}
            />
          </div>

          <div className="order-4 flex items-center gap-2">
            <Switch id="extrato-somente-pdv" checked={somentePDV} onCheckedChange={setSomentePDV} />
            <Label htmlFor="extrato-somente-pdv" className="flex items-center gap-1.5 text-sm cursor-pointer">
              <Store className="h-4 w-4 text-muted-foreground" />
              Só movimentações do PDV (sangria e suprimento)
            </Label>
          </div>

          <div className="order-5 space-y-4">
            <h2 className="text-[21px] font-bold tracking-[-0.5px] text-[#101828] dark:text-foreground">Movimentações</h2>
            <ListaExtrato
              eventos={eventos}
              carregando={carregandoLista}
              temMais={temMais}
              onCarregarMais={() => carregarMais(filtro, origensLista)}
              onVerDetalhes={setEventoDetalhe}
              onEditar={setEventoEditando}
              onExcluir={setEventoExcluindo}
            mensagemVazio={somentePDV ? "Nenhuma sangria ou suprimento do PDV neste período." : undefined}
            />
          </div>

          <DialogLancamentoExtrato
            open={lancamentoAberto}
            onOpenChange={setLancamentoAberto}
            onSalvar={salvarLancamento}
          />

          <DialogBalancoCaixa
            open={balancoAberto}
            onOpenChange={setBalancoAberto}
            buscarSaldoAtual={buscarSaldoAtual}
            onSalvar={salvarLancamento}
          />

          <DialogDetalheExtrato
            evento={eventoDetalhe}
            onOpenChange={(open) => { if (!open) setEventoDetalhe(null); }}
          />

          <DialogEditarLancamentoExtrato
            evento={eventoEditando}
            onOpenChange={(open) => { if (!open) setEventoEditando(null); }}
            onSalvar={salvarEdicaoLancamento}
          />

          <DialogExcluirLancamentoExtrato
            evento={eventoExcluindo}
            onOpenChange={(open) => { if (!open) setEventoExcluindo(null); }}
            onConfirmar={confirmarExclusaoLancamento}
          />
        </div>
      </main>
    </AppLayout>
  );
}

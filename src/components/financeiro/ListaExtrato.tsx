import { ValorMonetario } from "@/components/ui/valor-monetario";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpCircle, ArrowDownCircle, Eye, Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { ORIGENS_PDV, ORIGENS_EDITAVEIS, type EventoExtrato } from "@/hooks/useExtratoFinanceiro";
import { temDetalheExtrato } from "@/hooks/useDetalheExtrato";
import { LABEL_ORIGEM_EXTRATO as LABEL_ORIGEM } from "@/lib/financeiro/origensExtrato";
import { cn } from "@/lib/utils";

interface ListaExtratoProps {
  eventos: EventoExtrato[];
  carregando: boolean;
  temMais: boolean;
  onCarregarMais: () => void;
  /** Abre o popup de detalhes (linhas de venda, de OS e de devolução de troca). */
  onVerDetalhes: (evento: EventoExtrato) => void;
  /** Abre o diálogo de editar (só lançamento manual/balanço). */
  onEditar: (evento: EventoExtrato) => void;
  /** Abre a confirmação de exclusão (só lançamento manual/balanço). */
  onExcluir: (evento: EventoExtrato) => void;
  /** Texto quando não há linhas (ex.: filtro "Só PDV" sem movimentações). */
  mensagemVazio?: string;
}

/** "2026-06-10" → "10/06/2026", sem passar por Date (evita reinterpretação de fuso horário). */
const formatarDataBR = (isoDate: string) => {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
};

// Visual da lista (referência layout-extrato). Só classes.
const FOCO = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#A7C8FF] focus-visible:ring-offset-1 focus-visible:ring-offset-background";
const SELO = "inline-flex items-center whitespace-nowrap rounded-full px-2 py-[3px] text-[10px] font-semibold leading-none";

export function ListaExtrato({ eventos, carregando, temMais, onCarregarMais, onVerDetalhes, onEditar, onExcluir, mensagemVazio }: ListaExtratoProps) {
  if (!carregando && eventos.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {mensagemVazio ?? "Nenhuma movimentação neste período."}
      </div>
    );
  }

  const grupos: { data: string; itens: EventoExtrato[] }[] = [];
  for (const evento of eventos) {
    const ultimoGrupo = grupos[grupos.length - 1];
    if (ultimoGrupo && ultimoGrupo.data === evento.data) {
      ultimoGrupo.itens.push(evento);
    } else {
      grupos.push({ data: evento.data, itens: [evento] });
    }
  }

  return (
    <div className="space-y-[13px]">
      {grupos.map((grupo) => (
        <section key={grupo.data} className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Faixa do dia */}
          <div className="bg-[#F0F4FA] px-[13px] py-[13px] text-[11px] font-medium text-[#526580] dark:bg-muted/60 dark:text-muted-foreground">
            <p>{formatarDataBR(grupo.data)}</p>
          </div>
          {grupo.itens.map((evento) => {
            const entrada = evento.tipo === "entrada";
            const temDetalhe = temDetalheExtrato(evento);
            const editavel = ORIGENS_EDITAVEIS.includes(evento.origem);
            return (
              <div
                key={`${evento.origem}:${evento.referencia_id}`}
                data-evento=""
                className="flex items-center gap-3 border-b border-border px-[13px] py-[15px] last:border-b-0 max-[390px]:gap-2 max-[390px]:px-[9px] max-[390px]:py-3"
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    "grid h-[45px] w-[45px] shrink-0 place-items-center rounded-[13px] max-[390px]:h-10 max-[390px]:w-10 [&>svg]:h-[22px] [&>svg]:w-[22px]",
                    entrada
                      ? "bg-[#E0FAEA] text-[#009C4A] dark:bg-emerald-500/15 dark:text-emerald-400"
                      : "bg-[#FFE9E9] text-[#F02828] dark:bg-red-500/15 dark:text-red-400",
                  )}
                >
                  {entrada ? <ArrowUpCircle /> : <ArrowDownCircle />}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-sm font-bold leading-snug text-[#101828] dark:text-foreground">{evento.descricao}</p>
                  <div className="mt-[5px] flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{LABEL_ORIGEM[evento.origem] ?? evento.origem}</span>
                    {ORIGENS_PDV.includes(evento.origem) && (
                      <span className={cn(SELO, "bg-[#E5EEFF] text-[#246BFF] dark:bg-blue-500/15 dark:text-blue-400")}>PDV</span>
                    )}
                    {!evento.conta_no_saldo && (
                      <span className={cn(SELO, "bg-[#FFF0D6] text-[#A66A00] ring-1 ring-inset ring-[#F5C46B] dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-500/40")}>
                        Fora do caixa
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={cn(
                    "shrink-0 whitespace-nowrap text-sm font-bold max-[390px]:text-xs",
                    entrada ? "text-[#009C4A] dark:text-emerald-400" : "text-[#F02828] dark:text-red-400",
                  )}
                >
                  {entrada ? "+ " : "− "}
                  <ValorMonetario valor={evento.valor} />
                </span>

                {/* Ações reais da linha (as mesmas de antes) num menu de três pontos */}
                {temDetalhe || editavel ? (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Mais ações de "${evento.descricao}"`}
                        className={cn("-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#101828] transition hover:bg-muted dark:text-foreground", FOCO)}
                      >
                        <MoreVertical className="h-[18px] w-[18px]" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {temDetalhe && (
                        <DropdownMenuItem onSelect={() => onVerDetalhes(evento)}>
                          <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                          Ver detalhes
                        </DropdownMenuItem>
                      )}
                      {editavel && (
                        <>
                          <DropdownMenuItem onSelect={() => onEditar(evento)}>
                            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                            Editar lançamento
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => onExcluir(evento)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                            Excluir lançamento
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span aria-hidden="true" className="-mr-1 w-8 shrink-0" />
                )}
              </div>
            );
          })}
        </section>
      ))}

      {carregando && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!carregando && temMais && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onCarregarMais}
            className={cn("h-10 rounded-xl border border-border bg-card px-5 text-sm font-semibold text-[#0B1429] transition hover:bg-muted/60 dark:text-foreground", FOCO)}
          >
            Carregar mais
          </button>
        </div>
      )}
    </div>
  );
}

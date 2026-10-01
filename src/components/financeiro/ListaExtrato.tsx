import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { ArrowUpCircle, ArrowDownCircle, Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { ORIGENS_PDV, ORIGENS_EDITAVEIS, type EventoExtrato, type OrigemEventoExtrato } from "@/hooks/useExtratoFinanceiro";
import { temDetalheExtrato } from "@/hooks/useDetalheExtrato";

interface ListaExtratoProps {
  eventos: EventoExtrato[];
  carregando: boolean;
  temMais: boolean;
  onCarregarMais: () => void;
  /** Abre o popup de detalhes (linhas de venda e de OS). */
  onVerDetalhes: (evento: EventoExtrato) => void;
  /** Abre o diálogo de editar (só lançamento manual/balanço). */
  onEditar: (evento: EventoExtrato) => void;
  /** Abre a confirmação de exclusão (só lançamento manual/balanço). */
  onExcluir: (evento: EventoExtrato) => void;
  /** Texto quando não há linhas (ex.: filtro "Só PDV" sem movimentações). */
  mensagemVazio?: string;
}

const LABEL_ORIGEM: Record<OrigemEventoExtrato, string> = {
  venda_pdv: "Venda",
  venda_avulsa: "Venda Avulsa",
  servico_avulso: "Serviço Avulso",
  ordem_servico: "Ordem de Serviço",
  conta_receber: "Conta a Receber",
  conta_pagar: "Conta a Pagar",
  pdv_sangria: "Sangria",
  pdv_suprimento: "Suprimento",
  lancamento_manual: "Lançamento Manual",
  balanco_caixa: "Balanço do Caixa",
};

/** "2026-06-10" → "10/06/2026", sem passar por Date (evita reinterpretação de fuso horário). */
const formatarDataBR = (isoDate: string) => {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
};

export function ListaExtrato({ eventos, carregando, temMais, onCarregarMais, onVerDetalhes, onEditar, onExcluir, mensagemVazio }: ListaExtratoProps) {
  if (!carregando && eventos.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {mensagemVazio ?? "Nenhuma movimentação neste período."}
      </Card>
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
    <div className="space-y-4">
      {grupos.map((grupo) => (
        <div key={grupo.data} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {formatarDataBR(grupo.data)}
          </p>
          <Card className="divide-y">
            {grupo.itens.map((evento) => (
              <div key={`${evento.origem}:${evento.referencia_id}`} className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  {evento.tipo === "entrada" ? (
                    <ArrowUpCircle className="h-5 w-5 text-green-600 shrink-0" />
                  ) : (
                    <ArrowDownCircle className="h-5 w-5 text-destructive shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{evento.descricao}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {ORIGENS_PDV.includes(evento.origem) && (
                        <Badge className="text-[10px]">PDV</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {LABEL_ORIGEM[evento.origem] ?? evento.origem}
                      </Badge>
                      {!evento.conta_no_saldo && (
                        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                          Fora do caixa
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {temDetalheExtrato(evento) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      title="Ver detalhes"
                      aria-label="Ver detalhes"
                      onClick={() => onVerDetalhes(evento)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {ORIGENS_EDITAVEIS.includes(evento.origem) && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        title="Editar lançamento"
                        aria-label="Editar lançamento"
                        onClick={() => onEditar(evento)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Excluir lançamento"
                        aria-label="Excluir lançamento"
                        onClick={() => onExcluir(evento)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <span className={`text-sm font-semibold ${evento.tipo === "entrada" ? "text-green-600" : "text-destructive"}`}>
                    {evento.tipo === "entrada" ? "+ " : "− "}
                    <ValorMonetario valor={evento.valor} />
                  </span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      ))}

      {carregando && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!carregando && temMais && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={onCarregarMais}>
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}

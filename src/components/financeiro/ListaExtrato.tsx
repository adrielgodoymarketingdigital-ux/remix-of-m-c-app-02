import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { ArrowUpCircle, ArrowDownCircle, Loader2 } from "lucide-react";
import type { EventoExtrato, OrigemEventoExtrato } from "@/hooks/useExtratoFinanceiro";

interface ListaExtratoProps {
  eventos: EventoExtrato[];
  carregando: boolean;
  temMais: boolean;
  onCarregarMais: () => void;
}

const LABEL_ORIGEM: Record<OrigemEventoExtrato, string> = {
  venda_pdv: "Venda",
  venda_avulsa: "Venda Avulsa",
  servico_avulso: "Serviço Avulso",
  ordem_servico: "Ordem de Serviço",
  conta_receber: "Conta a Receber",
  conta_pagar: "Conta a Pagar",
};

/** "2026-06-10" → "10/06/2026", sem passar por Date (evita reinterpretação de fuso horário). */
const formatarDataBR = (isoDate: string) => {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
};

export function ListaExtrato({ eventos, carregando, temMais, onCarregarMais }: ListaExtratoProps) {
  if (!carregando && eventos.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Nenhuma movimentação neste período.
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
                    <Badge variant="outline" className="text-[10px] mt-0.5">
                      {LABEL_ORIGEM[evento.origem] ?? evento.origem}
                    </Badge>
                  </div>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${evento.tipo === "entrada" ? "text-green-600" : "text-destructive"}`}>
                  {evento.tipo === "entrada" ? "+ " : "− "}
                  <ValorMonetario valor={evento.valor} />
                </span>
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

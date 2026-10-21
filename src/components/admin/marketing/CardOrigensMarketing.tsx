import { useMemo, useState } from "react";
import { AlertCircle, Info, RefreshCw, Route } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { FuncaoOrigensIndisponivel, useAdminMarketingOrigens } from "@/hooks/useAdminMarketingOrigens";
import type { PeriodoMarketing } from "@/lib/marketing/cadastrosPorDia";
import {
  AGRUPAMENTOS_ORIGEM,
  LIMITE_LINHAS_ORIGENS,
  agruparOrigens,
  formatarConversao,
  taxaConversao,
  totalOrigens,
  type AgrupamentoOrigem,
  type TotaisOrigem,
} from "@/lib/marketing/origens";

/** Quantas origens mostrar antes do "Ver todas". */
const LINHAS_VISIVEIS = 20;

const fmtNumero = (n: number) => n.toLocaleString("pt-BR");
const fmtCentavos = (c: number) => formatCurrency(c / 100);

function CelulasNumeros({ t }: { t: TotaisOrigem }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">{fmtNumero(t.cadastros)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtNumero(t.testes)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtNumero(t.pagantes)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatarConversao(taxaConversao(t.pagantes, t.cadastros))}</TableCell>
      <TableCell className="text-right tabular-nums">
        <span>{fmtCentavos(t.receitaCentavos)}</span>
        {t.receitaCartaoEstimadaCentavos > 0 && (
          <span className="block text-[11px] text-muted-foreground">cartão est. {fmtCentavos(t.receitaCartaoEstimadaCentavos)}</span>
        )}
      </TableCell>
    </>
  );
}

function Mensagem({ texto, onTentar, tentando }: { texto: string; onTentar?: () => void; tentando?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
      <p className="font-medium">{texto}</p>
      {onTentar && (
        <Button variant="outline" size="sm" onClick={onTentar} disabled={tentando} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${tentando ? "animate-spin" : ""}`} />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function CardOrigensMarketing({ periodo }: { periodo: PeriodoMarketing }) {
  const [agrupamento, setAgrupamento] = useState<AgrupamentoOrigem>("campanha");
  const [verTodas, setVerTodas] = useState(false);
  const { data, isLoading, error, refetch, isFetching } = useAdminMarketingOrigens(periodo);

  const grupos = useMemo(() => (data ? agruparOrigens(data.linhas, agrupamento) : []), [data, agrupamento]);
  const total = useMemo(() => (data ? totalOrigens(data.linhas) : null), [data]);
  const visiveis = verTodas ? grupos : grupos.slice(0, LINHAS_VISIVEIS);
  const rotuloColuna = AGRUPAMENTOS_ORIGEM.find((a) => a.valor === agrupamento)?.rotulo ?? "Origem";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            Cadastros e conversão por origem
          </CardTitle>
          <Tabs value={agrupamento} onValueChange={(v) => { setAgrupamento(v as AgrupamentoOrigem); setVerTodas(false); }}>
            <TabsList className="w-full sm:w-auto">
              {AGRUPAMENTOS_ORIGEM.map((a) => (
                <TabsTrigger key={a.valor} value={a.valor} className="flex-1 sm:flex-none text-xs sm:text-sm">{a.rotulo}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error instanceof FuncaoOrigensIndisponivel ? (
          <Mensagem texto="Indicador ainda não disponível" />
        ) : error ? (
          <Mensagem texto="Indicadores indisponíveis no momento" onTentar={() => refetch()} tentando={isFetching} />
        ) : isLoading || !data || !total ? (
          <Skeleton className="h-48 w-full" />
        ) : grupos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum cadastro no período.</p>
        ) : (
          <>
            <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
              <Table data-testid="tabela-origens">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">{rotuloColuna}</TableHead>
                    <TableHead className="text-right">Cadastros</TableHead>
                    <TableHead className="text-right">Testes</TableHead>
                    <TableHead className="text-right">Pagantes</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                    <TableHead className="text-right min-w-[110px]">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiveis.map((g) => (
                    <TableRow key={g.chave}>
                      <TableCell className={`max-w-[220px] truncate ${g.chave === "sem origem" ? "text-muted-foreground italic" : "font-medium"}`} title={g.chave}>
                        {g.chave}
                      </TableCell>
                      <CelulasNumeros t={g} />
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <CelulasNumeros t={total} />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            {grupos.length > LINHAS_VISIVEIS && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setVerTodas((v) => !v)}>
                {verTodas ? "Ver menos" : `Ver todas (${fmtNumero(grupos.length)})`}
              </Button>
            )}
            {data.linhas.length >= LIMITE_LINHAS_ORIGENS && (
              <p className="text-xs text-muted-foreground">
                Mostrando as {LIMITE_LINHAS_ORIGENS} combinações de origem com mais cadastros; o total considera só elas.
              </p>
            )}
          </>
        )}
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2" data-testid="aviso-receita-estimada">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Receita do cartão é estimada</strong> pelo preço cheio do plano (sem cupom).
            PIX é o valor exato. A receita considera só o primeiro pagamento de cada cadastro do período; pagante é quem já pagou, em qualquer data até hoje.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

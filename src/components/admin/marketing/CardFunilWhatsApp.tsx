import { useMemo, useState } from "react";
import { AlertCircle, Info, MessageCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";
import { calcularCustosWhatsApp, percentual } from "@/lib/marketing/custoWhatsApp";
import {
  PERIODOS_FUNIL,
  TEXTO_NAO_ATIVADO,
  avisoAmostraPequena,
  formatarCentavos,
  formatarCusto,
  formatarDataBR,
  formatarNumero,
  formatarPercentual,
  intervaloFunil,
  rotuloFonteGasto,
  somarDiasISO,
  type PeriodoFunil,
} from "@/lib/marketing/funilWhatsApp";
import { ErroFunilWhatsApp, useAdminCrmFunil, useAdminCrmFunilPorAnuncio } from "@/hooks/useAdminCrmFunil";
import { GastoInformadoWhatsApp } from "./GastoInformadoWhatsApp";

/**
 * Funil das conversas de WhatsApp (anúncios Click-to-WhatsApp), só números:
 * nenhum telefone, nome ou texto de lead. Custos, fonte do gasto e amostra
 * pequena vêm de src/lib/marketing/custoWhatsApp.ts (fonte única).
 */
export function CardFunilWhatsApp() {
  const hoje = dataBrasiliaISO();
  const [periodo, setPeriodo] = useState<PeriodoFunil>("30d");
  const [personalizado, setPersonalizado] = useState({ inicio: somarDiasISO(hoje, -29), fim: hoje });

  const intervalo = useMemo(() => intervaloFunil(periodo, personalizado, hoje), [periodo, personalizado, hoje]);
  const consulta = "erro" in intervalo ? null : { inicio: intervalo.inicio, fim: intervalo.fim };

  const funil = useAdminCrmFunil(consulta);
  const ativo = funil.isSuccess;
  const porAnuncio = useAdminCrmFunilPorAnuncio(consulta, ativo);
  const estadoErro = funil.error instanceof ErroFunilWhatsApp ? funil.error.estado : funil.error ? "falha" : null;

  const custos = funil.data ? calcularCustosWhatsApp(funil.data) : null;
  const aviso = funil.data ? avisoAmostraPequena(funil.data.conversas, funil.data.assinantes) : null;

  return (
    <Card data-testid="card-funil-whatsapp">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            Funil do WhatsApp
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            {periodo === "personalizado" && (
              <div className="flex gap-2">
                <Input type="date" aria-label="Início" className="w-full sm:w-[150px]" max={hoje} value={personalizado.inicio}
                  onChange={(e) => setPersonalizado((p) => ({ ...p, inicio: e.target.value }))} />
                <Input type="date" aria-label="Fim" className="w-full sm:w-[150px]" max={hoje} value={personalizado.fim}
                  onChange={(e) => setPersonalizado((p) => ({ ...p, fim: e.target.value }))} />
              </div>
            )}
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFunil)}>
              <SelectTrigger className="w-full sm:w-[180px]" aria-label="Período do funil"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODOS_FUNIL.map((p) => <SelectItem key={p.valor} value={p.valor}>{p.rotulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {"erro" in intervalo ? (
          <p className="text-sm text-muted-foreground">{intervalo.erro}</p>
        ) : estadoErro === "nao_ativado" ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground" data-testid="funil-nao-ativado">
            <Info className="h-4 w-4 shrink-0" />
            {TEXTO_NAO_ATIVADO}
          </div>
        ) : estadoErro === "sem_permissao" ? (
          <p className="text-sm text-muted-foreground">Disponível só para administradores.</p>
        ) : estadoErro ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Funil indisponível no momento</p>
            <Button variant="outline" size="sm" onClick={() => funil.refetch()} disabled={funil.isFetching} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${funil.isFetching ? "animate-spin" : ""}`} />
              Tentar novamente
            </Button>
          </div>
        ) : funil.isLoading || !funil.data || !custos ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Pessoas cujo 1º contato foi de {formatarDataBR(intervalo.inicio)} a {formatarDataBR(intervalo.fim)}; cadastros e
              pagamentos contam até hoje.
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="funil-etapas">
              <Etapa titulo="Conversas iniciadas" valor={funil.data.conversas}
                detalhe={`${formatarNumero(funil.data.conversas_anuncio)} de anúncio · ${formatarNumero(funil.data.ja_clientes)} já eram clientes`} />
              <Etapa titulo="Cadastraram" valor={funil.data.cadastros}
                detalhe={`${formatarPercentual(percentual(funil.data.cadastros, funil.data.conversas))} das conversas`} />
              <Etapa titulo="Iniciaram teste" valor={funil.data.testes}
                detalhe={`${formatarPercentual(percentual(funil.data.testes, funil.data.cadastros))} dos cadastros`} />
              <Etapa titulo="Assinantes pagos" valor={funil.data.assinantes}
                detalhe={`${formatarPercentual(percentual(funil.data.assinantes, funil.data.cadastros))} dos cadastros`} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" data-testid="fonte-gasto">
                {rotuloFonteGasto(custos.fonte, custos.diasComGastoMeta, intervalo.dias)}
              </Badge>
              {aviso && (
                <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400" data-testid="aviso-amostra">
                  {aviso}
                </Badge>
              )}
              {funil.data.opt_outs > 0 && (
                <span className="text-xs text-muted-foreground">{formatarNumero(funil.data.opt_outs)} pediram para parar</span>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="funil-custos">
              <Custo titulo="Gasto no período" valor={formatarCentavos(custos.gastoCentavos)} />
              <Custo titulo="Custo por conversa" valor={formatarCentavos(custos.porConversaCentavos)} />
              <Custo titulo="Custo por cadastro" valor={formatarCentavos(custos.porCadastroCentavos)} />
              <Custo titulo="Custo por assinante" valor={formatarCentavos(custos.porAssinanteCentavos)} />
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Por anúncio</h3>
              {porAnuncio.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : porAnuncio.isError ? (
                <p className="text-sm text-muted-foreground">Não foi possível carregar a tabela por anúncio.</p>
              ) : (porAnuncio.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conversa no período.</p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <Table data-testid="tabela-funil-anuncio">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">Anúncio</TableHead>
                        <TableHead className="text-right">Conversas</TableHead>
                        <TableHead className="text-right">Cadastros</TableHead>
                        <TableHead className="text-right">Teste</TableHead>
                        <TableHead className="text-right">Assinantes</TableHead>
                        <TableHead className="text-right">Gasto informado</TableHead>
                        <TableHead className="text-right">Custo/conversa</TableHead>
                        <TableHead className="text-right">Custo/assinante</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(porAnuncio.data ?? []).map((l) => {
                        const gasto = l.gastoInformadoCentavos > 0 ? l.gastoInformadoCentavos : null;
                        const avisoLinha = avisoAmostraPequena(l.conversas, l.assinantes);
                        return (
                          <TableRow key={l.adId || "sem-anuncio"}>
                            <TableCell className={`max-w-[240px] ${l.adId ? "font-medium" : "text-muted-foreground italic"}`}>
                              <span className="block truncate" title={l.titulo}>{l.titulo}</span>
                              {avisoLinha && <span className="block text-[11px] font-normal not-italic text-amber-700 dark:text-amber-400">{avisoLinha}</span>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatarNumero(l.conversas)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatarNumero(l.cadastros)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatarNumero(l.testes)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatarNumero(l.assinantes)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatarCentavos(gasto)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatarCusto(gasto, l.conversas)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatarCusto(gasto, l.assinantes)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Por anúncio, o custo usa só o gasto informado com o ID do anúncio (o gasto da Meta é por campanha).
                "—" = sem gasto ou sem ninguém na etapa.
              </p>
            </div>
          </>
        )}

        {ativo && (
          <div className="border-t pt-4 space-y-2">
            <h3 className="text-sm font-medium">Gasto informado</h3>
            <GastoInformadoWhatsApp habilitado={ativo} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Etapa({ titulo, valor, detalhe }: { titulo: string; valor: number; detalhe: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-2xl font-semibold tabular-nums">{formatarNumero(valor)}</p>
      <p className="text-[11px] text-muted-foreground">{detalhe}</p>
    </div>
  );
}

function Custo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-lg font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

import { memo, useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, Info, Loader2, Lock, Search, Smartphone, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ItemNfe, ResultadoLeituraNfe } from '@/lib/nfe/lerXmlNfe';
import type { DadosTributaveisItem } from '@/lib/nfe/dadosTributaveisNfe';
import {
  buscarCandidatos,
  indexarCandidatos,
  nomeExibicao,
  sugerirVinculo,
  type CandidatoEstoque,
  type IndiceCandidatos,
  type SugestaoVinculo,
} from '@/lib/nfe/sugestaoVinculo';
import {
  centavosParaTexto,
  decisaoInicial,
  montarLinha,
  resumirImportacao,
  sugerirFator,
  type AcaoItem,
  type DecisaoItem,
  type LinhaPlano,
} from '@/lib/nfe/planoImportacao';
import type { CandidatosVinculoXml } from '@/hooks/useCandidatosVinculoXml';
import { LIMITE_CANDIDATOS_POR_TABELA } from '@/hooks/useCandidatosVinculoXml';
import { Extras, Fiscal, Imeis } from './detalhesItemXml';
import { dinheiro, dinheiroCentavos, quantidade } from './formatoItemXml';

/**
 * Importar XML de compra — ETAPA 2: para cada item, sugere o vínculo com um
 * produto/peça já cadastrado, calcula quantidade inteira e custo, prevê o
 * custo médio e resume. NADA É GRAVADO: sem botão de confirmar; as decisões
 * vivem só no estado desta tela.
 */
interface VinculoItensXmlCompraProps {
  resultado: ResultadoLeituraNfe;
  dadosTributaveis: Map<number, DadosTributaveisItem>;
  candidatos: CandidatosVinculoXml;
}

const ROTULO_MOTIVO: Record<NonNullable<DecisaoItem['origemVinculo']>, { texto: string; fraco: boolean }> = {
  ean: { texto: 'Mesmo código de barras', fraco: false },
  codigo: { texto: 'Mesmo código do fornecedor', fraco: false },
  nome: { texto: 'Nome parecido — confira', fraco: true },
  manual: { texto: 'Escolhido por você', fraco: false },
};

const ACOES: { valor: AcaoItem; texto: string }[] = [
  { valor: 'vincular', texto: 'Vincular a produto existente' },
  { valor: 'novo', texto: 'Cadastrar como novo' },
  { valor: 'ignorar', texto: 'Ignorar este item' },
];

const tipoTexto = (t: CandidatoEstoque['tipo']) => (t === 'produto' ? 'Produto' : 'Peça');

function diferenca(c: number) {
  if (c === 0) return 'sem diferença';
  return `${c > 0 ? '+' : '−'}${dinheiroCentavos(Math.abs(c))}`;
}

// ---------------------------------------------------------------------------
// Seletor manual de produto (busca local, sem requisição)
// ---------------------------------------------------------------------------

function SeletorProduto({ indice, atual, onEscolher }: { indice: IndiceCandidatos; atual: CandidatoEstoque | null; onEscolher: (c: CandidatoEstoque) => void }) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const resultados = useMemo(() => (aberto ? buscarCandidatos(indice, termo, 50) : []), [aberto, indice, termo]);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8" data-testid="xml-trocar-produto">
          <Search className="w-3.5 h-3.5 mr-1.5" />
          {atual ? 'Trocar produto' : 'Escolher produto'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,28rem)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nome, código ou código de barras…" value={termo} onValueChange={setTermo} />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              {resultados.map((c) => (
                <CommandItem
                  key={`${c.tipo}:${c.id}`}
                  value={`${c.tipo}:${c.id}`}
                  onSelect={() => {
                    onEscolher(c);
                    setAberto(false);
                    setTermo('');
                  }}
                >
                  <div className="min-w-0">
                    <div className="truncate">{nomeExibicao(c)}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {tipoTexto(c.tipo)} · estoque {c.quantidade}
                      {c.sku ? ` · cód. ${c.sku}` : ''}
                      {c.codigoBarras ? ` · ${c.codigoBarras}` : ''}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Cartão de um item
// ---------------------------------------------------------------------------

interface CartaoItemProps {
  item: ItemNfe;
  decisao: DecisaoItem;
  sugestao: SugestaoVinculo | null;
  trib: DadosTributaveisItem | undefined;
  atualizarCustoMedioGeral: boolean;
  indice: IndiceCandidatos;
  onAlterar: (nItem: number, mudanca: Partial<DecisaoItem>) => void;
}

const CartaoItem = memo(function CartaoItem({ item, decisao, sugestao, trib, atualizarCustoMedioGeral, indice, onAlterar }: CartaoItemProps) {
  const linha = useMemo(() => montarLinha(item, decisao, atualizarCustoMedioGeral), [item, decisao, atualizarCustoMedioGeral]);
  const [ajustarQuantidade, setAjustarQuantidade] = useState(false);
  const alterar = (m: Partial<DecisaoItem>) => onAlterar(item.nItem, m);
  const fatorSugerido = useMemo(() => sugerirFator(item, trib), [item, trib]);
  const motivo = decisao.origemVinculo ? ROTULO_MOTIVO[decisao.origemVinculo] : null;
  const ambiguo = !!sugestao && sugestao.quantidade > 1 && decisao.vinculo?.id === sugestao.candidato.id && decisao.origemVinculo === sugestao.motivo;
  const mostrarQuantidade = linha.quantidade.precisaAjuste || ajustarQuantidade || !!linha.quantidade.erro;

  return (
    <div
      data-testid={`xml-item-${item.nItem}`}
      data-situacao={linha.situacao}
      className={cn('rounded-lg border p-3 sm:p-4 space-y-3', linha.situacao === 'erro' && 'border-destructive/60', linha.situacao === 'ignorado' && 'opacity-70')}
    >
      {/* O que veio na nota */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-3">
        <div className="min-w-0">
          <div className="font-medium text-sm break-words">{item.nItem}. {item.xProd}</div>
          <div className="text-xs text-muted-foreground break-words">
            cód. fornecedor {item.cProd || '—'} · {item.ean ?? trib?.eanTrib ?? 'sem código de barras'}
          </div>
          <div className="flex flex-col"><Fiscal item={item} /><Extras item={item} /></div>
          <Imeis item={item} />
        </div>
        <div className="text-sm sm:text-right whitespace-nowrap">
          <div>{quantidade(item.qCom)} {item.uCom} × {dinheiro(item.vUnCom)}</div>
          <div className="font-medium">{dinheiro(item.vProd)}</div>
        </div>
      </div>

      {linha.situacao === 'aparelho' ? (
        <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm" data-testid="xml-item-aparelho">
          <Smartphone className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Aparelho com IMEI: será tratado em etapa futura. Fica fora do total desta importação.</span>
        </div>
      ) : (
        <>
          {/* Ação */}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`O que fazer com o item ${item.nItem}`}>
            {ACOES.map((a) => (
              <Button
                key={a.valor}
                type="button"
                size="sm"
                role="radio"
                aria-checked={decisao.acao === a.valor}
                variant={decisao.acao === a.valor ? 'default' : 'outline'}
                className="h-8 text-xs sm:text-sm"
                onClick={() => alterar({ acao: a.valor })}
              >
                {a.texto}
              </Button>
            ))}
          </div>

          {decisao.acao === 'vincular' && (
            <div className="rounded-md border bg-muted/30 p-2.5 space-y-2" data-testid="xml-vinculo">
              {decisao.vinculo ? (
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-sm break-words" data-testid="xml-vinculo-nome">{nomeExibicao(decisao.vinculo)}</span>
                    <Badge variant="secondary">{tipoTexto(decisao.vinculo.tipo)}</Badge>
                    {motivo && (
                      <Badge variant="outline" className={cn(motivo.fraco && 'border-amber-500 text-amber-700 dark:text-amber-400')} data-testid="xml-vinculo-motivo">
                        {motivo.texto}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    estoque atual {decisao.vinculo.quantidade}
                    {decisao.vinculo.sku ? ` · cód. ${decisao.vinculo.sku}` : ''}
                    {decisao.vinculo.codigoBarras ? ` · ${decisao.vinculo.codigoBarras}` : ''}
                  </div>
                  {ambiguo && (
                    <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      {sugestao!.quantidade} cadastros batem pelo mesmo critério; confira se é este.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Nenhum produto escolhido.</div>
              )}
              <SeletorProduto indice={indice} atual={decisao.vinculo} onEscolher={(c) => alterar({ vinculo: c, origemVinculo: 'manual' })} />
            </div>
          )}

          {decisao.acao === 'novo' && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Cadastrar como:</span>
              {(['produto', 'peca'] as const).map((t) => (
                <Button key={t} type="button" size="sm" variant={decisao.tipoNovo === t ? 'secondary' : 'ghost'} className="h-7" onClick={() => alterar({ tipoNovo: t })}>
                  {tipoTexto(t)}
                </Button>
              ))}
              <span className="text-xs text-muted-foreground">(só marca a intenção; nada é criado nesta etapa)</span>
            </div>
          )}

          {decisao.acao !== 'ignorar' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Quantidade */}
              <div className="space-y-1.5">
                {mostrarQuantidade ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`xml-qtd-${item.nItem}`}>Quantidade a entrar no estoque</Label>
                      <Input
                        id={`xml-qtd-${item.nItem}`}
                        data-testid="xml-quantidade"
                        inputMode="numeric"
                        className="h-8"
                        placeholder={linha.quantidade.calculada.replace('.', ',')}
                        value={decisao.quantidadeManual}
                        onChange={(e) => alterar({ quantidadeManual: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`xml-fator-${item.nItem}`}>Fator (1 {item.uCom || 'un.'} = ? un.)</Label>
                      <Input
                        id={`xml-fator-${item.nItem}`}
                        data-testid="xml-fator"
                        inputMode="decimal"
                        className="h-8"
                        value={decisao.fator}
                        onChange={(e) => alterar({ fator: e.target.value })}
                      />
                    </div>
                    {fatorSugerido.origem === 'tributavel' && (
                      <p className="col-span-2 text-xs text-muted-foreground">
                        Fator sugerido pela unidade tributável da nota: 1 {item.uCom} = {fatorSugerido.fator} {trib?.uTrib}. Confira.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-sm">
                    Entra no estoque: <strong>{linha.quantidade.inteira}</strong> un.{' '}
                    <button type="button" className="text-xs text-primary underline" onClick={() => setAjustarQuantidade(true)}>ajustar</button>
                  </div>
                )}
                {linha.quantidade.inteira !== null && mostrarQuantidade && (
                  <p className="text-xs text-muted-foreground" data-testid="xml-quantidade-final">Entra no estoque: {linha.quantidade.inteira} un.</p>
                )}
              </div>

              {/* Custo */}
              <div className="space-y-1.5">
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor={`xml-custo-${item.nItem}`}>Custo por unidade (R$)</Label>
                  <Input
                    id={`xml-custo-${item.nItem}`}
                    data-testid="xml-custo"
                    inputMode="decimal"
                    className="h-8"
                    placeholder={linha.custo.unitarioCentavos !== null ? centavosParaTexto(linha.custo.unitarioCentavos) : '—'}
                    value={decisao.custoManual}
                    onChange={(e) => alterar({ custoManual: e.target.value })}
                  />
                </div>
                <Collapsible>
                  <CollapsibleTrigger className="text-xs text-primary underline inline-flex items-center gap-0.5" data-testid="xml-ver-conta">
                    ver a conta <ChevronDown className="w-3 h-3" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="mt-1 text-xs space-y-0.5" data-testid="xml-conta">
                      {linha.custo.parcelas.map((p) => (
                        <li key={p.rotulo} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{p.sinal < 0 ? '− ' : '+ '}{p.rotulo}</span>
                          <span>{dinheiroCentavos(p.centavos)}</span>
                        </li>
                      ))}
                      <li className="flex justify-between gap-2 border-t pt-0.5 font-medium">
                        <span>= Total do item</span>
                        <span>{dinheiroCentavos(linha.custo.totalCentavos)}</span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span className="text-muted-foreground">÷ {linha.quantidade.inteira ?? '?'} un. (arredondado em centavos)</span>
                        <span>{dinheiroCentavos(linha.custo.unitarioCentavos)}</span>
                      </li>
                    </ul>
                  </CollapsibleContent>
                </Collapsible>

                {decisao.acao === 'vincular' && decisao.vinculo && (
                  <div className="text-xs space-y-1" data-testid="xml-custo-medio">
                    <div>
                      Custo atual {dinheiroCentavos(linha.custoAtualCentavos)}
                      {linha.custoAtualCentavos !== null && linha.custoUnitarioCentavos !== null && (
                        <> · nota {diferenca(linha.custoUnitarioCentavos - linha.custoAtualCentavos)}</>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`xml-cm-${item.nItem}`}
                        checked={decisao.atualizarCustoMedio ?? atualizarCustoMedioGeral}
                        onCheckedChange={(v) => alterar({ atualizarCustoMedio: v })}
                      />
                      <Label htmlFor={`xml-cm-${item.nItem}`} className="text-xs font-normal">Atualizar custo médio</Label>
                    </div>
                    {linha.custoDepoisCentavos !== null && (
                      <div data-testid="xml-custo-depois">
                        Custo depois da entrada (previsão): <strong>{dinheiroCentavos(linha.custoDepoisCentavos)}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {linha.erros.length > 0 && (
            <ul className="text-sm text-destructive space-y-0.5" data-testid="xml-item-erros">
              {linha.erros.map((e) => (
                <li key={e} className="flex items-start gap-1.5"><XCircle className="w-4 h-4 mt-0.5 shrink-0" />{e}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

function Numero({ rotulo, valor, testId }: { rotulo: string; valor: string | number; testId: string }) {
  return (
    <div className="rounded-md border p-2" data-testid={testId}>
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className="text-lg font-semibold tabular-nums">{valor}</div>
    </div>
  );
}

export function ResumoNotaInvalida() {
  return (
    <Alert variant="destructive" data-testid="xml-resumo">
      <XCircle className="h-4 w-4" />
      <AlertDescription className="font-medium" data-testid="xml-resumo-invalida">Nota não pode ser importada.</AlertDescription>
    </Alert>
  );
}

function Resumo({ resultado, linhas }: { resultado: ResultadoLeituraNfe; linhas: LinhaPlano[] }) {
  const r = useMemo(() => resumirImportacao(resultado, linhas), [resultado, linhas]);
  if (r.notaInvalida) return <ResumoNotaInvalida />;
  return (
    <section className="rounded-lg border p-3 sm:p-4 space-y-3" data-testid="xml-resumo">
      <div>
        <h2 className="text-base sm:text-lg font-semibold">Resumo da importação</h2>
        <p className="text-sm text-muted-foreground break-words">
          Nota {r.numero}/{r.serie} · {r.fornecedor || 'fornecedor sem nome'}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Numero rotulo="A importar" valor={r.aImportar} testId="xml-resumo-importar" />
        <Numero rotulo="Vinculados" valor={r.vinculados} testId="xml-resumo-vinculados" />
        <Numero rotulo="Novos" valor={r.novos} testId="xml-resumo-novos" />
        <Numero rotulo="Ignorados" valor={r.ignorados} testId="xml-resumo-ignorados" />
        <Numero rotulo="Com erro" valor={r.comErro} testId="xml-resumo-erro" />
        <Numero rotulo="Aparelhos (etapa futura)" valor={r.aparelhos} testId="xml-resumo-aparelhos" />
        <Numero rotulo="Unidades" valor={r.unidades} testId="xml-resumo-unidades" />
        <Numero rotulo="Custo total" valor={dinheiroCentavos(r.custoTotalCentavos)} testId="xml-resumo-custo" />
      </div>
      {r.pendencias.length > 0 && (
        <div data-testid="xml-resumo-pendencias">
          <p className="text-sm font-medium text-destructive">Pendências que impedem a confirmação</p>
          <ul className="text-sm list-disc pl-5 space-y-0.5 max-h-48 overflow-y-auto">
            {r.pendencias.map((p, i) => (
              <li key={i}>{p.nItem ? <strong>Item {p.nItem}: </strong> : null}{p.texto}</li>
            ))}
          </ul>
        </div>
      )}
      {r.avisos.length > 0 && (
        <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-0.5">
          {r.avisos.map((a, i) => (
            <li key={i} className="flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{a.texto}</li>
          ))}
        </ul>
      )}
      <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm" data-testid="xml-resumo-proxima-etapa">
        <Lock className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Gravar no estoque será liberado na próxima etapa.</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

export function VinculoItensXmlCompra({ resultado, dadosTributaveis, candidatos }: VinculoItensXmlCompraProps) {
  const [alteracoes, setAlteracoes] = useState<Record<number, DecisaoItem>>({});
  const [atualizarCustoMedioGeral, setAtualizarCustoMedioGeral] = useState(true);

  const indice = useMemo(() => indexarCandidatos(candidatos.candidatos), [candidatos.candidatos]);
  const sugestoes = useMemo(() => {
    const m = new Map<number, SugestaoVinculo | null>();
    for (const it of resultado.itens) {
      m.set(it.nItem, sugerirVinculo({ ...it, eanTrib: dadosTributaveis.get(it.nItem)?.eanTrib ?? null }, indice));
    }
    return m;
  }, [resultado.itens, dadosTributaveis, indice]);
  // Decisões iniciais estáveis (o cartão é memo): a sugestão vira proposta; sem sugestão = novo.
  const iniciais = useMemo(() => {
    const m = new Map<number, DecisaoItem>();
    for (const it of resultado.itens) m.set(it.nItem, decisaoInicial(it, sugestoes.get(it.nItem) ?? null, dadosTributaveis.get(it.nItem)));
    return m;
  }, [resultado.itens, sugestoes, dadosTributaveis]);

  const decisaoDe = useCallback((nItem: number) => alteracoes[nItem] ?? (iniciais.get(nItem) as DecisaoItem), [alteracoes, iniciais]);

  const onAlterar = useCallback((nItem: number, mudanca: Partial<DecisaoItem>) => {
    setAlteracoes((atual) => {
      const base = atual[nItem] ?? iniciais.get(nItem);
      if (!base) return atual;
      return { ...atual, [nItem]: { ...base, ...mudanca } };
    });
  }, [iniciais]);

  const linhas = useMemo(
    () => resultado.itens.map((it) => montarLinha(it, decisaoDe(it.nItem), atualizarCustoMedioGeral)),
    [resultado.itens, decisaoDe, atualizarCustoMedioGeral],
  );

  return (
    <div className="space-y-3" data-testid="xml-vinculo-itens">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Itens: vínculo, quantidade e custo</h2>
          <p className="text-sm text-muted-foreground">
            {resultado.itens.length} {resultado.itens.length === 1 ? 'item' : 'itens'} na nota. As sugestões nunca são aplicadas sozinhas: confira cada uma.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="xml-cm-geral" checked={atualizarCustoMedioGeral} onCheckedChange={setAtualizarCustoMedioGeral} data-testid="xml-cm-geral" />
          <Label htmlFor="xml-cm-geral" className="text-sm font-normal">Atualizar custo médio</Label>
        </div>
      </div>

      {candidatos.carregando && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="xml-candidatos-carregando">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando produtos cadastrados para sugerir vínculos…
        </div>
      )}
      {candidatos.erro && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>Não foi possível carregar os produtos cadastrados; nenhum vínculo foi sugerido.</AlertDescription>
        </Alert>
      )}
      {candidatos.truncado && (
        <Alert data-testid="xml-candidatos-truncado">
          <Info className="h-4 w-4" />
          <AlertDescription>
            A loja tem mais de {LIMITE_CANDIDATOS_POR_TABELA.toLocaleString('pt-BR')} produtos ou peças; só os primeiros (por nome) entraram nas sugestões e na busca.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2" data-testid="xml-itens">
        {resultado.itens.map((it) => (
          <CartaoItem
            key={it.nItem}
            item={it}
            decisao={decisaoDe(it.nItem)}
            sugestao={sugestoes.get(it.nItem) ?? null}
            trib={dadosTributaveis.get(it.nItem)}
            atualizarCustoMedioGeral={atualizarCustoMedioGeral}
            indice={indice}
            onAlterar={onAlterar}
          />
        ))}
      </div>

      <Resumo resultado={resultado} linhas={linhas} />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Minus, Package, Plus, Printer, Ruler, Tags, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { ItemEstoque } from '@/types/produto';
import { detectarContextoImpressaoMobile, printViaIframe, printViaPrintRoot } from '@/lib/printMobile';
import {
  CAMPOS_ETIQUETA,
  CampoEtiqueta,
  ConfigEtiquetas,
  ItemEtiqueta,
  PADRAO_AVULSO_ID,
  SUGESTOES_PIMACO,
  TamanhoFonteEtiqueta,
  calcularLayoutFolha,
  carregarConfigEtiquetas,
  contarEtiquetas,
  contarFolhasA4,
  dimensoesEtiqueta,
  escolherCodigoBarras,
  montarBodyEtiquetaTeste,
  montarBodyEtiquetas,
  montarCssEtiquetaTeste,
  montarCssEtiquetas,
  montarCssPagina,
  montarDocumentoEtiquetaTeste,
  montarDocumentoEtiquetas,
  montarEtiquetaHtml,
  renderizarCodigoBarras,
  salvarConfigEtiquetas,
} from '@/lib/etiquetas/etiquetasProduto';
import {
  LIMITES_AJUSTE_VERTICAL_MM,
  aplicarAjusteNoPadrao,
  clampAjusteVertical,
  formatarAjusteVertical,
} from '@/lib/etiquetas/ajusteVertical';
import {
  avisoModoEtiqueta,
  escolherModoInicial,
  houveEscolhaManualNaSessao,
  marcarEscolhaManualNaSessao,
  type FormatoImpressaoEtiqueta,
} from '@/lib/etiquetas/modoPadrao';
import { usePadroesEtiqueta } from '@/hooks/usePadroesEtiqueta';
import { CampoNumero, CamposPadraoEtiqueta, MiniaturaFolha, ResumoLayoutFolha } from './CamposPadraoEtiqueta';

interface DialogGerarEtiquetasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itensSelecionados: ItemEstoque[];
  nomeLoja?: string;
  /** Atalho para as Configurações de Produtos, onde os padrões são criados/editados. */
  onGerenciarPadroes?: () => void;
}

// Evita travar o navegador montando milhares de etiquetas num único documento.
const MAX_ETIQUETAS_POR_IMPRESSAO = 1000;
const PX_POR_MM = 96 / 25.4;
const LARGURA_PREVIA_PX = 300;

const sessaoDoNavegador = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const DialogGerarEtiquetas = ({ open, onOpenChange, itensSelecionados, nomeLoja = '', onGerenciarPadroes }: DialogGerarEtiquetasProps) => {
  const [config, setConfig] = useState<ConfigEtiquetas>(carregarConfigEtiquetas);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [previaId, setPreviaId] = useState<string>('');
  // Mesma query da aba Etiquetas das Configurações: salvar lá atualiza esta lista.
  const { padroes, carregando: carregandoPadroes, salvando: salvandoPadrao, salvarPadrao } = usePadroesEtiqueta(open);
  // Modo inicial pelo padrão da loja: decidido uma vez por abertura, depois que os padrões chegam.
  const modoInicialAplicado = useRef(false);

  // itensSelecionados é recriado a cada render do pai (filter) — reinicia só quando
  // o diálogo abre ou a seleção muda de fato, senão as quantidades digitadas se perdem.
  const chaveItens = itensSelecionados.map((i) => i.id).join(',');
  useEffect(() => {
    if (!open) return;
    const ids = chaveItens ? chaveItens.split(',') : [];
    setConfig(carregarConfigEtiquetas());
    modoInicialAplicado.current = false;
    setQuantidades(Object.fromEntries(ids.map((id) => [id, 1])));
    setPreviaId(ids[0] ?? '');
  }, [open, chaveItens]);

  // O padrão lembrado no navegador pode ter sido editado/excluído (inclusive em
  // outro aparelho): acompanha a versão salva ou, se sumiu, vira "Personalizado"
  // com as mesmas medidas.
  useEffect(() => {
    if (!open || carregandoPadroes) return;
    setConfig((c) => {
      if (c.a4.id === PADRAO_AVULSO_ID || SUGESTOES_PIMACO.some((s) => s.id === c.a4.id)) return c;
      const salvo = padroes.find((p) => p.id === c.a4.id);
      if (salvo) {
        if (salvo === c.a4) return c;
        // Ajuste do padrão mudou desde a última impressão (aqui ou em outro aparelho): vale o do padrão.
        const ajusteVerticalMm = salvo.ajusteVerticalMm !== c.a4.ajusteVerticalMm ? salvo.ajusteVerticalMm : c.ajusteVerticalMm;
        return { ...c, a4: salvo, ajusteVerticalMm };
      }
      return { ...c, a4: { ...c.a4, id: PADRAO_AVULSO_ID, nome: 'Personalizado' } };
    });
  }, [open, padroes, carregandoPadroes]);

  // Loja com padrão de folha salvo abre em Folha/Grade, a menos que o modo já
  // tenha sido escolhido à mão nesta sessão do navegador (ver modoPadrao.ts).
  useEffect(() => {
    if (!open || carregandoPadroes || modoInicialAplicado.current) return;
    modoInicialAplicado.current = true;
    setConfig((c) => {
      const decisao = escolherModoInicial({
        formatoLembrado: c.formato,
        padraoLembradoId: c.a4.id,
        padroesLoja: padroes.map((p) => p.id),
        escolhaManualNaSessao: houveEscolhaManualNaSessao(sessaoDoNavegador()),
      });
      const padrao = decisao.padraoId && decisao.padraoId !== c.a4.id ? padroes.find((p) => p.id === decisao.padraoId) : undefined;
      if (decisao.formato === c.formato && !padrao) return c;
      return {
        ...c,
        formato: decisao.formato,
        // Padrão salvo traz a calibração dele (mesma regra da troca de padrão na lista).
        ...(padrao ? { a4: padrao, posicaoInicial: 1, ajusteVerticalMm: padrao.ajusteVerticalMm } : {}),
      };
    });
  }, [open, padroes, carregandoPadroes]);

  const atualizar = (parcial: Partial<ConfigEtiquetas>) => setConfig((c) => ({ ...c, ...parcial }));
  const escolherFormato = (formato: FormatoImpressaoEtiqueta) => {
    marcarEscolhaManualNaSessao(sessaoDoNavegador());
    modoInicialAplicado.current = true;
    atualizar({ formato });
  };
  const avisoModo = avisoModoEtiqueta(config.formato, padroes.length);
  const alternarCampo = (campo: CampoEtiqueta, marcado: boolean) =>
    setConfig((c) => ({ ...c, campos: { ...c.campos, [campo]: marcado } }));
  const atualizarA4 = (parcial: Partial<ConfigEtiquetas['a4']>) =>
    setConfig((c) => ({ ...c, a4: { ...c.a4, ...parcial, id: PADRAO_AVULSO_ID, nome: 'Personalizado' } }));
  // Passo de 0,1mm na tela.
  const mudarAjuste = (mm: number) => atualizar({ ajusteVerticalMm: clampAjusteVertical(Math.round(mm * 10) / 10) });

  const itensImpressao: ItemEtiqueta[] = useMemo(
    () => itensSelecionados.map((item) => ({ item, quantidade: quantidades[item.id] ?? 1 })),
    [itensSelecionados, quantidades],
  );
  const totalEtiquetas = contarEtiquetas(itensImpressao);
  const totalFolhas = config.formato === 'a4' ? contarFolhasA4(totalEtiquetas, config) : 0;
  const { larguraMm, alturaMm } = dimensoesEtiqueta(config);
  const layoutFolha = calcularLayoutFolha(config.a4);
  const erroLayout = config.formato === 'a4' ? layoutFolha.erro : null;

  // Avisos de código de barras por item (sem código ou longo demais para esta largura).
  const avisosCodigo = useMemo(() => {
    const avisos = new Map<string, string>();
    if (!config.campos.codigo_barras) return avisos;
    for (const item of itensSelecionados) {
      const codigo = escolherCodigoBarras(item);
      if (!codigo) {
        avisos.set(item.id, 'Sem código de barras nem SKU — sai sem barras');
        continue;
      }
      const { aviso } = renderizarCodigoBarras(codigo, larguraMm - 3, 6);
      if (aviso) avisos.set(item.id, `${aviso} Sai só o número.`);
    }
    return avisos;
  }, [itensSelecionados, config.campos.codigo_barras, larguraMm]);

  const itemPrevia = itensSelecionados.find((i) => i.id === previaId) ?? itensSelecionados[0];
  const escalaPrevia = Math.min(3, LARGURA_PREVIA_PX / (larguraMm * PX_POR_MM));
  const larguraPreviaPx = Math.ceil(larguraMm * PX_POR_MM * escalaPrevia) + 2;
  const alturaPreviaPx = Math.ceil(alturaMm * PX_POR_MM * escalaPrevia) + 2;
  const documentoPrevia = useMemo(() => {
    if (!itemPrevia) return '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      html { overflow: hidden; }
      body { margin: 0; padding: 1px; background: transparent; }
      .previa { transform: scale(${escalaPrevia}); transform-origin: top left; width: max-content; }
      .previa .etq-etiqueta { outline: 1px dashed #9ca3af; }
      ${montarCssEtiquetas(config)}
    </style></head><body><div class="previa">${montarEtiquetaHtml(itemPrevia, config, nomeLoja)}</div></body></html>`;
  }, [itemPrevia, config, nomeLoja, escalaPrevia]);

  // Mesmos caminhos dos recibos: iOS → #print-root; Android/PWA → iframe;
  // desktop → window.open síncrono no tick do clique.
  const enviarParaImpressao = (body: string, css: string, documento: string) => {
    const { isMobile, isStandalone, isIOS } = detectarContextoImpressaoMobile();
    const usarMecanismoMobile = isMobile || isStandalone;

    if (usarMecanismoMobile && isIOS) {
      printViaPrintRoot(body, css);
      return;
    }
    if (usarMecanismoMobile) {
      printViaIframe(documento, isIOS);
      return;
    }
    const janela = window.open('', '_blank');
    if (!janela) {
      toast.error('Permita pop-ups para imprimir as etiquetas.');
      return;
    }
    janela.document.write(documento);
    janela.document.close();
  };

  const handleImprimir = () => {
    const itens = itensImpressao.filter((i) => i.quantidade > 0);
    if (totalEtiquetas === 0) {
      toast.error('Defina a quantidade de pelo menos uma etiqueta.');
      return;
    }
    if (erroLayout) {
      toast.error(erroLayout);
      return;
    }
    if (totalEtiquetas > MAX_ETIQUETAS_POR_IMPRESSAO) {
      toast.error(`Máximo de ${MAX_ETIQUETAS_POR_IMPRESSAO} etiquetas por impressão. Divida em mais de uma impressão.`);
      return;
    }
    salvarConfigEtiquetas(config);
    enviarParaImpressao(
      montarBodyEtiquetas(itens, config, nomeLoja),
      `${montarCssPagina(config)}${montarCssEtiquetas(config)}`,
      montarDocumentoEtiquetas(itens, config, nomeLoja),
    );
  };

  /** Uma fileira com régua e contorno, para medir quanto a impressora corta e acertar o ajuste. */
  const handleImprimirTeste = () => {
    if (erroLayout) {
      toast.error(erroLayout);
      return;
    }
    salvarConfigEtiquetas(config);
    enviarParaImpressao(
      montarBodyEtiquetaTeste(config),
      `${montarCssPagina(config)}${montarCssEtiquetaTeste(config)}`,
      montarDocumentoEtiquetaTeste(config),
    );
  };

  // Padrão salvo da loja em uso: o ajuste pode ser gravado nele (vale para todos os aparelhos).
  const padraoSalvoAtual = config.formato === 'a4' ? padroes.find((p) => p.id === config.a4.id) : undefined;
  const salvarAjusteNoPadrao = async () => {
    if (!padraoSalvoAtual) return;
    if (await salvarPadrao(aplicarAjusteNoPadrao(padraoSalvoAtual, config.ajusteVerticalMm))) {
      toast.success(`Ajuste salvo no padrão "${padraoSalvoAtual.nome}".`);
    }
  };

  const definirTodas = (fn: (item: ItemEstoque) => number) =>
    setQuantidades(Object.fromEntries(itensSelecionados.map((i) => [i.id, fn(i)])));

  const opcoesA4 = [...padroes, ...SUGESTOES_PIMACO];
  const padraoA4Id = opcoesA4.some((p) => p.id === config.a4.id) ? config.a4.id : PADRAO_AVULSO_ID;
  const porFolha = Math.max(1, layoutFolha.etiquetasPorFolha);
  const posicoesVazias = Math.min(Math.max(config.posicaoInicial, 1), porFolha) - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl sm:max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="w-5 h-5" />
            Gerar Etiquetas
          </DialogTitle>
          <DialogDescription>
            Escolha a quantidade de cada item, o que aparece na etiqueta e o formato de impressão.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
          {/* Coluna esquerda: itens + campos */}
          <div className="space-y-5 min-w-0">
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-semibold">
                  Itens ({itensSelecionados.length}) · {totalEtiquetas} {totalEtiquetas === 1 ? 'etiqueta' : 'etiquetas'}
                </h3>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => definirTodas(() => 1)}>
                    Todas = 1
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => definirTodas((i) => Math.max(0, Math.min(999, i.quantidade)))}>
                    Usar estoque
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
                {itensSelecionados.map((item) => {
                  const aviso = avisosCodigo.get(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${item.id === itemPrevia?.id ? 'bg-accent/60' : 'hover:bg-muted/50'}`}
                      onClick={() => setPreviaId(item.id)}
                      title="Clique para ver a prévia deste item"
                    >
                      {item.tipo === 'produto'
                        ? <Package className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        : <Wrench className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.nome}</p>
                        {aviso && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span className="truncate" title={aviso}>{aviso}</span>
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">Estoque: {item.quantidade}</span>
                      <div className="w-16 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <CampoNumero
                          valor={quantidades[item.id] ?? 1}
                          onChange={(n) => setQuantidades((q) => ({ ...q, [item.id]: n }))}
                          min={0}
                          max={999}
                          inteiro
                          className="h-8 text-center"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">O que aparece na etiqueta</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                {CAMPOS_ETIQUETA.map((campo) => (
                  <label key={campo.id} className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={config.campos[campo.id]}
                      onCheckedChange={(v) => alternarCampo(campo.id, v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      {campo.label}
                      {campo.dica && <span className="block text-[11px] text-muted-foreground">{campo.dica}</span>}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Label className="text-sm">Tamanho da fonte</Label>
                <Select value={config.tamanhoFonte} onValueChange={(v) => atualizar({ tamanhoFonte: v as TamanhoFonteEtiqueta })}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pequeno">Pequena</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="grande">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>
          </div>

          {/* Coluna direita: formato + prévia */}
          <div className="space-y-5 min-w-0">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Formato de impressão</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant={config.formato === 'termica' ? 'default' : 'outline'} size="sm" onClick={() => escolherFormato('termica')}>
                  Térmica avulsa
                </Button>
                <Button variant={config.formato === 'a4' ? 'default' : 'outline'} size="sm" onClick={() => escolherFormato('a4')}>
                  Folha/Grade
                </Button>
              </div>
              {avisoModo && (
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {avisoModo}
                </p>
              )}

              {config.formato === 'termica' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="etq-larg" className="text-xs">Largura (mm)</Label>
                    <CampoNumero id="etq-larg" valor={config.termica.larguraMm} min={20} max={110} onChange={(n) => atualizar({ termica: { ...config.termica, larguraMm: n } })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="etq-alt" className="text-xs">Altura (mm)</Label>
                    <CampoNumero id="etq-alt" valor={config.termica.alturaMm} min={10} max={150} onChange={(n) => atualizar({ termica: { ...config.termica, alturaMm: n } })} />
                  </div>
                  <p className="col-span-2 text-[11px] text-muted-foreground">Uma etiqueta por página, no tamanho do rolo da impressora térmica.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Select
                      value={padraoA4Id}
                      onValueChange={(id) => {
                        const padrao = opcoesA4.find((p) => p.id === id);
                        // "Personalizado" parte das medidas atuais, para ajustar um padrão sem mexer nele.
                        // Padrão salvo traz a calibração dele; sugestões mantêm o ajuste atual.
                        const salvo = padroes.some((p) => p.id === id);
                        if (padrao) atualizar({ a4: padrao, posicaoInicial: 1, ...(salvo ? { ajusteVerticalMm: padrao.ajusteVerticalMm } : {}) });
                        else atualizarA4({});
                      }}
                    >
                      <SelectTrigger className="h-9 min-w-0 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {padroes.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Meus padrões</SelectLabel>
                            {padroes.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                          </SelectGroup>
                        )}
                        <SelectGroup>
                          <SelectLabel>Sugestões</SelectLabel>
                          {SUGESTOES_PIMACO.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Avulso</SelectLabel>
                          <SelectItem value={PADRAO_AVULSO_ID}>Personalizado (só desta vez)</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {onGerenciarPadroes && (
                      <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={onGerenciarPadroes} title="Cadastrar e editar seus padrões de folha (Configurações)">
                        <Ruler className="w-4 h-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Gerenciar</span>
                      </Button>
                    )}
                  </div>

                  {padraoA4Id === PADRAO_AVULSO_ID && (
                    <div className="space-y-2 rounded-lg border p-3">
                      <CamposPadraoEtiqueta idPrefixo="etq-avulso" padrao={config.a4} onChange={atualizarA4} />
                      <p className="text-[11px] text-muted-foreground">
                        Usado só nesta impressão. Para reutilizar, salve um padrão em Produtos → Configurações → Etiquetas.
                      </p>
                    </div>
                  )}

                  <ResumoLayoutFolha padrao={config.a4} />

                  <div className="flex items-center gap-2">
                    <Label htmlFor="etq-pos" className="text-xs whitespace-nowrap">Começar na posição</Label>
                    <CampoNumero id="etq-pos" valor={Math.min(config.posicaoInicial, porFolha)} min={1} max={porFolha} inteiro onChange={(n) => atualizar({ posicaoInicial: n })} className="h-8 w-20" />
                    <span className="text-[11px] text-muted-foreground">de {porFolha}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Use "começar na posição" para aproveitar uma folha já usada pela metade (contando da esquerda para a direita, de cima para baixo).
                  </p>
                </div>
              )}

              <div className="space-y-1.5 border-t pt-3">
                <Label htmlFor="etq-ajuste" className="text-xs">Ajuste vertical (mm)</Label>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    title="Subir 0,1mm"
                    onClick={() => mudarAjuste(config.ajusteVerticalMm - 0.1)}
                    disabled={config.ajusteVerticalMm <= LIMITES_AJUSTE_VERTICAL_MM.min}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                  <CampoNumero
                    id="etq-ajuste"
                    valor={config.ajusteVerticalMm}
                    min={LIMITES_AJUSTE_VERTICAL_MM.min}
                    max={LIMITES_AJUSTE_VERTICAL_MM.max}
                    onChange={mudarAjuste}
                    className="h-8 w-20 text-center"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    title="Descer 0,1mm"
                    onClick={() => mudarAjuste(config.ajusteVerticalMm + 0.1)}
                    disabled={config.ajusteVerticalMm >= LIMITES_AJUSTE_VERTICAL_MM.max}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Se o topo da etiqueta sai cortado, aumente este valor. Positivo desce o conteúdo; negativo sobe (de -5 a +5).
                </p>
                {padraoSalvoAtual && padraoSalvoAtual.ajusteVerticalMm !== config.ajusteVerticalMm && (
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={salvarAjusteNoPadrao} disabled={salvandoPadrao}>
                    Salvar {formatarAjusteVertical(config.ajusteVerticalMm)} no padrão "{padraoSalvoAtual.nome}"
                  </Button>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={handleImprimirTeste} disabled={!!erroLayout}>
                  <Ruler className="w-4 h-4 mr-2" />
                  Imprimir etiqueta de teste
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Sai uma fileira com régua: os milímetros que sumirem no topo são o quanto aumentar o ajuste.
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Prévia</h3>
                <span className="text-[11px] text-muted-foreground">{larguraMm}×{alturaMm}mm</span>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4 flex items-center justify-center min-h-[140px]">
                {itemPrevia ? (
                  <iframe
                    title="Prévia da etiqueta"
                    srcDoc={documentoPrevia}
                    style={{ width: larguraPreviaPx, height: alturaPreviaPx, border: 0, background: 'white' }}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">Nenhum item selecionado</span>
                )}
              </div>
              {itensSelecionados.length > 1 && (
                <p className="text-[11px] text-muted-foreground">Clique num item da lista para ver a prévia dele.</p>
              )}
              {config.formato === 'a4' && !erroLayout && (
                <div className="flex items-end gap-3 pt-1">
                  <MiniaturaFolha padrao={config.a4} vazias={posicoesVazias} ocupadas={totalEtiquetas} larguraPx={120} />
                  <p className="text-[11px] text-muted-foreground">
                    Primeira folha: etiquetas preenchidas, posições puladas tracejadas.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:items-center">
          <span className="text-xs text-muted-foreground sm:mr-auto">
            {totalEtiquetas} {totalEtiquetas === 1 ? 'etiqueta' : 'etiquetas'}
            {config.formato === 'a4' && totalFolhas > 0 && ` · ${totalFolhas} ${totalFolhas === 1 ? 'folha' : 'folhas'}`}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleImprimir} disabled={totalEtiquetas === 0 || !!erroLayout}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

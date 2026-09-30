import { useEffect, useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Package, Printer, Tags, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { ItemEstoque } from '@/types/produto';
import { detectarContextoImpressaoMobile, printViaIframe, printViaPrintRoot } from '@/lib/printMobile';
import {
  CAMPOS_ETIQUETA,
  CampoEtiqueta,
  ConfigEtiquetas,
  ItemEtiqueta,
  MODELOS_FOLHA_A4,
  MODELO_A4_PERSONALIZADO,
  TamanhoFonteEtiqueta,
  carregarConfigEtiquetas,
  contarEtiquetas,
  contarFolhasA4,
  dimensoesEtiqueta,
  escolherCodigoBarras,
  etiquetasPorFolha,
  montarBodyEtiquetas,
  montarCssEtiquetas,
  montarCssPagina,
  montarDocumentoEtiquetas,
  montarEtiquetaHtml,
  renderizarCodigoBarras,
  salvarConfigEtiquetas,
} from '@/lib/etiquetas/etiquetasProduto';

interface DialogGerarEtiquetasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itensSelecionados: ItemEstoque[];
  nomeLoja?: string;
}

// Evita travar o navegador montando milhares de etiquetas num único documento.
const MAX_ETIQUETAS_POR_IMPRESSAO = 1000;
const PX_POR_MM = 96 / 25.4;
const LARGURA_PREVIA_PX = 300;

function parseNumero(texto: string): number {
  const n = parseFloat(texto.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

// Input numérico que aceita vírgula e só confirma o valor ao sair do campo
// (evita "pular" o valor enquanto a pessoa ainda está digitando).
function CampoNumero({ valor, onChange, min, max, inteiro = false, id, className }: {
  valor: number;
  onChange: (valor: number) => void;
  min: number;
  max: number;
  inteiro?: boolean;
  id?: string;
  className?: string;
}) {
  const [texto, setTexto] = useState(String(valor).replace('.', ','));
  useEffect(() => { setTexto(String(valor).replace('.', ',')); }, [valor]);

  const confirmar = () => {
    let n = parseNumero(texto);
    if (!Number.isFinite(n)) n = valor;
    if (inteiro) n = Math.round(n);
    n = Math.min(Math.max(n, min), max);
    setTexto(String(n).replace('.', ','));
    if (n !== valor) onChange(n);
  };

  return (
    <Input
      id={id}
      inputMode={inteiro ? 'numeric' : 'decimal'}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); }}
      className={className ?? 'h-9'}
    />
  );
}

export const DialogGerarEtiquetas = ({ open, onOpenChange, itensSelecionados, nomeLoja = '' }: DialogGerarEtiquetasProps) => {
  const [config, setConfig] = useState<ConfigEtiquetas>(carregarConfigEtiquetas);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [previaId, setPreviaId] = useState<string>('');

  // itensSelecionados é recriado a cada render do pai (filter) — reinicia só quando
  // o diálogo abre ou a seleção muda de fato, senão as quantidades digitadas se perdem.
  const chaveItens = itensSelecionados.map((i) => i.id).join(',');
  useEffect(() => {
    if (!open) return;
    const ids = chaveItens ? chaveItens.split(',') : [];
    setConfig(carregarConfigEtiquetas());
    setQuantidades(Object.fromEntries(ids.map((id) => [id, 1])));
    setPreviaId(ids[0] ?? '');
  }, [open, chaveItens]);

  const atualizar = (parcial: Partial<ConfigEtiquetas>) => setConfig((c) => ({ ...c, ...parcial }));
  const alternarCampo = (campo: CampoEtiqueta, marcado: boolean) =>
    setConfig((c) => ({ ...c, campos: { ...c.campos, [campo]: marcado } }));
  const atualizarA4 = (parcial: Partial<ConfigEtiquetas['a4']>) =>
    setConfig((c) => ({ ...c, a4: { ...c.a4, ...parcial, id: MODELO_A4_PERSONALIZADO, nome: 'Personalizado' } }));

  const itensImpressao: ItemEtiqueta[] = useMemo(
    () => itensSelecionados.map((item) => ({ item, quantidade: quantidades[item.id] ?? 1 })),
    [itensSelecionados, quantidades],
  );
  const totalEtiquetas = contarEtiquetas(itensImpressao);
  const totalFolhas = config.formato === 'a4' ? contarFolhasA4(totalEtiquetas, config) : 0;
  const { larguraMm, alturaMm } = dimensoesEtiqueta(config);

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

  const handleImprimir = () => {
    const itens = itensImpressao.filter((i) => i.quantidade > 0);
    if (totalEtiquetas === 0) {
      toast.error('Defina a quantidade de pelo menos uma etiqueta.');
      return;
    }
    if (totalEtiquetas > MAX_ETIQUETAS_POR_IMPRESSAO) {
      toast.error(`Máximo de ${MAX_ETIQUETAS_POR_IMPRESSAO} etiquetas por impressão. Divida em mais de uma impressão.`);
      return;
    }
    salvarConfigEtiquetas(config);

    // Mesmos caminhos dos recibos: iOS → #print-root; Android/PWA → iframe;
    // desktop → window.open síncrono no tick do clique.
    const { isMobile, isStandalone, isIOS } = detectarContextoImpressaoMobile();
    const usarMecanismoMobile = isMobile || isStandalone;

    if (usarMecanismoMobile && isIOS) {
      printViaPrintRoot(montarBodyEtiquetas(itens, config, nomeLoja), `${montarCssPagina(config)}${montarCssEtiquetas(config)}`);
      return;
    }
    if (usarMecanismoMobile) {
      printViaIframe(montarDocumentoEtiquetas(itens, config, nomeLoja), isIOS);
      return;
    }
    const janela = window.open('', '_blank');
    if (!janela) {
      toast.error('Permita pop-ups para imprimir as etiquetas.');
      return;
    }
    janela.document.write(montarDocumentoEtiquetas(itens, config, nomeLoja));
    janela.document.close();
  };

  const definirTodas = (fn: (item: ItemEstoque) => number) =>
    setQuantidades(Object.fromEntries(itensSelecionados.map((i) => [i.id, fn(i)])));

  const modeloA4Id = MODELOS_FOLHA_A4.some((m) => m.id === config.a4.id) ? config.a4.id : MODELO_A4_PERSONALIZADO;
  const porFolha = etiquetasPorFolha(config.a4);

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
                <Button variant={config.formato === 'termica' ? 'default' : 'outline'} size="sm" onClick={() => atualizar({ formato: 'termica' })}>
                  Térmica avulsa
                </Button>
                <Button variant={config.formato === 'a4' ? 'default' : 'outline'} size="sm" onClick={() => atualizar({ formato: 'a4' })}>
                  Folha A4
                </Button>
              </div>

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
                  <Select
                    value={modeloA4Id}
                    onValueChange={(id) => {
                      const modelo = MODELOS_FOLHA_A4.find((m) => m.id === id);
                      if (modelo) atualizar({ a4: modelo, posicaoInicial: 1 });
                      else atualizarA4({});
                    }}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODELOS_FOLHA_A4.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                      <SelectItem value={MODELO_A4_PERSONALIZADO}>Personalizado</SelectItem>
                    </SelectContent>
                  </Select>

                  {modeloA4Id === MODELO_A4_PERSONALIZADO && (
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ['larguraMm', 'Largura (mm)', 10, 200, false],
                        ['alturaMm', 'Altura (mm)', 10, 280, false],
                        ['colunas', 'Colunas', 1, 10, true],
                        ['linhas', 'Linhas', 1, 30, true],
                        ['margemSuperiorMm', 'Margem sup. (mm)', 0, 50, false],
                        ['margemEsquerdaMm', 'Margem esq. (mm)', 0, 50, false],
                        ['espacoHorizontalMm', 'Espaço horiz. (mm)', 0, 20, false],
                        ['espacoVerticalMm', 'Espaço vert. (mm)', 0, 20, false],
                      ] as const).map(([chave, rotulo, min, max, inteiro]) => (
                        <div key={chave} className="space-y-1">
                          <Label className="text-xs">{rotulo}</Label>
                          <CampoNumero valor={config.a4[chave]} min={min} max={max} inteiro={inteiro} onChange={(n) => atualizarA4({ [chave]: n })} />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Label htmlFor="etq-pos" className="text-xs whitespace-nowrap">Começar na posição</Label>
                    <CampoNumero id="etq-pos" valor={config.posicaoInicial} min={1} max={porFolha} inteiro onChange={(n) => atualizar({ posicaoInicial: n })} className="h-8 w-20" />
                    <span className="text-[11px] text-muted-foreground">de {porFolha}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Use "começar na posição" para aproveitar uma folha já usada pela metade (contando da esquerda para a direita, de cima para baixo).
                  </p>
                </div>
              )}
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
            </section>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:items-center">
          <span className="text-xs text-muted-foreground sm:mr-auto">
            {totalEtiquetas} {totalEtiquetas === 1 ? 'etiqueta' : 'etiquetas'}
            {config.formato === 'a4' && totalFolhas > 0 && ` · ${totalFolhas} ${totalFolhas === 1 ? 'folha' : 'folhas'} A4`}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleImprimir} disabled={totalEtiquetas === 0}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

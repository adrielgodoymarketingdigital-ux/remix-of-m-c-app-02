import { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle,
  XCircle, Loader2, ArrowLeft, Trash2, Eye, ChevronRight,
} from 'lucide-react';
import { lerPlanilha } from '@/lib/templatePlanilhaProdutos';
import { detectarMapeamentoOS, baixarTemplateOS } from '@/lib/templatePlanilhaOS';
import { formatCurrency } from '@/lib/formatters';

// upload → mapeamento → preview → resultado
type Etapa = 'upload' | 'mapeamento' | 'preview' | 'resultado';

export interface OSImportada {
  cliente_nome: string;
  cliente_telefone?: string;
  dispositivo_tipo: string;
  dispositivo_marca: string;
  dispositivo_modelo: string;
  dispositivo_imei?: string;
  dispositivo_cor?: string;
  defeito_relatado: string;
  status?: string;
  total?: number;
  data_abertura?: string;
}

interface OSValidada extends OSImportada {
  _linha: number;
  _avisos: string[];
  _erro: string | null;
}

interface ResultadoImportacao {
  inseridas: number;
  clientesCriados: number;
  erros: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportar: (ordens: OSImportada[]) => Promise<ResultadoImportacao>;
}

const CAMPOS = [
  { id: 'cliente_nome', label: 'Cliente *', obrigatorio: true },
  { id: 'cliente_telefone', label: 'Telefone Cliente', obrigatorio: false },
  { id: 'dispositivo_tipo', label: 'Tipo Dispositivo', obrigatorio: false },
  { id: 'dispositivo_marca', label: 'Marca *', obrigatorio: true },
  { id: 'dispositivo_modelo', label: 'Modelo *', obrigatorio: true },
  { id: 'dispositivo_imei', label: 'IMEI', obrigatorio: false },
  { id: 'dispositivo_cor', label: 'Cor', obrigatorio: false },
  { id: 'defeito_relatado', label: 'Defeito *', obrigatorio: true },
  { id: 'status', label: 'Status', obrigatorio: false },
  { id: 'total', label: 'Valor Total', obrigatorio: false },
  { id: 'data_abertura', label: 'Data Abertura', obrigatorio: false },
];

const ETAPAS: { id: Etapa; label: string }[] = [
  { id: 'upload', label: 'Arquivo' },
  { id: 'mapeamento', label: 'Colunas' },
  { id: 'preview', label: 'Revisão' },
  { id: 'resultado', label: 'Concluído' },
];

function StepIndicator({ etapa }: { etapa: Etapa }) {
  const idx = ETAPAS.findIndex(e => e.id === etapa);
  return (
    <div className="flex items-center gap-1 mb-4">
      {ETAPAS.filter(e => e.id !== 'resultado').map((e, i) => (
        <div key={e.id} className="flex items-center gap-1">
          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors
            ${i < idx ? 'bg-primary text-primary-foreground' : i === idx ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' : 'bg-muted text-muted-foreground'}`}>
            {i < idx ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span className={`text-xs hidden sm:inline ${i === idx ? 'font-medium' : 'text-muted-foreground'}`}>{e.label}</span>
          {i < ETAPAS.filter(e => e.id !== 'resultado').length - 1 && (
            <ChevronRight className="w-3 h-3 text-muted-foreground mx-0.5" />
          )}
        </div>
      ))}
    </div>
  );
}

export const DialogImportarOS = ({ open, onOpenChange, onImportar }: Props) => {
  const [etapa, setEtapa] = useState<Etapa>('upload');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dados, setDados] = useState<any[][]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, number | null>>({});
  const [itensValidados, setItensValidados] = useState<OSValidada[]>([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const resetar = useCallback(() => {
    setEtapa('upload');
    setArquivo(null);
    setHeaders([]);
    setDados([]);
    setMapeamento({});
    setItensValidados([]);
    setImportando(false);
    setResultado(null);
    setErro(null);
  }, []);

  const handleClose = (open: boolean) => {
    if (!open) resetar();
    onOpenChange(open);
  };

  const validarItens = (dadosRaw: any[][], map: Record<string, number | null>) => {
    const itens: OSValidada[] = dadosRaw.map((linha, index) => {
      const avisos: string[] = [];
      let erro: string | null = null;

      const getValue = (campo: string) => {
        const col = map[campo];
        if (col === null || col === undefined) return '';
        const val = linha[col];
        return val !== undefined && val !== '' ? String(val).trim() : '';
      };

      const cliente_nome = getValue('cliente_nome');
      const dispositivo_marca = getValue('dispositivo_marca');
      const dispositivo_modelo = getValue('dispositivo_modelo');
      const defeito_relatado = getValue('defeito_relatado');

      if (!cliente_nome) erro = 'Cliente é obrigatório';
      else if (!dispositivo_marca) erro = 'Marca é obrigatória';
      else if (!dispositivo_modelo) erro = 'Modelo é obrigatório';
      else if (!defeito_relatado) erro = 'Defeito é obrigatório';

      const totalRaw = getValue('total');
      let total = parseFloat(totalRaw) || 0;
      if (total < 0) { avisos.push('Valor negativo → 0'); total = 0; }

      const dispositivo_tipo = getValue('dispositivo_tipo') || 'celular';

      return {
        _linha: index + 2,
        _avisos: avisos,
        _erro: erro,
        cliente_nome,
        cliente_telefone: getValue('cliente_telefone') || undefined,
        dispositivo_tipo,
        dispositivo_marca,
        dispositivo_modelo,
        dispositivo_imei: getValue('dispositivo_imei') || undefined,
        dispositivo_cor: getValue('dispositivo_cor') || undefined,
        defeito_relatado,
        status: getValue('status') || undefined,
        total,
        data_abertura: getValue('data_abertura') || undefined,
      };
    });
    setItensValidados(itens);
    return itens;
  };

  const handleArquivoSelecionado = async (file: File) => {
    setErro(null);
    setArquivo(file);
    try {
      const { headers: h, dados: d } = await lerPlanilha(file);
      if (d.length === 0) { setErro('Nenhum dado encontrado na planilha.'); return; }
      setHeaders(h);
      setDados(d);
      const detected = detectarMapeamentoOS(h);
      const initial: Record<string, number | null> = {};
      CAMPOS.forEach(c => { initial[c.id] = detected[c.id] ?? null; });
      setMapeamento(initial);
      validarItens(d, initial);
      setEtapa('mapeamento');
    } catch (err: any) {
      setErro(err.message || 'Erro ao processar arquivo');
    }
  };

  const handleMapeamentoChange = (campo: string, valor: string) => {
    const novo = { ...mapeamento, [campo]: valor === '__nao_importar__' ? null : parseInt(valor) };
    setMapeamento(novo);
    validarItens(dados, novo);
  };

  const removerLinha = (linha: number) => {
    setItensValidados(prev => prev.filter(i => i._linha !== linha));
  };

  const handleImportar = async () => {
    const validos = itensValidados.filter(i => !i._erro);
    if (validos.length === 0) { setErro('Nenhum item válido para importar.'); return; }
    setImportando(true);
    setErro(null);
    try {
      const items: OSImportada[] = validos.map(({ _linha, _avisos, _erro, ...rest }) => rest);
      const res = await onImportar(items);
      setResultado(res);
      setEtapa('resultado');
    } catch (err: any) {
      setErro(err.message || 'Erro durante importação');
    } finally {
      setImportando(false);
    }
  };

  const itensComErro = itensValidados.filter(i => i._erro);
  const itensComAviso = itensValidados.filter(i => !i._erro && i._avisos.length > 0);
  const itensOk = itensValidados.filter(i => !i._erro && i._avisos.length === 0);
  const totalValidos = itensValidados.filter(i => !i._erro).length;
  const totalOriginal = dados.length;
  const removidas = totalOriginal - itensValidados.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-hidden flex flex-col gap-0 p-0">
        {/* Header fixo */}
        <div className="px-6 pt-6 pb-4 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Importar Ordens de Serviço
              {arquivo && etapa !== 'upload' && (
                <Badge variant="outline" className="ml-2 text-xs font-normal truncate max-w-[200px]">{arquivo.name}</Badge>
              )}
            </DialogTitle>
            {etapa === 'upload' && (
              <DialogDescription className="text-xs">
                Importe OS de outra planilha. Clientes inexistentes são criados automaticamente.
              </DialogDescription>
            )}
          </DialogHeader>
          {etapa !== 'resultado' && <StepIndicator etapa={etapa} />}
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* ETAPA 1 — Upload */}
          {etapa === 'upload' && (
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/40 transition-all"
                  onClick={() => document.getElementById('file-input-os')?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-muted/50'); }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary', 'bg-muted/50'); }}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary', 'bg-muted/50'); const f = e.dataTransfer.files[0]; if (f) handleArquivoSelecionado(f); }}
                >
                  <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-semibold">Arraste a planilha aqui</p>
                  <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-3">Formatos: .xlsx · .xls · .csv</p>
                  <Input id="file-input-os" type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleArquivoSelecionado(f); }} />
                </div>

                {erro && <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertDescription>{erro}</AlertDescription></Alert>}

                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted px-4 py-2 text-sm font-medium">Colunas aceitas na planilha</div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-border">
                      {[
                        ['Cliente (Nome)', true, 'Nome completo do cliente'],
                        ['Marca', true, 'Ex: Apple, Samsung, Motorola'],
                        ['Modelo', true, 'Ex: iPhone 14, Galaxy S23'],
                        ['Defeito', true, 'Descrição do problema relatado'],
                        ['Telefone', false, 'Telefone do cliente'],
                        ['Tipo Dispositivo', false, 'celular, tablet (padrão: celular)'],
                        ['IMEI', false, 'Número IMEI'],
                        ['Cor', false, 'Cor do aparelho'],
                        ['Status', false, 'aguardando_aprovacao, em_andamento, finalizado...'],
                        ['Valor', false, 'Ex: 150.00'],
                        ['Data Abertura', false, 'Ex: 2024-01-15'],
                      ].map(([col, obrig, desc]) => (
                        <tr key={String(col)}>
                          <td className="px-4 py-1.5 font-medium w-36">{col}</td>
                          <td className="px-2 py-1.5 w-20 text-center">
                            {obrig ? <span className="text-red-500 font-semibold">Sim</span> : <span className="text-muted-foreground">Não</span>}
                          </td>
                          <td className="px-4 py-1.5 text-muted-foreground">{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Button variant="outline" className="w-full" onClick={baixarTemplateOS}>
                  <Download className="w-4 h-4 mr-2" />Baixar modelo de planilha (.xlsx)
                </Button>
              </div>
            </ScrollArea>
          )}

          {/* ETAPA 2 — Mapeamento de colunas */}
          {etapa === 'mapeamento' && (
            <div className="flex-1 overflow-hidden flex flex-col px-6 py-4 gap-4">
              <p className="text-sm text-muted-foreground">
                Planilha lida com <strong>{dados.length}</strong> linha(s). Confirme quais colunas correspondem a cada campo:
              </p>

              <ScrollArea className="flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-2">
                  {CAMPOS.map(campo => (
                    <div key={campo.id} className="space-y-1">
                      <Label className="text-xs">{campo.label}</Label>
                      <Select
                        value={mapeamento[campo.id]?.toString() ?? '__nao_importar__'}
                        onValueChange={(v) => handleMapeamentoChange(campo.id, v)}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__nao_importar__">
                            {campo.obrigatorio ? '— Selecione —' : '— Não importar —'}
                          </SelectItem>
                          {headers.map((h, idx) => (
                            <SelectItem key={idx} value={idx.toString()}>
                              {h || `Coluna ${idx + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Resumo rápido */}
              <div className="flex flex-wrap gap-2 pt-1">
                {itensOk.length > 0 && <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1" />{itensOk.length} OK</Badge>}
                {itensComAviso.length > 0 && <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50"><AlertTriangle className="w-3 h-3 mr-1" />{itensComAviso.length} com aviso</Badge>}
                {itensComErro.length > 0 && <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50"><XCircle className="w-3 h-3 mr-1" />{itensComErro.length} com erro</Badge>}
              </div>

              {erro && <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertDescription>{erro}</AlertDescription></Alert>}

              <div className="flex justify-between gap-3 pt-1 border-t">
                <Button variant="ghost" size="sm" onClick={resetar}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
                <Button onClick={() => setEtapa('preview')} disabled={totalValidos === 0}>
                  <Eye className="w-4 h-4 mr-2" />Revisar {totalValidos} ordem{totalValidos !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {/* ETAPA 3 — Preview e remoção de linhas */}
          {etapa === 'preview' && (
            <div className="flex-1 overflow-hidden flex flex-col px-6 py-4 gap-3">
              {/* Cabeçalho do preview */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex flex-wrap gap-2">
                  {itensOk.length > 0 && <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1" />{itensOk.length} prontas</Badge>}
                  {itensComAviso.length > 0 && <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50"><AlertTriangle className="w-3 h-3 mr-1" />{itensComAviso.length} com aviso</Badge>}
                  {itensComErro.length > 0 && <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50"><XCircle className="w-3 h-3 mr-1" />{itensComErro.length} com erro</Badge>}
                  {removidas > 0 && <Badge variant="outline" className="text-muted-foreground"><Trash2 className="w-3 h-3 mr-1" />{removidas} removida{removidas !== 1 ? 's' : ''}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">Clique no <Trash2 className="w-3 h-3 inline" /> para remover uma linha antes de importar</p>
              </div>

              {/* Tabela de preview */}
              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Dispositivo</TableHead>
                      <TableHead>Defeito</TableHead>
                      <TableHead className="text-right w-24">Valor</TableHead>
                      <TableHead className="w-32">Status / Aviso</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensValidados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Todas as linhas foram removidas.
                        </TableCell>
                      </TableRow>
                    )}
                    {itensValidados.map((item) => (
                      <TableRow
                        key={item._linha}
                        className={
                          item._erro
                            ? 'bg-red-50 dark:bg-red-950/20'
                            : item._avisos.length > 0
                            ? 'bg-yellow-50 dark:bg-yellow-950/20'
                            : ''
                        }
                      >
                        <TableCell className="text-center text-xs text-muted-foreground">{item._linha}</TableCell>
                        <TableCell className="font-medium text-sm">
                          <div>{item.cliente_nome || <span className="text-red-500 italic text-xs">Vazio</span>}</div>
                          {item.cliente_telefone && <div className="text-xs text-muted-foreground">{item.cliente_telefone}</div>}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{item.dispositivo_marca} {item.dispositivo_modelo}</div>
                          {item.dispositivo_cor && <div className="text-xs text-muted-foreground">{item.dispositivo_tipo} · {item.dispositivo_cor}</div>}
                          {item.dispositivo_imei && <div className="text-xs text-muted-foreground font-mono">IMEI: {item.dispositivo_imei}</div>}
                        </TableCell>
                        <TableCell className="text-sm max-w-[180px]">
                          <div className="truncate" title={item.defeito_relatado}>{item.defeito_relatado || <span className="text-muted-foreground italic text-xs">—</span>}</div>
                          {item.data_abertura && <div className="text-xs text-muted-foreground">{item.data_abertura}</div>}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {item.total ? formatCurrency(item.total) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item._erro
                            ? <span className="text-red-600 flex items-start gap-1"><XCircle className="w-3 h-3 mt-0.5 shrink-0" />{item._erro}</span>
                            : item._avisos.length > 0
                            ? <span className="text-yellow-700 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{item._avisos.join(', ')}</span>
                            : <span className="text-green-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{item.status || 'aguardando'}</span>}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            onClick={() => removerLinha(item._linha)}
                            title="Remover esta linha"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {erro && <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertDescription>{erro}</AlertDescription></Alert>}

              <div className="flex justify-between gap-3 pt-1 border-t">
                <Button variant="ghost" size="sm" onClick={() => setEtapa('mapeamento')}>
                  <ArrowLeft className="w-4 h-4 mr-1" />Voltar
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
                  <Button
                    onClick={handleImportar}
                    disabled={importando || totalValidos === 0}
                    className="min-w-[160px]"
                  >
                    {importando
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</>
                      : <>Importar {totalValidos} ordem{totalValidos !== 1 ? 's' : ''}</>}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 4 — Resultado */}
          {etapa === 'resultado' && resultado && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-9 h-9 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold">Importação Concluída!</h3>
                <p className="text-sm text-muted-foreground mt-1">As ordens de serviço foram criadas com sucesso.</p>
              </div>

              <div className="w-full max-w-sm bg-muted/50 rounded-xl p-5 space-y-3">
                <p className="font-medium text-sm">Resumo</p>
                <div className="space-y-2 text-sm">
                  {resultado.inseridas > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" />OS importadas</span>
                      <Badge className="bg-green-600">{resultado.inseridas}</Badge>
                    </div>
                  )}
                  {resultado.clientesCriados > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600" />Clientes criados</span>
                      <Badge className="bg-blue-600">{resultado.clientesCriados}</Badge>
                    </div>
                  )}
                  {resultado.erros > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-red-600"><XCircle className="w-4 h-4" />Erros</span>
                      <Badge variant="destructive">{resultado.erros}</Badge>
                    </div>
                  )}
                </div>
              </div>

              <Button className="w-full max-w-sm" onClick={() => handleClose(false)}>Fechar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

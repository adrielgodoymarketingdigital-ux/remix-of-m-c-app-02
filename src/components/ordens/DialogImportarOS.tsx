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
  XCircle, Loader2, ArrowLeft,
} from 'lucide-react';
import { lerPlanilha } from '@/lib/templatePlanilhaProdutos';
import { detectarMapeamentoOS, baixarTemplateOS } from '@/lib/templatePlanilhaOS';
import { formatCurrency } from '@/lib/formatters';

type Etapa = 'upload' | 'mapeamento' | 'resultado';

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
  };

  const handleArquivoSelecionado = async (file: File) => {
    setErro(null);
    setArquivo(file);
    try {
      const { headers: h, dados: d } = await lerPlanilha(file);
      if (d.length === 0) { setErro('Nenhum dado encontrado.'); return; }
      setHeaders(h);
      setDados(d);
      const detected = detectarMapeamentoOS(h);
      const initial: Record<string, number | null> = {};
      CAMPOS.forEach(c => { initial[c.id] = detected[c.id] ?? null; });
      setMapeamento(initial);
      setEtapa('mapeamento');
      validarItens(d, initial);
    } catch (err: any) {
      setErro(err.message || 'Erro ao processar arquivo');
    }
  };

  const handleMapeamentoChange = (campo: string, valor: string) => {
    const novo = { ...mapeamento, [campo]: valor === '__nao_importar__' ? null : parseInt(valor) };
    setMapeamento(novo);
    validarItens(dados, novo);
  };

  const handleImportar = async () => {
    const validos = itensValidados.filter(i => !i._erro);
    if (validos.length === 0) { setErro('Nenhum item válido'); return; }
    setImportando(true);
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {etapa === 'upload' && 'Importar Ordens de Serviço via Planilha'}
            {etapa === 'mapeamento' && 'Mapeamento de Colunas'}
            {etapa === 'resultado' && 'Importação Concluída'}
          </DialogTitle>
          {etapa === 'upload' && (
            <DialogDescription>
              Importe ordens de serviço de outro sistema. Clientes serão criados automaticamente se não existirem.
            </DialogDescription>
          )}
        </DialogHeader>

        {etapa === 'upload' && (
          <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              onClick={() => document.getElementById('file-input-os')?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-muted/50'); }}
              onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary', 'bg-muted/50'); }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary', 'bg-muted/50'); const f = e.dataTransfer.files[0]; if (f) handleArquivoSelecionado(f); }}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Arraste sua planilha aqui</p>
              <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-3">Formatos aceitos: .xlsx, .xls, .csv</p>
              <Input id="file-input-os" type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleArquivoSelecionado(f); }} />
            </div>

            {erro && <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertDescription>{erro}</AlertDescription></Alert>}

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="font-medium text-sm">📋 Passo a passo para importação:</p>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Prepare sua planilha com a <strong>primeira linha sendo o cabeçalho</strong></li>
                <li>Preencha os dados das OS a partir da <strong>segunda linha</strong></li>
                <li>Clientes inexistentes serão <strong>criados automaticamente</strong></li>
              </ol>
              <div className="mt-3 border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left px-3 py-1.5 font-semibold">Coluna</th>
                      <th className="text-center px-3 py-1.5 font-semibold w-24">Obrigatório</th>
                      <th className="text-left px-3 py-1.5 font-semibold">Valores aceitos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr><td className="px-3 py-1.5 font-medium">Cliente (Nome)</td><td className="text-center px-3 py-1.5"><span className="text-red-500 font-bold">Sim</span></td><td className="px-3 py-1.5 text-muted-foreground">Nome do cliente</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Marca</td><td className="text-center px-3 py-1.5"><span className="text-red-500 font-bold">Sim</span></td><td className="px-3 py-1.5 text-muted-foreground">Ex: Apple, Samsung, Motorola</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Modelo</td><td className="text-center px-3 py-1.5"><span className="text-red-500 font-bold">Sim</span></td><td className="px-3 py-1.5 text-muted-foreground">Ex: iPhone 14, Galaxy S23</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Defeito</td><td className="text-center px-3 py-1.5"><span className="text-red-500 font-bold">Sim</span></td><td className="px-3 py-1.5 text-muted-foreground">Descrição do problema</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Telefone</td><td className="text-center px-3 py-1.5">Não</td><td className="px-3 py-1.5 text-muted-foreground">Telefone do cliente</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Tipo Dispositivo</td><td className="text-center px-3 py-1.5">Não</td><td className="px-3 py-1.5 text-muted-foreground">Ex: celular, tablet (padrão: celular)</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">IMEI</td><td className="text-center px-3 py-1.5">Não</td><td className="px-3 py-1.5 text-muted-foreground">Número IMEI do aparelho</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Cor</td><td className="text-center px-3 py-1.5">Não</td><td className="px-3 py-1.5 text-muted-foreground">Cor do dispositivo</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Status</td><td className="text-center px-3 py-1.5">Não</td><td className="px-3 py-1.5 text-muted-foreground">Ex: aberta, concluida (padrão: aberta)</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Valor</td><td className="text-center px-3 py-1.5">Não</td><td className="px-3 py-1.5 text-muted-foreground">Número decimal ex: 150.00</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Data</td><td className="text-center px-3 py-1.5">Não</td><td className="px-3 py-1.5 text-muted-foreground">Data de abertura ex: 2024-01-15</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">💡 Nomes alternativos também são aceitos (ex: "nome_cliente", "device_brand", "problem")</p>
            </div>

            <Button variant="outline" className="w-full" onClick={baixarTemplateOS}>
              <Download className="w-4 h-4 mr-2" />Baixar modelo de planilha
            </Button>
          </div>
          </ScrollArea>
        )}

        {etapa === 'mapeamento' && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={resetar}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
              <Badge variant="outline">{arquivo?.name}</Badge>
            </div>

            <p className="text-sm text-muted-foreground">Encontradas <strong>{dados.length}</strong> linhas</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CAMPOS.map(campo => (
                <div key={campo.id} className="space-y-1">
                  <Label className="text-xs">{campo.label}</Label>
                  <Select value={mapeamento[campo.id]?.toString() ?? '__nao_importar__'} onValueChange={(v) => handleMapeamentoChange(campo.id, v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__nao_importar__">{campo.obrigatorio ? '-- Selecione --' : '-- Não importar --'}</SelectItem>
                      {headers.map((h, idx) => <SelectItem key={idx} value={idx.toString()}>{h || `Coluna ${idx + 1}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {itensOk.length > 0 && <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1" />{itensOk.length} OK</Badge>}
              {itensComAviso.length > 0 && <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50"><AlertTriangle className="w-3 h-3 mr-1" />{itensComAviso.length} com avisos</Badge>}
              {itensComErro.length > 0 && <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50"><XCircle className="w-3 h-3 mr-1" />{itensComErro.length} com erros</Badge>}
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Defeito</TableHead>
                    <TableHead className="w-24 text-right">Valor</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensValidados.slice(0, 50).map((item, idx) => (
                    <TableRow key={idx} className={item._erro ? 'bg-red-50' : item._avisos.length > 0 ? 'bg-yellow-50' : ''}>
                      <TableCell className="text-muted-foreground">{item._linha}</TableCell>
                      <TableCell className="font-medium truncate max-w-[150px]">
                        {item.cliente_nome || <span className="text-red-500 italic">Vazio</span>}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[150px]">
                        {item.dispositivo_marca} {item.dispositivo_modelo}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[150px]">{item.defeito_relatado || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.total || 0)}</TableCell>
                      <TableCell>
                        {item._erro ? <span className="text-xs text-red-600">{item._erro}</span>
                          : item._avisos.length > 0 ? <span className="text-xs text-yellow-600">{item._avisos.join(', ')}</span>
                          : <CheckCircle2 className="w-4 h-4 text-green-600" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {itensValidados.length > 50 && <p className="p-2 text-center text-xs text-muted-foreground">Mostrando 50 de {itensValidados.length}</p>}
            </ScrollArea>

            {erro && <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertDescription>{erro}</AlertDescription></Alert>}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={handleImportar} disabled={importando || itensValidados.filter(i => !i._erro).length === 0}>
                {importando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</> : <>Importar {itensValidados.filter(i => !i._erro).length} ordens</>}
              </Button>
            </div>
          </div>
        )}

        {etapa === 'resultado' && resultado && (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-600 mb-4" />
              <h3 className="text-xl font-semibold">Importação Concluída!</h3>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="font-medium">📊 Resumo:</p>
              <ul className="space-y-1 text-sm">
                {resultado.inseridas > 0 && <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" />{resultado.inseridas} OS importada(s)</li>}
                {resultado.clientesCriados > 0 && <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600" />{resultado.clientesCriados} cliente(s) criado(s) automaticamente</li>}
                {resultado.erros > 0 && <li className="flex items-center gap-2 text-red-600"><XCircle className="w-4 h-4" />{resultado.erros} erro(s)</li>}
              </ul>
            </div>
            <div className="flex justify-center">
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

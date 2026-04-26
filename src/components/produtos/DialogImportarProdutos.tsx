import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { FormularioProduto, TipoProduto } from '@/types/produto';
import { 
  lerPlanilha, 
  detectarMapeamento, 
  baixarTemplatePlanilha,
  MAPEAMENTO_COLUNAS,
} from '@/lib/templatePlanilhaProdutos';
import { formatCurrency } from '@/lib/formatters';

type Etapa = 'upload' | 'mapeamento' | 'resultado';

interface ItemValidado extends FormularioProduto {
  _linha: number;
  _avisos: string[];
  _erro: string | null;
}

interface ResultadoImportacao {
  produtosInseridos: number;
  pecasInseridas: number;
  erros: number;
}

interface DialogImportarProdutosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportar: (itens: FormularioProduto[]) => Promise<ResultadoImportacao>;
}

const CAMPOS_SISTEMA = [
  { id: 'nome', label: 'Nome *', obrigatorio: true },
  { id: 'tipo', label: 'Tipo', obrigatorio: false },
  { id: 'quantidade', label: 'Quantidade', obrigatorio: false },
  { id: 'custo', label: 'Custo', obrigatorio: false },
  { id: 'preco', label: 'Preço', obrigatorio: false },
  { id: 'sku', label: 'SKU', obrigatorio: false },
  { id: 'codigo_barras', label: 'Código de Barras', obrigatorio: false },
];

export const DialogImportarProdutos = ({
  open,
  onOpenChange,
  onImportar,
}: DialogImportarProdutosProps) => {
  const [etapa, setEtapa] = useState<Etapa>('upload');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dados, setDados] = useState<any[][]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, number | null>>({});
  const [itensValidados, setItensValidados] = useState<ItemValidado[]>([]);
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
    if (!open) {
      resetar();
    }
    onOpenChange(open);
  };

  const handleArquivoSelecionado = async (file: File) => {
    setErro(null);
    setArquivo(file);
    
    try {
      const { headers: h, dados: d } = await lerPlanilha(file);
      
      if (d.length === 0) {
        setErro('Nenhum dado encontrado na planilha.');
        return;
      }
      
      setHeaders(h);
      setDados(d);
      
      // Auto-detectar mapeamento
      const mapeamentoDetectado = detectarMapeamento(h);
      const mapeamentoInicial: Record<string, number | null> = {};
      
      CAMPOS_SISTEMA.forEach(campo => {
        mapeamentoInicial[campo.id] = mapeamentoDetectado[campo.id] ?? null;
      });
      
      setMapeamento(mapeamentoInicial);
      setEtapa('mapeamento');
      
      // Validar itens
      validarItens(d, mapeamentoInicial);
    } catch (err: any) {
      setErro(err.message || 'Erro ao processar arquivo');
    }
  };

  const validarItens = (dadosRaw: any[][], map: Record<string, number | null>) => {
    const itens: ItemValidado[] = dadosRaw.map((linha, index) => {
      const avisos: string[] = [];
      let erro: string | null = null;
      
      const getValue = (campo: string, padrao: any = null) => {
        const colIndex = map[campo];
        if (colIndex === null || colIndex === undefined) return padrao;
        const valor = linha[colIndex];
        return valor !== undefined && valor !== '' ? valor : padrao;
      };

      // Nome (obrigatório)
      const nome = String(getValue('nome', '')).trim();
      if (!nome) {
        erro = 'Nome é obrigatório';
      }

      // Tipo
      const tipoRaw = String(getValue('tipo', 'produto')).toLowerCase().trim();
      let tipo: TipoProduto = 'produto';
      if (['peca', 'peça', 'part', 'componente'].includes(tipoRaw)) {
        tipo = 'peca';
      }

      // Quantidade
      let quantidade = parseInt(getValue('quantidade', '0')) || 0;
      if (quantidade < 0) {
        avisos.push('Quantidade negativa → 0');
        quantidade = 0;
      }

      // Custo
      let custo = parseFloat(getValue('custo', '0')) || 0;
      if (custo < 0) {
        avisos.push('Custo negativo → 0');
        custo = 0;
      }

      // Preço
      let preco = parseFloat(getValue('preco', '0')) || 0;
      if (preco < 0) {
        avisos.push('Preço negativo → 0');
        preco = 0;
      }

      // Aviso se preço menor que custo
      if (preco > 0 && custo > 0 && preco < custo) {
        avisos.push('Preço menor que custo');
      }

      // SKU e código de barras
      const codigo = tipo === 'produto' ? String(getValue('sku', '') || '').trim() || undefined : undefined;
      const codigo_barras = String(getValue('codigo_barras', '') || '').trim() || undefined;

      return {
        _linha: index + 2, // +2 porque começa da linha 2 (após header)
        _avisos: avisos,
        _erro: erro,
        tipo,
        nome,
        quantidade,
        custo,
        preco,
        codigo,
        codigo_barras,
        fotos: [],
      };
    });

    setItensValidados(itens);
  };

  const handleMapeamentoChange = (campo: string, valor: string) => {
    const novoMapeamento = {
      ...mapeamento,
      [campo]: valor === '__nao_importar__' ? null : parseInt(valor),
    };
    setMapeamento(novoMapeamento);
    validarItens(dados, novoMapeamento);
  };

  const handleImportar = async () => {
    const itensValidos = itensValidados.filter(i => !i._erro);
    
    if (itensValidos.length === 0) {
      setErro('Nenhum item válido para importar');
      return;
    }

    setImportando(true);
    
    try {
      // Remove campos internos antes de enviar
      const itensParaImportar: FormularioProduto[] = itensValidos.map(({ 
        _linha, _avisos, _erro, ...item 
      }) => item);
      
      const res = await onImportar(itensParaImportar);
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {etapa === 'upload' && 'Importar Produtos via Planilha'}
            {etapa === 'mapeamento' && 'Mapeamento de Colunas'}
            {etapa === 'resultado' && 'Importação Concluída'}
          </DialogTitle>
          {etapa === 'upload' && (
            <DialogDescription>
              Importe seus produtos e peças de uma planilha Excel ou CSV
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Etapa: Upload */}
        {etapa === 'upload' && (
          <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              onClick={() => document.getElementById('file-input')?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-primary', 'bg-muted/50');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-primary', 'bg-muted/50');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-primary', 'bg-muted/50');
                const file = e.dataTransfer.files[0];
                if (file) handleArquivoSelecionado(file);
              }}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Arraste sua planilha aqui</p>
              <p className="text-sm text-muted-foreground mt-1">
                ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                Formatos aceitos: .xlsx, .xls, .csv
              </p>
              <Input
                id="file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleArquivoSelecionado(file);
                }}
              />
            </div>

            {erro && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="font-medium text-sm">📋 Passo a passo para importação:</p>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Prepare sua planilha com a <strong>primeira linha sendo o cabeçalho</strong></li>
                <li>Preencha os dados a partir da <strong>segunda linha</strong></li>
                <li>O sistema detecta as colunas automaticamente pelo nome</li>
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
                    <tr><td className="px-3 py-1.5 font-medium">Nome</td><td className="text-center px-3 py-1.5"><span className="text-red-500 font-bold">Sim</span></td><td className="px-3 py-1.5 text-muted-foreground">Texto livre</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Tipo</td><td className="text-center px-3 py-1.5">Não</td><td className="px-3 py-1.5 text-muted-foreground"><code className="bg-muted px-1 rounded">produto</code> ou <code className="bg-muted px-1 rounded">peca</code> (padrão: produto)</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Quantidade</td><td className="text-center px-3 py-1.5">Não</td><td className="px-3 py-1.5 text-muted-foreground">Número inteiro (padrão: 0)</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Custo</td><td className="text-center px-3 py-1.5">Não</td><td className="px-3 py-1.5 text-muted-foreground">Número decimal ex: 150.00</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Preço</td><td className="text-center px-3 py-1.5">Não</td><td className="px-3 py-1.5 text-muted-foreground">Número decimal ex: 250.00</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">SKU</td><td className="text-center px-3 py-1.5">Não</td><td className="px-3 py-1.5 text-muted-foreground">Código do produto (só para tipo produto)</td></tr>
                    <tr><td className="px-3 py-1.5 font-medium">Código de Barras</td><td className="text-center px-3 py-1.5">Não</td><td className="px-3 py-1.5 text-muted-foreground">EAN/UPC</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">💡 Nomes alternativos também são aceitos (ex: "qty", "price", "descricao")</p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={baixarTemplatePlanilha}
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar modelo de planilha
            </Button>
          </div>
          </ScrollArea>
        )}

        {/* Etapa: Mapeamento */}
        {etapa === 'mapeamento' && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetar}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
              <Badge variant="outline">
                {arquivo?.name}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              Encontradas <strong>{dados.length}</strong> linhas de dados
            </p>

            {/* Mapeamento de colunas */}
            <div className="grid grid-cols-2 gap-3">
              {CAMPOS_SISTEMA.map(campo => (
                <div key={campo.id} className="space-y-1">
                  <Label className="text-xs">
                    {campo.label}
                  </Label>
                  <Select
                    value={mapeamento[campo.id]?.toString() ?? '__nao_importar__'}
                    onValueChange={(v) => handleMapeamentoChange(campo.id, v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__nao_importar__">
                        {campo.obrigatorio ? '-- Selecione --' : '-- Não importar --'}
                      </SelectItem>
                      {headers.map((header, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {header || `Coluna ${idx + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Status */}
            <div className="flex flex-wrap gap-2">
              {itensOk.length > 0 && (
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {itensOk.length} OK
                </Badge>
              )}
              {itensComAviso.length > 0 && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {itensComAviso.length} com avisos
                </Badge>
              )}
              {itensComErro.length > 0 && (
                <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
                  <XCircle className="w-3 h-3 mr-1" />
                  {itensComErro.length} com erros
                </Badge>
              )}
            </div>

            {/* Preview */}
            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-20">Tipo</TableHead>
                    <TableHead className="w-16 text-right">Qtd</TableHead>
                    <TableHead className="w-24 text-right">Custo</TableHead>
                    <TableHead className="w-24 text-right">Preço</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensValidados.slice(0, 50).map((item, idx) => (
                    <TableRow 
                      key={idx}
                      className={item._erro ? 'bg-red-50' : item._avisos.length > 0 ? 'bg-yellow-50' : ''}
                    >
                      <TableCell className="text-muted-foreground">{item._linha}</TableCell>
                      <TableCell className="font-medium truncate max-w-[200px]">
                        {item.nome || <span className="text-red-500 italic">Vazio</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {item.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.quantidade}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.custo)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.preco)}</TableCell>
                      <TableCell>
                        {item._erro ? (
                          <span className="text-xs text-red-600">{item._erro}</span>
                        ) : item._avisos.length > 0 ? (
                          <span className="text-xs text-yellow-600" title={item._avisos.join(', ')}>
                            {item._avisos.length} aviso(s)
                          </span>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {itensValidados.length > 50 && (
                <p className="p-2 text-center text-xs text-muted-foreground">
                  Mostrando 50 de {itensValidados.length} itens
                </p>
              )}
            </ScrollArea>

            {erro && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            {/* Botões */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleImportar}
                disabled={importando || itensValidados.filter(i => !i._erro).length === 0 || mapeamento.nome === null}
              >
                {importando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    Importar {itensValidados.filter(i => !i._erro).length} itens
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Etapa: Resultado */}
        {etapa === 'resultado' && resultado && (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-600 mb-4" />
              <h3 className="text-xl font-semibold">Importação Concluída!</h3>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="font-medium">📊 Resumo:</p>
              <ul className="space-y-1 text-sm">
                {resultado.produtosInseridos > 0 && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    {resultado.produtosInseridos} produto(s) importado(s)
                  </li>
                )}
                {resultado.pecasInseridas > 0 && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    {resultado.pecasInseridas} peça(s) importada(s)
                  </li>
                )}
                {resultado.erros > 0 && (
                  <li className="flex items-center gap-2 text-red-600">
                    <XCircle className="w-4 h-4" />
                    {resultado.erros} erro(s)
                  </li>
                )}
              </ul>
            </div>

            <div className="flex justify-center">
              <Button onClick={() => handleClose(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

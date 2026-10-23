import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileCode, Info, Loader2, XCircle } from 'lucide-react';
import {
  conferirDestinatario,
  lerXmlNfe,
  TAMANHO_MAXIMO_XML_NFE,
  type ItemNfe,
  type MensagemLeitura,
  type NotaNfe,
  type ResultadoLeituraNfe,
  type SituacaoDestinatario,
} from '@/lib/nfe/lerXmlNfe';
import { lerDadosTributaveis, type DadosTributaveisItem } from '@/lib/nfe/dadosTributaveisNfe';
import type { CandidatosVinculoXml } from '@/hooks/useCandidatosVinculoXml';
import { Extras, Fiscal, Imeis } from './detalhesItemXml';
import { dinheiro, quantidade } from './formatoItemXml';
import { ResumoNotaInvalida, VinculoItensXmlCompra } from './VinculoItensXmlCompra';
import { SucessoImportacaoXml } from './ConfirmarImportacaoXml';
import type { RetornoImportacao } from '@/lib/nfe/gravarImportacao';

/**
 * Importar XML de NF-e de compra. Etapa 1: lê o arquivo no navegador e mostra
 * o conteúdo. Etapa 2: com a nota válida, sugere vínculo, quantidade e custo
 * por item e resume (VinculoItensXmlCompra). Etapa 4: o "Confirmar
 * importação" do resumo envia o arquivo original e grava pela RPC; antes disso
 * nada é gravado e nenhum byte do arquivo vai ao servidor. Depois de gravar,
 * mostra o resultado e limpa o estado da tela.
 * Usado pela página Configurações › Fiscal › Importar XML de compra
 * (src/pages/ImportarXmlCompra.tsx), visível só via useImportacaoXmlCompraVisivel.
 */
interface LeitorXmlCompraProps {
  /** CNPJ/CPF da empresa ativa (matriz ou filial), para conferir o destinatário da nota. */
  documentosLoja: Array<string | null | undefined>;
  /** Produtos e peças da loja (somente leitura) para sugerir vínculos. */
  candidatos: CandidatosVinculoXml;
}

const CODIGOS_CHAVE = ['chave_invalida', 'chave_divergente', 'chave_protocolo'];

/** dhEmi/dVenc "2026-10-15..." → "15/10/2026" sem passar por Date (sem fuso). */
const data = (v: string) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : v || '—');
const documento = (d: string | null | undefined) => {
  if (!d) return '—';
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
};
const chaveFormatada = (c: string) => c.replace(/(\d{4})(?=\d)/g, '$1 ');

const TEXTO_DESTINATARIO: Record<SituacaoDestinatario, { texto: string; ok: boolean }> = {
  confere: { texto: 'Destinatário confere com o CNPJ da loja', ok: true },
  nao_confere: { texto: 'O destinatário da nota NÃO é o CNPJ cadastrado da loja', ok: false },
  loja_sem_cnpj: { texto: 'A loja não tem CNPJ cadastrado (Configurações); não deu para conferir o destinatário', ok: false },
  nota_sem_destinatario: { texto: 'A nota não informa destinatário', ok: false },
};

function Selo({ ok, children, testId }: { ok: boolean; children: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className={`flex items-start gap-1.5 text-sm ${ok ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
      {ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className="text-sm font-medium break-words">{children}</div>
    </div>
  );
}

function ListaMensagens({ mensagens, tipo }: { mensagens: MensagemLeitura[]; tipo: 'erro' | 'aviso' }) {
  if (mensagens.length === 0) return null;
  return (
    <Alert variant={tipo === 'erro' ? 'destructive' : 'default'} data-testid={tipo === 'erro' ? 'xml-erros' : 'xml-avisos'}
      className={tipo === 'aviso' ? 'border-amber-500/50' : undefined}>
      {tipo === 'erro' ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
      <AlertDescription>
        <p className="font-medium mb-1">{tipo === 'erro' ? 'Problemas que impedem usar este arquivo' : 'Atenção'}</p>
        <ul className="list-disc pl-4 space-y-0.5 text-sm max-h-40 overflow-y-auto">
          {mensagens.map((m, i) => (
            <li key={i}>{m.nItem ? <strong>Item {m.nItem}: </strong> : null}{m.texto}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function Cabecalho({ nota, erros, documentosLoja }: { nota: NotaNfe; erros: MensagemLeitura[]; documentosLoja: LeitorXmlCompraProps['documentosLoja'] }) {
  const chaveOk = !erros.some((e) => CODIGOS_CHAVE.includes(e.codigo));
  const destinatario = TEXTO_DESTINATARIO[conferirDestinatario(nota, documentosLoja)];
  return (
    <div className="rounded-lg border p-3 sm:p-4 space-y-3" data-testid="xml-cabecalho">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Campo rotulo="Emitente (fornecedor)">
          {nota.emitente.nome || '—'}
          <div className="text-xs text-muted-foreground font-normal">{documento(nota.emitente.cnpj ?? nota.emitente.cpf)}</div>
        </Campo>
        <Campo rotulo="Número / série">{nota.numero} / {nota.serie}</Campo>
        <Campo rotulo="Emissão">{data(nota.dataEmissao)}</Campo>
        <Campo rotulo="Valor total">{dinheiro(nota.totais.vNF)}</Campo>
        <Campo rotulo="Destinatário">
          {nota.destinatario?.nome || '—'}
          <div className="text-xs text-muted-foreground font-normal">{documento(nota.destinatario?.cnpj ?? nota.destinatario?.cpf)}</div>
        </Campo>
        <Campo rotulo="Natureza da operação">{nota.naturezaOperacao || '—'}</Campo>
        <Campo rotulo="Duplicatas">
          {nota.duplicatas.length === 0
            ? '—'
            : nota.duplicatas.map((d, i) => (
                <div key={i} className="font-normal">{d.numero || i + 1}: {dinheiro(d.valor)} em {data(d.vencimento)}</div>
              ))}
        </Campo>
        <Campo rotulo="Chave de acesso">
          <span className="font-mono text-xs break-all">{chaveFormatada(nota.chave) || '—'}</span>
        </Campo>
      </div>
      <div className="flex flex-col gap-1 border-t pt-3">
        <Selo ok={chaveOk} testId="xml-situacao-chave">{chaveOk ? 'Chave de acesso válida e coerente com a nota' : 'Chave de acesso inválida ou divergente'}</Selo>
        <Selo ok={nota.autorizada}>
          {nota.autorizada
            ? `Autorizada pela SEFAZ (protocolo ${nota.protocolo?.numero || '—'})`
            : nota.protocolo ? 'O protocolo não indica nota autorizada' : 'Sem protocolo de autorização no arquivo'}
        </Selo>
        <Selo ok={destinatario.ok} testId="xml-destinatario">{destinatario.texto}</Selo>
      </div>
    </div>
  );
}

function TabelaItens({ itens }: { itens: ItemNfe[] }) {
  return (
    <div data-testid="xml-itens">
      {/* Desktop */}
      <div className="hidden md:block rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Código / EAN</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead className="text-right">Unitário</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((item) => (
              <TableRow key={item.nItem}>
                <TableCell className="align-top text-muted-foreground">{item.nItem}</TableCell>
                <TableCell className="align-top">
                  <div className="font-medium">{item.xProd}</div>
                  <div className="flex flex-col"><Fiscal item={item} /><Extras item={item} /></div>
                  <Imeis item={item} />
                </TableCell>
                <TableCell className="align-top text-sm">
                  <div>{item.cProd || '—'}</div>
                  <div className="text-xs text-muted-foreground">{item.ean ?? 'sem código de barras'}</div>
                </TableCell>
                <TableCell className="align-top text-right whitespace-nowrap">{quantidade(item.qCom)} {item.uCom}</TableCell>
                <TableCell className="align-top text-right whitespace-nowrap">{dinheiro(item.vUnCom)}</TableCell>
                <TableCell className="align-top text-right whitespace-nowrap font-medium">{dinheiro(item.vProd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Celular */}
      <div className="md:hidden space-y-2">
        {itens.map((item) => (
          <div key={item.nItem} className="rounded-lg border p-3 space-y-1">
            <div className="flex justify-between gap-2">
              <span className="font-medium text-sm break-words min-w-0">{item.nItem}. {item.xProd}</span>
              <span className="font-medium text-sm whitespace-nowrap">{dinheiro(item.vProd)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {quantidade(item.qCom)} {item.uCom} × {dinheiro(item.vUnCom)} · cód. {item.cProd || '—'} · {item.ean ?? 'sem código de barras'}
            </div>
            <div className="flex flex-col"><Fiscal item={item} /><Extras item={item} /></div>
            <Imeis item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeitorXmlCompra({ documentosLoja, candidatos }: LeitorXmlCompraProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [lendo, setLendo] = useState(false);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoLeituraNfe | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [dadosTributaveis, setDadosTributaveis] = useState<Map<number, DadosTributaveisItem>>(new Map());
  const [importada, setImportada] = useState<RetornoImportacao | null>(null);

  const resetar = () => {
    setNomeArquivo('');
    setErroArquivo(null);
    setResultado(null);
    setArquivo(null);
    setDadosTributaveis(new Map());
    if (inputRef.current) inputRef.current.value = '';
  };

  const aoImportar = (retorno: RetornoImportacao) => {
    resetar();
    setImportada(retorno);
    window.scrollTo({ top: 0 });
  };

  const lerArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErroArquivo(null);
    setResultado(null);
    setArquivo(null);
    setImportada(null);
    if (!arquivo.name.toLowerCase().endsWith('.xml')) {
      setErroArquivo('Escolha o arquivo .xml da nota (não o PDF/DANFE).');
      return;
    }
    // Antes de ler: arquivo grande nem é carregado na memória.
    if (arquivo.size > TAMANHO_MAXIMO_XML_NFE) {
      setErroArquivo('O arquivo passa de 5 MB. Um XML de NF-e não chega nem perto disso; confira se escolheu o arquivo certo.');
      return;
    }
    setLendo(true);
    try {
      const texto = await arquivo.text();
      setNomeArquivo(arquivo.name);
      const lido = lerXmlNfe(texto, { tamanhoBytes: arquivo.size });
      // cEANTrib/uTrib/qTrib só de nota válida (as checagens de segurança já passaram).
      setDadosTributaveis(lido.ok ? lerDadosTributaveis(texto, { tamanhoBytes: arquivo.size }) : new Map());
      setArquivo(arquivo);
      setResultado(lido);
    } catch {
      setErroArquivo('Não foi possível ler o arquivo.');
    } finally {
      setLendo(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="leitor-xml-compra">
      {importada ? (
        <SucessoImportacaoXml retorno={importada} onOutraNota={() => { setImportada(null); resetar(); }} />
      ) : (
        <Alert data-testid="xml-somente-leitura">
          <Info className="h-4 w-4" />
          <AlertDescription>Nada é gravado até você conferir os itens e confirmar a importação no fim da página.</AlertDescription>
        </Alert>
      )}

      {importada ? null : !resultado ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={lendo}
            className="w-full border-2 border-dashed rounded-lg p-6 sm:p-10 flex flex-col items-center gap-2 text-center hover:bg-muted/50 transition-colors"
          >
            {lendo ? <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /> : <FileCode className="w-8 h-8 text-muted-foreground" />}
            <span className="font-medium">{lendo ? 'Lendo arquivo…' : 'Escolher arquivo .xml'}</span>
            <span className="text-xs text-muted-foreground">NF-e modelo 55, até 5 MB. O arquivo é lido no seu aparelho; só é enviado se você confirmar a importação.</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            className="hidden"
            data-testid="xml-input"
            onChange={(e) => lerArquivo(e.target.files?.[0])}
          />
          {erroArquivo && (
            <Alert variant="destructive" data-testid="xml-erros">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{erroArquivo}</AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={resetar}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Outro arquivo
            </Button>
            <Badge variant="outline" className="truncate max-w-[60%]">{nomeArquivo}</Badge>
          </div>

          <ListaMensagens mensagens={resultado.erros} tipo="erro" />
          {resultado.nota && <Cabecalho nota={resultado.nota} erros={resultado.erros} documentosLoja={documentosLoja} />}
          <ListaMensagens mensagens={resultado.avisos} tipo="aviso" />
          {resultado.nota?.imeisInfCpl.length ? (
            <div className="text-xs rounded-lg border p-3">
              <span className="text-muted-foreground">IMEIs nas informações complementares: </span>
              <span className="font-mono break-all">{resultado.nota.imeisInfCpl.join(', ')}</span>
            </div>
          ) : null}
          {resultado.ok && resultado.nota && arquivo ? (
            <VinculoItensXmlCompra
              resultado={resultado}
              dadosTributaveis={dadosTributaveis}
              candidatos={candidatos}
              arquivo={arquivo}
              situacaoDestinatario={conferirDestinatario(resultado.nota, documentosLoja)}
              onImportada={aoImportar}
            />
          ) : (
            <>
              {resultado.itens.length > 0 && (
                <>
                  <p className="text-sm text-muted-foreground">{resultado.itens.length} {resultado.itens.length === 1 ? 'item' : 'itens'} na nota</p>
                  <TabelaItens itens={resultado.itens} />
                </>
              )}
              <ResumoNotaInvalida />
            </>
          )}
        </div>
      )}
    </div>
  );
}

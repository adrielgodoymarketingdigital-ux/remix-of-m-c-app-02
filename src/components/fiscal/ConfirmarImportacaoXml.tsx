import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle2, Loader2, PackageCheck, XCircle } from 'lucide-react';
import type { ResultadoLeituraNfe, SituacaoDestinatario } from '@/lib/nfe/lerXmlNfe';
import type { DadosTributaveisItem } from '@/lib/nfe/dadosTributaveisNfe';
import type { LinhaPlano, ResumoImportacao } from '@/lib/nfe/planoImportacao';
import {
  MENSAGEM_ERRO_GENERICO,
  montarPayloadImportacao,
  motivosBloqueio,
  textoJaImportada,
  type ErroImportacao,
  type PayloadImportacao,
  type RetornoImportacao,
} from '@/lib/nfe/gravarImportacao';
import { useImportacaoXmlCompraVisivel } from '@/hooks/useImportacaoXmlCompraVisivel';
import { useIdentidade } from '@/hooks/useResolvedUserId';
import { useGravarXmlCompra, useLimitePlanoImportacao } from '@/hooks/useGravarXmlCompra';
import { dinheiroCentavos } from './formatoItemXml';

/**
 * Importar XML de compra — ETAPA 4: botão "Confirmar importação", diálogo de
 * confirmação e a gravação (upload do XML original + RPC importar_nfe_compra).
 * Nenhuma escrita acontece antes do "Confirmar" do diálogo; enquanto grava, o
 * botão fica desabilitado e cliques repetidos são ignorados.
 */
interface ConfirmarImportacaoXmlProps {
  resultado: ResultadoLeituraNfe;
  linhas: LinhaPlano[];
  resumo: ResumoImportacao;
  dadosTributaveis: Map<number, DadosTributaveisItem>;
  /** Arquivo original escolhido (vai como está para o bucket). */
  arquivo: File;
  situacaoDestinatario: SituacaoDestinatario;
  verificacaoNota: { verificando: boolean; falhou: boolean; tentarDeNovo: () => void };
  /** RPC respondeu 23505: a tela trata como "já importada". */
  onJaImportada: (texto: string) => void;
  onImportada: (retorno: RetornoImportacao) => void;
}

type Fase = 'fechado' | 'confirmar' | 'enviando_xml' | 'falha_xml' | 'gravando' | 'erro';

const documento = (d: string | null) => {
  if (!d) return '';
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
};

function Linha({ rotulo, children, testId }: { rotulo: string; children: ReactNode; testId: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b last:border-b-0" data-testid={testId}>
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="font-medium text-right break-words min-w-0">{children}</span>
    </div>
  );
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function ConfirmarImportacaoXml({
  resultado,
  linhas,
  resumo,
  dadosTributaveis,
  arquivo,
  situacaoDestinatario,
  verificacaoNota,
  onJaImportada,
  onImportada,
}: ConfirmarImportacaoXmlProps) {
  const podeImportar = useImportacaoXmlCompraVisivel();
  const { empresaId, isFilial } = useIdentidade();
  const limite = useLimitePlanoImportacao(resumo.novos);
  const { enviarXml, gravar, invalidarCaches } = useGravarXmlCompra();
  const [fase, setFase] = useState<Fase>('fechado');
  const [erro, setErro] = useState<ErroImportacao | null>(null);
  const emAndamento = useRef(false);

  const motivos = motivosBloqueio({
    podeImportar,
    resumo,
    notaOk: resultado.ok,
    verificandoNota: verificacaoNota.verificando,
    falhaVerificacaoNota: verificacaoNota.falhou,
    verificandoLimite: limite.verificando,
    bloqueioLimite: limite.bloqueio,
  });
  const ocupado = fase === 'enviando_xml' || fase === 'gravando';
  const habilitado = motivos.length === 0 && !ocupado;

  const executar = async (comXml: boolean) => {
    if (emAndamento.current) return;
    emAndamento.current = true;
    setErro(null);
    try {
      let payload: PayloadImportacao;
      try {
        payload = montarPayloadImportacao(resultado, linhas, dadosTributaveis, { empresaId, isFilial });
      } catch {
        setErro({ tipo: 'generico', mensagem: MENSAGEM_ERRO_GENERICO });
        setFase('erro');
        return;
      }
      if (comXml) {
        setFase('enviando_xml');
        const envio = await enviarXml(arquivo, payload.nota.chave);
        if (!envio.ok) {
          setFase('falha_xml');
          return;
        }
      }
      setFase('gravando');
      const r = await gravar(payload);
      if (r.ok) {
        void invalidarCaches();
        setFase('fechado');
        onImportada(r.retorno);
        return;
      }
      if (r.erro.tipo === 'ja_importada') onJaImportada(textoJaImportada({ mensagemRpc: r.erro.mensagem }));
      setErro(r.erro);
      setFase('erro');
    } finally {
      emAndamento.current = false;
    }
  };

  const abrir = () => {
    if (!habilitado || emAndamento.current) return;
    setErro(null);
    setFase('confirmar');
  };
  const fechar = () => {
    if (!ocupado) setFase('fechado');
  };

  return (
    <div className="space-y-2" data-testid="xml-confirmacao">
      <Button
        type="button"
        className="w-full sm:w-auto"
        disabled={!habilitado}
        onClick={abrir}
        data-testid="xml-confirmar-importacao"
      >
        {ocupado ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackageCheck className="w-4 h-4 mr-2" />}
        Confirmar importação
      </Button>
      {motivos.length > 0 && (
        <ul className="text-sm text-muted-foreground space-y-0.5" data-testid="xml-motivos-bloqueio">
          {motivos.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      {verificacaoNota.falhou && (
        <Button type="button" variant="outline" size="sm" onClick={() => verificacaoNota.tentarDeNovo()}>
          Verificar de novo
        </Button>
      )}

      <AlertDialog open={fase !== 'fechado'} onOpenChange={(aberto) => { if (!aberto) fechar(); }}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg" data-testid="xml-dialogo-confirmacao">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar importação da nota</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-foreground text-left space-y-3">
                <div className="rounded-md border px-3 py-1" data-testid="xml-dialogo-numeros">
                  <Linha rotulo="Fornecedor" testId="xml-dialogo-fornecedor">
                    {resumo.fornecedor || '—'}
                    {resumo.fornecedorDocumento && (
                      <span className="block text-xs text-muted-foreground font-normal">{documento(resumo.fornecedorDocumento)}</span>
                    )}
                  </Linha>
                  <Linha rotulo="Nota / série" testId="xml-dialogo-nota">{resumo.numero} / {resumo.serie}</Linha>
                  <Linha rotulo="Itens a importar" testId="xml-dialogo-itens">
                    {resumo.aImportar} ({plural(resumo.vinculados, 'vinculado', 'vinculados')}, {plural(resumo.novos, 'novo', 'novos')})
                  </Linha>
                  <Linha rotulo="Unidades" testId="xml-dialogo-unidades">{resumo.unidades}</Linha>
                  <Linha rotulo="Custo total" testId="xml-dialogo-custo">{dinheiroCentavos(resumo.custoTotalCentavos)}</Linha>
                  <Linha rotulo="Cadastros novos" testId="xml-dialogo-novos">
                    {[
                      resumo.novosProdutos > 0 && plural(resumo.novosProdutos, 'produto', 'produtos'),
                      resumo.novosPecas > 0 && plural(resumo.novosPecas, 'peça', 'peças'),
                    ].filter(Boolean).join(' e ') || 'nenhum'}
                  </Linha>
                </div>
                {situacaoDestinatario !== 'confere' && (
                  <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400" data-testid="xml-dialogo-destinatario">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    O destinatário da nota não foi confirmado como esta empresa. Confira antes de importar.
                  </p>
                )}
                <p className="flex items-start gap-1.5 font-medium" data-testid="xml-dialogo-aviso">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                  Isso altera o estoque e o custo. Não há botão de desfazer nesta tela.
                </p>

                {fase === 'enviando_xml' && (
                  <p className="flex items-center gap-2 text-muted-foreground" data-testid="xml-dialogo-progresso">
                    <Loader2 className="w-4 h-4 animate-spin" /> Guardando o arquivo XML…
                  </p>
                )}
                {fase === 'gravando' && (
                  <p className="flex items-center gap-2 text-muted-foreground" data-testid="xml-dialogo-progresso">
                    <Loader2 className="w-4 h-4 animate-spin" /> Gravando no estoque…
                  </p>
                )}
                {fase === 'falha_xml' && (
                  <Alert data-testid="xml-dialogo-falha-upload" className="border-amber-500/50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      Não foi possível guardar o arquivo XML. Você pode tentar de novo ou importar sem guardar o arquivo
                      (o estoque e o custo são gravados do mesmo jeito; só o XML original não fica anexado).
                    </AlertDescription>
                  </Alert>
                )}
                {fase === 'erro' && erro && (
                  <Alert variant="destructive" data-testid="xml-dialogo-erro" data-tipo={erro.tipo}>
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{erro.mensagem}</AlertDescription>
                  </Alert>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            {fase === 'falha_xml' ? (
              <>
                <Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button>
                <Button type="button" variant="outline" onClick={() => executar(false)} data-testid="xml-continuar-sem-xml">
                  Continuar sem guardar o arquivo
                </Button>
                <Button type="button" onClick={() => executar(true)} data-testid="xml-tentar-upload">Tentar de novo</Button>
              </>
            ) : fase === 'erro' ? (
              <Button type="button" onClick={fechar} data-testid="xml-dialogo-fechar">Fechar</Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={fechar} disabled={ocupado} data-testid="xml-dialogo-cancelar">Cancelar</Button>
                <Button type="button" onClick={() => executar(true)} disabled={ocupado} data-testid="xml-dialogo-confirmar">
                  {ocupado && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function SucessoImportacaoXml({ retorno, onOutraNota }: { retorno: RetornoImportacao; onOutraNota: () => void }) {
  return (
    <section className="rounded-lg border border-green-600/40 p-4 sm:p-5 space-y-4" data-testid="xml-sucesso">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
        <div>
          <h2 className="text-lg font-semibold">Nota importada</h2>
          <p className="text-sm text-muted-foreground">O estoque e o custo já foram atualizados.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
        {[
          ['Itens', retorno.itens, 'itens'],
          ['Vinculados', retorno.vinculados, 'vinculados'],
          ['Novos', retorno.novos, 'novos'],
          ['Unidades', retorno.unidades, 'unidades'],
          ['Custo total', dinheiroCentavos(retorno.custoTotalCentavos), 'custo'],
        ].map(([rotulo, valor, id]) => (
          <div key={id} className="rounded-md border p-2" data-testid={`xml-sucesso-${id}`}>
            <div className="text-xs text-muted-foreground">{rotulo}</div>
            <div className="text-lg font-semibold tabular-nums">{valor}</div>
          </div>
        ))}
      </div>
      {!retorno.xmlAnexado && (
        <p className="text-sm text-amber-700 dark:text-amber-400" data-testid="xml-sucesso-sem-arquivo">
          O arquivo XML original não ficou guardado junto desta importação.
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button asChild data-testid="xml-ver-produtos"><Link to="/produtos">Ver produtos</Link></Button>
        <Button type="button" variant="outline" onClick={onOutraNota} data-testid="xml-outra-nota">Importar outra nota</Button>
      </div>
    </section>
  );
}

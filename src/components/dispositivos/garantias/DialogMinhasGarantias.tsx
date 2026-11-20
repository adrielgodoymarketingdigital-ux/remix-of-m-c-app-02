/**
 * "Minhas garantias" — FASE A: cadastro das garantias da loja (nome + prazo +
 * texto do termo). Só admin vê (lib/garantias/visibilidadeMinhasGarantias.ts).
 * NADA aqui é usado na venda, nos recibos ou no catálogo nesta fase.
 * Carregado sob demanda (AcessoMinhasGarantias): quem não abre não baixa.
 */
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Copy, Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useGarantias } from "@/hooks/useGarantias";
import {
  type AcaoGarantia,
  type ErrosGarantia,
  type GarantiaExibida,
  MESES_MAX,
  NOME_MAX,
  prazosDivergentes,
  validarGarantia,
} from "@/lib/garantias/garantias";
import { textoPadraoGarantia } from "@/lib/garantias/textoPadrao";
import { previaTextoGarantia, rotuloPrazo, VARIAVEIS_GARANTIA } from "@/lib/garantias/previa";

interface Rascunho {
  chave: string | null; // null = nova
  nome: string;
  meses: number;
  texto: string;
  ativo: boolean;
  revisar: boolean;
}

const PRAZOS_RAPIDOS = [0, 3, 6, 12, 24];

const rascunhoNovo = (): Rascunho => ({ chave: null, nome: "", meses: 3, texto: textoPadraoGarantia(3), ativo: true, revisar: false });
const rascunhoDe = (g: GarantiaExibida): Rascunho => ({
  chave: g.chave,
  nome: g.nome,
  meses: g.meses,
  texto: g.texto,
  ativo: g.ativo,
  revisar: g.revisar,
});

export interface DialogMinhasGarantiasProps {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
}

export default function DialogMinhasGarantias({ open, onOpenChange }: DialogMinhasGarantiasProps) {
  const { lista, virtual, carregando, erro, gravar, gravando } = useGarantias(open);
  const { config: loja } = useConfiguracaoLoja();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [erros, setErros] = useState<ErrosGarantia>({});
  const [confirmarDivergencia, setConfirmarDivergencia] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<GarantiaExibida | null>(null);
  const textoRef = useRef<HTMLTextAreaElement>(null);

  const divergentes = useMemo(
    () => (rascunho ? prazosDivergentes(rascunho.texto, rascunho.meses) : []),
    [rascunho],
  );
  const previa = useMemo(
    () => (rascunho ? previaTextoGarantia(rascunho.texto, rascunho.meses, loja) : ""),
    [rascunho, loja],
  );

  const executar = async (acao: AcaoGarantia, sucesso: string) => {
    try {
      await gravar(acao);
      toast.success(sucesso);
      return true;
    } catch (e) {
      console.error("[minhas garantias]", e);
      const codigo = (e as { code?: string })?.code;
      toast.error(codigo === "23505" ? "Estas garantias já foram gravadas. Confira a lista." : "Não foi possível salvar a garantia.");
      return false;
    }
  };

  const alterar = (campos: Partial<Rascunho>) => {
    setRascunho((r) => (r ? { ...r, ...campos } : r));
    setErros({});
  };

  const inserirVariavel = (tag: string) => {
    if (!rascunho) return;
    const el = textoRef.current;
    const ini = el?.selectionStart ?? rascunho.texto.length;
    const fim = el?.selectionEnd ?? ini;
    const texto = rascunho.texto.slice(0, ini) + tag + rascunho.texto.slice(fim);
    alterar({ texto });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(ini + tag.length, ini + tag.length);
    });
  };

  const salvar = async (ignorarDivergencia = false) => {
    if (!rascunho) return;
    const v = validarGarantia(rascunho);
    if ("erros" in v) {
      setErros(v.erros);
      return;
    }
    if (divergentes.length > 0 && !ignorarDivergencia) {
      setConfirmarDivergencia(true);
      return;
    }
    const acao: AcaoGarantia = rascunho.chave
      ? { tipo: "editar", chave: rascunho.chave, dados: v.valor }
      : { tipo: "criar", dados: v.valor };
    if (await executar(acao, rascunho.chave ? "Garantia atualizada" : "Garantia criada")) setRascunho(null);
  };

  const fechar = (aberto: boolean) => {
    if (!aberto) {
      setRascunho(null);
      setErros({});
    }
    onOpenChange(aberto);
  };

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-5xl sm:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {rascunho && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRascunho(null)} aria-label="Voltar para a lista">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {rascunho ? (rascunho.chave ? `Editar: ${rascunho.nome || "garantia"}` : "Nova garantia") : "Minhas garantias"}
            <Badge variant="outline" className="ml-1 text-[10px]">Só admin</Badge>
          </DialogTitle>
          <DialogDescription>
            A garantia leva o prazo e o texto do termo juntos. Ainda não é usada nas vendas nem nos recibos.
          </DialogDescription>
        </DialogHeader>

        {!rascunho && (
          <div className="space-y-3">
            {virtual && !carregando && !erro && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                Estas são as garantias padrão. Elas só são gravadas na sua loja quando você alterar, criar, duplicar ou excluir alguma.
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => { setRascunho(rascunhoNovo()); setErros({}); }} disabled={carregando || !!erro}>
                <Plus className="mr-2 h-4 w-4" /> Nova garantia
              </Button>
            </div>

            {carregando && (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
              </div>
            )}
            {erro && !carregando && (
              <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
                Não foi possível carregar as garantias. Tente de novo mais tarde.
              </div>
            )}
            {!carregando && !erro && lista.length === 0 && (
              <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                Nenhuma garantia cadastrada. Use "Nova garantia".
              </div>
            )}

            {!carregando && !erro && lista.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {lista.map((g) => (
                  <li key={g.chave} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{g.nome}</span>
                        {!g.ativo && <Badge variant="secondary">Desativada</Badge>}
                        {g.revisar && (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300">Revise o prazo</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {rotuloPrazo(g.meses)}
                        {g.origem === "modelo" && " · importada de um modelo antigo"}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setRascunho(rascunhoDe(g)); setErros({}); }} disabled={gravando}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => executar({ tipo: "duplicar", chave: g.chave }, "Garantia duplicada")} disabled={gravando}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicar
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => setParaExcluir(g)} disabled={gravando} aria-label={`Excluir ${g.nome}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Excluir tira a garantia da lista. Vendas feitas com ela continuam com a cópia guardada na própria venda.
            </p>
          </div>
        )}

        {rascunho && (
          <div className="space-y-4">
            {rascunho.revisar && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Importada de um modelo antigo sem prazo claro: confira o prazo e salve.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <div className="space-y-1.5">
                <Label htmlFor="garantia-nome">Nome</Label>
                <Input id="garantia-nome" value={rascunho.nome} maxLength={NOME_MAX} onChange={(e) => alterar({ nome: e.target.value })} placeholder="Ex.: Garantia 3 meses" />
                {erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="garantia-meses">Prazo (meses)</Label>
                <Input
                  id="garantia-meses"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MESES_MAX}
                  value={Number.isFinite(rascunho.meses) ? rascunho.meses : ""}
                  onChange={(e) => alterar({ meses: e.target.value === "" ? NaN : Math.trunc(Number(e.target.value)) })}
                />
                <div className="flex flex-wrap gap-1">
                  {PRAZOS_RAPIDOS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => alterar({ meses: m })}
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${rascunho.meses === m ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}
                    >
                      {m === 0 ? "Sem garantia" : rotuloPrazo(m)}
                    </button>
                  ))}
                </div>
                {erros.meses && <p className="text-xs text-destructive">{erros.meses}</p>}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="garantia-texto">Texto do termo</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => alterar({ texto: textoPadraoGarantia(rascunho.meses) })}>
                    <RotateCcw className="mr-1 h-3 w-3" /> Restaurar texto padrão
                  </Button>
                </div>
                <Textarea
                  id="garantia-texto"
                  ref={textoRef}
                  value={rascunho.texto}
                  onChange={(e) => alterar({ texto: e.target.value })}
                  className="min-h-[300px] font-mono text-xs leading-relaxed"
                />
                {erros.texto && <p className="text-xs text-destructive">{erros.texto}</p>}
                <div>
                  <p className="mb-1 text-xs font-medium">Variáveis (toque para inserir)</p>
                  <div className="flex flex-wrap gap-1">
                    {VARIAVEIS_GARANTIA.map((v) => (
                      <button
                        key={v.tag}
                        type="button"
                        title={v.descricao}
                        onClick={() => inserirVariavel(v.tag)}
                        className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] hover:bg-muted/70"
                      >
                        {v.tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Prévia com dados de exemplo</Label>
                <pre className="min-h-[300px] max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-dashed bg-background p-3 font-mono text-[11px] leading-relaxed">
                  {previa}
                </pre>
              </div>
            </div>

            {divergentes.length > 0 && (
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  O texto fala em {divergentes.map((d) => `"${d.trecho}"`).join(", ")}, mas o prazo desta garantia é{" "}
                  <b>{rascunho.meses > 0 ? rotuloPrazo(rascunho.meses) : "sem garantia"}</b>. Prefira{" "}
                  <code className="font-mono">{"{{garantia_meses}}"}</code> no texto.
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={rascunho.ativo} onCheckedChange={(ativo) => alterar({ ativo })} />
                Ativa (aparece para escolher na venda)
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRascunho(null)} disabled={gravando}>Cancelar</Button>
                <Button onClick={() => salvar()} disabled={gravando}>
                  {gravando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
                </Button>
              </div>
            </div>
          </div>
        )}

        <AlertDialog open={confirmarDivergencia} onOpenChange={setConfirmarDivergencia}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Prazo diferente no texto</AlertDialogTitle>
              <AlertDialogDescription>
                O texto menciona um prazo diferente do prazo da garantia. O cliente pode ler um prazo e o recibo mostrar outro. Salvar mesmo assim?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Revisar o texto</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setConfirmarDivergencia(false); void salvar(true); }}>Salvar mesmo assim</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!paraExcluir} onOpenChange={(a) => !a && setParaExcluir(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir "{paraExcluir?.nome}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Ela sai da lista. Vendas antigas não mudam: cada venda guarda a própria cópia do termo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  const g = paraExcluir;
                  setParaExcluir(null);
                  if (g) void executar({ tipo: "excluir", chave: g.chave, agora: new Date().toISOString() }, "Garantia excluída");
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

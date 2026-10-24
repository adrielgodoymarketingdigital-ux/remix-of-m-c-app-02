import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  CATEGORIAS,
  type Categoria,
  categoriasParaEnviar,
  contagemAmigavel,
  type Contadores,
  type Escolha,
  expandirEscolha,
  type Inclusao,
  linhasPorTabela,
  linhasResumo,
  mensagemErro,
  type MensagemErro,
  PALAVRA_CONFIRMACAO,
  podeConfirmar,
  ROTULOS_COTA,
  textosNumeracao,
  TITULO_CATEGORIA,
} from "@/lib/comecarDoZero/regras";

/** Formato devolvido por zerar_meus_dados_previa (etapa 1). */
interface Previa {
  pode_usar: boolean;
  codigo?: string | null;
  motivo?: string | null;
  categorias_efetivas?: Categoria[];
  incluidas_automaticamente?: Inclusao[];
  resumo?: Partial<Record<Categoria, Record<string, number>>>;
  tabelas?: Record<string, number>;
  avisos?: { codigo: string; quantidade: number | null; texto: string }[];
  contadores?: Contadores;
  proxima_execucao_em?: string | null;
  impressao?: string;
}
/** Formato devolvido por zerar_meus_dados_executar (etapas 1 e 3a). */
interface Resultado {
  execucao_id: string;
  categorias_efetivas: Categoria[];
  apagados: Record<string, number>;
  contador_os_zerado: boolean;
  contador_venda_zerado: boolean;
  onboarding_reexibido: boolean;
  arquivos_na_fila: number;
  fantasmas_cota?: Record<string, number>;
}
type SituacaoFotos = "sem_fotos" | "removendo" | "removidas" | "em_segundo_plano";

const PASSOS = ["Escolher", "Revisar", "Confirmar"] as const;
const MAX_CHAMADAS_FOTOS = 10;

function Indicador({ passo }: { passo: number }) {
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label={`Passo ${passo} de 3`}>
      {PASSOS.map((nome, i) => (
        <li key={nome} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
              i + 1 === passo ? "border-destructive bg-destructive text-destructive-foreground"
                : i + 1 < passo ? "border-destructive/40 text-destructive" : "border-muted-foreground/30 text-muted-foreground",
            )}
            aria-current={i + 1 === passo ? "step" : undefined}
          >
            {i + 1}
          </span>
          <span className={cn(i + 1 === passo ? "font-medium text-foreground" : "text-muted-foreground")}>{nome}</span>
          {i < PASSOS.length - 1 && <span className="h-px w-4 bg-border" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

function CaixaErro({ erro }: { erro: MensagemErro }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="font-medium text-destructive">{erro.titulo}</p>
      <p className="mt-1 text-muted-foreground">{erro.texto}</p>
    </div>
  );
}

const SEM_VOLTA = "Isso NÃO tem volta. Se quiser guardar seus dados, exporte antes.";
/** Avisos da prévia que a tela já mostra com o próprio texto (sem volta e numeração). */
const AVISOS_DA_TELA = new Set(["sem_volta", "contador_os", "contador_venda"]);

interface Props {
  /** Fecha o diálogo/drawer (bloqueado enquanto apaga). */
  onFechar: () => void;
  /** Fecha e leva até o card de exportação. */
  onIrParaExportacao: () => void;
  /** Informa se está apagando (para impedir fechar no meio). */
  onExecutandoChange: (executando: boolean) => void;
}

export function FluxoComecarDoZero({ onFechar, onIrParaExportacao, onExecutandoChange }: Props) {
  const queryClient = useQueryClient();
  const [passo, setPasso] = useState<1 | 2 | 3 | "feito">(1);
  const [escolhidas, setEscolhidas] = useState<Escolha[]>([]);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [previaDe, setPreviaDe] = useState<string | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [erroPrevia, setErroPrevia] = useState<MensagemErro | null>(null);
  const [senha, setSenha] = useState("");
  const [palavra, setPalavra] = useState("");
  const [executando, setExecutando] = useState(false);
  const [erroExec, setErroExec] = useState<MensagemErro | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [fotos, setFotos] = useState<SituacaoFotos | null>(null);
  const emAndamento = useRef(false);

  const enviar = useMemo(() => categoriasParaEnviar(escolhidas), [escolhidas]);
  const chave = enviar.join(",");
  const { efetivas, tudo, incluidas } = useMemo(() => expandirEscolha(escolhidas), [escolhidas]);
  const revisaoValida = !!previa?.pode_usar && !previa.proxima_execucao_em && !!previa.impressao && previaDe === chave;

  useEffect(() => onExecutandoChange(executando), [executando, onExecutandoChange]);

  const alternar = (id: Escolha, marcar: boolean) =>
    setEscolhidas((atual) => (marcar ? [...atual.filter((e) => e !== id), id] : atual.filter((e) => e !== id)));

  const carregarPrevia = async () => {
    setCarregandoPrevia(true);
    setErroPrevia(null);
    setPrevia(null);
    try {
      const { data, error } = await supabase.rpc("zerar_meus_dados_previa", { p_categorias: enviar });
      if (error) throw error;
      // Formato definido pela função do banco (etapa 1).
      setPrevia(data as unknown as Previa);
      setPreviaDe(chave);
    } catch (e) {
      setErroPrevia(mensagemErro(e));
    } finally {
      setCarregandoPrevia(false);
    }
  };

  const irParaRevisao = () => {
    setPasso(2);
    // Mudou a seleção (ou ainda não há prévia): refaz e guarda a impressão nova.
    if (previaDe !== chave || !previa) void carregarPrevia();
  };

  const processarFotos = async (execucaoId: string, total: number) => {
    if (total === 0) { setFotos("sem_fotos"); return; }
    setFotos("removendo");
    try {
      for (let i = 0; i < MAX_CHAMADAS_FOTOS; i++) {
        const { data, error } = await supabase.functions.invoke("zerar-dados-storage", { body: { execucao_id: execucaoId } });
        if (error) throw error;
        if ((data as { concluido?: boolean } | null)?.concluido) { setFotos("removidas"); return; }
      }
      setFotos("em_segundo_plano");
    } catch {
      // As fotos ficam na fila e são tentadas de novo depois; nada a fazer na tela.
      setFotos("em_segundo_plano");
    }
  };

  const apagar = async () => {
    if (emAndamento.current || !podeConfirmar({ revisaoValida, senha, palavra, executando })) return;
    emAndamento.current = true;
    setExecutando(true);
    setErroExec(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw { code: "ZD000" };
      // Login por senha recente: a função do banco exige (amr < 10 min).
      const { error: erroSenha } = await supabase.auth.signInWithPassword({ email: user.email, password: senha });
      if (erroSenha) throw erroSenha;
      const { data, error } = await supabase.rpc("zerar_meus_dados_executar", {
        p_categorias: enviar,
        p_confirmacao: palavra,
        p_impressao: previa!.impressao!,
      });
      if (error) throw error;
      const r = data as unknown as Resultado;
      setSenha("");
      setResultado(r);
      setPasso("feito");
      try { localStorage.removeItem("pdv_entrada_troca_pendente"); } catch { /* navegador sem localStorage */ }
      void queryClient.invalidateQueries();
      void processarFotos(r.execucao_id, r.arquivos_na_fila);
    } catch (e) {
      const m = mensagemErro(e);
      setErroExec(m);
      if (m.refazerRevisao) { setPrevia(null); setPreviaDe(null); }
    } finally {
      setExecutando(false);
      emAndamento.current = false;
    }
  };

  // ---------------- passo 1 ----------------
  if (passo === 1) {
    return (
      <div className="flex flex-col gap-4">
        <Indicador passo={1} />
        <div role="note" className="flex gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="space-y-2">
            <p className="font-semibold text-destructive">{SEM_VOLTA}</p>
            <Button type="button" variant="outline" size="sm" onClick={onIrParaExportacao}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Exportar meus dados antes
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Escolha o que apagar:</p>
        <ul className="flex flex-col gap-2">
          {CATEGORIAS.map((c) => {
            const marcadaPeloTudo = tudo && c.id !== "tudo";
            const inclusao = c.id !== "tudo" ? incluidas.find((i) => i.categoria === c.id) : undefined;
            const marcada = escolhidas.includes(c.id) || marcadaPeloTudo || !!inclusao;
            const travada = marcadaPeloTudo || (!!inclusao && !escolhidas.includes(c.id));
            const idCampo = `zerar-${c.id}`;
            return (
              <li key={c.id} className={cn("rounded-lg border p-3", marcada && "border-destructive/50 bg-destructive/5", c.id === "tudo" && "border-dashed")}>
                <div className="flex items-start gap-3">
                  <Checkbox id={idCampo} checked={marcada} disabled={travada}
                    onCheckedChange={(v) => alternar(c.id, v === true)} className="mt-0.5" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor={idCampo} className="font-medium">{c.titulo}</Label>
                    <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Apaga:</span> {c.apaga}</p>
                    <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Fica:</span> {c.fica}</p>
                    {c.aviso && <p className="text-xs font-medium text-amber-600 dark:text-amber-500">{c.aviso}</p>}
                    {inclusao && !escolhidas.includes(c.id) && (
                      <p className="text-xs font-medium text-destructive">
                        Entra junto porque você marcou {TITULO_CATEGORIA[inclusao.por_causa_de]}: {inclusao.motivo}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button type="button" variant="destructive" disabled={efetivas.length === 0} onClick={irParaRevisao}>Continuar</Button>
        </div>
      </div>
    );
  }

  // ---------------- passo 2 ----------------
  if (passo === 2) {
    const ef = previa?.categorias_efetivas ?? efetivas;
    return (
      <div className="flex flex-col gap-4">
        <Indicador passo={2} />
        {carregandoPrevia && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Contando o que será apagado…
          </p>
        )}
        {erroPrevia && (
          <div className="space-y-2">
            <CaixaErro erro={erroPrevia} />
            <Button type="button" variant="outline" size="sm" onClick={() => void carregarPrevia()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Tentar de novo
            </Button>
          </div>
        )}
        {previa && !previa.pode_usar && (
          <CaixaErro erro={{ titulo: "Não é possível apagar nesta conta", texto: `${previa.motivo ?? "Sua conta não pode usar este recurso."} Nada foi apagado.` }} />
        )}
        {previa?.pode_usar && (
          <>
            {previa.proxima_execucao_em && (
              <CaixaErro erro={{
                titulo: "Aguarde alguns minutos",
                texto: `Você acabou de apagar dados. Poderá fazer de novo a partir das ${new Date(previa.proxima_execucao_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
              }} />
            )}
            <p className="text-sm font-medium">Será apagado de vez:</p>
            <ul className="flex flex-col gap-2">
              {ef.map((c) => {
                const linhas = linhasResumo(c, previa.resumo?.[c]);
                const inclusao = previa.incluidas_automaticamente?.find((i) => i.categoria === c);
                return (
                  <li key={c} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">
                      {TITULO_CATEGORIA[c]}
                      {inclusao && <span className="ml-2 text-xs font-normal text-destructive">(entra junto com {TITULO_CATEGORIA[inclusao.por_causa_de]})</span>}
                    </p>
                    <p className="mt-1 text-muted-foreground">{linhas.length ? linhas.join(" · ") : "Nada para apagar aqui."}</p>
                  </li>
                );
              })}
            </ul>
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
                <ChevronDown className="h-3 w-3" aria-hidden="true" /> Ver o detalhe de tudo que será apagado
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                  {linhasPorTabela(previa.tabelas).map((l) => <li key={l}>{l}</li>)}
                </ul>
              </CollapsibleContent>
            </Collapsible>
            <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              {(previa.avisos ?? []).filter((a) => !AVISOS_DA_TELA.has(a.codigo)).map((a) => <p key={a.codigo}>• {a.texto}</p>)}
              {textosNumeracao(ef, previa.contadores).map((t) => <p key={t}>• {t}</p>)}
              <p>• As fotos e documentos ligados ao que for apagado também são removidos, em segundo plano, em alguns minutos. A quantidade aparece no final.</p>
              <p>• As cópias de segurança automáticas do sistema guardam os dados por até 365 dias e não são apagadas agora.</p>
            </div>
          </>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setPasso(1)}>Voltar</Button>
          <Button type="button" variant="destructive" disabled={!revisaoValida || carregandoPrevia} onClick={() => { setErroExec(null); setPasso(3); }}>
            Continuar
          </Button>
        </div>
      </div>
    );
  }

  // ---------------- passo 3 ----------------
  if (passo === 3) {
    const liberado = podeConfirmar({ revisaoValida, senha, palavra, executando });
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => { e.preventDefault(); void apagar(); }}
      >
        <Indicador passo={3} />
        <p className="text-sm font-semibold text-destructive">{SEM_VOLTA}</p>
        <p className="text-sm text-muted-foreground">
          Vai apagar: {(previa?.categorias_efetivas ?? efetivas).map((c) => TITULO_CATEGORIA[c]).join(", ")}.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="zerar-senha">Sua senha</Label>
          <Input id="zerar-senha" type="password" autoComplete="current-password" value={senha}
            onChange={(e) => setSenha(e.target.value)} disabled={executando} />
          <p className="text-xs text-muted-foreground">Por segurança, confirmamos que é você.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zerar-palavra">Digite {PALAVRA_CONFIRMACAO} para confirmar</Label>
          <Input id="zerar-palavra" value={palavra} onChange={(e) => setPalavra(e.target.value)} autoComplete="off"
            autoCapitalize="characters" spellCheck={false} placeholder={PALAVRA_CONFIRMACAO} disabled={executando} />
        </div>
        {erroExec && <CaixaErro erro={erroExec} />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={executando}
            onClick={() => { setErroExec(null); irParaRevisao(); }}>
            Voltar
          </Button>
          <Button type="submit" variant="destructive" disabled={!liberado}>
            {executando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Apagando…</> : "Apagar definitivamente"}
          </Button>
        </div>
      </form>
    );
  }

  // ---------------- feito ----------------
  const r = resultado!;
  const cota = Object.entries(r.fantasmas_cota ?? {}).filter(([, n]) => n > 0)
    .map(([t, n]) => contagemAmigavel(n, ROTULOS_COTA[t] ?? [t, t]));
  const textoFotos: Record<SituacaoFotos, string> = {
    sem_fotos: "Não havia fotos ou documentos para remover.",
    removendo: `Removendo ${contagemAmigavel(r.arquivos_na_fila, ["foto ou documento", "fotos e documentos"])}…`,
    removidas: `${contagemAmigavel(r.arquivos_na_fila, ["foto ou documento removido", "fotos e documentos removidos"])}.`,
    em_segundo_plano: `${contagemAmigavel(r.arquivos_na_fila, ["foto ou documento", "fotos e documentos"])} serão removidos em segundo plano nos próximos minutos.`,
  };
  return (
    <div className="flex flex-col gap-4" role="status">
      <div className="flex items-center gap-2 text-base font-semibold">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /> Pronto. Os dados foram apagados.
      </div>
      <div className="rounded-lg border p-3 text-sm">
        <p className="font-medium">Apagado: {r.categorias_efetivas.map((c) => TITULO_CATEGORIA[c]).join(", ")}</p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {linhasPorTabela(r.apagados).map((l) => <li key={l}>{l}</li>)}
        </ul>
      </div>
      <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
        {fotos && <p>• {textoFotos[fotos]}</p>}
        {textosNumeracao(r.categorias_efetivas, previa?.contadores).map((t) => <p key={t}>• {t}</p>)}
        {r.onboarding_reexibido && <p>• Os Primeiros Passos voltam a aparecer no início.</p>}
        {cota.length > 0 && <p>• Continuam contando no limite do seu plano, como antes: {cota.join(", ")}.</p>}
      </div>
      <p className="text-sm">Recarregue a página para ver tudo atualizado.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onFechar}>Fechar</Button>
        <Button type="button" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Recarregar a página
        </Button>
      </div>
    </div>
  );
}

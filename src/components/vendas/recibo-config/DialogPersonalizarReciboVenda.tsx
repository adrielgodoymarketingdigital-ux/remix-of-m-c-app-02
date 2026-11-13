/**
 * Diálogo "Personalizar recibo de venda": interruptores e textos do recibo de
 * venda A4 (novo), com prévia ao vivo. Carregado sob demanda
 * (AcessoPersonalizarReciboVenda) e só para quem vê o recibo novo.
 *
 * - Editor à esquerda e prévia à direita no computador (>= 1024px); abas
 *   "Editar" / "Prévia" abaixo disso.
 * - Só o dono edita (useReciboVendaConfig.podeEditar); os demais veem a
 *   prévia, com o motivo traduzido aqui.
 * - Um Salvar só; "Restaurar padrão" mexe só no rascunho.
 * - A prévia desenha o ReciboVendaNovo de hoje SEM alterá-lo: o modelo vem de
 *   montarReciboVenda(exemplo, rascunho); o que o componente ainda não sabe
 *   desenhar (assinaturas/rodapé desligados e os textos novos) fica num aviso.
 */
import { useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, Info, Loader2, Lock, RotateCcw } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsDesktop } from "@/hooks/use-mobile";
import { useReciboVendaConfig } from "@/hooks/useReciboVendaConfig";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { cn } from "@/lib/utils";
import { ReciboVendaNovoSeguro } from "@/components/vendas/recibo-novo/ReciboVendaNovoSeguro";
import { cssReciboVendaNovo } from "@/components/vendas/recibo-novo/cssReciboVendaNovo";
import { MODELOS_PADRAO_GARANTIA } from "@/components/dispositivos/DialogConfiguracaoTermoGarantiaDispositivo";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import {
  type CampoTextoReciboVenda,
  type InterruptorReciboVenda,
  normalizarReciboVendaConfig,
  type ReciboVendaConfig,
  reciboVendaConfigPadrao,
} from "@/lib/vendas/reciboVendaConfig";
import {
  contarTextoRecibo,
  GRUPOS_INTERRUPTORES_RECIBO_VENDA,
  haAlteracoesReciboVendaConfig,
  itensForaDaPrevia,
  modeloDesenhavelNaPrevia,
  rascunhoEhPadraoReciboVenda,
  SEMPRE_APARECE_RECIBO_VENDA,
  textosPassandoDoLimite,
} from "@/lib/vendas/reciboVendaConfigTela";
import { entradaExemploRecibo, EXEMPLOS_RECIBO_VENDA, type IdExemploReciboVenda } from "@/lib/vendas/reciboVendaExemplo";
import {
  type EntradaReciboVenda,
  type LojaReciboEntrada,
  type ModeloTermoEntrada,
  montarReciboVenda,
  type ReciboVendaModelo,
  type TermoConfigEntrada,
} from "@/lib/vendas/reciboVendaModelo";

export interface DialogPersonalizarReciboVendaProps {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
}

/** Mesma regra do kitReciboNovo (termoDaLoja): modelos salvos da loja ou os padrão. */
function termoDaLoja(config: ConfiguracaoLoja | null): EntradaReciboVenda["termo"] {
  const termo = (config?.termo_garantia_dispositivo_config ?? null) as (TermoConfigEntrada & { modelos?: ModeloTermoEntrada[] }) | null;
  return {
    config: termo,
    modelos: termo?.modelos?.length ? termo.modelos : (MODELOS_PADRAO_GARANTIA as ModeloTermoEntrada[]),
  };
}

const LARGURA_RECIBO = 850;
// Intl.ListFormat ("a, b e c" / "a, b y c"): a lib do TypeScript do projeto ainda não declara.
const ListFormat = (Intl as unknown as {
  ListFormat?: new (idioma: string, opcoes: { style: "long"; type: "conjunction" }) => { format(itens: string[]): string };
}).ListFormat;
// Assinaturas/rodapé desligados: o componente de hoje ainda desenha os blocos (vazios); a prévia esconde.
const CSS_PREVIA = `
.prc-sem-assinaturas .rvn-assinaturas, .prc-sem-rodape .rvn-rodape { display: none !important; }
`;

const CAMPOS_EM_ORDEM: { campo: CampoTextoReciboVenda; linhas: number }[] = [
  { campo: "topo", linhas: 3 },
  { campo: "agradecimento", linhas: 1 },
  { campo: "frase_rodape", linhas: 2 },
  { campo: "observacoes", linhas: 5 },
  { campo: "politica_troca", linhas: 5 },
];

function copia(cfg: ReciboVendaConfig): ReciboVendaConfig {
  return { versao: cfg.versao, mostrar: { ...cfg.mostrar }, textos: { ...cfg.textos } };
}

export default function DialogPersonalizarReciboVenda({ open, onOpenChange }: DialogPersonalizarReciboVendaProps) {
  const { t } = useTranslation("configuracoes");
  const isDesktop = useIsDesktop();
  const { isProprietario, empresaAtiva } = useEmpresa();
  // Mesma loja que a tela de Configurações edita (null = matriz).
  const empresaId = isProprietario ? empresaAtiva : null;
  const { reciboConfig, configLoja, carregando, podeEditar, motivo, salvando, salvar } = useReciboVendaConfig(empresaId);

  const [base, setBase] = useState<ReciboVendaConfig>(reciboVendaConfigPadrao);
  const [rascunho, setRascunho] = useState<ReciboVendaConfig>(reciboVendaConfigPadrao);
  const [iniciado, setIniciado] = useState(false);
  const [exemplo, setExemplo] = useState<IdExemploReciboVenda>("com-garantia");
  const [aba, setAba] = useState("editar");
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);

  // Foco devolvido ao fechar: o Radix devolve ao Dialog.Trigger, que este diálogo (aberto por
  // estado) não tem. Guarda quem tinha o foco ao abrir; se era um item de menu (que some com o
  // menu), guarda o botão que abriu o menu (o menu do Radix aponta para ele em aria-labelledby).
  const origemFoco = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const ativo = document.activeElement as HTMLElement | null;
    const menu = ativo?.closest<HTMLElement>("[role=menu]");
    const botaoDoMenu = menu?.getAttribute("aria-labelledby") ? document.getElementById(menu.getAttribute("aria-labelledby") as string) : null;
    origemFoco.current = botaoDoMenu ?? (ativo && ativo !== document.body ? ativo : null);
  }, [open]);

  // Abre sempre a partir do que está salvo (depois que a configuração chega).
  useEffect(() => {
    if (!open) {
      setIniciado(false);
      return;
    }
    if (iniciado || carregando) return;
    setBase(copia(reciboConfig));
    setRascunho(copia(reciboConfig));
    setAba("editar");
    setIniciado(true);
  }, [open, iniciado, carregando, reciboConfig]);

  const alterado = podeEditar && iniciado && haAlteracoesReciboVendaConfig(base, rascunho);
  const passaram = textosPassandoDoLimite(rascunho);
  const podeSalvar = podeEditar && alterado && passaram.length === 0 && !salvando;
  const podeRestaurar = podeEditar && iniciado && !rascunhoEhPadraoReciboVenda(rascunho) && !salvando;

  const mudarInterruptor = (k: InterruptorReciboVenda, v: boolean) => setRascunho((r) => ({ ...r, mostrar: { ...r.mostrar, [k]: v } }));
  const mudarTexto = (k: CampoTextoReciboVenda, v: string) => setRascunho((r) => ({ ...r, textos: { ...r.textos, [k]: v } }));

  const aoSalvar = async () => {
    if (!podeSalvar) return;
    const resultado = await salvar(rascunho);
    if (resultado.ok === true) {
      const salvo = normalizarReciboVendaConfig(rascunho);
      setBase(salvo);
      setRascunho(copia(salvo));
    }
  };

  const pedirFechar = (aberto: boolean) => {
    if (!aberto && alterado) {
      setConfirmarDescarte(true);
      return;
    }
    onOpenChange(aberto);
  };

  // Prévia: segue o rascunho sem travar a digitação.
  const rascunhoPrevia = useDeferredValue(rascunho);
  const termo = useMemo(() => termoDaLoja(configLoja), [configLoja]);
  const modelo = useMemo<ReciboVendaModelo | null>(() => {
    try {
      const entrada = entradaExemploRecibo(exemplo, {
        loja: (configLoja as LojaReciboEntrada | null) ?? null,
        termo,
        origemApp: window.location.origin,
      });
      return montarReciboVenda(entrada, rascunhoPrevia);
    } catch (erro) {
      console.error("[personalizar recibo] falha ao montar a prévia", erro);
      return null;
    }
  }, [exemplo, configLoja, termo, rascunhoPrevia]);

  const somenteLeitura = !podeEditar;
  const avisoPermissao = !carregando && somenteLeitura ? t(`reciboVenda.permissao.${motivo}`) : null;

  const editor = (
    <Editor
      rascunho={rascunho}
      desabilitado={somenteLeitura || !iniciado}
      carregando={carregando || !iniciado}
      onInterruptor={mudarInterruptor}
      onTexto={mudarTexto}
    />
  );
  const previa = (
    <Previa modelo={modelo} carregando={carregando} exemplo={exemplo} onExemplo={setExemplo} reduzida={isDesktop} />
  );

  return (
    <>
      <Dialog open={open} onOpenChange={pedirFechar}>
        <DialogContent
          className="flex flex-col gap-0 overflow-hidden p-0 focus:outline-none sm:h-[90vh] sm:w-[calc(100vw-2rem)] sm:max-w-[1180px] sm:p-0"
          data-testid="dialog-personalizar-recibo"
          // Foco no próprio diálogo ao abrir (o título é lido); o Tab segue do primeiro interruptor.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus();
          }}
          onCloseAutoFocus={(e) => {
            const origem = origemFoco.current;
            if (origem?.isConnected) {
              e.preventDefault();
              origem.focus();
            }
          }}
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-4 pr-12 text-left sm:px-6">
            <DialogTitle className="text-lg font-bold">{t("reciboVenda.titulo")}</DialogTitle>
            <DialogDescription className="flex items-start gap-2 text-[13px]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{t("reciboVenda.aviso")}</span>
            </DialogDescription>
          </DialogHeader>

          {avisoPermissao && (
            <div
              role="status"
              className="mx-4 mt-3 flex shrink-0 items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 sm:mx-6"
            >
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{avisoPermissao}</span>
            </div>
          )}

          {isDesktop ? (
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-h-0 overflow-y-auto px-6 py-5">{editor}</div>
              <div className="min-h-0 overflow-y-auto border-l bg-muted/40 px-6 py-5">{previa}</div>
            </div>
          ) : (
            <Tabs value={aba} onValueChange={setAba} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-4 mt-3 grid shrink-0 grid-cols-2" aria-label={t("reciboVenda.abasRotulo")}>
                <TabsTrigger value="editar">{t("reciboVenda.abaEditar")}</TabsTrigger>
                <TabsTrigger value="previa">{t("reciboVenda.abaPrevia")}</TabsTrigger>
              </TabsList>
              <TabsContent value="editar" className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {editor}
              </TabsContent>
              <TabsContent value="previa" className="mt-0 min-h-0 flex-1 overflow-y-auto bg-muted/40 px-4 py-4">
                {previa}
              </TabsContent>
            </Tabs>
          )}

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Button type="button" variant="outline" onClick={() => setRascunho(reciboVendaConfigPadrao())} disabled={!podeRestaurar}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("reciboVenda.restaurar")}
            </Button>
            <Button type="button" onClick={aoSalvar} disabled={!podeSalvar} aria-busy={salvando || undefined}>
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="mr-2 h-4 w-4" aria-hidden="true" />}
              {salvando ? t("reciboVenda.salvando") : t("reciboVenda.salvar")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarDescarte} onOpenChange={setConfirmarDescarte}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("reciboVenda.descartar.titulo")}</AlertDialogTitle>
            <AlertDialogDescription>{t("reciboVenda.descartar.descricao")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("reciboVenda.descartar.continuar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmarDescarte(false);
                onOpenChange(false);
              }}
            >
              {t("reciboVenda.descartar.confirmar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────

function Editor(p: {
  rascunho: ReciboVendaConfig;
  desabilitado: boolean;
  carregando: boolean;
  onInterruptor: (k: InterruptorReciboVenda, v: boolean) => void;
  onTexto: (k: CampoTextoReciboVenda, v: string) => void;
}) {
  const { t } = useTranslation("configuracoes");
  const id = useId();

  if (p.carregando) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("reciboVenda.carregando")}
      </p>
    );
  }

  return (
    <fieldset disabled={p.desabilitado} className="min-w-0 space-y-7">
      <section aria-labelledby={`${id}-mostrar`} className="space-y-3">
        <div>
          <h3 id={`${id}-mostrar`} className="text-base font-bold">
            {t("reciboVenda.mostrarTitulo")}
          </h3>
          <p className="text-[13px] text-muted-foreground">{t("reciboVenda.mostrarDescricao")}</p>
        </div>

        {GRUPOS_INTERRUPTORES_RECIBO_VENDA.map((g) => (
          <fieldset key={g.id} className="rounded-xl border bg-card px-3 pb-1 pt-1">
            <legend className="px-1 text-[13px] font-semibold text-muted-foreground">{t(`reciboVenda.grupos.${g.id}`)}</legend>
            <div className="divide-y">
              {g.interruptores.map((k) => {
                const dica = t(`reciboVenda.dicas.${k}`);
                const idCampo = `${id}-sw-${k}`;
                return (
                  <div key={k} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Label htmlFor={idCampo} className="cursor-pointer text-sm font-medium leading-snug">
                        {t(`reciboVenda.interruptores.${k}`)}
                      </Label>
                      {dica && (
                        <p id={`${idCampo}-dica`} className="mt-0.5 text-xs leading-snug text-muted-foreground">
                          {dica}
                        </p>
                      )}
                    </div>
                    <Switch
                      id={idCampo}
                      checked={p.rascunho.mostrar[k]}
                      onCheckedChange={(v) => p.onInterruptor(k, v)}
                      disabled={p.desabilitado}
                      aria-describedby={dica ? `${idCampo}-dica` : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="rounded-xl bg-muted/60 px-3 py-3">
          <h4 className="text-[13px] font-semibold">{t("reciboVenda.sempreApareceTitulo")}</h4>
          <ul className="mt-1.5 grid gap-1 text-[13px] text-muted-foreground sm:grid-cols-2">
            {SEMPRE_APARECE_RECIBO_VENDA.map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                {t(`reciboVenda.sempreAparece.${k}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby={`${id}-textos`} className="space-y-4">
        <div>
          <h3 id={`${id}-textos`} className="text-base font-bold">
            {t("reciboVenda.textosTitulo")}
          </h3>
          <p className="text-[13px] text-muted-foreground">{t("reciboVenda.textosDescricao")}</p>
        </div>
        {CAMPOS_EM_ORDEM.map(({ campo, linhas }) => (
          <CampoTexto
            key={campo}
            idBase={`${id}-tx-${campo}`}
            campo={campo}
            linhasVisiveis={linhas}
            valor={p.rascunho.textos[campo]}
            desabilitado={p.desabilitado}
            onMudar={(v) => p.onTexto(campo, v)}
          />
        ))}
      </section>
    </fieldset>
  );
}

function CampoTexto(p: {
  idBase: string;
  campo: CampoTextoReciboVenda;
  linhasVisiveis: number;
  valor: string;
  desabilitado: boolean;
  onMudar: (v: string) => void;
}) {
  const { t } = useTranslation("configuracoes");
  const c = contarTextoRecibo(p.campo, p.valor);
  const umaLinha = c.maxLinhas === 1;
  const idDica = `${p.idBase}-dica`;
  const idContador = `${p.idBase}-contador`;
  const idErro = `${p.idBase}-erro`;
  const descritores = [idDica, idContador, c.passou ? idErro : null].filter(Boolean).join(" ");
  const comum = {
    id: p.idBase,
    value: p.valor,
    disabled: p.desabilitado,
    "aria-describedby": descritores,
    "aria-invalid": c.passou || undefined,
    className: cn(c.passou && "border-destructive focus-visible:ring-destructive"),
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={p.idBase} className="text-sm font-medium">
        {t(`reciboVenda.campos.${p.campo}`)}
      </Label>
      <p id={idDica} className="text-xs text-muted-foreground">
        {t(`reciboVenda.dicasCampos.${p.campo}`)}
      </p>
      {umaLinha ? (
        <Input {...comum} onChange={(e) => p.onMudar(e.target.value)} />
      ) : (
        <Textarea {...comum} rows={p.linhasVisiveis} onChange={(e) => p.onMudar(e.target.value)} />
      )}
      <p id={idContador} className={cn("text-right text-xs tabular-nums", c.passou ? "font-medium text-destructive" : "text-muted-foreground")}>
        {umaLinha
          ? t("reciboVenda.contadorUmaLinha", { caracteres: c.caracteres, maxCaracteres: c.maxCaracteres })
          : t("reciboVenda.contador", { caracteres: c.caracteres, maxCaracteres: c.maxCaracteres, linhas: c.linhas, maxLinhas: c.maxLinhas })}
      </p>
      {c.passou && (
        <p id={idErro} className="text-xs font-medium text-destructive" role="alert">
          {t("reciboVenda.passouLimite")}
        </p>
      )}
    </div>
  );
}

// ── Prévia ──────────────────────────────────────────────────────────────────

function Previa(p: {
  modelo: ReciboVendaModelo | null;
  carregando: boolean;
  exemplo: IdExemploReciboVenda;
  onExemplo: (e: IdExemploReciboVenda) => void;
  reduzida: boolean;
}) {
  const { t, i18n } = useTranslation("configuracoes");
  const id = useId();
  // Se o recibo quebrar ao desenhar este modelo: aviso; o próximo modelo tenta de novo (instância nova).
  const [falhou, setFalhou] = useState<{ modelo: ReciboVendaModelo | null; tentativa: number }>({ modelo: null, tentativa: 0 });
  const fora = p.modelo ? itensForaDaPrevia(p.modelo) : [];
  const nomesFora = fora.map((k) => t(`reciboVenda.itensForaDaPrevia.${k}`));
  let lista = nomesFora.join(", ");
  try {
    if (ListFormat) lista = new ListFormat(i18n.language, { style: "long", type: "conjunction" }).format(nomesFora);
  } catch {
    // Idioma não suportado: fica a lista com vírgulas.
  }

  const desenhavel = p.modelo ? modeloDesenhavelNaPrevia(p.modelo) : null;
  const classes = cn(p.modelo?.assinaturas === null && "prc-sem-assinaturas", p.modelo?.rodape === null && "prc-sem-rodape");

  let recibo: ReactNode;
  if (p.carregando) {
    recibo = (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("reciboVenda.carregando")}
      </p>
    );
  } else if (!desenhavel || falhou.modelo === p.modelo) {
    recibo = <p className="text-sm text-muted-foreground">{t("reciboVenda.previaFalhou")}</p>;
  } else {
    const conteudo = (
      <div className={classes} data-testid="previa-recibo">
        <ReciboVendaNovoSeguro
          key={`${p.exemplo}-${falhou.tentativa}`}
          modelo={desenhavel}
          onFalha={() => setFalhou((f) => ({ modelo: p.modelo, tentativa: f.tentativa + 1 }))}
        />
      </div>
    );
    recibo = p.reduzida ? <Reduzido>{conteudo}</Reduzido> : conteudo;
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-3">
      <style>{cssReciboVendaNovo() + CSS_PREVIA}</style>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${id}-titulo`} className="text-base font-bold">
            {t("reciboVenda.previaRotulo")}
          </h3>
          <p className="text-[13px] text-muted-foreground">{t("reciboVenda.previaDescricao")}</p>
        </div>
        <div className="w-full space-y-1 sm:w-56">
          <Label htmlFor={`${id}-exemplo`} className="text-xs font-medium">
            {t("reciboVenda.exemploRotulo")}
          </Label>
          <Select value={p.exemplo} onValueChange={(v) => p.onExemplo(v as IdExemploReciboVenda)}>
            <SelectTrigger id={`${id}-exemplo`} className="h-9 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXEMPLOS_RECIBO_VENDA.map((e) => (
                <SelectItem key={e} value={e}>
                  {t(`reciboVenda.exemplos.${e}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {fora.length > 0 && !p.carregando && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground" data-testid="aviso-fora-da-previa">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t("reciboVenda.foraDaPrevia", { itens: lista })}</span>
        </p>
      )}

      {recibo}
    </section>
  );
}

/** Recibo em tamanho real (850px) reduzido para caber na coluna da prévia. */
function Reduzido({ children }: { children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState({ largura: 0, altura: 0 });

  useLayoutEffect(() => {
    const medir = () =>
      setMedidas({ largura: caixa.current?.clientWidth ?? 0, altura: conteudo.current?.offsetHeight ?? 0 });
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    if (caixa.current) ro.observe(caixa.current);
    if (conteudo.current) ro.observe(conteudo.current);
    return () => ro.disconnect();
  }, []);

  const escala = medidas.largura ? Math.min(1, medidas.largura / LARGURA_RECIBO) : 0.5;
  return (
    <div ref={caixa} className="relative w-full overflow-hidden" style={{ height: medidas.altura ? Math.ceil(medidas.altura * escala) : undefined }}>
      <div ref={conteudo} style={{ width: LARGURA_RECIBO, transform: `scale(${escala})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ExternalLink, Info, Loader2, RotateCcw, Save, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { buscarConfiguracaoLojaPorEmpresa } from "@/hooks/useConfiguracaoLoja";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import {
  CHAVE_ATIVO_AVALIACAO,
  CHAVE_LINK_AVALIACAO,
  CHAVE_MENSAGEM_AVALIACAO,
  MENSAGEM_AVALIACAO_PADRAO,
  VARIAVEIS_AVALIACAO,
  lerConfigAvaliacaoGoogle,
  montarMensagemAvaliacao,
  validarLinkAvaliacaoGoogle,
} from "@/lib/marketing/avaliacaoGoogle";

interface CardConfigAvaliacaoGoogleProps {
  config: ConfiguracaoLoja | null;
  atualizarConfiguracao: (dados: Partial<ConfiguracaoLoja>) => Promise<boolean>;
  /** Recarrega a configuração depois de salvar. */
  aoSalvar: () => Promise<void> | void;
}

const LINK_EXEMPLO = "https://g.page/r/sua-loja/review";

export function CardConfigAvaliacaoGoogle({ config, atualizarConfiguracao, aoSalvar }: CardConfigAvaliacaoGoogleProps) {
  const { t } = useTranslation("marketing");
  const salvo = useMemo(() => lerConfigAvaliacaoGoogle(config?.mensagens_whatsapp_os), [config]);

  const [link, setLink] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [mensagem, setMensagem] = useState(MENSAGEM_AVALIACAO_PADRAO);
  const [mostrarErro, setMostrarErro] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Preenche com o que está salvo sempre que a configuração (re)carrega.
  useEffect(() => {
    setLink(salvo.link);
    setAtivo(salvo.ativo);
    setMensagem(salvo.mensagem || MENSAGEM_AVALIACAO_PADRAO);
    setMostrarErro(false);
  }, [salvo]);

  const validacao = useMemo(() => validarLinkAvaliacaoGoogle(link), [link]);
  const linkValido = "url" in validacao ? validacao.url : null;
  // "in" em vez de .ok: sem strictNullChecks o TS não estreita pela flag.
  const motivoErro = "motivo" in validacao ? validacao.motivo : null;
  const erroLink = motivoErro && motivoErro !== "vazio" ? t(`avaliacao.erros.${motivoErro}`) : null;

  const previa = montarMensagemAvaliacao(mensagem, {
    cliente: t("avaliacao.exemploCliente"),
    loja: config?.nome_loja || t("avaliacao.exemploLoja"),
    link: linkValido ?? LINK_EXEMPLO,
    numeroOS: "000125",
    dispositivo: t("avaliacao.exemploDispositivo"),
  });

  const inserirVariavel = (variavel: string) => {
    const el = textareaRef.current;
    const inicio = el?.selectionStart ?? mensagem.length;
    const fim = el?.selectionEnd ?? mensagem.length;
    const novo = mensagem.slice(0, inicio) + variavel + mensagem.slice(fim);
    setMensagem(novo);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = inicio + variavel.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const testarLink = () => {
    // Só o link validado (https + host do Google) é aberto.
    if (!linkValido) return;
    window.open(linkValido, "_blank", "noopener,noreferrer");
  };

  const handleSalvar = async () => {
    const vazio = !link.trim();
    if (!vazio && !linkValido) {
      setMostrarErro(true);
      toast.error(t("avaliacao.linkInvalidoSalvar"));
      return;
    }
    const linkParaGravar = vazio ? "" : (linkValido as string);
    // Mensagem igual à padrão grava vazia: segue a padrão se ela mudar.
    const mensagemParaGravar = mensagem.trim() === MENSAGEM_AVALIACAO_PADRAO ? "" : mensagem;
    const ativoParaGravar = ativo ? "1" : "0";

    setSalvando(true);
    try {
      // Grava só as chaves marketing_*; atualizarConfiguracao mescla sobre o valor
      // do banco (modelos de status e os_tracking ficam intactos).
      const ok = await atualizarConfiguracao({
        mensagens_whatsapp_os: {
          [CHAVE_LINK_AVALIACAO]: linkParaGravar,
          [CHAVE_MENSAGEM_AVALIACAO]: mensagemParaGravar,
          [CHAVE_ATIVO_AVALIACAO]: ativoParaGravar,
        },
      });
      if (!ok) {
        toast.error(t("avaliacao.salvoErro"));
        return;
      }
      // UPDATE barrado por RLS não dá erro (0 linhas): confere relendo do banco.
      const relida = await buscarConfiguracaoLojaPorEmpresa(null);
      const gravado = lerConfigAvaliacaoGoogle(relida?.mensagens_whatsapp_os);
      const conferiu = gravado.link === linkParaGravar && gravado.mensagem === mensagemParaGravar && gravado.ativo === ativo;
      if (!conferiu) {
        toast.error(t("avaliacao.salvoSemPermissao"));
        return;
      }
      setLink(linkParaGravar);
      toast.success(t("avaliacao.salvoSucesso"));
      await aoSalvar();
    } catch {
      toast.error(t("avaliacao.salvoErro"));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Star className="h-5 w-5 text-amber-500" />
          {t("avaliacao.configTitulo")}
        </CardTitle>
        <CardDescription>{t("avaliacao.configDescricao")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* a) Link */}
        <div className="space-y-2">
          <Label htmlFor="link-avaliacao-google">{t("avaliacao.campoLink")}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="link-avaliacao-google"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("avaliacao.placeholderLink")}
              value={link}
              maxLength={600}
              onChange={(e) => setLink(e.target.value)}
              onBlur={() => setMostrarErro(true)}
              aria-invalid={mostrarErro && !!erroLink}
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={testarLink} disabled={!linkValido} className="gap-2 shrink-0">
              <ExternalLink className="h-4 w-4" />
              {t("avaliacao.testarLink")}
            </Button>
          </div>
          {mostrarErro && erroLink && <p className="text-sm text-destructive">{erroLink}</p>}

          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            <p className="mb-1.5 flex items-center gap-1.5 font-medium text-foreground">
              <Info className="h-4 w-4 text-primary" />
              {t("avaliacao.comoPegarTitulo")}
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>{t("avaliacao.passo1")}</li>
              <li>{t("avaliacao.passo2")}</li>
              <li>{t("avaliacao.passo3")}</li>
            </ol>
          </div>
        </div>

        {/* b) Liga/desliga */}
        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="oferecer-avaliacao-entrega" className="text-sm font-medium">{t("avaliacao.oferecerTitulo")}</Label>
            <p className="text-xs text-muted-foreground">{t("avaliacao.oferecerDescricao")}</p>
          </div>
          <Switch id="oferecer-avaliacao-entrega" checked={ativo} onCheckedChange={setAtivo} />
        </div>

        {/* c) Mensagem + prévia */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mensagem-avaliacao">{t("avaliacao.mensagemTitulo")}</Label>
            <p className="text-xs text-muted-foreground">{t("avaliacao.mensagemDescricao")}</p>
            <div className="flex flex-wrap gap-1.5">
              {VARIAVEIS_AVALIACAO.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => inserirVariavel(v)}
                  title={v}
                  className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs hover:bg-muted transition-colors"
                >
                  {t(`avaliacao.variaveis.${v.slice(2, -2)}`)}
                </button>
              ))}
            </div>
            <Textarea
              id="mensagem-avaliacao"
              ref={textareaRef}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={6}
              maxLength={450}
              className="resize-none"
            />
            <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => setMensagem(MENSAGEM_AVALIACAO_PADRAO)}>
              <RotateCcw className="h-4 w-4" />
              {t("avaliacao.restaurarPadrao")}
            </Button>
          </div>
          <div className="space-y-2">
            <Label>{t("avaliacao.previa")}</Label>
            <p className="text-xs text-muted-foreground">{t("avaliacao.previaDescricao")}</p>
            <div className="rounded-xl bg-[#e7fbe0] dark:bg-[#1f3a2a] p-3 text-sm whitespace-pre-wrap break-words text-foreground">
              {previa}
            </div>
          </div>
        </div>

        {/* d) Salvar */}
        <div className="flex justify-end">
          <Button type="button" onClick={handleSalvar} disabled={salvando || !config} className="gap-2">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {salvando ? t("avaliacao.salvando") : t("avaliacao.salvar")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

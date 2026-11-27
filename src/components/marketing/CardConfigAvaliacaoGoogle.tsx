import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ExternalLink, FileText, Info, Link2, Loader2, MessageSquare, RotateCcw, Save, Smartphone, Store, User, type LucideIcon } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PreviaWhatsAppAvaliacao } from "@/components/marketing/PreviaWhatsAppAvaliacao";
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

/** Ícone de cada chip de variável (chave = nome entre as chaves duplas). */
const ICONE_VARIAVEL: Record<string, LucideIcon> = {
  cliente: User,
  loja: Store,
  numero_os: FileText,
  dispositivo: Smartphone,
  link_avaliacao: Link2,
};

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

  const nomeLojaPrevia = config?.nome_loja || t("avaliacao.exemploLoja");
  const linkPrevia = linkValido ?? LINK_EXEMPLO;
  const previa = montarMensagemAvaliacao(mensagem, {
    cliente: t("avaliacao.exemploCliente"),
    loja: nomeLojaPrevia,
    link: linkPrevia,
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
    <div className="grid items-start gap-6 min-[1250px]:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
      <Card className="overflow-hidden rounded-2xl">
        <CardHeader className="border-b p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Link2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg">{t("avaliacao.configTitulo")}</CardTitle>
              <CardDescription>{t("avaliacao.configDescricao")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-4 pt-5 sm:p-6">
          {/* a) Link */}
          <div className="space-y-2">
            <Label htmlFor="link-avaliacao-google" className="font-semibold">{t("avaliacao.campoLink")}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <ExternalLink className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
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
                  className="h-11 rounded-lg bg-muted/30 pl-10"
                />
              </div>
              <Button type="button" variant="outline" onClick={testarLink} disabled={!linkValido} className="h-11 shrink-0 gap-2 rounded-lg font-semibold">
                <ExternalLink className="h-4 w-4" />
                {t("avaliacao.testarLink")}
              </Button>
            </div>
            {mostrarErro && erroLink && <p className="text-sm text-destructive">{erroLink}</p>}

            <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm">
              <p className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {t("avaliacao.comoPegarTitulo")}
              </p>
              <ol className="list-decimal space-y-1 pl-11 text-muted-foreground">
                <li>{t("avaliacao.passo1")}</li>
                <li>{t("avaliacao.passo2")}</li>
                <li>{t("avaliacao.passo3")}</li>
              </ol>
            </div>
          </div>

          {/* b) Liga/desliga */}
          <div className="flex items-center gap-3 border-t pt-5 sm:gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15">
              <FaWhatsapp className="h-6 w-6 text-[#1DA851]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <Label htmlFor="oferecer-avaliacao-entrega" className="text-sm font-semibold leading-snug">{t("avaliacao.oferecerTitulo")}</Label>
              <p className="text-xs text-muted-foreground">{t("avaliacao.oferecerDescricao")}</p>
            </div>
            <Switch id="oferecer-avaliacao-entrega" checked={ativo} onCheckedChange={setAtivo} className="shrink-0" />
          </div>

          {/* c) Mensagem */}
          <div className="space-y-3 border-t pt-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquare className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="mensagem-avaliacao" className="font-semibold">{t("avaliacao.mensagemTitulo")}</Label>
                <p className="text-xs text-muted-foreground">{t("avaliacao.mensagemDescricao")}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {VARIAVEIS_AVALIACAO.map((v) => {
                const nome = v.slice(2, -2);
                const IconeVariavel = ICONE_VARIAVEL[nome] ?? Link2;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => inserirVariavel(v)}
                    title={v}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  >
                    <IconeVariavel className="h-3.5 w-3.5" aria-hidden="true" />
                    {t(`avaliacao.variaveis.${nome}`)}
                  </button>
                );
              })}
            </div>
            <Textarea
              id="mensagem-avaliacao"
              ref={textareaRef}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={5}
              maxLength={450}
              className="resize-y rounded-xl bg-muted/30 leading-relaxed"
            />
          </div>

          {/* d) Restaurar + Salvar */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" className="gap-2 self-start text-muted-foreground hover:text-foreground" onClick={() => setMensagem(MENSAGEM_AVALIACAO_PADRAO)}>
              <RotateCcw className="h-4 w-4" />
              {t("avaliacao.restaurarPadrao")}
            </Button>
            <Button type="button" onClick={handleSalvar} disabled={salvando || !config} className="h-11 gap-2 rounded-lg px-6 font-semibold">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {salvando ? t("avaliacao.salvando") : t("avaliacao.salvarAlteracoes")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PreviaWhatsAppAvaliacao
        texto={previa}
        link={linkPrevia}
        nomeLoja={nomeLojaPrevia}
        logoUrl={config?.logo_url}
      />
    </div>
  );
}

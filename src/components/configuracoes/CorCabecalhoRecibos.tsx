/**
 * "Cor do cabeçalho dos recibos" (Configurações → Cores): a cor do cabeçalho
 * do recibo A4 personalizado da OS e do recibo de venda novo. Grava SÓ a chave
 * recibo_cabecalho_cor de cores_personalizadas, em cada linha do dono (matriz e
 * filiais), mesclando com o que a linha já tem. "Voltar ao azul padrão" remove a
 * chave (nunca grava o azul): os recibos voltam ao azul de sempre.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2, Printer, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  definirCorRecibo,
  gravarCoresPorLinha,
  removerCorRecibo,
  type ClienteCores,
} from "@/lib/configuracaoLoja/coresPersonalizadasLinhas";
import { normalizarCorHex, paletaCabecalhoRecibo } from "@/lib/recibo/corCabecalhoRecibo";

interface Paleta {
  nome: string;
  from: string;
  via: string;
  to: string;
}

interface Props {
  /** As mesmas paletas das cores do app; aqui vale a primeira cor de cada uma. */
  paletas: readonly Paleta[];
  /** Cor já gravada (null = azul padrão). */
  corSalva: string | null;
  onGravada: (cor: string | null) => void;
}

/** Azul de sempre dos dois recibos (só para a prévia: o recibo usa o próprio CSS). */
const PADRAO_OS = { fundo: "#0a1a3f", fundo2: "#0f2a6b", texto: "#ffffff", textoSuave: "rgba(255,255,255,0.92)", acento: "#60a5fa", borda: "rgba(255,255,255,0.28)" };
const PADRAO_VENDA = { fundo: "#0b1429", fundo2: "#143763", texto: "#ffffff", acento: "#7cc4ff", onda: "#2b6cf0", borda: "rgba(255,255,255,0.25)" };

export function CorCabecalhoRecibos({ paletas, corSalva, onGravada }: Props) {
  const { t } = useTranslation("configuracoes");
  const { toast } = useToast();
  const [rascunho, setRascunho] = useState<string | null>(corSalva);
  const [textoHex, setTextoHex] = useState(corSalva ?? "");
  const [gravando, setGravando] = useState(false);

  useEffect(() => {
    setRascunho(corSalva);
    setTextoHex(corSalva ?? "");
  }, [corSalva]);

  const escolher = (cor: string) => {
    const hex = normalizarCorHex(cor);
    if (!hex) return;
    setRascunho(hex);
    setTextoHex(hex);
  };

  // Nada gravado ainda: só desfaz a escolha na tela (não há chave para remover).
  const escolherPadraoSemGravar = () => {
    setRascunho(null);
    setTextoHex("");
  };

  const digitar = (valor: string) => {
    setTextoHex(valor);
    const hex = normalizarCorHex(valor);
    if (hex) setRascunho(hex);
  };

  const textoInvalido = textoHex.trim() !== "" && !normalizarCorHex(textoHex);
  const p = rascunho ? paletaCabecalhoRecibo(rascunho) : null;
  const os = p ?? PADRAO_OS;
  const venda = p ? { fundo: p.fundo, fundo2: p.fundo2, texto: p.texto, acento: p.acento, onda: p.acento, borda: p.borda } : PADRAO_VENDA;

  const gravar = async (cor: string | null) => {
    setGravando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const linhas = await gravarCoresPorLinha(
        supabase as unknown as ClienteCores,
        user.id,
        cor ? definirCorRecibo(cor) : removerCorRecibo,
      );
      if (linhas === 0) throw new Error("Nenhuma configuração da loja para gravar");
      onGravada(cor);
      toast({
        title: cor ? t("cores.recibo.salva") : t("cores.recibo.voltouPadrao"),
        description: t("cores.recibo.salvaDescricao"),
      });
    } catch (erro) {
      console.error("Erro ao salvar a cor do cabeçalho dos recibos:", erro);
      toast({ title: t("cores.erroSalvar"), description: t("cores.recibo.erroSalvar"), variant: "destructive" });
    } finally {
      setGravando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          {t("cores.recibo.titulo")}
        </CardTitle>
        <CardDescription>{t("cores.recibo.descricao")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>{t("cores.escolhaPaleta")}</Label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {paletas.map((cor) => {
              const ativo = rascunho === normalizarCorHex(cor.from);
              return (
                <button
                  key={cor.nome}
                  type="button"
                  onClick={() => escolher(cor.from)}
                  aria-pressed={ativo}
                  title={t(`cores.paletas.${cor.nome}`)}
                  aria-label={t(`cores.paletas.${cor.nome}`)}
                  className={cn(
                    "relative h-10 rounded-md border-2 transition-all hover:scale-105",
                    ativo ? "border-foreground ring-2 ring-foreground ring-offset-2" : "border-transparent hover:border-muted-foreground/50",
                  )}
                  style={{ background: cor.from }}
                >
                  {ativo && <Check className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="recibo-cor-livre">{t("cores.recibo.corLivre")}</Label>
            <input
              id="recibo-cor-livre"
              type="color"
              value={rascunho ?? PADRAO_OS.fundo}
              onChange={(e) => escolher(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded-md border border-input bg-background p-1"
            />
          </div>
          <div className="flex flex-col gap-2 sm:w-40">
            <Label htmlFor="recibo-cor-hex">{t("cores.recibo.codigo")}</Label>
            <Input
              id="recibo-cor-hex"
              value={textoHex}
              placeholder="#1d4ed8"
              maxLength={7}
              onChange={(e) => digitar(e.target.value)}
              aria-invalid={textoInvalido}
            />
          </div>
          {textoInvalido && <p className="text-sm text-destructive sm:pb-2">{t("cores.recibo.codigoInvalido")}</p>}
        </div>

        <div className="space-y-3">
          <Label>{t("cores.recibo.previa")}</Label>
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3" data-previa-cor={rascunho ?? "padrao"}>
            {/* Recibo da OS */}
            <div
              className="flex items-center gap-3 rounded-md px-4 py-3"
              style={{ background: `linear-gradient(135deg, ${os.fundo} 0%, ${os.fundo2} 100%)`, color: os.texto }}
            >
              <div className="h-9 w-14 shrink-0 rounded border" style={{ borderColor: os.borda }} />
              <div className="min-w-0 flex-1">
                <p className="text-base font-extrabold leading-tight">{t("cores.recibo.previaOS")}</p>
                <p className="text-sm font-extrabold" style={{ color: os.acento }}>#1234</p>
              </div>
              <div className="hidden sm:block border-l pl-3 text-xs" style={{ borderColor: os.borda, color: os.textoSuave }}>
                <p className="font-bold" style={{ color: os.texto }}>{t("cores.recibo.previaLoja")}</p>
                <p>(11) 99999-9999</p>
              </div>
            </div>
            {/* Recibo de venda */}
            <div
              className="relative overflow-hidden rounded-md px-4 pt-3 pb-6"
              style={{ background: `linear-gradient(115deg, ${venda.fundo}, ${venda.fundo2})`, color: venda.texto }}
            >
              <div className="flex items-center gap-3">
                <p className="text-base font-extrabold">{t("cores.recibo.previaLoja")}</p>
                <div className="border-l pl-3 text-xs flex items-center gap-2" style={{ borderColor: venda.borda }}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: venda.acento }} />
                  {t("cores.recibo.previaVenda")}
                </div>
              </div>
              <svg className="absolute inset-x-0 bottom-0 h-4 w-full" viewBox="0 0 850 34" preserveAspectRatio="none" aria-hidden>
                <path d="M0 34 L0 16 Q 300 40 560 22 T 850 6 L850 34 Z" fill={venda.onda} fillOpacity="0.35" />
                <path d="M0 34 L0 24 Q 320 44 600 28 T 850 16 L850 34 Z" fill="#ffffff" />
              </svg>
            </div>
            <p className="text-xs text-muted-foreground">{rascunho ? t("cores.recibo.previaEscolhida") : t("cores.recibo.previaPadrao")}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button onClick={() => rascunho && gravar(rascunho)} disabled={gravando || !rascunho || rascunho === corSalva} className="flex-1">
            {gravando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            {gravando ? t("cores.salvando") : t("cores.recibo.salvar")}
          </Button>
          <Button variant="outline" onClick={() => (corSalva ? gravar(null) : escolherPadraoSemGravar())} disabled={gravando || (!corSalva && !rascunho)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("cores.recibo.voltarPadrao")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

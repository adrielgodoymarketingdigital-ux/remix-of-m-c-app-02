import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { FileSignature, PenTool, Upload, Loader2, Save, Trash2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { AssinaturaDigital } from "@/components/ordens/AssinaturaDigital";
import { processarImagemAssinatura } from "@/lib/assinaturaLoja";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";

interface AssinaturaLojaConfigProps {
  assinaturaAtual?: string | null;
  usarAssinatura?: boolean;
  onSalvar: (dados: Partial<ConfiguracaoLoja>) => Promise<boolean>;
}

// Fundo quadriculado atrás do preview: deixa visível que o papel ficou
// transparente (assinatura enviada por foto passa por removerFundoAssinatura).
const FUNDO_XADREZ =
  "bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] bg-white";

export function AssinaturaLojaConfig({ assinaturaAtual, usarAssinatura, onSalvar }: AssinaturaLojaConfigProps) {
  const [editando, setEditando] = useState(false);
  const [pendente, setPendente] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  // Textos: namespace "configuracoes" (assinatura.*). Toasts com i18n.t: saem no idioma da hora.
  const { t, i18n } = useTranslation("configuracoes");
  const tt = (chave: string) => i18n.t(chave, { ns: "configuracoes" });

  const temAssinatura = Boolean(assinaturaAtual);
  const mostrandoEditor = editando || !temAssinatura;

  const salvar = async (dados: Partial<ConfiguracaoLoja>, sucesso: string) => {
    setSalvando(true);
    const ok = await onSalvar(dados);
    setSalvando(false);
    if (ok) toast.success(sucesso);
    else toast.error(tt("assinatura.erroSalvar"));
    return ok;
  };

  const handleArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      toast.error(tt("assinatura.erroNaoImagem"));
      return;
    }
    if (arquivo.size > 10 * 1024 * 1024) {
      toast.error(tt("assinatura.erroMuitoGrande"));
      return;
    }
    setProcessando(true);
    try {
      setPendente(await processarImagemAssinatura(arquivo));
    } catch (error) {
      console.error("Erro ao processar assinatura:", error);
      toast.error(
        error instanceof Error && error.message.startsWith("Nenhum traço")
          ? tt("assinatura.erroSemTraco")
          : tt("assinatura.erroProcessar"),
      );
    } finally {
      setProcessando(false);
    }
  };

  const handleSalvarNova = async () => {
    if (!pendente) return;
    const ok = await salvar({ assinatura_loja: pendente }, tt("assinatura.salva"));
    if (ok) {
      setPendente(null);
      setEditando(false);
    }
  };

  const handleCancelarEdicao = () => {
    setPendente(null);
    setEditando(false);
  };

  const handleRemover = async () => {
    setConfirmarRemocao(false);
    await salvar({ assinatura_loja: null, usar_assinatura_loja: false }, tt("assinatura.removida"));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <FileSignature className="h-5 w-5" />
          {t("assinatura.titulo")}
        </CardTitle>
        <CardDescription>
          {t("assinatura.descricao")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="usar-assinatura-loja" className="text-sm font-medium">
              {t("assinatura.usar")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {temAssinatura
                ? t("assinatura.desligado")
                : t("assinatura.cadastre")}
            </p>
          </div>
          <Switch
            id="usar-assinatura-loja"
            checked={Boolean(usarAssinatura) && temAssinatura}
            disabled={!temAssinatura || salvando}
            onCheckedChange={(v) =>
              salvar({ usar_assinatura_loja: v }, v ? tt("assinatura.ativada") : tt("assinatura.desativada"))
            }
          />
        </div>

        {temAssinatura && !editando && (
          <div className="space-y-3">
            <div className={`flex items-center justify-center rounded-lg border p-4 ${FUNDO_XADREZ}`}>
              <img src={assinaturaAtual!} alt={t("assinatura.atualAlt")} className="max-h-24 max-w-full object-contain" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setEditando(true)} disabled={salvando}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("assinatura.trocar")}
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmarRemocao(true)}
                disabled={salvando}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("assinatura.remover")}
              </Button>
            </div>
          </div>
        )}

        {mostrandoEditor && (
          <div className="space-y-3">
            {pendente ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t("assinatura.previa")}</p>
                <div className={`flex items-center justify-center rounded-lg border p-4 ${FUNDO_XADREZ}`}>
                  <img src={pendente} alt={t("assinatura.novaAlt")} className="max-h-24 max-w-full object-contain" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setPendente(null)} disabled={salvando}>
                    <X className="h-4 w-4 mr-2" />
                    {t("assinatura.refazer")}
                  </Button>
                  <Button onClick={handleSalvarNova} disabled={salvando}>
                    {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    {t("assinatura.salvar")}
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="desenhar">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="desenhar">
                    <PenTool className="h-4 w-4 mr-2" />
                    {t("assinatura.desenhar")}
                  </TabsTrigger>
                  <TabsTrigger value="upload">
                    <Upload className="h-4 w-4 mr-2" />
                    {t("assinatura.enviarImagem")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="desenhar" className="mt-3">
                  <AssinaturaDigital
                    label={t("assinatura.desenheLabel")}
                    onSave={setPendente}
                    mostrarCheckbox={false}
                    mostrarSeletorTipo={false}
                  />
                </TabsContent>

                <TabsContent value="upload" className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {t("assinatura.ajudaFoto")}
                  </p>
                  <input
                    ref={inputArquivo}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleArquivo}
                  />
                  <Button
                    variant="outline"
                    className="w-full h-20 border-dashed"
                    onClick={() => inputArquivo.current?.click()}
                    disabled={processando}
                  >
                    {processando ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        {t("assinatura.processando")}
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 mr-2" />
                        {t("assinatura.escolherFoto")}
                      </>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            )}

            {temAssinatura && (
              <Button variant="ghost" className="w-full" onClick={handleCancelarEdicao} disabled={salvando}>
                {t("assinatura.cancelarTroca")}
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmarRemocao} onOpenChange={setConfirmarRemocao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("assinatura.removerTitulo")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("assinatura.removerDescricao")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("assinatura.cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemover} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("assinatura.remover")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

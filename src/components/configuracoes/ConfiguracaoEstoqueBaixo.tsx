import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Info, PackageSearch, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useConfiguracaoEstoque } from "@/hooks/useConfiguracaoEstoque";
import { LIMITE_BAIXO_MAXIMO, limiteParaSalvar } from "@/lib/estoque/configuracaoEstoque";

/**
 * "Avisar estoque baixo quando restar [X] ou menos" (só o dono; a página só
 * mostra a aba para ele). Vazio = padrão de cada tela; "não avisar" = 0.
 * Textos: namespace "configuracoes" (estoque.*); toasts com i18n.t na hora.
 */
export function ConfiguracaoEstoqueBaixo() {
  const { t, i18n } = useTranslation("configuracoes");
  const tt = (chave: string, valores?: Record<string, unknown>) => i18n.t(chave, { ns: "configuracoes", ...valores });
  const { limiteBaixo, carregando, ehDono, salvar, salvando } = useConfiguracaoEstoque();
  const [texto, setTexto] = useState("");
  const [naoAvisar, setNaoAvisar] = useState(false);

  // Formulário segue o valor salvo (ao abrir e depois de salvar).
  useEffect(() => {
    if (carregando) return;
    setNaoAvisar(limiteBaixo === 0);
    setTexto(limiteBaixo !== null && limiteBaixo > 0 ? String(limiteBaixo) : "");
  }, [carregando, limiteBaixo]);

  if (!ehDono) return null;

  const handleSalvar = async () => {
    const resultado = limiteParaSalvar(texto, naoAvisar);
    if (!resultado.ok) {
      toast.error(tt("estoque.erroValor", { maximo: LIMITE_BAIXO_MAXIMO }));
      return;
    }
    try {
      await salvar(resultado.valor);
      toast.success(tt("estoque.salvo"));
    } catch (error) {
      console.error("Erro ao salvar limite de estoque baixo:", error);
      toast.error(tt("estoque.erroSalvar"));
    }
  };

  const situacaoAtual = carregando
    ? t("estoque.carregando")
    : limiteBaixo === null
      ? t("estoque.atualPadrao")
      : limiteBaixo === 0
        ? t("estoque.atualDesligado")
        : t("estoque.atualLimite", { limite: limiteBaixo });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageSearch className="h-5 w-5" />
          {t("estoque.titulo")}
        </CardTitle>
        <CardDescription>{t("estoque.descricao")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription data-testid="estoque-situacao-atual">{situacaoAtual}</AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="limiteEstoqueBaixo" className="flex flex-wrap items-center gap-2 text-sm font-medium leading-10">
            <Trans
              t={t}
              i18nKey="estoque.limiteBaixo"
              components={{
                campo: (
                  <Input
                    id="limiteEstoqueBaixo"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={t("estoque.campoRotulo")}
                    value={naoAvisar ? "" : texto}
                    onChange={(e) => setTexto(e.target.value.replace(/\D/g, ""))}
                    disabled={naoAvisar || carregando}
                    className="inline-flex h-10 w-20 text-center"
                  />
                ),
              }}
            />
          </Label>
          <p className="text-xs text-muted-foreground">{t("estoque.limiteBaixoDica")}</p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-1">
            <Label htmlFor="naoAvisarEstoqueBaixo" className="text-sm font-medium">
              {t("estoque.naoAvisar")}
            </Label>
            <p className="text-xs text-muted-foreground">{t("estoque.naoAvisarDica")}</p>
          </div>
          <Switch
            id="naoAvisarEstoqueBaixo"
            checked={naoAvisar}
            onCheckedChange={setNaoAvisar}
            disabled={carregando}
          />
        </div>

        <Button onClick={handleSalvar} disabled={carregando || salvando}>
          <Save className="mr-2 h-4 w-4" />
          {salvando ? t("estoque.salvando") : t("estoque.salvar")}
        </Button>
      </CardContent>
    </Card>
  );
}

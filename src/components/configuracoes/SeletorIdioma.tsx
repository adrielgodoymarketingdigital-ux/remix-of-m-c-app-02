import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useI18nVisivel } from "@/hooks/useI18nVisivel";
import { useMercado, useSalvarIdioma } from "@/hooks/useMercado";
import { ehIdioma, NOME_IDIOMA } from "@/lib/i18n/idiomas";
import { aplicarIdioma, IDIOMAS_DISPONIVEIS } from "@/lib/i18n/instancia";

/**
 * Idioma da conta (grava profiles.idioma e troca na hora). Só existe para
 * quem useI18nVisivel libera (hoje: admin); para os demais não desenha nada.
 * Oferece só os idiomas que já têm algum arquivo em src/locales/.
 */
export function SeletorIdioma() {
  const visivel = useI18nVisivel();
  const { idioma, carregando } = useMercado();
  const salvar = useSalvarIdioma();
  const { toast } = useToast();
  const { t } = useTranslation("comum");

  if (!visivel) return null;

  const trocar = (valor: string) => {
    if (!ehIdioma(valor) || valor === idioma) return;
    salvar.mutate(valor, {
      onSuccess: async (novo) => {
        await aplicarIdioma(novo);
        toast({ title: t("idioma.salvo") });
      },
      onError: (erro: Error) => {
        toast({ title: t("idioma.erroSalvar"), description: erro.message, variant: "destructive" });
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">{t("idioma.titulo")}</CardTitle>
        <CardDescription className="text-sm">{t("idioma.descricao")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={idioma} onValueChange={trocar} disabled={carregando || salvar.isPending}>
          <SelectTrigger className="w-full sm:w-72" aria-label={t("idioma.titulo")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IDIOMAS_DISPONIVEIS.map((i) => (
              <SelectItem key={i} value={i}>
                {NOME_IDIOMA[i]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Megaphone, Star, type LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecaoAvaliacoesGoogle } from "@/components/marketing/SecaoAvaliacoesGoogle";

/**
 * Marketing da LOJA (/marketing). Não confundir com o Marketing de admin
 * (/admin/marketing, AdminMarketing.tsx), que é outra tela.
 *
 * Cada função nova entra como uma seção (aba) em SECOES.
 */
interface SecaoMarketing {
  id: string;
  /** Chave em marketing:secoes. */
  chaveTitulo: string;
  icone: LucideIcon;
  Componente: ComponentType;
}

const SECOES: SecaoMarketing[] = [
  { id: "avaliacoes-google", chaveTitulo: "secoes.avaliacoesGoogle", icone: Star, Componente: SecaoAvaliacoesGoogle },
];

export default function Marketing() {
  const { t } = useTranslation("marketing");

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <span className="hidden lg:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600">
            <Megaphone className="h-5 w-5 text-white" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">{t("titulo")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitulo")}</p>
          </div>
        </div>

        <Tabs defaultValue={SECOES[0].id} className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start">
            {SECOES.map(({ id, chaveTitulo, icone: Icone }) => (
              <TabsTrigger key={id} value={id} className="gap-2">
                <Icone className="h-4 w-4" />
                {t(chaveTitulo)}
              </TabsTrigger>
            ))}
          </TabsList>
          {SECOES.map(({ id, Componente }) => (
            <TabsContent key={id} value={id} className="mt-0">
              <Componente />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}

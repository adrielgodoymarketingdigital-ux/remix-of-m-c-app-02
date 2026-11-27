import { useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, House, Megaphone, Star, type LucideIcon } from "lucide-react";
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
  const [secaoAtiva, setSecaoAtiva] = useState(SECOES[0].id);
  const secao = SECOES.find((s) => s.id === secaoAtiva) ?? SECOES[0];

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1560px] space-y-5 p-4 sm:p-6 lg:px-8">
        <nav aria-label={t("cabecalho.navegacao")} className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
          <Link
            to="/dashboard"
            aria-label={t("cabecalho.inicio")}
            className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <House className="h-4 w-4" />
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t("titulo")}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate font-medium text-foreground" aria-current="page">{t(secao.chaveTitulo)}</span>
        </nav>

        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-14 sm:w-14">
            <Megaphone className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{t("titulo")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitulo")}</p>
          </div>
        </div>

        <Tabs value={secaoAtiva} onValueChange={setSecaoAtiva} className="space-y-5">
          <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
            {SECOES.map(({ id, chaveTitulo, icone: Icone }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="gap-2 rounded-lg border px-4 py-2 font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
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

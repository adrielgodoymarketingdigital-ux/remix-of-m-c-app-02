import { useTranslation } from "react-i18next";
import { Grid2x2, Smartphone } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TipoCompatibilidade, lerTipoCompatibilidade } from "@/lib/compatibilidade/compatibilidade";

const ABA =
  "h-12 min-w-[200px] gap-3 rounded-xl px-7 text-[15px] font-semibold text-muted-foreground " +
  "data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-sky-500 " +
  "data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-blue-500/20";

/**
 * Abas "Películas | Vidros" do layout de computador (com ícone). Mesmo contrato
 * de AbasTipoCompatibilidade, que continua sendo a do celular e a do admin.
 */
export function AbasTipoCompatibilidadeDesktop({ tipo, onChange }: { tipo: TipoCompatibilidade; onChange: (tipo: TipoCompatibilidade) => void }) {
  const { t } = useTranslation("comum");
  return (
    <Tabs value={tipo} onValueChange={(v) => onChange(lerTipoCompatibilidade(v))}>
      <TabsList className="h-auto gap-1 rounded-2xl border bg-muted/60 p-1">
        <TabsTrigger value="pelicula" className={ABA}>
          <Smartphone className="h-5 w-5" aria-hidden="true" />
          {t("compatibilidade.abaPeliculas")}
        </TabsTrigger>
        <TabsTrigger value="vidro" className={ABA}>
          <Grid2x2 className="h-5 w-5" aria-hidden="true" />
          {t("compatibilidade.abaVidros")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

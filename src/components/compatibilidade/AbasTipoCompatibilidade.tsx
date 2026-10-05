import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TipoCompatibilidade, lerTipoCompatibilidade } from "@/lib/compatibilidade/compatibilidade";

/** Abas "Películas | Vidros" (usadas na busca e no admin; o tipo fica na URL — ver useTipoCompatibilidadeDaUrl). */
export function AbasTipoCompatibilidade({ tipo, onChange }: { tipo: TipoCompatibilidade; onChange: (tipo: TipoCompatibilidade) => void }) {
  return (
    <Tabs value={tipo} onValueChange={(v) => onChange(lerTipoCompatibilidade(v))}>
      <TabsList className="grid w-full grid-cols-2 sm:w-80">
        <TabsTrigger value="pelicula">Películas</TabsTrigger>
        <TabsTrigger value="vidro">Vidros</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, Smartphone, HelpCircle } from "lucide-react";
import { SeletorMarcaModeloCelular } from "@/components/admin/SeletorMarcaModeloCelular";
import { useCompatibilidadePelicula, encontrarGrupoDoModelo } from "@/hooks/useCompatibilidadePelicula";

export default function CompatibilidadePelicula() {
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");

  const { data: grupos = [], isLoading } = useCompatibilidadePelicula();

  const buscou = !!marca && !!modelo;
  const grupoEncontrado = buscou ? encontrarGrupoDoModelo(grupos, marca, modelo) : undefined;
  const outrosCompativeis = grupoEncontrado?.modelos.filter(
    (m) => !(m.marca === marca && m.modelo === modelo),
  ) ?? [];

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto space-y-6 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600">
            <ShieldCheck className="h-5 sm:h-6 w-5 sm:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Compatibilidade de Película</h1>
            <p className="text-sm text-muted-foreground">
              Descubra quais outros modelos usam a mesma película
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buscar modelo</CardTitle>
            <CardDescription>Selecione a marca e o modelo do celular</CardDescription>
          </CardHeader>
          <CardContent>
            <SeletorMarcaModeloCelular
              marca={marca}
              modelo={modelo}
              onChangeMarca={setMarca}
              onChangeModelo={setModelo}
            />
          </CardContent>
        </Card>

        {isLoading && buscou && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Buscando compatibilidade...</span>
          </div>
        )}

        {!isLoading && buscou && !grupoEncontrado && (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center border rounded-lg bg-muted/20">
            <div className="p-4 rounded-full bg-muted">
              <HelpCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Ainda não temos dados de compatibilidade para esse modelo
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {marca} {modelo}
              </p>
            </div>
          </div>
        )}

        {!isLoading && buscou && grupoEncontrado && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-blue-600" />
                Modelos compatíveis
              </CardTitle>
              <CardDescription>
                {marca} {modelo} está no grupo "{grupoEncontrado.nome}"
              </CardDescription>
            </CardHeader>
            <CardContent>
              {outrosCompativeis.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum outro modelo cadastrado neste grupo ainda.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {outrosCompativeis.map((m) => (
                    <Badge key={m.id} variant="outline" className="py-1.5 px-3">
                      {m.marca} {m.modelo}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </AppLayout>
  );
}

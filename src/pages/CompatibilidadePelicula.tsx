import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, Smartphone, HelpCircle, AlertTriangle } from "lucide-react";
import { SeletorMarcaModeloDados } from "@/components/compatibilidade/SeletorMarcaModeloDados";
import { AbasTipoCompatibilidade } from "@/components/compatibilidade/AbasTipoCompatibilidade";
import { useTipoCompatibilidadeDaUrl } from "@/hooks/useTipoCompatibilidadeDaUrl";
import { useCompatibilidadePelicula } from "@/hooks/useCompatibilidadePelicula";
import {
  TipoCompatibilidade,
  encontrarCompativeis,
  montarOpcoesMarcaModelo,
} from "@/lib/compatibilidade/compatibilidade";

const TEXTOS: Record<TipoCompatibilidade, {
  descricaoBusca: string;
  tituloResultado: string;
  usaOMesmo: string;
  semDados: string;
}> = {
  pelicula: {
    descricaoBusca: "Selecione a marca e o modelo do celular para ver quais outros modelos usam a mesma película",
    tituloResultado: "Películas compatíveis",
    usaOMesmo: "usa a mesma película que",
    semDados: "Ainda não há dados de compatibilidade de películas.",
  },
  vidro: {
    descricaoBusca: "Selecione a marca e o modelo do celular para ver quais outros modelos usam o mesmo vidro na troca de vidro da tela",
    tituloResultado: "Vidros compatíveis (troca de vidro da tela)",
    usaOMesmo: "usa o mesmo vidro de tela que",
    semDados: "Ainda não há dados de compatibilidade de vidros. Em breve esta lista estará disponível aqui.",
  },
};

function PainelCompatibilidade({ tipo }: { tipo: TipoCompatibilidade }) {
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const textos = TEXTOS[tipo];

  const { data: grupos = [], isLoading, isError } = useCompatibilidadePelicula(tipo);
  const opcoes = useMemo(() => montarOpcoesMarcaModelo(grupos), [grupos]);

  const buscou = !!marca && !!modelo;
  const resultado = buscou ? encontrarCompativeis(grupos, marca, modelo) : null;
  const encontrado = !!resultado && resultado.grupos.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando compatibilidade...</span>
      </div>
    );
  }

  if (isError || grupos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center border rounded-lg bg-muted/20">
        <div className="p-4 rounded-full bg-muted">
          {isError ? <AlertTriangle className="h-8 w-8 text-muted-foreground" /> : <HelpCircle className="h-8 w-8 text-muted-foreground" />}
        </div>
        <p className="font-semibold text-foreground px-4">
          {isError ? "Não foi possível carregar a compatibilidade agora. Tente novamente em instantes." : textos.semDados}
        </p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar modelo</CardTitle>
          <CardDescription>{textos.descricaoBusca}</CardDescription>
        </CardHeader>
        <CardContent>
          <SeletorMarcaModeloDados
            opcoes={opcoes}
            marca={marca}
            modelo={modelo}
            onChangeMarca={setMarca}
            onChangeModelo={setModelo}
          />
        </CardContent>
      </Card>

      {buscou && !encontrado && (
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

      {buscou && encontrado && resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-600" />
              {textos.tituloResultado}
            </CardTitle>
            <CardDescription>
              {marca} {modelo} {textos.usaOMesmo}:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {resultado.compativeis.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum outro modelo cadastrado como compatível ainda.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {resultado.compativeis.map((m) => (
                  <Badge key={`${m.marca}|${m.modelo}`} variant="outline" className="py-1.5 px-3">
                    {m.marca === marca ? m.modelo : `${m.marca} ${m.modelo}`}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              {resultado.grupos.length === 1 ? "Grupo" : "Grupos"}: {resultado.grupos.map((g) => g.nome).join(" · ")}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function CompatibilidadePelicula() {
  const [tipo, setTipo] = useTipoCompatibilidadeDaUrl();

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto space-y-6 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600">
            <ShieldCheck className="h-5 sm:h-6 w-5 sm:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Compatibilidade de Películas e Vidros</h1>
            <p className="text-sm text-muted-foreground">
              Descubra quais outros modelos usam a mesma película ou o mesmo vidro de tela
            </p>
          </div>
        </div>

        <AbasTipoCompatibilidade tipo={tipo} onChange={setTipo} />

        {/* key: trocar de aba limpa marca/modelo escolhidos. */}
        <PainelCompatibilidade key={tipo} tipo={tipo} />
      </main>
    </AppLayout>
  );
}

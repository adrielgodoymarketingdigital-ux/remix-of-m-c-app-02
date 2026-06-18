import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HelpCircle, Search } from "lucide-react";
import { ajudaModulos } from "@/data/ajudaModulos";

function AjudaContent() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");

  const modulosFiltrados = useMemo(() => {
    if (!busca.trim()) return ajudaModulos;
    const termo = busca.toLowerCase();
    return ajudaModulos.filter(
      (m) =>
        m.title.toLowerCase().includes(termo) ||
        m.resumo.toLowerCase().includes(termo) ||
        m.conteudo.some((c) => c.toLowerCase().includes(termo))
    );
  }, [busca]);

  return (
    <main className="flex-1 p-6 overflow-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HelpCircle className="h-7 w-7 text-primary" />
            Ajuda
          </h1>
          <p className="text-muted-foreground">
            Explicações sobre como usar cada funcionalidade do sistema.
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar funcionalidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        {modulosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <Search className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma funcionalidade encontrada</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modulosFiltrados.map((modulo) => (
              <Card
                key={modulo.slug}
                className="hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
                onClick={() => navigate(`/ajuda/${modulo.slug}`)}
              >
                <div className="aspect-video w-full overflow-hidden bg-muted border-b">
                  <img
                    src={modulo.imagem}
                    alt={`Tela de ${modulo.title}`}
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <modulo.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-base">{modulo.title}</CardTitle>
                  </div>
                  <CardDescription>{modulo.resumo}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function Ajuda() {
  return (
    <AppLayout>
      <AjudaContent />
    </AppLayout>
  );
}

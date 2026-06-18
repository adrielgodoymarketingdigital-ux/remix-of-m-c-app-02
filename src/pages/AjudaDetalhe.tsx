import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ajudaModulos } from "@/data/ajudaModulos";

function AjudaDetalheContent() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const modulo = ajudaModulos.find((m) => m.slug === slug);

  if (!modulo) {
    return (
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          <Button variant="ghost" onClick={() => navigate("/ajuda")} className="gap-1 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Voltar para Ajuda
          </Button>
          <p className="text-muted-foreground">Funcionalidade não encontrada.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6 overflow-auto">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/ajuda")} className="gap-1 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Voltar para Ajuda
        </Button>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <modulo.icon className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{modulo.title}</h1>
            <p className="text-muted-foreground">{modulo.resumo}</p>
          </div>
        </div>

        {modulo.imagem && (
          <div className="rounded-lg border overflow-hidden">
            <img
              src={modulo.imagem}
              alt={`Tela de ${modulo.title}`}
              className="w-full"
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {modulo.conteudo.map((paragrafo, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                {paragrafo}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Passo a passo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {modulo.passos.map((passo, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                {passo}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function AjudaDetalhe() {
  return (
    <AppLayout>
      <AjudaDetalheContent />
    </AppLayout>
  );
}

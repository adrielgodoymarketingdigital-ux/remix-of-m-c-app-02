import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LABEL_POR_CATEGORIA, MotivoNaoRenovacaoCategoria } from "@/lib/motivosNaoRenovacao";

interface LinhaMotivo {
  motivo_categoria: string | null;
  motivo_texto: string | null;
  modal_exibido_em: string;
  respondido_em: string | null;
  plano_tipo: string | null;
}

const ORDEM_CATEGORIAS: MotivoNaoRenovacaoCategoria[] = [
  "preco_alto",
  "nao_usei",
  "outra_solucao",
  "problema_tecnico",
  "volto_em_breve",
  "outro",
];

/**
 * Seção "Motivos de Não Renovação" do Admin Financeiro. Contagem por
 * categoria (respostas do modal "Por que você não renovou?"), taxa de
 * resposta e textos livres recentes.
 */
export function MotivosNaoRenovacaoAdmin() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-motivos-nao-renovacao"],
    queryFn: async (): Promise<LinhaMotivo[]> => {
      const { data, error } = await supabase
        .from("motivos_nao_renovacao")
        .select("motivo_categoria, motivo_texto, modal_exibido_em, respondido_em, plano_tipo")
        .order("modal_exibido_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LinhaMotivo[];
    },
  });

  const resumo = useMemo(() => {
    const linhas = data ?? [];
    const exibidos = linhas.length;
    const respondidos = linhas.filter((l) => l.respondido_em).length;

    const porCategoria = ORDEM_CATEGORIAS.map((cat) => {
      const count = linhas.filter((l) => l.motivo_categoria === cat).length;
      return {
        categoria: cat,
        label: LABEL_POR_CATEGORIA[cat],
        count,
        pct: respondidos > 0 ? Math.round((count / respondidos) * 100) : 0,
      };
    }).sort((a, b) => b.count - a.count);

    const textosLivres = linhas
      .filter((l) => l.motivo_categoria === "outro" && l.motivo_texto)
      .slice(0, 15);

    return { exibidos, respondidos, porCategoria, textosLivres };
  }, [data]);

  const taxaResposta =
    resumo.exibidos > 0 ? Math.round((resumo.respondidos / resumo.exibidos) * 100) : 0;
  const maxCount = Math.max(1, ...resumo.porCategoria.map((c) => c.count));

  return (
    <Card className="border-red-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="h-5 w-5 text-red-500" />
          Motivos de Não Renovação
        </CardTitle>
        <CardDescription>
          Respostas do modal “Por que você não renovou?” — exibido uma vez no primeiro acesso
          após o plano vencer
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">Não foi possível carregar os motivos.</p>
        ) : resumo.exibidos === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum modal exibido ainda.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Exibidos: </span>
                <span className="font-semibold">{resumo.exibidos}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Responderam: </span>
                <span className="font-semibold">{resumo.respondidos}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Taxa de resposta: </span>
                <span className="font-semibold">{taxaResposta}%</span>
              </div>
            </div>

            <div className="space-y-2">
              {resumo.porCategoria.map((c) => (
                <div key={c.categoria} className="flex items-center gap-3">
                  <div className="w-56 shrink-0 text-sm">{c.label}</div>
                  <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full bg-red-500/70"
                      style={{ width: `${(c.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <div className="w-20 shrink-0 text-right text-sm tabular-nums">
                    {c.count} <span className="text-muted-foreground">({c.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>

            {resumo.textosLivres.length > 0 && (
              <div className="pt-2">
                <p className="text-sm font-medium mb-2">“Outro motivo” — respostas recentes</p>
                <ul className="space-y-2">
                  {resumo.textosLivres.map((l, i) => (
                    <li key={i} className="text-sm border-l-2 border-red-500/40 pl-3">
                      <span>{l.motivo_texto}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {l.respondido_em
                          ? format(new Date(l.respondido_em), "dd/MM/yyyy", { locale: ptBR })
                          : ""}
                        {l.plano_tipo ? ` · ${l.plano_tipo}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

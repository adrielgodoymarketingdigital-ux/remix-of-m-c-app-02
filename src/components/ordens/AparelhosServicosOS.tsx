import { AlertTriangle, Loader2, Smartphone } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { cn } from "@/lib/utils";
import { useAdicionaisDaOS } from "@/contexts/AdicionaisPorOSContext";
import { chaveDispositivosAdicionaisOS, useOsDispositivosAdicionais } from "@/hooks/useOsDispositivosAdicionais";
import { useLinhasServicoOS } from "@/hooks/useLinhasServicoOS";
import {
  adicionaisFalharam,
  agruparServicosPorAparelho,
  type AparelhoLista,
} from "@/lib/ordemServico/aparelhosServicosListaOS";

interface AparelhosServicosOSProps {
  osId: string;
  /** Dispositivo 1 (colunas da OS que a lista já tem). */
  dispositivo1: AparelhoLista;
  /** Celular/tablet: um cartão embaixo do outro. */
  empilhado?: boolean;
}

/**
 * Conteúdo da linha expandida na lista de OS (etapa 6d, só para quem vê os
 * adicionais): um cartão por aparelho com os serviços ligados a ele e
 * "Da OS / aparelho principal". Só é montado com a linha ABERTA — é aí que as
 * consultas acontecem (aparelhos pela mesma chave de detalhes/impressão;
 * serviços só avarias->servicos_realizados).
 */
export function AparelhosServicosOS({ osId, dispositivo1, empilhado = false }: AparelhosServicosOSProps) {
  const queryClient = useQueryClient();
  const noResumo = useAdicionaisDaOS(osId).length;
  const { adicionais, carregando: carregandoAparelhos } = useOsDispositivosAdicionais(osId);
  const servicos = useLinhasServicoOS(osId, true);

  const carregando = carregandoAparelhos || servicos.isPending || (servicos.isError && servicos.isFetching);
  const falhou = !carregando && (servicos.isError || adicionaisFalharam(adicionais.length, noResumo));

  const tentarDeNovo = () => {
    queryClient.invalidateQueries({ queryKey: chaveDispositivosAdicionaisOS(osId) });
    servicos.refetch();
  };

  if (carregando) {
    return (
      <p className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground" data-aparelhos-servicos="carregando">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando aparelhos e serviços...
      </p>
    );
  }

  if (falhou) {
    return (
      <div className="flex flex-wrap items-center gap-2 px-3 py-3 text-xs text-destructive" data-aparelhos-servicos="erro">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Não foi possível carregar.</span>
        <Button type="button" variant="outline" size="sm" className="h-7 rounded-full px-3 text-xs" onClick={tentarDeNovo}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const { grupos, semServicos } = agruparServicosPorAparelho(servicos.data ?? [], dispositivo1, adicionais);
  const temPrincipal = grupos.some((g) => g.tipo === "principal");

  return (
    <div className="space-y-2 p-3" data-aparelhos-servicos="ok">
      <div className={cn("grid gap-2", empilhado ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
        {grupos.map((g) => (
          <div key={g.chave} className="min-w-0 rounded-lg border border-border/50 bg-card p-2.5" data-grupo-aparelho={g.tipo}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground min-w-0">
              {g.tipo !== "principal" && <Smartphone className="h-3 w-3 shrink-0 text-muted-foreground" />}
              <span className="truncate">{g.titulo}</span>
            </p>
            {g.detalhe && <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{g.detalhe}</p>}
            {g.servicos.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {g.servicos.map((s) => (
                  <li key={s.chave} className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate text-foreground/80">{s.nome}</span>
                    <span className="shrink-0 font-mono font-semibold">
                      <ValorMonetario valor={s.valor} tipo="preco" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              !semServicos && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {g.tipo === "dispositivo1" && temPrincipal
                    ? "Serviços em “Da OS / aparelho principal”."
                    : "Nenhum serviço ligado a este aparelho."}
                </p>
              )
            )}
          </div>
        ))}
      </div>
      {semServicos && <p className="text-xs text-muted-foreground" data-sem-servicos>Nenhum serviço lançado</p>}
    </div>
  );
}

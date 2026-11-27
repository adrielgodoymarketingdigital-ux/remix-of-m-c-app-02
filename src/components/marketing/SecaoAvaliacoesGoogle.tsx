import { Skeleton } from "@/components/ui/skeleton";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { CardConfigAvaliacaoGoogle } from "@/components/marketing/CardConfigAvaliacaoGoogle";
import { CardPedirAvaliacao } from "@/components/marketing/CardPedirAvaliacao";

/**
 * Marketing → Avaliações no Google. Usa a mesma configuração da loja que a tela
 * de OS lê ao entregar (useConfiguracaoLoja sem filial).
 */
export function SecaoAvaliacoesGoogle() {
  const { config, loading, atualizarConfiguracao, refetch } = useConfiguracaoLoja();

  if (loading && !config) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CardConfigAvaliacaoGoogle config={config} atualizarConfiguracao={atualizarConfiguracao} aoSalvar={refetch} />
      <CardPedirAvaliacao config={config} />
    </div>
  );
}

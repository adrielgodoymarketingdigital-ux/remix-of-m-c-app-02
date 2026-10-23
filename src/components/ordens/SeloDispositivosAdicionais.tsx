import { useAdicionaisDaOS } from "@/contexts/AdicionaisPorOSContext";
import { seloAdicionais } from "@/lib/ordemServico/dispositivosAdicionaisOS";

/**
 * "+1 aparelho" junto do modelo na lista e nos kanbans; nada sem adicionais.
 * Fica FORA do texto do modelo (que é truncado com "…"), para não ser cortado.
 */
export function SeloDispositivosAdicionais({ osId }: { osId: string }) {
  const quantidade = useAdicionaisDaOS(osId).length;
  if (quantidade === 0) return null;
  return (
    <span className="inline-flex w-fit shrink-0 self-start items-center whitespace-nowrap rounded border border-primary/30 bg-primary/10 px-1 text-[10px] font-semibold not-italic text-primary align-middle">
      {seloAdicionais(quantidade)}
    </span>
  );
}

/**
 * Por onde se abre "Minhas garantias": item no menu Configurações da página
 * Dispositivos. Regra única em src/lib/garantias/visibilidadeMinhasGarantias.ts
 * (fase A: só admin). Quem não vê o item não baixa o diálogo (chunk próprio)
 * nem consulta garantias_loja.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { ShieldPlus } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useIdentidade } from "@/hooks/useResolvedUserId";
import { type PapelLojaGarantias, telaMinhasGarantiasVisivelPara } from "@/lib/garantias/visibilidadeMinhasGarantias";

const DialogMinhasGarantias = lazy(() => import("./DialogMinhasGarantias"));

/** Papel na loja (gerente de filial > funcionário > dono); null = carregando. */
function usePapelLoja(): PapelLojaGarantias | null {
  const { isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const { isGerenteFilial, carregando: carregandoIdentidade } = useIdentidade();
  if (carregandoPermissoes || carregandoIdentidade) return null;
  return isGerenteFilial ? "gerente" : isFuncionario ? "funcionario" : "dono";
}

export function useTelaMinhasGarantiasVisivel(): boolean {
  const { data: isAdmin } = useIsAdminMecApp();
  const papel = usePapelLoja();
  return telaMinhasGarantiasVisivelPara({ isAdmin: isAdmin === true, papel });
}

/** Item de menu (dentro de um DropdownMenuContent). */
export function ItemMenuMinhasGarantias({ onAbrir }: { onAbrir: () => void }) {
  const visivel = useTelaMinhasGarantiasVisivel();
  if (!visivel) return null;
  return (
    <DropdownMenuItem onClick={onAbrir}>
      <ShieldPlus className="h-4 w-4 mr-2" aria-hidden="true" />
      Minhas garantias
    </DropdownMenuItem>
  );
}

/** Diálogo montado só depois da 1ª abertura (e mantido para a animação de fechar). */
export function DialogMinhasGarantiasSobDemanda({ open, onOpenChange }: { open: boolean; onOpenChange: (aberto: boolean) => void }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    if (open) setMontado(true);
  }, [open]);
  if (!(open || montado)) return null;
  return <DialogSeVisivel open={open} onOpenChange={onOpenChange} />;
}

function DialogSeVisivel({ open, onOpenChange }: { open: boolean; onOpenChange: (aberto: boolean) => void }) {
  const visivel = useTelaMinhasGarantiasVisivel();
  if (!visivel) return null;
  return (
    <Suspense fallback={null}>
      <DialogMinhasGarantias open={open} onOpenChange={onOpenChange} />
    </Suspense>
  );
}

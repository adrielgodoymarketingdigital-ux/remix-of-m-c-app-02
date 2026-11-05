import { useAssinatura } from "@/hooks/useAssinatura";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { podeAcessarModuloContas } from "@/lib/contas/acessoModuloContas";

/** true quando o usuário pode abrir o menu Contas (mesma regra da rota /contas). */
export function usePodeVerContas(): boolean {
  const { temAcessoModulo: planoTem, assinatura, carregando: carregandoAssinatura } = useAssinatura();
  const { isFuncionario, carregando: carregandoFuncionario, temAcessoModulo: funcionarioTem } = useFuncionarioPermissoes();
  return podeAcessarModuloContas({
    carregandoFuncionario,
    isFuncionario,
    funcionarioTemModulo: funcionarioTem("contas"),
    carregandoAssinatura,
    temAssinatura: !!assinatura,
    planoTemModulo: planoTem("contas"),
  });
}

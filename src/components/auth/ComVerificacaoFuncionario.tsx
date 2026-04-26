import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { Skeleton } from "@/components/ui/skeleton";
import type { PermissoesModulos } from "@/types/funcionario";

interface ComVerificacaoFuncionarioProps {
  children: ReactNode;
  modulo?: keyof PermissoesModulos;
}

export function ComVerificacaoFuncionario({ children, modulo }: ComVerificacaoFuncionarioProps) {
  const { carregando, temAcessoModulo, isFuncionario, isDonoLoja } = useFuncionarioPermissoes();
  const location = useLocation();

  if (carregando) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Se é dono da loja, sempre tem acesso
  if (isDonoLoja) {
    return <>{children}</>;
  }

  // Se é funcionário e tem um módulo especificado, verifica a permissão
  if (isFuncionario && modulo) {
    if (!temAcessoModulo(modulo)) {
      return <Navigate to="/dashboard" state={{ from: location }} replace />;
    }
  }

  return <>{children}</>;
}

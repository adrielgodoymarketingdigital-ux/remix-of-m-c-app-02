import { useState } from 'react';

// "Mostrar custo e lucro" nos relatórios exportados de Produtos e Peças.
// Lembra a última escolha neste aparelho (mesmo padrão de useColunasVisiveis).
// Sem localStorage (modo privado, bloqueado): fica ligado, como antes da opção.
const STORAGE_KEY = 'produtos_exportar_mostrar_custo_lucro';

function lerStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function salvarStorage(valor: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(valor));
  } catch {
    // Sem onde guardar: vale só enquanto a tela estiver aberta.
  }
}

export function useMostrarCustoLucroExportacao() {
  const [mostrarCustoELucro, setMostrar] = useState<boolean>(() => lerStorage());

  const alterarMostrarCustoELucro = (valor: boolean) => {
    setMostrar(valor);
    salvarStorage(valor);
  };

  return { mostrarCustoELucro, alterarMostrarCustoELucro };
}

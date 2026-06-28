import { useState } from 'react';

export const COLUNAS_DISPONIVEIS = [
  { id: 'foto', label: 'Foto', obrigatoria: false },
  { id: 'tipo', label: 'Tipo', obrigatoria: false },
  { id: 'codigo', label: 'Código / SKU', obrigatoria: false },
  { id: 'nome', label: 'Nome', obrigatoria: true },
  { id: 'categoria', label: 'Categoria', obrigatoria: false },
  { id: 'fornecedor', label: 'Fornecedor', obrigatoria: false },
  { id: 'cadastro', label: 'Data de Cadastro', obrigatoria: false },
  { id: 'quantidade', label: 'Quantidade', obrigatoria: false },
  { id: 'custo', label: 'Custo', obrigatoria: false },
  { id: 'preco_venda', label: 'Preço Venda', obrigatoria: false },
  { id: 'preco_atacado', label: 'Preço Atacado', obrigatoria: false },
  { id: 'lucro', label: 'Lucro', obrigatoria: false },
] as const;

export type ColunaId = typeof COLUNAS_DISPONIVEIS[number]['id'];

const COLUNAS_PADRAO: ColunaId[] = ['foto', 'nome', 'categoria', 'quantidade', 'custo', 'preco_venda', 'lucro'];
const STORAGE_KEY = 'produtos_colunas_visiveis';

function lerStorage(): Set<ColunaId> {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) return new Set(JSON.parse(salvo) as ColunaId[]);
  } catch {}
  return new Set(COLUNAS_PADRAO);
}

function salvarStorage(colunas: Set<ColunaId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...colunas]));
  } catch {}
}

export function useColunasVisiveis() {
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<ColunaId>>(() => lerStorage());

  const toggleColuna = (id: ColunaId) => {
    const coluna = COLUNAS_DISPONIVEIS.find(c => c.id === id);
    if (coluna?.obrigatoria) return;
    setColunasVisiveis(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      salvarStorage(next);
      return next;
    });
  };

  const resetarColunas = () => {
    const padrao = new Set(COLUNAS_PADRAO);
    salvarStorage(padrao);
    setColunasVisiveis(padrao);
  };

  return { colunasVisiveis, toggleColuna, resetarColunas };
}

import { CategoriaProduto } from '@/types/categoria-produto';

// Ordena categorias com subcategorias logo após a categoria pai (ordem de árvore em uma lista plana)
export function ordenarCategoriasHierarquicamente(
  categorias: CategoriaProduto[]
): { categoria: CategoriaProduto; nivel: number }[] {
  const porPai = new Map<string | null, CategoriaProduto[]>();
  categorias.forEach((cat) => {
    const chave = cat.categoria_pai_id || null;
    if (!porPai.has(chave)) porPai.set(chave, []);
    porPai.get(chave)!.push(cat);
  });

  const resultado: { categoria: CategoriaProduto; nivel: number }[] = [];
  const percorrer = (paiId: string | null, nivel: number) => {
    (porPai.get(paiId) || []).forEach((cat) => {
      resultado.push({ categoria: cat, nivel });
      percorrer(cat.id, nivel + 1);
    });
  };
  percorrer(null, 0);
  return resultado;
}

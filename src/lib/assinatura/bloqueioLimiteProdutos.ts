// Decide se o clique em "Novo produto" abre a janela "Limite de Produtos Atingido".
// Função pura: a página busca a contagem NA HORA do clique e passa aqui.
//
// Regras (as mesmas de antes, sem mudar limite de plano nenhum):
// - Assinatura ainda carregando → nunca bloqueia (igual podeAbrirNovaOrdem da OS).
// - Só o plano free é bloqueado nesta tela (trial ativo chega aqui como ilimitado).
// - limite <= 0 não é limite de plano: -1 = ilimitado e 0 = contagem que falhou
//   (obterContagemProdutosMes devolve limite 0 em erro). Nenhum plano tem cota 0.
// - Bloqueia quando usados >= limite.

export interface EntradaBloqueioProdutos {
  assinaturaCarregando: boolean;
  planoTipo: string | null | undefined;
  ilimitado: boolean;
  usados: number;
  limite: number;
}

export function deveBloquearNovoProduto(e: EntradaBloqueioProdutos): boolean {
  if (e.assinaturaCarregando) return false;
  if (e.planoTipo !== "free") return false;
  if (e.ilimitado) return false;
  if (!(e.limite > 0)) return false;
  return e.usados >= e.limite;
}

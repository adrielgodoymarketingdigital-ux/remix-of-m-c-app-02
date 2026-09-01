// Walkthroughs curtos disparados pelo card "Primeiros Passos": ao clicar num
// item do checklist, o usuário é levado para a tela REAL (?walkthrough=<key>) e
// um mini tour aponta onde clicar. Cada `target` casa com um atributo
// `data-walkthrough="<target>"` na tela/dialog correspondente.

export interface WalkStep {
  /** valor do atributo data-walkthrough do elemento a destacar */
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

export interface WalkthroughConfig {
  /** rota onde o walkthrough roda; fora dela o host não renderiza nada */
  pathname: string;
  steps: WalkStep[];
}

export const WALKTHROUGHS = {
  produto: {
    pathname: "/produtos",
    steps: [
      {
        target: "produtos-novo-item",
        position: "bottom",
        title: "Cadastre seu primeiro produto",
        description:
          'Todo item que você vende fica aqui no estoque. Clique em "Novo Item" para cadastrar o primeiro.',
      },
      {
        target: "produto-dialog",
        position: "left",
        title: "Preencha os dados",
        description:
          "Nome, preço de venda e custo. É exatamente assim que você cadastra qualquer produto no dia a dia.",
      },
      {
        target: "produto-btn-salvar",
        position: "top",
        title: "Salve e pronto",
        description: "Ao salvar, o produto já fica disponível no PDV e nas Ordens de Serviço.",
      },
    ],
  },
  venda: {
    pathname: "/pdv",
    steps: [
      {
        target: "pdv-adicionar-item",
        position: "bottom",
        title: "Comece uma venda",
        description: 'No PDV a venda é rápida. Clique em "Adicionar Item" para escolher um produto.',
      },
      {
        target: "pdv-selecionar-item",
        position: "left",
        title: "Escolha o produto",
        description: "Busque pelo nome, ajuste a quantidade e confirme para jogar no carrinho.",
      },
      {
        target: "pdv-finalizar",
        position: "top",
        title: "Finalize a venda",
        description:
          "Confira o resumo, escolha a forma de pagamento e finalize. A venda entra no faturamento na hora.",
      },
    ],
  },
} satisfies Record<string, WalkthroughConfig>;

export type WalkthroughKey = keyof typeof WALKTHROUGHS;

export function isWalkthroughKey(v: string | null): v is WalkthroughKey {
  return v !== null && Object.prototype.hasOwnProperty.call(WALKTHROUGHS, v);
}

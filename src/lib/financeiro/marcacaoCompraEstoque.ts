/**
 * Caixinha "Compra de mercadoria para estoque" (contas.compra_estoque) no
 * cadastro de contas, reagindo à categoria escolhida pelo usuário.
 *
 * - Escolher "Compra de Mercadoria" (conta a pagar) marca a caixinha.
 * - Trocar para outra categoria desmarca SÓ se a marcação foi automática;
 *   marcação feita à mão fica como está.
 * - Só reage a uma troca de categoria feita pelo usuário: abrir/editar uma
 *   conta existente (form.reset) não passa por aqui, então nada muda sozinho.
 *
 * Arquivo sem imports: roda direto no Deno (scripts/testes-compra-estoque/).
 */

export const CATEGORIA_COMPRA_MERCADORIA = "Compra de Mercadoria";

export const AVISO_SEM_MARCACAO_COMPRA =
  "Sem esta marcação, o valor também será descontado do lucro, além do custo da venda.";

export interface EstadoMarcacaoCompra {
  marcada: boolean;
  /** true quando a caixinha foi marcada pela escolha da categoria (não pelo usuário). */
  automatica: boolean;
}

export function decidirMarcacaoCompraEstoque(args: {
  tipo: "pagar" | "receber";
  categoriaAnterior: string | null | undefined;
  categoriaNova: string | null | undefined;
  estado: EstadoMarcacaoCompra;
}): EstadoMarcacaoCompra {
  const { tipo, categoriaAnterior, categoriaNova, estado } = args;
  if (tipo !== "pagar" || categoriaAnterior === categoriaNova) return estado;

  if (categoriaNova === CATEGORIA_COMPRA_MERCADORIA) {
    // Já marcada à mão: continua marcada e continua "do usuário".
    return estado.marcada ? estado : { marcada: true, automatica: true };
  }

  if (categoriaAnterior === CATEGORIA_COMPRA_MERCADORIA && estado.automatica) {
    return { marcada: false, automatica: false };
  }

  return estado;
}

/** Usuário mexeu na caixinha: o valor passa a ser escolha dele. */
export const marcacaoManual = (marcada: boolean): EstadoMarcacaoCompra => ({ marcada, automatica: false });

/** Aviso enquanto a categoria é "Compra de Mercadoria" e a caixinha está desmarcada. */
export function deveAvisarSemMarcacao(args: {
  tipo: "pagar" | "receber";
  categoria: string | null | undefined;
  marcada: boolean;
}): boolean {
  return args.tipo === "pagar" && args.categoria === CATEGORIA_COMPRA_MERCADORIA && !args.marcada;
}

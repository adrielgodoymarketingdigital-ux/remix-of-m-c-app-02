interface PecaUtilizadaOS {
  quantidade?: number | string | null;
  preco_total?: number | string | null;
  custo_unitario?: number | string | null;
}

/**
 * Receita (preço cobrado) e custo das peças/produtos usados numa OS
 * (avarias.produtos_utilizados). O custo é o snapshot gravado quando o item
 * entrou na OS.
 */
export function totaisPecasOS(avarias: unknown): { receita: number; custo: number } {
  const itens = ((avarias as { produtos_utilizados?: PecaUtilizadaOS[] } | null)?.produtos_utilizados) ?? [];
  return itens.reduce(
    (acc, p) => {
      const qtd = Number(p.quantidade) || 1;
      return {
        receita: acc.receita + (Number(p.preco_total) || 0),
        custo: acc.custo + (Number(p.custo_unitario) || 0) * qtd,
      };
    },
    { receita: 0, custo: 0 },
  );
}

/**
 * Linha de serviço da OS. Quando `peca_repassada` é true (serviço com peça
 * vinculada, lançado depois da regra de 30/09/2026), `preco` é SÓ a mão de
 * obra e a peça é cobrada do cliente pelo custo, sem margem:
 *   valor da linha = mão de obra + custo da peça
 *   lucro da linha = mão de obra
 * Sem a flag (serviço sem peça, ou OS antiga), `preco` é o valor cheio da
 * linha e o lucro é preço − custo, como sempre foi.
 */
export interface LinhaServicoOS {
  preco?: number | string | null;
  custo?: number | string | null;
  peca_valor?: number | string | null;
  peca_repassada?: boolean | null;
}

/** Custo da peça/serviço (peca_valor quando informado na OS, senão o custo do serviço). */
export function custoLinhaServico(s: LinhaServicoOS): number {
  return Number(s.peca_valor ?? s.custo) || 0;
}

/** Valor cobrado do cliente pela linha. */
export function valorLinhaServico(s: LinhaServicoOS): number {
  return (Number(s.preco) || 0) + (s.peca_repassada ? custoLinhaServico(s) : 0);
}

/** Lucro da linha: mão de obra quando a peça é repassada, senão preço − custo. */
export function lucroLinhaServico(s: LinhaServicoOS): number {
  return valorLinhaServico(s) - custoLinhaServico(s);
}

/** Soma do custo dos serviços realizados (inclui a peça vinculada ao serviço). */
export function custoServicosOS(avarias: unknown): number {
  const servicos = ((avarias as { servicos_realizados?: { custo?: number | string | null }[] } | null)?.servicos_realizados) ?? [];
  return servicos.reduce((acc, s) => acc + (Number(s.custo) || 0), 0);
}

// Montagem dos cenários: loja fictícia, relógio falso do aparelho e execução do hook real.
import { servidor } from "@/integrations/supabase/client";
import { relogioServidor } from "@/lib/horaBrasilia/relogioServidor";

export const H = 3_600_000;
export const M = 60_000;
export const ABRE = Date.parse("2026-11-17T12:00:00.000Z"); // 09:00 em Brasília
export const FECHA = ABRE + 8 * H; // 17:00 em Brasília
export const iso = (ms: number) => new DataReal(ms).toISOString();

const DataReal = Date;

/** Relógio do aparelho = hora do servidor + desvio. */
export function instalarRelogio(desvioMs: () => number) {
  const agora = () => servidor.agoraMs + desvioMs();
  class DataFalsa extends DataReal {
    constructor(...a: unknown[]) {
      // @ts-ignore: repassa os argumentos de Date
      a.length ? super(...a) : super(agora());
    }
    static override now() { return agora(); }
  }
  globalThis.Date = DataFalsa as DateConstructor;
  return () => { globalThis.Date = DataReal; };
}

export const caixaAberto = (extra: Record<string, unknown> = {}) => ({
  id: "cx", user_id: "dono", proprietario_id: "dono", empresa_id: null, status: "aberto",
  data_abertura: iso(ABRE), data_fechamento: null, saldo_inicial: 100, saldo_final: null,
  total_vendas: 0, total_dinheiro: 0, total_pix: 0, total_cartao: 0, total_a_receber: 0,
  total_servicos: 0, total_devolucoes_troca: 0, observacoes: null, ...extra,
});

export const venda = (dataMs: number, p: Record<string, unknown> = {}) => ({
  user_id: "dono", empresa_id: null, data: iso(dataMs), forma_pagamento: "dinheiro", total: 100, observacoes: "Item",
  cancelada: null, segunda_forma_pagamento: null, valor_segunda_forma: null, valor_troca: null,
  valor_desconto_manual: 0, valor_desconto_cupom: 0, ...p,
});
export const avulsa = (dataMs: number, valor: number, forma = "dinheiro") => ({ user_id: "dono", valor, forma_pagamento: forma, created_at: iso(dataMs), deleted_at: null });

/** Loja com todo tipo de lançamento, gravado na hora certa. */
export function lojaCompleta() {
  const t = ABRE + 2 * H;
  return {
    caixas: [caixaAberto()],
    vendas: [
      venda(t, { total: 100, valor_desconto_manual: 10 }),
      venda(t, { forma_pagamento: "pix", total: 80.1 }),
      venda(t, { forma_pagamento: "debito", total: 70.2 }),
      venda(t, { forma_pagamento: "credito_parcelado", total: 33.33 }),
      venda(t, { forma_pagamento: "a_receber", total: 40 }),
      venda(t, { forma_pagamento: "outro", total: 25, observacoes: "Item [forma:Link]" }),
      venda(t, { total: 200, segunda_forma_pagamento: "pix", valor_segunda_forma: 50 }),
      venda(t, { forma_pagamento: "pix", total: 50, observacoes: "pagamento_duplo_secundario" }),
      venda(t, { total: 300, valor_troca: 120 }),
      venda(t, { total: 999, cancelada: true }),
      venda(t, { total: 777, observacoes: "Peça utilizado na OS 7" }),
      venda(ABRE - H, { total: 555 }),
      venda(t, { total: 444, user_id: "outra-loja" }),
    ],
    vendas_avulsas: [avulsa(t, 30), avulsa(t, 12.5, "pix"), avulsa(t, 18, "transferencia"), { ...avulsa(t, 66), deleted_at: iso(t) }],
    ordens_servico: [
      { numero_os: "1", user_id: "dono", status: "entregue", deleted_at: null, total: 150, forma_pagamento: "dinheiro", avarias: {}, created_at: iso(t), data_caixa: "2026-11-17", data_saida: iso(t) },
      { numero_os: "2", user_id: "dono", status: "entregue", deleted_at: null, total: 300, forma_pagamento: "pix", avarias: { dados_pagamento: { entrada: 100, forma: "pix", forma_pagamento_entrada: "dinheiro" } }, created_at: iso(t), data_caixa: "2026-11-17", data_saida: iso(t) },
      { numero_os: "3", user_id: "dono", status: "entregue", deleted_at: null, total: 500, forma_pagamento: "a_prazo", avarias: { dados_pagamento: { forma: "a_prazo" } }, created_at: iso(t), data_caixa: "2026-11-17", data_saida: iso(t) },
    ],
    contas: [{ os_numero: "3", user_id: "dono", tipo: "receber", status: "pendente" }],
    caixa_movimentacoes: [{ caixa_id: "cx", tipo: "sangria", valor: 25 }, { caixa_id: "cx", tipo: "suprimento", valor: 10 }],
    vendas_trocas: [{ caixa_id: "cx", valor_devolvido: 15, forma_devolucao: "dinheiro", cancelada: false }],
  };
}

/** Os quatro lançamentos do caso real: R$ 200 ao todo. `pdvMs` diz como o PDV grava a hora. */
export function lojaDoCasoReal(pdvMs: (servidorMs: number) => number) {
  return {
    caixas: [caixaAberto()],
    vendas: [venda(pdvMs(ABRE + M), { total: 100 }), venda(pdvMs(ABRE + 4 * H), { total: 50 }), venda(pdvMs(FECHA - M), { total: 20 })],
    vendas_avulsas: [avulsa(FECHA - 2 * M, 30)],
  };
}

export interface Opcoes {
  tabelas: Record<string, any[]>;
  desvioMs?: number;
  rpc?: typeof servidor.rpc;
  gatilho?: boolean;
  agoraMs?: number;
}

export function preparar(o: Opcoes) {
  relogioServidor.reiniciar();
  Object.assign(servidor, {
    agoraMs: o.agoraMs ?? FECHA, rpc: o.rpc ?? "ok", chamadasRpc: 0, gatilho: o.gatilho ?? false,
    tabelas: structuredClone(o.tabelas), escritas: [], consultas: [], antesDeAtualizar: null,
  });
}

/** Fecha o caixa com o hook indicado e devolve o que foi gravado. */
export async function fechar(useHook: () => any, o: Opcoes, saldoContado?: number) {
  preparar(o);
  const restaurar = instalarRelogio(() => o.desvioMs ?? 0);
  try {
    const resultado = await useHook().fecharCaixa("cx", undefined, saldoContado);
    return { resultado, patch: servidor.escritas[0]?.corpo, linha: servidor.tabelas.caixas[0], escritas: servidor.escritas };
  } finally {
    restaurar();
  }
}

export const soma4 = (p: any) => p.total_dinheiro + p.total_pix + p.total_cartao + p.total_a_receber;

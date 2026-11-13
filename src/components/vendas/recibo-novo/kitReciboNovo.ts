/**
 * Tudo o que o recibo novo precisa num chunk só, carregado sob demanda
 * (import() em useModeloReciboNovo) apenas para quem a regra libera: quem não
 * vê o recibo novo não baixa nada disso (componente, QR, CSS, montagem, leitura).
 */
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import {
  type DadosPDVParaRecibo,
  type DadosVendaCarregados,
  type EntradaReciboVenda,
  entradaDasLinhas,
  entradaDoPDV,
  extrasDoBanco,
  type LojaReciboEntrada,
  type ModeloTermoEntrada,
  montarReciboVenda,
  type ReciboVendaModelo,
  type TermoConfigEntrada,
} from "@/lib/vendas/reciboVendaModelo";
import { MODELOS_PADRAO_GARANTIA } from "@/components/dispositivos/DialogConfiguracaoTermoGarantiaDispositivo";

export { carregarReciboVenda } from "@/lib/vendas/carregarReciboVenda";
export { ReciboVendaNovoSeguro } from "./ReciboVendaNovoSeguro";
export { cssReciboVendaNovo } from "./cssReciboVendaNovo";
export { cssPrintRootReciboNovo, documentoImpressaoReciboNovo } from "./impressaoReciboVendaNovo";

/** Termo da loja como os recibos de hoje resolvem (modelos salvos ou os padrão). */
function termoDaLoja(config: ConfiguracaoLoja): EntradaReciboVenda["termo"] {
  const termo = (config.termo_garantia_dispositivo_config ?? null) as (TermoConfigEntrada & { modelos?: ModeloTermoEntrada[] }) | null;
  return {
    config: termo,
    modelos: termo?.modelos?.length ? termo.modelos : (MODELOS_PADRAO_GARANTIA as ModeloTermoEntrada[]),
  };
}

const contexto = (loja: ConfiguracaoLoja) => ({ loja: loja as LojaReciboEntrada, termo: termoDaLoja(loja), origemApp: window.location.origin });

/**
 * Monta com a personalização da loja (recibo_venda_config da MESMA linha de
 * configuracoes_loja já lida para loja/logo/termo: nenhuma consulta a mais).
 * Vale a configuração ATUAL, também na reimpressão. Coluna ausente, nula ou
 * inválida = padrão (normalizarReciboVendaConfig); se aplicar a personalização
 * falhar, sai o recibo novo de sempre, nunca o antigo por causa dela.
 */
function montarComPersonalizacao(entrada: EntradaReciboVenda, loja: ConfiguracaoLoja): ReciboVendaModelo {
  const personalizacao = loja.recibo_venda_config;
  if (personalizacao === undefined || personalizacao === null) return montarReciboVenda(entrada);
  try {
    return montarReciboVenda(entrada, personalizacao);
  } catch (erro) {
    console.error("[recibo novo] personalização da loja ignorada (falha ao aplicar)", erro);
    return montarReciboVenda(entrada);
  }
}

/** Recibo reaberto (Vendas, Dispositivos vendidos). */
export function montarReciboReaberto(dados: DadosVendaCarregados, loja: ConfiguracaoLoja): ReciboVendaModelo {
  return montarComPersonalizacao(entradaDasLinhas(dados, contexto(loja)), loja);
}

/** Recibo logo após o PDV: dados do PDV completados pelo que a finalização gravou (banco null = só o PDV). */
export function montarReciboPDV(dados: DadosPDVParaRecibo, banco: DadosVendaCarregados | null, loja: ConfiguracaoLoja): ReciboVendaModelo {
  return montarComPersonalizacao(entradaDoPDV(dados, { ...contexto(loja), ...(banco ? extrasDoBanco(banco) : {}) }), loja);
}

export type KitReciboNovo = typeof import("./kitReciboNovo");

/**
 * Monta o recibo novo para os diálogos de recibo (só quando `ativo`: quem não
 * vê o recibo novo não faz nenhuma consulta a mais). Qualquer falha ao ler ou
 * montar → modelo null, e o diálogo segue com o recibo antigo (sem toast).
 */
import { useEffect, useMemo, useState } from "react";
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
import { carregarReciboVenda } from "@/lib/vendas/carregarReciboVenda";
import { MODELOS_PADRAO_GARANTIA } from "@/components/dispositivos/DialogConfiguracaoTermoGarantiaDispositivo";

export interface EstadoReciboNovo {
  modelo: ReciboVendaModelo | null;
  /** Ainda lendo o banco: o botão A4 espera (o recibo antigo não muda). */
  carregando: boolean;
}

/** Termo da loja como os recibos de hoje resolvem (modelos salvos ou os padrão). */
function termoDaLoja(config: ConfiguracaoLoja | null): EntradaReciboVenda["termo"] {
  const termo = (config?.termo_garantia_dispositivo_config ?? null) as (TermoConfigEntrada & { modelos?: ModeloTermoEntrada[] }) | null;
  return {
    config: termo,
    modelos: termo?.modelos?.length ? termo.modelos : (MODELOS_PADRAO_GARANTIA as ModeloTermoEntrada[]),
  };
}

function montarComSeguranca(montar: () => EntradaReciboVenda): ReciboVendaModelo | null {
  try {
    return montarReciboVenda(montar());
  } catch (erro) {
    console.error("[recibo novo] falha ao montar; usando o recibo antigo", erro);
    return null;
  }
}

async function carregarComSeguranca(vendaId: string, grupoVenda: string | null | undefined): Promise<DadosVendaCarregados | null> {
  try {
    return await carregarReciboVenda({ vendaId, grupoVenda });
  } catch (erro) {
    console.error("[recibo novo] falha ao ler a venda; usando o recibo antigo", erro);
    return null;
  }
}

function useDadosDoBanco(ativo: boolean, vendaId: string | null | undefined, grupoVenda: string | null | undefined) {
  const [estado, setEstado] = useState<{ chave: string; dados: DadosVendaCarregados | null } | null>(null);
  const chave = ativo && vendaId ? `${vendaId}|${grupoVenda ?? ""}` : null;
  useEffect(() => {
    if (!chave || !vendaId) return;
    let cancelado = false;
    carregarComSeguranca(vendaId, grupoVenda).then((dados) => {
      if (!cancelado) setEstado({ chave, dados });
    });
    return () => {
      cancelado = true;
    };
  }, [chave, vendaId, grupoVenda]);
  const pronto = !!chave && estado?.chave === chave;
  return { dados: pronto ? estado.dados : null, carregando: !!chave && !pronto };
}

/** Recibo reaberto (Vendas, Dispositivos vendidos): lê a venda e monta pelas linhas. */
export function useModeloReciboNovoReaberto(p: {
  ativo: boolean;
  vendaId: string | null | undefined;
  grupoVenda: string | null | undefined;
  loja: ConfiguracaoLoja | null;
}): EstadoReciboNovo {
  const { dados, carregando } = useDadosDoBanco(p.ativo, p.vendaId, p.grupoVenda);
  const modelo = useMemo(
    () =>
      p.ativo && dados && p.loja
        ? montarComSeguranca(() => entradaDasLinhas(dados, { loja: p.loja as LojaReciboEntrada, termo: termoDaLoja(p.loja), origemApp: window.location.origin }))
        : null,
    [p.ativo, dados, p.loja],
  );
  return { modelo, carregando: p.ativo && (carregando || !p.loja) };
}

/**
 * Recibo logo após o PDV: valores, troca e forma do PDV (entradaDoPDV),
 * completados pelo que a finalização gravou (extrasDoBanco). Se a leitura
 * falhar, sai só com os dados do PDV.
 */
export function useModeloReciboNovoPDV(p: {
  ativo: boolean;
  dados: (DadosPDVParaRecibo & { grupoVendaId?: string | null }) | null;
  vendaId: string | null | undefined;
  loja: ConfiguracaoLoja | null;
}): EstadoReciboNovo {
  const { dados: banco, carregando } = useDadosDoBanco(p.ativo && !!p.dados, p.vendaId, p.dados?.grupoVendaId);
  const modelo = useMemo(
    () =>
      p.ativo && p.dados && p.loja && !carregando
        ? montarComSeguranca(() =>
            entradaDoPDV(p.dados as DadosPDVParaRecibo, {
              loja: p.loja as LojaReciboEntrada,
              termo: termoDaLoja(p.loja),
              origemApp: window.location.origin,
              ...(banco ? extrasDoBanco(banco) : {}),
            }),
          )
        : null,
    [p.ativo, p.dados, p.loja, banco, carregando],
  );
  return { modelo, carregando: p.ativo && !!p.dados && (carregando || !p.loja) };
}

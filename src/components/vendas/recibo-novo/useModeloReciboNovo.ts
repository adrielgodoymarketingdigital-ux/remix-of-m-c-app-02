/**
 * Monta o recibo novo para os diálogos de recibo, só quando `ativo` (a regra
 * de visibilidade liberou): aí carrega sob demanda o kit do recibo novo
 * (kitReciboNovo: componente, QR, CSS, montagem) e lê a venda. Quem não vê o
 * recibo novo não baixa o kit nem faz consulta a mais. Qualquer falha ao
 * carregar, ler ou montar → modelo null, e o diálogo segue com o recibo antigo
 * (sem toast, só console). Kit, leitura da venda e configuração da loja têm
 * tempo máximo (TEMPO_MAXIMO_RECIBO_NOVO_MS): esgotou, também recibo antigo —
 * o A4 nunca fica apagado para sempre.
 */
import { useEffect, useMemo, useState } from "react";
import { comTempoMaximo, TEMPO_MAXIMO_RECIBO_NOVO_MS } from "@/lib/tempoMaximo";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import type { DadosPDVParaRecibo, DadosVendaCarregados, ReciboVendaModelo } from "@/lib/vendas/reciboVendaModelo";
import type { KitReciboNovo } from "./kitReciboNovo";

export interface EstadoReciboNovo {
  /** Kit carregado (componente, CSS e impressão do recibo novo). */
  kit: KitReciboNovo | null;
  modelo: ReciboVendaModelo | null;
  /** Ainda carregando o kit ou lendo o banco: o botão A4 espera (o recibo antigo não muda). */
  carregando: boolean;
}

let kitPromessa: Promise<KitReciboNovo | null> | null = null;
function carregarKit(): Promise<KitReciboNovo | null> {
  kitPromessa ??= import("./kitReciboNovo").catch((erro) => {
    console.error("[recibo novo] falha ao carregar; usando o recibo antigo", erro);
    kitPromessa = null;
    return null;
  });
  return kitPromessa;
}

/** Kit + dados da venda no banco. */
function useKitEDados(ativo: boolean, vendaId: string | null | undefined, grupoVenda: string | null | undefined) {
  const chave = ativo && vendaId ? `${vendaId}|${grupoVenda ?? ""}` : null;
  const [estado, setEstado] = useState<{ chave: string; kit: KitReciboNovo | null; dados: DadosVendaCarregados | null } | null>(null);
  useEffect(() => {
    if (!chave || !vendaId) return;
    let cancelado = false;
    (async () => {
      const kit = await comTempoMaximo(carregarKit(), TEMPO_MAXIMO_RECIBO_NOVO_MS, () => {
        console.error("[recibo novo] kit não carregou a tempo; usando o recibo antigo");
        return null;
      });
      let dados: DadosVendaCarregados | null = null;
      if (kit) {
        try {
          dados = await comTempoMaximo(kit.carregarReciboVenda({ vendaId, grupoVenda }), TEMPO_MAXIMO_RECIBO_NOVO_MS, () => {
            console.error("[recibo novo] leitura da venda não terminou a tempo; usando o recibo antigo");
            return null;
          });
        } catch (erro) {
          console.error("[recibo novo] falha ao ler a venda; usando o recibo antigo", erro);
        }
      }
      if (!cancelado) setEstado({ chave, kit, dados });
    })();
    return () => {
      cancelado = true;
    };
  }, [chave, vendaId, grupoVenda]);
  const pronto = !!chave && estado?.chave === chave;
  return { kit: pronto ? estado.kit : null, dados: pronto ? estado.dados : null, carregando: !!chave && !pronto };
}

/**
 * true quando `esperando` já dura mais que o tempo máximo (a configuração da
 * loja que não chega não pode prender o A4). Volta a false quando para de esperar.
 */
function useEsperaEsgotada(esperando: boolean): boolean {
  const [esgotada, setEsgotada] = useState(false);
  useEffect(() => {
    setEsgotada(false);
    if (!esperando) return;
    const id = setTimeout(() => {
      console.error("[recibo novo] configuração da loja não chegou a tempo; usando o recibo antigo");
      setEsgotada(true);
    }, TEMPO_MAXIMO_RECIBO_NOVO_MS);
    return () => clearTimeout(id);
  }, [esperando]);
  return esperando && esgotada;
}

function montarComSeguranca(montar: () => ReciboVendaModelo): ReciboVendaModelo | null {
  try {
    return montar();
  } catch (erro) {
    console.error("[recibo novo] falha ao montar; usando o recibo antigo", erro);
    return null;
  }
}

/** Recibo reaberto (Vendas, Dispositivos vendidos): lê a venda e monta pelas linhas. */
export function useModeloReciboNovoReaberto(p: {
  ativo: boolean;
  vendaId: string | null | undefined;
  grupoVenda: string | null | undefined;
  loja: ConfiguracaoLoja | null;
}): EstadoReciboNovo {
  const { kit, dados, carregando } = useKitEDados(p.ativo, p.vendaId, p.grupoVenda);
  const semLojaEsgotado = useEsperaEsgotada(p.ativo && !p.loja);
  const modelo = useMemo(
    () => (kit && dados && p.loja ? montarComSeguranca(() => kit.montarReciboReaberto(dados, p.loja as ConfiguracaoLoja)) : null),
    [kit, dados, p.loja],
  );
  return { kit, modelo, carregando: p.ativo && (carregando || (!p.loja && !semLojaEsgotado)) };
}

/**
 * Recibo logo após o PDV: valores, troca e forma do PDV, completados pelo que
 * a finalização gravou. Se a leitura falhar, sai só com os dados do PDV.
 */
export function useModeloReciboNovoPDV(p: {
  ativo: boolean;
  dados: (DadosPDVParaRecibo & { grupoVendaId?: string | null }) | null;
  loja: ConfiguracaoLoja | null;
}): EstadoReciboNovo {
  const ativo = p.ativo && !!p.dados;
  const grupo = p.dados?.grupoVendaId ?? null;
  const { kit, dados: banco, carregando } = useKitEDados(ativo, grupo, grupo);
  const semLojaEsgotado = useEsperaEsgotada(ativo && !p.loja);
  const modelo = useMemo(
    () => (kit && p.dados && p.loja ? montarComSeguranca(() => kit.montarReciboPDV(p.dados as DadosPDVParaRecibo, banco, p.loja as ConfiguracaoLoja)) : null),
    [kit, p.dados, p.loja, banco],
  );
  return { kit, modelo, carregando: ativo && (carregando || (!p.loja && !semLojaEsgotado)) };
}

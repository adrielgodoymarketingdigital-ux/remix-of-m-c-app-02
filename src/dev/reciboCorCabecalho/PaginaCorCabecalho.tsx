import type { OrdemServico } from "@/hooks/useOrdensServico";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { LAYOUT_PADRAO } from "@/lib/termo-garantia-utils";
import { ImpressaoA4Personalizado } from "@/components/ordens/recibo-personalizado/ImpressaoA4Personalizado";
import { MiniaturaModeloRecibo } from "@/components/ordens/recibo-personalizado/MiniaturaModeloRecibo";
import { ReciboVendaNovo } from "@/components/vendas/recibo-novo/ReciboVendaNovo";
import { cssReciboVendaNovo } from "@/components/vendas/recibo-novo/cssReciboVendaNovo";
import { montarReciboVenda } from "@/lib/vendas/reciboVendaModelo";
import { PersonalizacaoCores } from "@/components/configuracoes/PersonalizacaoCores";
import { CENARIOS } from "../reciboVendaNovo/cenarios";

const params = new URLSearchParams(window.location.search);
const tela = params.get("tela") ?? "os";
const coresParam = params.get("cores");
const cores: unknown = coresParam === null ? undefined : JSON.parse(coresParam);

// Dados 100% fictícios.
const ORDEM: OrdemServico = {
  id: "os-exemplo",
  numero_os: "1234",
  created_at: "2026-11-20T13:00:00.000Z",
  data_saida: null,
  defeito_relatado: "Tela quebrada, não liga",
  total: 250,
  status: "Aberta",
  dispositivo_modelo: "Modelo Exemplo",
  dispositivo_imei: "350000000000000",
  dispositivo_tipo: "Smartphone",
  dispositivo_marca: "Marca",
  dispositivo_cor: "Preto",
  dispositivo_numero_serie: null,
  cliente_id: "cli-1",
  funcionario_id: null,
  tipo_servico_id: null,
  tempo_garantia: 90,
  cliente: { id: "cli-1", nome: "Cliente Exemplo", telefone: "11999999999", cpf: "12345678901" },
  avarias: {
    servicos_realizados: [{ id: "s1", nome: "Troca de Tela", preco: 250, custo: 0, lucro: 250 }],
    produtos_utilizados: [],
    custos_adicionais: [],
    avarias_visuais: [],
    checklist: { entrada: { tela: true, bateria: false }, saida: {} },
    dados_pagamento: { desconto: 0 },
  },
} as unknown as OrdemServico;

const LOJA = {
  id: "cfg-1",
  user_id: "dono",
  nome_loja: "Loja Exemplo",
  cnpj: "00.000.000/0001-00",
  endereco: "Rua Exemplo, 123, Cidade Exemplo - SP",
  telefone: "11988887777",
  logo_url: undefined,
  ...(cores === undefined ? {} : { cores_personalizadas: cores }),
} as unknown as ConfiguracaoLoja;

function ReciboOS({ loja }: { loja: ConfiguracaoLoja | undefined }) {
  return (
    <div id="alvo" style={{ width: 794, background: "#fff" }}>
      <ImpressaoA4Personalizado ordem={ORDEM} configuracaoLoja={loja} layoutConfig={LAYOUT_PADRAO} termoGarantia="Garantia de 90 dias para o serviço realizado." />
    </div>
  );
}

function OSDaSessao() {
  const { config, loading } = useConfiguracaoLoja();
  if (loading) return <p>carregando</p>;
  return <ReciboOS loja={config ?? undefined} />;
}

export function PaginaCorCabecalho() {
  if (tela === "config") return <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}><PersonalizacaoCores /></div>;
  if (tela === "os-sessao") return <div data-pronto="1"><OSDaSessao /></div>;
  if (tela === "miniatura") {
    return (
      <div id="alvo" style={{ width: 240, padding: 8 }}>
        <MiniaturaModeloRecibo modelo="personalizado" {...(cores === undefined ? {} : { corCabecalho: (cores as Record<string, string>)?.recibo_cabecalho_cor })} />
      </div>
    );
  }
  if (tela === "venda") {
    const cenario = CENARIOS.find((c) => c.id === (params.get("cenario") ?? "item-unico")) ?? CENARIOS[0];
    const entrada = { ...cenario.entrada, loja: { ...cenario.entrada.loja, ...(cores === undefined ? {} : { cores_personalizadas: cores }) } };
    return (
      <div style={{ background: "#eef2f7", padding: 16 }}>
        <div id="alvo">
          <style>{cssReciboVendaNovo({ paraImpressao: params.get("impressao") === "1" })}</style>
          <ReciboVendaNovo modelo={montarReciboVenda(entrada)} />
        </div>
      </div>
    );
  }
  return <ReciboOS loja={LOJA} />;
}

/**
 * Números do exemplo da ajuda "Como funciona a comissão" (Equipe), calculados
 * pelas MESMAS regras do app — nada escrito à mão:
 * - comissão de cada serviço: calcularComissaoDoItem (Comissão por Tipo de Serviço);
 * - serviço que sai da base do Técnico Principal: servicosDeOutrosTecnicos +
 *   linhaComComissaoConfigurada (gravação, F0c/F0e);
 * - conferência pela Comissão geral (Sistema A): baseSistemaADaOS (F0d).
 * Exemplo: OS de R$ 300; Serviço A R$ 100 sem técnico ligado; Serviço B
 * R$ 200 ligado ao técnico Bruno (20% por tipo de serviço); Técnico Principal
 * Ana (10%).
 */
import type { FormData, TecnicoOS } from "../../components/ordens/ordem-servico-wizard/tipos";
import { calcularComissaoDoItem } from "../ordemServico/comissaoPorTipoServico";
import { servicosDeOutrosTecnicos } from "../ordemServico/tecnicosPorServicoOS";
import { baseSistemaADaOS } from "./comissaoOsDoSnapshot";

export interface ExemploComissao {
  totalOS: number;
  servicoA: number;
  servicoB: number;
  percentualPrincipal: number;
  percentualTecnico: number;
  /** comissão do Técnico Principal (Ana) — só sobre o Serviço A */
  principal: number;
  /** comissão do técnico ligado ao Serviço B (Bruno) */
  tecnico: number;
  /** mesma conta pela Comissão geral (por cargo) do principal */
  principalComissaoGeral: number;
}

export function calcularExemploComissao(): ExemploComissao {
  const servicoA = 100;
  const servicoB = 200;
  const percentualPrincipal = 10;
  const percentualTecnico = 20;
  const servicos = [
    { id: "servico-a", nome: "Serviço A", preco: servicoA, custo: 0, lucro: servicoA, quantidade: 1, created_at: "" },
    { id: "servico-b", nome: "Serviço B", preco: servicoB, custo: 0, lucro: servicoB, quantidade: 1, created_at: "" },
  ] as FormData["servicos"];
  const tecnicos: TecnicoOS[] = [{ funcionario_id: "bruno", descricao_servico: "Serviço B", servico_id: "servico-b" }];

  const pct = (valor: number) => ({ comissao_tipo: "porcentagem", comissao_valor: valor });
  const tecnico = calcularComissaoDoItem({ preco: servicoB, custo: 0, custoConfirmado: true }, pct(percentualTecnico), "faturamento").valor;
  // Linha do Bruno como a gravação deixaria: comissão aplicada → tipo gravado.
  const linhaTecnico = { comissao_tipo_snapshot: "porcentagem", comissao_calculada_snapshot: tecnico };

  const foraDoPrincipal = servicosDeOutrosTecnicos("ana", tecnicos, servicos, [linhaTecnico]);
  const principal = servicos.reduce((acc, s, i) => (
    foraDoPrincipal.has(i)
      ? acc
      : acc + calcularComissaoDoItem({ preco: s.preco, custo: 0, custoConfirmado: true }, pct(percentualPrincipal), "faturamento").valor
  ), 0);

  const totalOS = servicoA + servicoB;
  const baseGeral = baseSistemaADaOS(
    { funcionario_id: "ana", total: totalOS },
    [{ funcionario_id: "bruno", servico_id: "servico-b", servico_nome_snapshot: "Serviço B", preco_servico_snapshot: servicoB, ...linhaTecnico }],
    servicos.map((s) => ({ id: s.id })),
  );

  return {
    totalOS,
    servicoA,
    servicoB,
    percentualPrincipal,
    percentualTecnico,
    principal,
    tecnico,
    principalComissaoGeral: baseGeral.valor * (percentualPrincipal / 100),
  };
}

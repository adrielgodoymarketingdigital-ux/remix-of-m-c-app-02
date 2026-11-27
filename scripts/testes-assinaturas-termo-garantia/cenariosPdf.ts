// Cenários do PDF A4 do recibo de venda / termo de garantia de dispositivo
// (gerarReciboVendaPDF): termo curto, médio (o texto padrão do app) e longo,
// com 1, 2 e 3 aparelhos, nos modos "recibo" e "garantia". Dados 100% fictícios.
import type { DadosReciboVendaPDF, DispositivoPDFReciboVenda } from "../../src/lib/gerarReciboVendaPDF.ts";
import { formatarTermoDispositivo } from "../../src/lib/termo-garantia-utils.ts";
import { pngDataUrl } from "../testes-recibo-legal/fixtures.ts";

import { TERMOS, type TamanhoTermo } from "./termosTeste.ts";


const LOJA = {
  nome_loja: "Loja Exemplo Celulares",
  cnpj: "00.000.000/0001-00",
  endereco: "Rua Fictícia, 100 - Centro - Cidade Teste/SP",
  telefone: "(11) 3000-0000",
  whatsapp: "(11) 90000-0000",
  email: "contato@lojaexemplo.test",
};

const APARELHOS = [
  { marca: "Apple", modelo: "iPhone 15", imei: "350000000000015", cor: "Azul", capacidadeGb: 128, condicaoLabel: "Seminovo", meses: 3, total: 4200 },
  { marca: "Samsung", modelo: "Galaxy S24", imei: "350000000000024", cor: "Preto", capacidadeGb: 256, condicaoLabel: "Novo", meses: 12, total: 5100 },
  { marca: "Motorola", modelo: "Edge 50", imei: "350000000000050", cor: "Verde", capacidadeGb: 256, condicaoLabel: "Usado", meses: 6, total: 1900 },
];

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const meses = (m: number) => (m === 12 ? "1 ano" : `${m} meses`);

export interface CenarioPdf {
  id: string;
  termo: TamanhoTermo;
  aparelhos: 1 | 2 | 3;
  modo: "recibo" | "garantia";
  troca: false | "completa" | "curta";
  dados: DadosReciboVendaPDF;
}

export function montarCenario(termo: TamanhoTermo, aparelhos: 1 | 2 | 3, modo: "recibo" | "garantia", troca: CenarioPdf["troca"] = false): CenarioPdf {
  const lista = APARELHOS.slice(0, aparelhos);
  const dispositivos: DispositivoPDFReciboVenda[] = lista.map((a) => ({
    marca: a.marca,
    modelo: a.modelo,
    imei: a.imei,
    cor: a.cor,
    capacidadeGb: a.capacidadeGb,
    condicaoLabel: a.condicaoLabel,
    garantiaLabel: meses(a.meses),
    total: a.total,
    textoTermo: formatarTermoDispositivo(TERMOS[termo], {
      cliente: "Cliente Teste da Silva",
      cpf: "000.000.000-00",
      telefone: "(11) 90000-1111",
      dispositivo: `${a.marca} ${a.modelo}`,
      imei: a.imei,
      cor: a.cor,
      capacidade: `${a.capacidadeGb} GB`,
      condicao: a.condicaoLabel,
      garantia_meses: meses(a.meses),
      valor: moeda(a.total),
      data_venda: "20/11/2026",
      loja: LOJA.nome_loja,
      loja_telefone: LOJA.telefone,
      loja_cnpj: LOJA.cnpj,
      loja_endereco: LOJA.endereco,
    }),
  }));
  const valorTotal = lista.reduce((s, a) => s + a.total, 0);
  return {
    id: `${termo}-${aparelhos}ap-${modo}${troca ? `-troca-${troca}` : ""}`,
    termo,
    aparelhos,
    modo,
    troca,
    dados: {
      modo,
      formato: "a4",
      // deno-lint-ignore no-explicit-any
      configLoja: LOJA as any,
      logoBase64: pngDataUrl(260, 90, [20, 40, 120]),
      dataVenda: "20/11/2026 às 14:30",
      formaPagamentoLabel: "Cartão de Crédito",
      valorTotal,
      clienteNome: "Cliente Teste da Silva",
      clienteCpf: "000.000.000-00",
      clienteTelefone: "(11) 90000-1111",
      dispositivos,
      trocaLinhas: troca === "curta"
        ? ["TROCA DE APARELHO", "Aparelho recebido: Apple iPhone 13 Pro Max 256 GB", "Valor da troca: \u2212R$ 1.500,00"]
        : troca
        ? ["TROCA DE APARELHO", "Aparelho recebido: Apple iPhone 13 Pro Max 256 GB (IMEI 350000000000013)", `Valor da venda: ${moeda(valorTotal)}`, "Valor da troca: −R$ 1.500,00", `Valor pago pelo cliente: ${moeda(valorTotal - 1500)}`]
        : undefined,
    },
  };
}

export function todosCenarios(): CenarioPdf[] {
  const lista: CenarioPdf[] = [];
  for (const modo of ["recibo", "garantia"] as const) {
    for (const termo of ["curto", "medio", "longo"] as const) {
      for (const n of [1, 2, 3] as const) lista.push(montarCenario(termo, n, modo));
    }
  }
  lista.push(montarCenario("curto", 1, "recibo", "completa"));
  lista.push(montarCenario("medio", 1, "recibo", "completa"));
  // Só cabe numa folha no nível 2 (fonte menor).
  lista.push(montarCenario("medio", 1, "recibo", "curta"));
  return lista;
}

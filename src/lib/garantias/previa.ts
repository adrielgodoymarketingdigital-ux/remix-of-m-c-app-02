/**
 * Prévia do termo de uma garantia com dados de EXEMPLO (fictícios) e lista
 * de variáveis da tela "Minhas garantias".
 *
 * renderizarTermoGarantia é como o termo de uma venda NOVA vai sair (fases
 * B/C): ajustes do recibo novo + troca das variáveis pelo formatador de
 * sempre (formatarTermoDispositivo). As duas funções pequenas abaixo
 * (ajustarTextoTermoGarantia e formatarMesesGarantiaTexto) são IGUAIS a
 * ajustarTextoTermo e formatarMesesGarantia de src/lib/vendas/reciboVendaModelo.ts
 * — ficam aqui nesta fase para a tela nova não puxar o módulo do recibo
 * (o chunk do recibo novo continua idêntico). O teste
 * scripts/testes-minhas-garantias/previa.test.ts compara as duas versões;
 * a fase C passa o recibo a importar daqui.
 */
import { formatarTermoDispositivo, type TermoDispositivoVars } from "../termo-garantia-utils.ts";

/** Variáveis aceitas no texto (as mesmas do termo de hoje). */
export const VARIAVEIS_GARANTIA: ReadonlyArray<{ tag: string; descricao: string }> = [
  { tag: "{{cliente}}", descricao: "Nome do cliente" },
  { tag: "{{cpf}}", descricao: "CPF do cliente" },
  { tag: "{{telefone}}", descricao: "Telefone do cliente" },
  { tag: "{{dispositivo}}", descricao: "Marca e modelo" },
  { tag: "{{imei}}", descricao: "IMEI do aparelho" },
  { tag: "{{numero_serie}}", descricao: "Número de série" },
  { tag: "{{cor}}", descricao: "Cor do aparelho" },
  { tag: "{{capacidade}}", descricao: "Capacidade (GB)" },
  { tag: "{{condicao}}", descricao: "Condição (Novo/Usado)" },
  { tag: "{{garantia_meses}}", descricao: "Prazo da garantia (ex.: 3 meses, 1 ano)" },
  { tag: "{{valor}}", descricao: "Valor do produto" },
  { tag: "{{data_venda}}", descricao: "Data da venda" },
  { tag: "{{loja}}", descricao: "Nome da loja" },
  { tag: "{{loja_telefone}}", descricao: "Telefone da loja" },
  { tag: "{{loja_cnpj}}", descricao: "CNPJ da loja" },
  { tag: "{{loja_endereco}}", descricao: "Endereço da loja" },
];

/** Dados fictícios da prévia (nunca dados reais de cliente). */
export const DADOS_EXEMPLO_GARANTIA: Readonly<Omit<TermoDispositivoVars, "garantia_meses">> = {
  cliente: "Maria Exemplo",
  cpf: "000.000.000-00",
  telefone: "(00) 00000-0000",
  dispositivo: "Apple iPhone 15",
  imei: "350000000000000",
  numero_serie: "EXEMPLO123",
  cor: "Preto",
  capacidade: "128 GB",
  condicao: "Seminovo",
  valor: "R$ 3.500,00",
  data_venda: "20/11/2026 às 14:30",
  loja: "Loja Exemplo",
  loja_telefone: "(00) 0000-0000",
  loja_cnpj: "00.000.000/0001-00",
  loja_endereco: "Rua Exemplo, 100 - Centro",
};

/** Igual a formatarMesesGarantia (reciboVendaModelo.ts): "1 mês", "3 meses", "1 ano", "2 anos", "18 meses". */
export function formatarMesesGarantiaTexto(meses: number): string {
  if (meses >= 12 && meses % 12 === 0) {
    const anos = meses / 12;
    return anos === 1 ? "1 ano" : `${anos} anos`;
  }
  return `${meses} ${meses === 1 ? "mês" : "meses"}`;
}

/** Igual a ajustarTextoTermo (reciboVendaModelo.ts). */
export const ajustarTextoTermoGarantia = (texto: string): string =>
  texto
    .replace(/Valor pago(\s*):(\s*)\{\{valor\}\}/gi, "Valor do produto$1:$2{{valor}}")
    .replace(/\{\{garantia_meses\}\}\s+meses\b/gi, "{{garantia_meses}}");

/** Termo pronto (variáveis trocadas) como sai numa venda nova. */
export function renderizarTermoGarantia(texto: string, meses: number, vars: Omit<TermoDispositivoVars, "garantia_meses">): string {
  return formatarTermoDispositivo(ajustarTextoTermoGarantia(texto), {
    ...vars,
    garantia_meses: meses > 0 ? formatarMesesGarantiaTexto(meses) : undefined,
  });
}

/** Prévia com os dados de exemplo; dados reais da loja (nome, CNPJ...) entram se vierem. */
export function previaTextoGarantia(
  texto: string,
  meses: number,
  loja?: { nome_loja?: string | null; telefone?: string | null; cnpj?: string | null; endereco?: string | null } | null,
): string {
  return renderizarTermoGarantia(texto, meses, {
    ...DADOS_EXEMPLO_GARANTIA,
    loja: loja?.nome_loja?.trim() || DADOS_EXEMPLO_GARANTIA.loja,
    loja_telefone: loja?.telefone?.trim() || DADOS_EXEMPLO_GARANTIA.loja_telefone,
    loja_cnpj: loja?.cnpj?.trim() || DADOS_EXEMPLO_GARANTIA.loja_cnpj,
    loja_endereco: loja?.endereco?.trim() || DADOS_EXEMPLO_GARANTIA.loja_endereco,
  });
}

/** Rótulo do prazo na lista ("—" para sem garantia). */
export const rotuloPrazo = (meses: number) => (meses > 0 ? formatarMesesGarantiaTexto(meses) : "—");

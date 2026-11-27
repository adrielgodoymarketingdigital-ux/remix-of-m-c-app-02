// Textos de termo de garantia usados nos testes (curto, médio = padrão do app, longo).
// Sem import nenhum: o script Playwright (Node) e os scripts Deno usam o mesmo arquivo.

/** Termo curto: o termo próprio de uma loja (cenário "garantia" da página de diálogos). */
const TERMO_CURTO = "TERMO DE GARANTIA\n\nLoja: {{loja}}\nComprador: {{cliente}}\nAparelho: {{dispositivo}} (IMEI {{imei}})\nValor pago: {{valor}}\n\nGarantia de {{garantia_meses}} a partir de {{data_venda}}.\nNão cobre quedas, líquidos ou mau uso.";

/** Termo médio: o texto padrão do app (TERMOS_GARANTIA_PADRAO.termo_com_garantia de DialogReimprimirReciboVenda). */
const TERMO_MEDIO = `TERMO DE GARANTIA

Loja: {{loja}}
CNPJ: {{loja_cnpj}}
Endereço: {{loja_endereco}}
Telefone: {{loja_telefone}}

COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}
Telefone: {{telefone}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Nº Série: {{numero_serie}}
Cor: {{cor}}  |  Capacidade: {{capacidade}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor pago: {{valor}}

1. GARANTIA LEGAL (CDC - Lei 8.078/90)
   • Garantia legal de 90 (noventa) dias, conforme Art. 26, II do CDC.
   • Cobre defeitos de fabricação ou vícios que comprometam o funcionamento.

2. GARANTIA CONTRATUAL ({{garantia_meses}} meses)
   • Garantia de {{garantia_meses}} meses a partir da data desta venda, já incluindo o prazo mínimo de garantia legal previsto no CDC (Art. 26, II).
   • Cobre defeitos de fabricação, excluindo mau uso, quedas ou oxidação.

3. DIREITOS DO CONSUMIDOR
   • Vício do produto: substituição, devolução ou abatimento (Art. 18 CDC).
   • Prazo suspenso durante reparo (Art. 26, §2º CDC).
   • Conserve este documento como comprovante.

4. EXCLUSÕES
   • Quedas, impactos, contato com líquidos, uso inadequado.
   • Violação de lacres ou reparo por terceiros não autorizados.
   • Desgaste natural de uso.

Para acionamento da garantia, apresente este termo na loja.`;

/** Termo longo: o padrão + cláusulas que lojas costumam acrescentar. */
const TERMO_LONGO = `${TERMO_MEDIO}

5. BATERIA E ACESSÓRIOS
   • Bateria com garantia de 90 dias, desde que a saúde informada no ato da venda seja mantida em uso normal.
   • Carregador, cabo e fone (quando acompanham o aparelho) têm garantia de 30 dias.

6. TELA E CARCAÇA
   • Riscos, trincas e marcas não visíveis no ato da entrega devem ser apontados em até 24 horas.
   • Tela trocada pela loja tem garantia apenas de funcionamento (touch e imagem), sem cobertura para quebra.

7. PROCEDIMENTO DE ACIONAMENTO
   • O aparelho deve ser entregue na loja com este termo e documento com foto do comprador.
   • O prazo de análise técnica é de até 7 dias úteis; a solução segue o Art. 18 do CDC.
   • Backup dos dados é responsabilidade do cliente; a loja não se responsabiliza por perda de informações.

8. DISPOSIÇÕES GERAIS
   • Este termo não exclui nenhum direito previsto no Código de Defesa do Consumidor.
   • Fica eleito o foro da comarca da loja para dirimir eventuais dúvidas.`;

export const TERMOS = { curto: TERMO_CURTO, medio: TERMO_MEDIO, longo: TERMO_LONGO } as const;
export type TamanhoTermo = keyof typeof TERMOS;

/** Linhas do termo que não dependem de campo ({{...}}): servem para achar o termo no texto de uma folha. */
export function linhasFixasDoTermo(tamanho: TamanhoTermo): string[] {
  return TERMOS[tamanho].split("\n").map((l) => l.replace(/^[\s•]+/, "").trim()).filter((l) => l.length >= 12 && !l.includes("{{") && l !== "TERMO DE GARANTIA");
}

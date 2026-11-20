/**
 * Texto padrão ÚNICO do termo de garantia de aparelho em "Minhas garantias".
 *
 * Usado pelas garantias padrão virtuais (loja que nunca configurou nada),
 * pelo "Restaurar texto padrão" da tela e — byte a byte — pela migration de
 * cópia (supabase/migrations/20261120120100_minhas_garantias_copia_dados.sql,
 * gerada por scripts/minhas-garantias/gerar-sql-copia.ts a partir destas
 * constantes; o teste confere que estão iguais).
 *
 * Diferenças para os textos antigos (só valem para vendas NOVAS, fases B/C):
 *  - o prazo entra só por {{garantia_meses}}, que já sai com a unidade
 *    ("3 meses", "1 ano"): nada de "{{garantia_meses}} meses" ("3 meses meses");
 *  - sem o bloco "1. GARANTIA LEGAL ... 90 dias", que o formatador
 *    (formatarTermoDispositivo) apaga sempre que há prazo;
 *  - "Valor do produto" no lugar de "Valor pago" ({{valor}} é o preço do item).
 *
 * Os textos antigos (DialogReciboPDV, DialogReimprimirReciboVenda,
 * reciboVendaModelo, diálogo do termo) NÃO mudam nesta fase.
 */

export const TEXTO_PADRAO_COM_GARANTIA = `TERMO DE GARANTIA

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
Valor do produto: {{valor}}

1. GARANTIA CONTRATUAL ({{garantia_meses}})
   • Garantia de {{garantia_meses}} a partir da data desta venda, já incluindo o prazo mínimo de garantia legal previsto no CDC (Art. 26, II).
   • Cobre defeitos de fabricação, excluindo mau uso, quedas ou oxidação.

2. DIREITOS DO CONSUMIDOR
   • Vício do produto: substituição, devolução ou abatimento (Art. 18 CDC).
   • Prazo suspenso durante reparo (Art. 26, §2º CDC).
   • Conserve este documento como comprovante.

3. EXCLUSÕES
   • Quedas, impactos, contato com líquidos, uso inadequado.
   • Violação de lacres ou reparo por terceiros não autorizados.
   • Desgaste natural de uso.

Para acionamento da garantia, apresente este termo na loja.`;

export const TEXTO_PADRAO_SEM_GARANTIA = `DECLARAÇÃO DE VENDA SEM GARANTIA CONTRATUAL

Loja: {{loja}}
CNPJ: {{loja_cnpj}}

COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor do produto: {{valor}}

AVISO: Este produto é vendido sem garantia contratual adicional.
A garantia legal de 90 dias prevista no CDC (Art. 26, II) se aplica conforme a legislação.
O cliente declara estar ciente das condições do equipamento.`;

/** Texto padrão para um prazo (0 = sem garantia). */
export function textoPadraoGarantia(meses: number): string {
  return meses > 0 ? TEXTO_PADRAO_COM_GARANTIA : TEXTO_PADRAO_SEM_GARANTIA;
}

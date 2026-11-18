# Pendências: caixa e relógio do aparelho

A Fase 1 (Partes 1A e 1B) cobre só o fechamento do caixa e o PDV. Os itens abaixo
ficaram de fora de propósito e precisam de decisão própria.

## Relógio e fuso do aparelho

- **Alterar data da venda:** o limite de "data no futuro" usa o relógio do aparelho
  (`src/lib/vendas/alterarDataVenda.ts:263`, `src/components/vendas/DialogAlterarDataVenda.tsx:83`).
- **Entrega de OS:** `data_caixa` e `data_saida` dependem do relógio ou do fuso do aparelho
  (`src/components/ordens/DialogAssinaturaSaida.tsx:83` e `:249`, `src/hooks/useOrdensServico.ts:554-556` e `:1015`).
- **Item usado em OS:** `src/lib/ordemServico/estoqueItensOS.ts:141`.
- **Cancelamentos:** `data_cancelamento` e `deleted_at` usam o relógio do aparelho
  (`src/hooks/useVendas.ts:582`, `:662`, `:1346`; `src/components/dispositivos/SecaoDispositivosVendidos.tsx:414-452`).
- **Demais telas e recibos:** continuam no fuso do aparelho, entre eles `useFormatadores` para quem
  não tem i18n (`src/lib/i18n/formatadores.ts:35`), `src/lib/gerarReciboLegalPDF.ts`,
  `src/lib/gerarRelatoriosExportPDF.ts:14` e `src/components/dispositivos/DialogReimprimirReciboVenda.tsx:297`.
- **Regra de dia em UTC:** `src/hooks/useCaixa.ts` (`janelaIniData`/`janelaFimData`),
  `src/lib/caixa/servicosCaixa.ts:54-55` e `:136-137`, `src/hooks/useRelatorios.ts:88`, `src/pages/Dashboard.tsx:362`.
  `contas.data` gravada pelo PDV com horário completo também vira o dia UTC (`src/pages/PDV.tsx`, `agoraISO`).
- **Dia no fuso do aparelho:** `src/hooks/useVendas.ts:826` e `:845`, `src/components/pdv/DialogVendaAvulsa.tsx:80-82`.

## Regras do caixa (diagnóstico de 2026-11-18)

- **OS em dois caixas:** a OS entra por data, então dois caixas no mesmo dia contam a mesma OS.
- **Sinal da OS:** só é lido na entrega e altera o caixa do dia em que foi recebido.
- **Pagamento duplo:** com 2 ou mais itens ou parcelado, a 2ª forma é somada mais de uma vez.
- **Fiado:** recebimento de conta a receber e conta paga pela gaveta não entram no dinheiro esperado.
- **`saldo_final` de caixa fechado:** parar de alterar o valor contado em OS, alterar data e editar valor.
- **Vendas lançadas depois:** decidir se contam no caixa do dia da venda ou no caixa aberto no lançamento.
- **Vendas antigas com hora errada:** continuam como foram gravadas; corrigir exigiria script próprio.

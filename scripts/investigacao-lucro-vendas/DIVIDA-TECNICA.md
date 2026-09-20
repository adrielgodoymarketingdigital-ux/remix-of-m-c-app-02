# Dívida técnica — pagamento duplo / 2ª forma "a receber"

Registrada ao implementar a correção (opção b) do bug "lucro diminui ao fazer vendas".
Conta original: livio.bruno14@gmail.com.

## 1. Carrinho com 2+ itens em pagamento duplo com 2ª forma "a receber"

**Bug pré-existente** (não introduzido nem corrigido nesta mudança).

`PDV.tsx` grava, em **cada** linha principal do carrinho, `valor_segunda_forma =
valorSegundaPagamento` — o valor da 2ª forma do **carrinho inteiro**, não a fatia
daquele item. Com 2+ itens, `getVendaReceitaLiquida` subtrai o valor total da 2ª
forma de cada linha principal → receita fortemente subestimada.

A correção atual (`calcularFracaoCustoReconhecidaAgora`) usa `clamp(...,0,1)`, então
não gera custo negativo, mas em carrinho multi-item o número fica inconsistente
(fração pode saturar em 0 → reconhece 0 de custo agora, todo o custo vira
"diferido").

**Todos os casos reais observados (VD-000088, VD-000094, VD-000099) são de item
único**, onde `valor_segunda_forma` = fatia do único item e a matemática fecha.

**Correção proposta (tarefa separada):** no `PDV.tsx`, gravar em cada linha
principal `valor_segunda_forma` proporcional ao item
(`item.preco * item.quantidade * proporcaoSegunda`), não o total do carrinho.
Depois disso, `reconhecerSegundaForma` já funciona por item sem mudança.

## 2. Cancelamento de venda de pagamento duplo não faz cascata — RESOLVIDO (set/2026)

> Resolvido: `cancelarSecundariasEmCascata.core.ts` (chamado por `useVendas.cancelarVenda`). Se alguma parcela já foi recebida, nada é cancelado e o usuário é avisado (estorno manual). Detalhes e testes em `testes-cancelamento-recebimento.mjs`.
> A sugestão de "baixo risco" abaixo (`.neq("cancelada", true)` na busca da principal) foi aplicada e causou o caso Wesley (parcela recebida sem custo → fallback com custo cheio do aparelho); agora a ausência da principal vira "custo não confirmado".

`useVendas.cancelarVenda` opera só na linha principal (`vendas.id` único).
Numa venda de pagamento duplo, as linhas secundárias (`observacoes =
"pagamento_duplo_secundario"`) e as `contas` a receber vinculadas (`descricao =
"venda_id:<id_secundária>"`) **não são canceladas/excluídas** junto.

Efeito: após cancelar a principal, as parcelas da 2ª forma continuam como
contas a receber em aberto e, se marcadas como recebidas, entram no lucro
(a principal já não conta, mas a fatia de custo diferido é calculada a partir
de uma principal `cancelada` — `reconhecerSegundaForma` não filtra por
`cancelada` na busca da principal).

**Correção proposta (tarefa separada):** em `cancelarVenda`, quando a venda tem
`grupo_venda`, cancelar todas as linhas do grupo e excluir/quitar as contas
`venda_id:` correspondentes. Enquanto isso não é feito, `reconhecerSegundaForma`
poderia adicionar `.neq("cancelada", true)` na busca da principal (baixo risco).

## 3. Limitações conhecidas das correções de set/2026 (cascata / custo não confirmado)

- **Item com custo realmente R$ 0,00** + pagamento duplo a receber: a parcela recebida é tratada como "custo não confirmado"
  (`isCustoNaoConfirmado` usa `custo_unitario <= 0`) e fica fora do lucro, com aviso. Não há coluna que distinga
  "custo 0 confirmado" de "custo desconhecido"; resolver exigiria `vendas.custo_confirmado` (migration).
- **Não há tela para "confirmar" o custo** de uma parcela sinalizada — hoje só o reparo por SQL (ver
  `reparo-a55-sincronizar-recebimento.sql` como modelo).
- **`useRelatoriosVendas.ts`** (relatório por dispositivo/produto) tem semântica própria: não filtra vendas canceladas
  nem linhas secundárias, usa o custo do cadastro e soma `custo` de qualquer linha com `parcela_numero` 1 (inclui
  secundárias). Não foi alterado — investigar separadamente.
- **`marcarComoPendente`** (tela de Vendas) não passa por `reverterRecebimentoVendaVinculada` (a fatia de custo da
  secundária fica gravada, mas a parcela sai do lucro por `recebido = false`; re-receber recalcula).

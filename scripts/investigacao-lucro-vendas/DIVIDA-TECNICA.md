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

## 2. Cancelamento de venda de pagamento duplo não faz cascata

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

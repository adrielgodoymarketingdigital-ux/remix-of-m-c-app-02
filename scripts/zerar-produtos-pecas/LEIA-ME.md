# "Começar do zero" › Produtos e peças

Categoria nova `produtos_pecas` ("Produtos e peças"): apaga só o estoque de
produtos e peças, sem mexer nos aparelhos. A categoria "Estoque" continua
igual. A tela continua visível só para admin e contas de teste marcadas
(`src/lib/comecarDoZero/visibilidade.ts` não mudou).

| | |
|---|---|
| **Apaga** | produtos, peças, entradas de estoque, as ligações "código do fornecedor = produto/peça" das notas XML (`compras_xml_mapeamento`) e as fotos do bucket `produtos-fotos` |
| **Inclui sozinho** | TODAS as vendas (inclusive as de aparelhos), como o Estoque |
| **Fica** | aparelhos e IMEIs, compras de aparelhos, pessoas de quem comprou, fornecedores, listas de compras, notas XML e os itens delas (sem o produto/peça e sem a entrada), serviços cadastrados (sem a peça) |
| **Estoque + Produtos e peças** | vale o Estoque (a prévia devolve `absorvidas`) |
| **Tudo** | igual a antes (Produtos e peças não entra) |

Por que o mapeamento XML é apagado: cada linha é obrigada a apontar para um
produto ou peça (CHECK de não nulo) e a ligação é `ON DELETE CASCADE`; sem os
produtos ele não existe. Decisão do Adriel em 2026-11-23. As notas e os itens
continuam.

## Ordem de execução (produção, SQL Editor, à mão)

**NUNCA `supabase db push`**: `supabase_migrations.schema_migrations` da
produção para em 20260606000001; o push reaplicaria tudo.

1. `0-conferir-producao.sql` — SOMENTE LEITURA. Tudo `ok = true`? Segue.
   Algum `false`: **não aplicar**, me mandar a linha inteira. (As linhas 1 e 2
   usam o md5 *normalizado* do corpo das funções; o topo do script explica.)
2. `supabase/migrations/20261124120000_zerar_produtos_pecas.sql` — recria só
   `zerar_meus_dados_previa` e `zerar_meus_dados_executar` (CREATE OR REPLACE,
   uma transação). Não cria nem altera tabela, coluna, índice ou dado.
   `_zerar_catalogo()` não muda.
3. `1-verificar.sql` — SOMENTE LEITURA. Tudo `ok = true` → aplicada.
4. Só depois: publicar a tela (push da branch `feat/zerar-produtos-pecas`).
   Se a tela subir antes do passo 2, quem escolher "Produtos e peças" recebe
   "Escolha inválida" (ZD007) e nada é apagado.

## Rollback

`rollback.sql` — volta as duas funções ao texto **exato** anterior (prévia da
20261027120000, execução da 20261029120000, mesmos REVOKE/GRANT). Não apaga
dado nenhum. Depois, `0-conferir-producao.sql` volta a dar tudo `ok`.
Se a tela nova já estiver publicada, voltar também o front (a opção nova passa
a dar ZD007, sem apagar nada).

## Provas (locais, dados fictícios, nada em produção)

```sh
mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
PGLITE_DIR=/tmp/pg node scripts/zerar-produtos-pecas/teste-pglite.mjs              # suíte
PGLITE_DIR=/tmp/pg node scripts/zerar-produtos-pecas/teste-pglite.mjs --mutantes   # + mutantes do SQL
PGLITE_DIR=/tmp/pg node scripts/zerar-produtos-pecas/teste-pglite.mjs --hashes     # md5 dos arquivos e das funções
deno test --no-check scripts/testes-comecar-do-zero/                                # regras da tela
deno run --allow-read --allow-write --allow-run --allow-env scripts/testes-comecar-do-zero/mutantes-regras.ts
```

A suíte PGlite carrega as migrations reais do recurso (etapas 1, 2, 3a e o
catálogo da 20261102120000), compara o banco ANTIGO (funções em vigor) com o
NOVO e prova: as 127 escolhas de antes dão a mesma prévia (JSON inteiro) e 11
execuções o mesmo resultado/estado; tela = banco nas 255 escolhas (importa
`src/lib/comecarDoZero/regras.ts` de verdade); Produtos e peças apaga e mantém
o que deve (linha a linha); fantasmas da cota só de produto e peça; fila de
fotos só de `produtos-fotos`; ZD000–ZD007; conferência final (inclusive
gatilho que muda um fornecedor sem mudar a contagem); o outro lojista idêntico
depois de toda execução; SECURITY DEFINER, search_path e permissões; os
scripts 0 e 1 dão `ok` onde devem; rollback volta o md5 exato.

## Ligações com produtos e peças (FKs) e o que acontece com cada uma

| Ligação | ON DELETE | Com "Produtos e peças" |
|---|---|---|
| `vendas.produto_id` → produtos | sem ação | vendas apagadas antes (inclusão automática) |
| `vendas.peca_id` → peças | SET NULL | vendas apagadas antes |
| `trocas_garantia.produto_novo_id` / `produto_devolvido_id` → produtos | sem ação | trocas apagadas antes (vêm com as vendas) |
| `servicos.peca_id` → peças | sem ação | serviço fica; `peca_id` vira NULL antes (`servicos_sem_peca`) |
| `entradas_estoque.produto_id` / `peca_id` | SET NULL | entradas apagadas (fazem parte da categoria) |
| `compras_xml_itens.produto_id` / `peca_id` | SET NULL | item fica; vira NULL antes, contado (`itens_xml_sem_produto`) |
| `compras_xml_itens.entrada_estoque_id` → entradas | SET NULL | idem (mesmo UPDATE) |
| `compras_xml_mapeamento.produto_id` / `peca_id` | CASCADE + CHECK não nulo | apagado (decisão do Adriel) |
| `produtos.produto_pai_id` → produtos | SET NULL | todos os produtos do dono saem juntos |
| `pecas.peca_pai_id` → peças | sem ação | todas as peças do dono saem no mesmo DELETE |

Referências sem FK: `orcamentos.itens` (JSON com cópia do item: fica como
está, igual ao Estoque hoje); peças usadas na OS são linhas de `vendas`
(apagadas); `lista_compras` é texto livre (fica).

# Pendências do Catálogo (fora da trilha do redesenho)

Achados na leitura de 2026-11-10 (branch `feat/catalogo-tela`, base origin/main `47e63e2`).
Nada aqui foi corrigido. Cada item precisa de uma trilha própria, com aprovação.
As linhas são as do commit `47e63e2`.

---

## 1. Funcionário e filial: gravação com `user.id` cru e sucesso com 0 linhas

**Sintoma:** o funcionário (e o gerente de filial, que tem `user.id` próprio) abre o Catálogo e vê a
configuração padrão, não a da loja. Quando clica em Salvar, aparece "salvo com sucesso", mas nada é gravado:
o `update` filtra `user_id = <id do funcionário>` e `empresa_id IS NULL`, não acha linha e o Supabase
não devolve erro (sem `.select()`, não há contagem de linhas para conferir).
A RLS já permite que o funcionário grave a linha do dono (`is_funcionario_of`, migration
`20260606000001_fix_configuracoes_loja_update_funcionario.sql`). O problema está só no filtro do app.
O `useConfiguracaoLoja` já troca funcionário por dono (`src/hooks/useConfiguracaoLoja.ts:175-188`); a página não usa essa troca.

| Arquivo | Linhas | O que faz |
|---|---|---|
| `src/pages/CatalogoDispositivos.tsx` | 63-71 | lê `catalogo_config` e `landing_page_config` com `user.id` cru |
| `src/pages/CatalogoDispositivos.tsx` | 100-113 | salvar da LP: `update` com `user.id` cru + toast de sucesso |
| `src/pages/CatalogoDispositivos.tsx` | 125-135 | salvar do catálogo: `update` com `user.id` cru + toast de sucesso |
| `src/pages/CatalogoDispositivos.tsx` | 35 | `useConfiguracaoLoja()` sem filial: logo, WhatsApp e nome são sempre os da matriz |
| `src/components/catalogo/GerenciadorLinkCatalogo.tsx` | 56-64 | lê link e publicação com `user.id` cru |
| `src/components/catalogo/GerenciadorLinkCatalogo.tsx` | 116-124 | "Gerar automático" lê o nome da loja com `user.id` cru |
| `src/components/catalogo/GerenciadorLinkCatalogo.tsx` | 167-194 | salvar link/publicação/config com `user.id` cru + toast de sucesso |
| `src/components/catalogo/GerenciadorLinkCatalogo.tsx` | 94-99 | "link em uso" compara com `neq user_id` do funcionário: o link da própria loja aparece como "em uso" |
| `src/components/catalogo/GerenciadorLinkLandingPage.tsx` | 64-71, 112-119 | leituras com `user.id` cru |
| `src/components/catalogo/GerenciadorLinkLandingPage.tsx` | 152-170 | salvar da LP com `user.id` cru + toast de sucesso |

**Relacionado (multiempresa):** as views públicas juntam `configuracoes_loja` por `user_id` sem
`empresa_id` (`supabase/migrations/20260707183409_exibir_no_catalogo.sql:31-33, 52-55, 73-76`).
O link público mostra os itens de todas as filiais, enquanto a tela, aberta numa filial, mostra só os
itens daquela filial (`useDispositivos`/`useProdutos` filtram por `empresaFiltro`).

## 2. Preço promocional de produto e peça é descartado

**Sintoma:** no modo de edição, o diálogo de fotos e preço deixa aplicar desconto em produto e peça e mostra
a prévia com o preço riscado, mas, ao salvar, o desconto some sem aviso.

| Arquivo | Linhas | O que faz |
|---|---|---|
| `src/pages/CatalogoDispositivos.tsx` | 257-278 | `produtos` e `pecas` recebem só `fotos` e `preco`; `precoPromocional` é ignorado |
| `src/types/catalogo-item.ts` | 85 | `produtoParaItemCatalogo` sempre põe `preco_promocional: null` |
| `src/components/catalogo/DialogEditarDispositivoCatalogo.tsx` | 292-400 | aba Preço com desconto aparece para todos os tipos |

**Atenção:** as tabelas `produtos` e `pecas` **não têm** a coluna `preco_promocional` (em
`src/integrations/supabase/types.ts` ela só existe em `dispositivos` e `dispositivos_catalogo`).
Corrigir de verdade exige migration (manual) e mudança nas views públicas; a alternativa sem banco é
esconder o desconto no diálogo para produto e peça.

## 3. Foto apagada do storage antes do Salvar

**Sintoma:** no diálogo de edição, clicar no X de uma foto apaga o arquivo (e a miniatura) do storage
na hora. Se o lojista clicar em Cancelar, o item continua apontando para a foto, que já não existe:
fica imagem quebrada no catálogo, no link público e na tela de Dispositivos/Produtos.

| Arquivo | Linhas | O que faz |
|---|---|---|
| `src/components/catalogo/DialogEditarDispositivoCatalogo.tsx` | 146-166 | `handleRemove` chama `removerFotoDispositivo` (linha 149) antes do Salvar |
| `src/components/catalogo/DialogEditarDispositivoCatalogo.tsx` | 403-406 | Cancelar só fecha o diálogo |

Do mesmo jeito, fotos enviadas e depois canceladas ficam no storage sem dono (linhas 99-144).

## 4. Limite do plano lê uma chave que ninguém grava

**Sintoma:** o limite `dispositivos_catalogo` do plano nunca é aplicado: a contagem de "usados" é
sempre 0.

| Arquivo | Linhas | O que faz |
|---|---|---|
| `src/hooks/useAssinatura.ts` | 719-734 | conta `catalogo_config.dispositivos_selecionados`, chave antiga; hoje a seleção é gravada em `itensSelecionadosIds` |
| `src/hooks/useAssinatura.ts` | 721-724 | também filtra só `user_id` (sem `empresa_id`) e usa `maybeSingle`: com filial pode dar erro de várias linhas |

Antes de corrigir: decidir se o limite conta a seleção, os itens visíveis (seleção vazia = todos)
ou só dispositivos. Ativar a contagem agora pode bloquear lojas que hoje passam do limite sem saber.

## 5. Link da Landing Page × link do catálogo

**Sintoma:** os dois usam a mesma coluna `catalogo_slug`. Mudar o link na aba Landing Page muda o link
do catálogo (`/c/...`) e vice-versa; links já enviados a clientes param de funcionar.

| Arquivo | Linhas | O que faz |
|---|---|---|
| `src/components/catalogo/GerenciadorLinkLandingPage.tsx` | 155-163 | grava `catalogo_slug` junto com `landing_page_config` e `landing_page_ativa` |
| `src/components/catalogo/GerenciadorLinkCatalogo.tsx` | 170-178 | grava o mesmo `catalogo_slug` |
| `src/App.tsx` | 244-245 | `/c/:slug` e `/lp/:slug` usam o mesmo valor |

---

## Outros achados (registrar, decidir depois)

- **PDF com lista vazia** (`src/pages/CatalogoDispositivos.tsx:214`): o PDF recebe só dispositivos
  (sem produtos nem peças) e, com a seleção vazia ("todos"), recebe nenhum. É da trilha do PDF
  (`feat/catalogo-pdf`); a F1 do redesenho só começa depois dela na main.
- **Tela do dono mostra itens ocultos** (`src/pages/CatalogoDispositivos.tsx:190-193`): a prévia
  online não filtra `exibir_no_catalogo`, mas o link público filtra (views). O redesenho do computador
  vai filtrar; o celular continua como está.
- **Seleção volta a "todos" sozinha** (`src/lib/catalogo-selection.ts:24-29`): se metade ou mais dos
  itens marcados sumiu (vendidos/apagados), a seleção inteira é descartada e o catálogo passa a
  mostrar tudo. No computador (F2) há um aviso; no celular e no tablet, nenhum.
- **Limpeza da seleção depende da ordem de carregamento** (`src/pages/CatalogoDispositivos.tsx:170-192`,
  efeito com `[itensCatalogo]`): se os itens chegam ANTES do `catalogo_config`, a limpeza não roda para
  a seleção salva. A tela fica com ids que não existem mais ("1 de 3 marcados"), enquanto o link público
  (que sempre limpa) mostra outra coisa. No computador a F2 roda a mesma limpeza sempre que aparece um
  id assim (`CatalogoDesktop.tsx`); no celular e no tablet continua dependendo da ordem.
- **Custo vazio de produto e peça vira R$ 0,00** (`src/hooks/useProdutos.ts`, `custo: Number(p.custo || 0)`):
  na tela do dono não dá para distinguir "sem custo" de "custo zero"; o lucro sai igual ao preço.
  Dispositivo traz o custo como está no banco (nulo aparece como "—").
- **Opções sem efeito** (`src/types/catalogo.ts`): `tamanhoFonte` tem controle em
  `ConfiguracaoTemplates.tsx:754-769`, mas não é aplicado em lugar nenhum; `layoutGrid`, `mostrarRodape`,
  `mostrarIMEI` e `mostrarNumeroSerie` existem só no tipo.

# Pendências do Catálogo (fora da trilha do redesenho)

Achados durante o redesenho da tela do Catálogo no computador (branch `feat/catalogo-tela`, 2026-11-10/11).
**Nada aqui foi corrigido**, a não ser onde está escrito "No computador". Cada item precisa de uma trilha
própria, com aprovação. As linhas são as do fim da trilha (F5, sobre origin/main `338fc2f`).

Formato de cada item: **sintoma** (o que o lojista vê), depois a tabela arquivo · linha · o que acontece.

---

## 1. Funcionário e filial gravam com o próprio `user.id` e recebem "sucesso" com 0 linhas

**Sintoma:** o funcionário (e o gerente de filial, que tem `user.id` próprio) abre o Catálogo e vê a
configuração padrão, não a da loja. No celular, ao salvar aparece "salvo com sucesso", mas nada é gravado.
No computador o Salvar único confere as linhas gravadas e mostra "Sua conta não tem permissão para alterar
o catálogo da loja." (`src/lib/catalogo/gravacaoCatalogoDesktop.ts:79-81`), mas a leitura continua errada.
A RLS já permite que o funcionário grave a linha do dono (`is_funcionario_of`, migration
`20260606000001_fix_configuracoes_loja_update_funcionario.sql`); o problema está só no filtro do app.
O `useConfiguracaoLoja` já resolve funcionário → dono (`src/hooks/useConfiguracaoLoja.ts:175-188`).

| Arquivo | Linha | O que acontece |
|---|---|---|
| `src/pages/CatalogoDispositivos.tsx` | 67-75 | lê `catalogo_config` e `landing_page_config` com `user.id` cru |
| `src/pages/CatalogoDispositivos.tsx` | 104-117 | salvar da LP: `update` com `user.id` cru + toast de sucesso sem conferir linhas |
| `src/pages/CatalogoDispositivos.tsx` | 129-139 | salvar do catálogo (celular): idem |
| `src/pages/CatalogoDispositivos.tsx` | 38 | `useConfiguracaoLoja()` sem filial: logo, WhatsApp e nome são sempre os da matriz |
| `src/hooks/useLinkCatalogo.ts` | 67-72, 149-154 | (computador) lê e grava com `user.id` cru; com 0 linhas mostra o erro de permissão |
| `src/hooks/useLinkCatalogo.ts` | 112-118 | (computador) "link em uso" compara com `neq user_id` do funcionário: o link da própria loja aparece como "em uso" |
| `src/components/catalogo/GerenciadorLinkCatalogo.tsx` | 56-62 | lê link e publicação com `user.id` cru |
| `src/components/catalogo/GerenciadorLinkCatalogo.tsx` | 91-98 | "link em uso" com `neq user_id` do funcionário (mesmo efeito acima) |
| `src/components/catalogo/GerenciadorLinkCatalogo.tsx` | 116-122 | "Gerar automático" lê o nome da loja com `user.id` cru |
| `src/components/catalogo/GerenciadorLinkCatalogo.tsx` | 167-191 | salvar link/publicação/config com `user.id` cru + toast de sucesso |
| `src/components/catalogo/GerenciadorLinkLandingPage.tsx` | 64-70, 112-118 | leituras com `user.id` cru |
| `src/components/catalogo/GerenciadorLinkLandingPage.tsx` | 152-167 | salvar da LP com `user.id` cru + toast de sucesso |

**Relacionado (multiempresa):** as views públicas juntam `configuracoes_loja` por `user_id` sem
`empresa_id` (`supabase/migrations/20260707183409_exibir_no_catalogo.sql:31, 52, 73`). O link público mostra
os itens de todas as filiais, enquanto a tela, aberta numa filial, mostra só os itens daquela filial
(`useDispositivos`/`useProdutos` filtram por `empresaFiltro`).

## 2. Preço promocional de produto e peça é descartado sem aviso

**Sintoma:** no modo de edição, o diálogo de fotos e preço deixa aplicar desconto em produto e peça e mostra a
prévia com o preço riscado; ao salvar, o desconto some.

| Arquivo | Linha | O que acontece |
|---|---|---|
| `src/pages/CatalogoDispositivos.tsx` | 269-291 | `produtos` e `pecas` recebem só `fotos` e `preco`; `precoPromocional` é ignorado |
| `src/types/catalogo-item.ts` | 85 | `produtoParaItemCatalogo` sempre põe `preco_promocional: null` |
| `src/components/catalogo/DialogEditarDispositivoCatalogo.tsx` | 292 | aba Preço (com desconto) aparece para todos os tipos |

As tabelas `produtos` e `pecas` **não têm** a coluna `preco_promocional`. Corrigir de verdade exige migration
(manual) e mudança nas views públicas; a alternativa sem banco é esconder o desconto para produto e peça.

## 3. Foto apagada do storage antes do Salvar

**Sintoma:** no diálogo de edição, o X de uma foto apaga o arquivo do storage na hora. Se o lojista clicar em
Cancelar, o item continua apontando para a foto que já não existe: imagem quebrada no catálogo, no link
público e nas telas de Dispositivos/Produtos.

| Arquivo | Linha | O que acontece |
|---|---|---|
| `src/components/catalogo/DialogEditarDispositivoCatalogo.tsx` | 146-149 | `handleRemove` chama `removerFotoDispositivo` antes do Salvar |
| `src/components/catalogo/DialogEditarDispositivoCatalogo.tsx` | 405 | Cancelar só fecha o diálogo |
| `src/components/catalogo/DialogEditarDispositivoCatalogo.tsx` | 99 | fotos enviadas e depois canceladas ficam no storage sem dono |

## 4. Limite do plano lê uma chave que ninguém grava

**Sintoma:** o limite `dispositivos_catalogo` do plano nunca é aplicado: a contagem de "usados" é sempre 0.

| Arquivo | Linha | O que acontece |
|---|---|---|
| `src/hooks/useAssinatura.ts` | 727-728 | conta `catalogo_config.dispositivos_selecionados` (chave antiga); a seleção hoje é `itensSelecionadosIds` |
| `src/hooks/useAssinatura.ts` | 721 | filtra só `user_id` (sem `empresa_id`) com `maybeSingle`: com filial pode dar erro de várias linhas |

Antes de corrigir: decidir se o limite conta a seleção, os itens visíveis (seleção vazia = todos) ou só
dispositivos. Ativar a contagem agora pode bloquear lojas que hoje passam do limite sem saber.

## 5. Link da Landing Page e link do catálogo são o mesmo

**Sintoma:** os dois usam a coluna `catalogo_slug`. Mudar o link na aba Landing Page muda o do catálogo
(`/c/...`) e vice-versa; links já enviados a clientes param de funcionar. No computador, o cartão do link
avisa quem tem a LP ("Este é o mesmo link da sua Landing Page: alterá-lo muda os dois.").

| Arquivo | Linha | O que acontece |
|---|---|---|
| `src/components/catalogo/GerenciadorLinkLandingPage.tsx` | 157-158 | grava `catalogo_slug` junto com a configuração da LP |
| `src/components/catalogo/GerenciadorLinkCatalogo.tsx` | 172-174 | grava o mesmo `catalogo_slug` |
| `src/App.tsx` | 244-245 | `/c/:slug` e `/lp/:slug` usam o mesmo valor |

---

## Outros achados (registrar, decidir depois)

| Assunto | Arquivo · linha | Sintoma |
|---|---|---|
| Prévia do celular mostra itens ocultos | `src/pages/CatalogoDispositivos.tsx:194-197` | a prévia da aba Online (celular/tablet) usa `itensSelecionados` sem filtrar `exibir_no_catalogo`; o link público filtra. **No computador** (F5) a prévia usa a regra do link (`apareceNoPublico`). |
| Seleção volta a "todos" sozinha | `src/lib/catalogo-selection.ts:28-30` | se metade ou mais dos itens marcados sumiu (vendidos/apagados), a seleção inteira é descartada. **No computador** há um aviso; no celular e no tablet, nenhum. |
| Limpeza da seleção depende da ordem de carregamento | `src/pages/CatalogoDispositivos.tsx:170-192` | o efeito só roda quando `itensCatalogo` muda; se os itens chegam antes do `catalogo_config`, a tela fica com ids que não existem ("1 de 3 marcados"). **No computador** a mesma limpeza roda sempre (`src/components/catalogo/desktop/CatalogoDesktop.tsx:156-171`). |
| Custo vazio de produto e peça vira R$ 0,00 | `src/hooks/useProdutos.ts:85, 102` | `Number(p.custo \|\| 0)` não distingue "sem custo" de "custo zero". **No computador** custo 0 de produto/peça vale como desconhecido ("—" em Custo e Lucro); efeito colateral: produto que custa R$ 0,00 de verdade também aparece "—". Resolver de vez: o hook devolver `null`. |
| Opções sem efeito | `src/components/catalogo/PainelOpcoesCatalogo.tsx:140, 190` | "Tamanho da fonte" (`tamanhoFonte`) e "Itens por página no PDF" (`itensPerPage`) não são lidos em lugar nenhum. **No computador** ficam escondidos; no celular e no tablet continuam. `layoutGrid`, `mostrarIMEI` e `mostrarNumeroSerie` existem só no tipo; `mostrarRodape` não tem controle, mas o PDF o lê. |
| Cores secundária e destaque sem uso no online | `src/components/catalogo/CatalogoOnline.tsx:61-62` | calculadas e não usadas; o online usa primária, cabeçalho, fundo e texto. O texto do rodapé só sai no PDF. |
| Botão "Salvar e Salvar Landing Page" | `src/components/catalogo/GerenciadorLinkLandingPage.tsx:387` | com a LP não publicada o texto fica "Salvar e Salvar Landing Page" (aparece no celular e no computador). |
| Controles da LP sem nome acessível | `src/components/catalogo/ConfiguracaoLandingPage.tsx:148, 247, 275`; `src/components/catalogo/GerenciadorLinkLandingPage.tsx:315, 331-357`; `src/components/catalogo/LandingPagePreview.tsx:112` | chaves (Switch) sem rótulo ligado, botões só com ícone sem `aria-label` (copiar/abrir/compartilhar o link da LP) e o link flutuante do WhatsApp sem texto: o leitor de tela anuncia só "botão"/"chave". |

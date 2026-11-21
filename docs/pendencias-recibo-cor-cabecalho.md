# Pendências — Cor do cabeçalho dos recibos

Branch `feat/recibo-cor-cabecalho` (21/11/2026). A loja escolhe em
Configurações → Cores a cor do cabeçalho do recibo A4 personalizado da OS e do
recibo de venda novo. Fica em `configuracoes_loja.cores_personalizadas.recibo_cabecalho_cor`
("#rrggbb"), sem migration. Sem a chave (ou com valor inválido) os dois recibos
saem idênticos aos de antes (provado byte a byte contra a origin/main).

Provas e como rodar: `scripts/testes-recibo-cor-cabecalho/` (node --test,
mutantes, Playwright com a página `dev/recibo-cor-cabecalho.html`) e
`scripts/testes-recibo-venda-novo/dialogos.playwright.mjs` com `CORES_LOJA=<json>`.

## 1. Funcionário que "salva" cores grava em 0 linhas (não mexido, por decisão)

A tela de Cores grava em `configuracoes_loja` pelo **id do usuário logado**. Para
funcionário (que não tem linha própria) isso dá 0 linhas: nada é gravado e a tela
mostra "Cores salvas!" mesmo assim (comportamento antigo, mantido nas cores do app).

- Na seção nova ("Cor do cabeçalho dos recibos") 0 linhas vira erro na tela, para
  não fingir que salvou.
- Se for corrigir: decidir se funcionário pode mudar as cores do dono (a RLS
  "Funcionarios podem atualizar config loja do dono" permite) ou se a aba deve
  ficar escondida para ele.

## 2. A chave nova aparece na resposta pública do acompanhamento (aceito)

As funções públicas do acompanhamento da OS (`get_os_tracking*` e as do
acompanhamento por cliente) devolvem `cores_personalizadas` inteiro. Com a cor
escolhida, `recibo_cabecalho_cor` passa a vir junto. É só um código de cor e já
vinham as cores do app e o `tracking_config`; aceito pelo Adriel em 21/11/2026.

## 3. Outros pontos para lembrar

- **Gerente de filial** usa a linha própria (igual ao recibo de venda novo): sai
  no azul padrão, salvo se o próprio gerente escolher uma cor.
- **Recibo de pagamento da OS** (`DialogEmitirReciboOS` / `reciboOS.ts`), 80 mm,
  58 mm, termo de garantia de Dispositivos, layout Padrão/Tech e o PDF antigo de
  Dispositivos no iPhone instalado **não** usam a cor.
- **Contraste em tons médios saturados**: o texto do cabeçalho é branco ou escuro,
  o que tiver mais contraste. Em cores como #ff3311 ou #ee11dd o melhor possível é
  ~3,7:1 (nas paletas da tela, ≥ 4,5:1; nenhuma cor fica abaixo de 3:1).
- A tela de Cores agora lê todas as linhas do dono e mostra a da matriz; antes,
  com filial, o `.single()` falhava e mostrava o padrão.
- O harness `dialogos.playwright.mjs` acusa "tabela sem mock: profiles" (16 casos)
  também na origin/main: pendência do próprio harness, não desta branch.

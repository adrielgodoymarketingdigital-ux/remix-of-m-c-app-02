# COMISSÃO — Fonte única de verdade

> Auditoria completa do sistema de comissão de funcionários (OS + Vendas de Produto/Peça).
> Data da auditoria: **2026-09-02**. Nenhum código foi alterado — este documento é só o mapa.
>
> **Leia o "Resumo executivo" primeiro.** Se você só tem 2 minutos, leia isso e a
> "Parte 5 — Inconsistências e bugs".

---

## Resumo executivo

Existem **dois motores de cálculo de comissão completamente separados**, que
**não se conciliam** e podem mostrar números diferentes para o mesmo funcionário
no mesmo mês:

| # | Nome informal | Onde é configurado | Como calcula | Onde é salvo | Onde aparece |
|---|---|---|---|---|---|
| **A** | Comissão por **Escopo/Cargo** (agregada) | Aba Equipe → cadastro do funcionário → "Comissão" (por cargo) e "Base de cálculo" | `%` (ou valor fixo × qtd) aplicado sobre a **soma** de vendas/OS do mês | **Nada é salvo** — recalculado ao vivo toda vez que a tela abre | Dashboard de Equipe (tabela "Desempenho por Funcionário" + card "Comissões a Pagar"), Dashboard do próprio funcionário, Sparkline |
| **B** | Comissão por **Tipo de Serviço** (snapshot) | Aba Equipe → cadastro do funcionário → "Comissão por Tipo de Serviço" (tabela `comissoes_tipo_servico`) | `%` (ou valor fixo) **item a item**, casando o nome do serviço com um "Tipo de Serviço"; suporta base **faturamento OU lucro** | `ordens_servico.comissao_calculada_snapshot` e `os_tecnicos.comissao_calculada_snapshot`, **gravados no momento em que a OS é salva** | "Perfil de Desempenho" do funcionário (dialog aberto a partir do Dashboard de Equipe) |

- **Vendas de produto/peça no PDV** usam **apenas o Sistema A**. Não há
  configuração de comissão por produto nem por categoria, não há snapshot, não
  há cálculo item-a-item, não há opção "sobre lucro", não há proteção de
  "custo não confirmado". É `% do funcionário × soma bruta de `vendas.total` do mês`.
- Todas as correções finas já feitas (match bidirecional, desambiguação por
  marca, aviso de custo não confirmado, comissão item-a-item, faturamento×lucro)
  vivem **só no Sistema B** (a OS de 1 serviço só passou a usar o mesmo motor
  na Fase 1 — ver P1-c).
- O card **"Comissões a Pagar"** que o dono usa para pagar a equipe é 100%
  Sistema A. Numa loja que adotou "Comissão por Tipo de Serviço", esse card
  frequentemente mostra **R$ 0** para os técnicos, enquanto cada "Perfil de
  Desempenho" mostra o valor real. E vice-versa.

Ver a lista priorizada na **Parte 5**.

---

## Parte 1 — Mapeamento completo (todos os arquivos)

Busca exaustiva por `comiss` em `src/` e `supabase/`. Arquivos que **calculam,
exibem ou armazenam** valor de comissão:

### 1.1 Núcleo de regras (Sistema B)

**[`src/lib/ordemServico/comissaoPorTipoServico.ts`](../src/lib/ordemServico/comissaoPorTipoServico.ts)**
Biblioteca pura, sem I/O. É o coração do Sistema B.

- `custoConfirmadoDoItem(custo, custoConfirmado)` → `true` se `custoConfirmado === true`
  **ou** `custo > 0`. O banner de confirmação só aparece quando o custo é
  exatamente `0` e ninguém respondeu.
- `calcularComissaoDoItem(item, config, calculo)` → comissão de **um** item:
  - `config.comissao_valor <= 0` → `{ valor: 0, aplicada: false }`.
  - `config.comissao_tipo !== "porcentagem"` → valor fixo, **independe** de
    faturamento/lucro.
  - `calculo === "lucro"` e custo **não confirmado** → `{ valor: 0, custoNaoConfirmado: true }`.
  - Caso normal: `base = (calculo === "lucro") ? max(0, preco - custo) : preco`;
    `valor = base × (comissao_valor / 100)`.
- `palavrasChaveDaMarca(marca)` → `["iphone","apple","ios","ipad"]` para Apple;
  `["android", <marca>]` para qualquer outra marca.
- `encontrarComissaoPorNomeServico(nomeServico, tiposComComissao, mapaConfig, dispositivoMarca)`
  → acha o "Tipo de Serviço" cujo nome casa com o nome do item:
  1. **Match bidirecional** case-insensitive: `item.includes(tipo) || tipo.includes(item)`.
  2. 0 candidatos → `{ config: undefined, ambiguo: false }` (item sem comissão, intencional).
  3. 1 candidato → usa ele.
  4. \>1 candidato → desempate: **(a)** igualdade exata de nome; **(b)** marca real
     do aparelho via `palavrasChaveDaMarca`; **(c)** se ainda empatar →
     `{ ambiguo: true }` — **nunca chuta por tamanho de string**.
- `formatarMotivoComissao(nomeItem, resultado)` → frase única para a UI e para o
  toast ("sem tipo configurado" / "ambíguo entre X vs Y" / "custo não confirmado").

### 1.2 Cálculo e persistência na OS (Sistema B — escrita)

**[`src/components/ordens/ordem-servico-wizard/handleSubmitOrdemServico.ts`](../src/components/ordens/ordem-servico-wizard/handleSubmitOrdemServico.ts)**

- `calcularComissaoPorServico(funcId, servicos, dispositivoMarca)` (linha ~105):
  lê `tipos_servico`, `comissoes_tipo_servico` do funcionário e
  `loja_funcionarios.comissao_calculo`. Para **cada** serviço da OS chama
  `encontrarComissaoPorNomeServico` + `calcularComissaoDoItem` e **soma item a
  item**. Devolve `total`, `itensSemComissaoConfigurada`, `itensComissaoAmbigua`,
  `itensCustoNaoConfirmado`.
- `salvarTecnicosOS(...)` (linha ~237): para cada linha de `os_tecnicos`
  ("Técnicos por Serviço"), calcula a comissão sobre o **preço do serviço
  vinculado** (`servico_id` → `preco`), respeitando lucro/faturamento e
  ambiguidade. Sem serviço vinculado (legado) → cai no **total da OS** como
  faturamento. Grava `comissao_tipo_snapshot`, `comissao_valor_snapshot`,
  `comissao_calculada_snapshot`, `servico_nome_snapshot`, `preco_servico_snapshot`.
- `salvarOrdemServico(...)` (bloco "=== SNAPSHOT DA COMISSÃO ===", linha ~584):
  decide qual caminho usar (ver Parte 3.1) e grava
  `ordens_servico.comissao_*_snapshot`. Também monta o `avisoComissaoTexto`
  (toast "⚠️ Comissão do técnico incompleta — revise: ...").

### 1.3 Exibição (Sistema B — leitura)

**[`src/hooks/useDesempenhoFuncionario.ts`](../src/hooks/useDesempenhoFuncionario.ts)**
Busca as OS do funcionário no período + as linhas de `os_tecnicos` dele + o
mapa `comissoes_tipo_servico` (fallback) + `comissao_calculo`. Filtra
`deleted_at IS NULL` e `is_teste = false`. Campo de data:
`data_saida` se `base_comissao = "entrega"`, senão `created_at`.

**[`src/components/equipe/PerfilDesempenhoFuncionario.tsx`](../src/components/equipe/PerfilDesempenhoFuncionario.tsx)**

- `resolverComissaoOS(os, fallback)`:
  1. OS não "entregue" → `0`.
  2. Tem linhas `os_tecnicos` → **soma** `comissao_calculada_snapshot` de todas.
  3. Senão, `comissao_calculada_snapshot` da OS ≠ null → usa ele.
  4. Senão, fallback: `os.total × (config.valor/100)` usando `comissoes_tipo_servico`
     **atual** (sempre faturamento).
- `avaliarAlertasComissaoOS(...)`: reaplica a regra do Sistema B com a config de
  **hoje** só para mostrar o ícone ⚠️ ("melhor esforço" — pode não bater com o
  que foi gravado se a config mudou).
- Cards do resumo: "OS Entregues", "Valor Total" (`Σ os.total` das entregues),
  "Comissão Total" (`Σ resolverComissaoOS`).

### 1.4 Cálculo e exibição agregados (Sistema A)

**[`src/hooks/useComissoes.ts`](../src/hooks/useComissoes.ts)**

- `calcularComissaoEscopo(escopo, tipo, valor, vendasProdutos, vendasDispositivos, totalServicos, qtdVendas, qtdOS)`:
  escolhe a **base agregada** conforme o escopo (`vendas_produtos`,
  `vendas_dispositivos`, `vendas_todos`, `servicos_os`, `tudo`) e faz
  `base × (valor/100)` (porcentagem) **ou** `quantidade × valor` (valor fixo).
- `calcularComissao(f, ...)`: se `f.comissoes_por_cargo` tem entradas, soma a
  comissão de cada cargo; senão usa `f.comissao_tipo/valor/escopo` (legado);
  senão `0`.
- `useComissoes(funcionarios, mes)`: busca `vendas` (mês) e `ordens_servico`
  (status `entregue`, campo de data por `base_comissao`). Devolve por
  funcionário `totalVendasProdutos/Dispositivos`, `totalServicos`,
  `comissaoCalculada`, `detalhePorCargo`; e os totais `totalComissoes`,
  `totalVendido`.
- `useComissoesSerieMensal(...)`: mesma regra, série de 6 meses para o sparkline.

**[`src/components/equipe/DashboardEquipe.tsx`](../src/components/equipe/DashboardEquipe.tsx)**
Consome `useComissoes` + `useComissoesSerieMensal`. Renderiza:
- Card **"Comissões a Pagar"** = `totalComissoes` (Sistema A, toda a equipe).
- Card "Total Vendido (Equipe)" = `totalVendido`.
- Tabela "Desempenho por Funcionário": coluna "Comissão" = `c.comissaoCalculada`.
- Botão que abre `PerfilDesempenhoFuncionario` (Sistema B) — **mistura os dois
  sistemas numa tela só**.
- `exportarDesempenho()` → XLSX com a coluna Comissão do Sistema A.

**[`src/components/equipe/DashboardComissaoFuncionario.tsx`](../src/components/equipe/DashboardComissaoFuncionario.tsx)**
Visão do **próprio funcionário** ("Sua Comissão do Mês"). Query própria
(não usa `useComissoes`), mesma ideia (Sistema A), mas com **diferenças de
implementação** — ver Parte 5, bug P1.

### 1.5 Configuração (não calculam — só persistem)

- **[`src/components/equipe/DialogCadastroFuncionario.tsx`](../src/components/equipe/DialogCadastroFuncionario.tsx)**
  — formulário: comissão por cargo (`tipo`, `valor`, `escopo`),
  "Base de cálculo da comissão" (`criacao` | `entrega`),
  "Comissão calculada sobre" (`faturamento` | `lucro`),
  e o editor "Comissão por Tipo de Serviço".
- **[`src/components/equipe/ComissoesTipoServicoEditor.tsx`](../src/components/equipe/ComissoesTipoServicoEditor.tsx)**
  — linha por Tipo de Serviço (`porcentagem` | `valor_fixo`, valor).
- **[`src/hooks/useComissoesTipoServico.ts`](../src/hooks/useComissoesTipoServico.ts)**
  — `salvarComissoes` faz **DELETE tudo + INSERT** dos itens com `valor > 0`.
- **[`src/hooks/useFuncionarios.ts`](../src/hooks/useFuncionarios.ts)** /
  **[`supabase/functions/criar-funcionario/index.ts`](../supabase/functions/criar-funcionario/index.ts)**
  — CRUD do funcionário; grava as colunas de comissão. **Nenhum cálculo.**
- **[`src/components/equipe/TabelaFuncionarios.tsx`](../src/components/equipe/TabelaFuncionarios.tsx)**
  — `formatComissao()` só formata `comissao_tipo/valor/escopo` para exibir
  (não mostra `comissao_calculo` nem as comissões por tipo de serviço).
- **[`src/components/servicos/GerenciadorTiposServico.tsx`](../src/components/servicos/GerenciadorTiposServico.tsx)**
  — CRUD de `tipos_servico`; ao excluir, remove `comissoes_tipo_servico` em cascata.
- **[`src/components/ordens/SelecionadorServico.tsx`](../src/components/ordens/SelecionadorServico.tsx)**,
  **[`.../EtapaServicosProdutos.tsx`](../src/components/ordens/ordem-servico-wizard/EtapaServicosProdutos.tsx)**,
  **[`.../EtapaInformacoesServico.tsx`](../src/components/ordens/ordem-servico-wizard/EtapaInformacoesServico.tsx)**,
  **[`src/components/ordens/DialogOrdemServico.tsx`](../src/components/ordens/DialogOrdemServico.tsx)**
  — UI da OS: `DialogOrdemServico` calcula `comissaoLucroAtiva` (algum técnico
  envolvido tem `comissao_calculo === "lucro"`) e passa adiante; `SelecionadorServico`
  mostra o **banner "custo R$ 0,00 está correto?"** quando `comissaoLucroAtiva`;
  `EtapaInformacoesServico` (linha ~190) tem o texto _"A comissão do Técnico
  Principal é calculada sobre o valor total da OS"_.
- **[`src/data/ajudaModulos.ts`](../src/data/ajudaModulos.ts)** — texto de ajuda.
- **[`src/pages/PDV.tsx`](../src/pages/PDV.tsx)** — grava `vendas.funcionario_id`.
  **Não calcula comissão nenhuma.**

### 1.6 Banco de dados

| Objeto | Migration | Papel |
|---|---|---|
| `loja_funcionarios.comissao_tipo / comissao_valor` | `20260214210052` | Sistema A — legado (1 comissão só) |
| `loja_funcionarios.comissao_escopo` | `20260214211312` | Sistema A — escopo do legado |
| `loja_funcionarios.comissoes_por_cargo` (jsonb) | `20260214233628` | Sistema A — comissão por cargo `{cargo: {tipo, valor, escopo}}` |
| `tipos_servico` | `20260310192246` | Catálogo de "Tipos de Serviço" (por `user_id`) |
| `comissoes_tipo_servico` (`funcionario_id`, `tipo_servico_id`, `comissao_tipo`, `comissao_valor`, `UNIQUE(func, tipo)`) | `20260310192246` | Sistema B — config por funcionário × tipo |
| `ordens_servico.tipo_servico_id` | `20260310192246` | Tipo escolhido na Etapa 4 da OS |
| `ordens_servico.comissao_tipo_snapshot / comissao_valor_snapshot / comissao_calculada_snapshot / tipo_servico_nome_snapshot` | `20260310204135` | Sistema B — valor congelado no save da OS |
| `os_tecnicos` (+ `comissao_*_snapshot`) | `20260410202052` | Múltiplos técnicos por OS |
| `os_tecnicos.servico_id / servico_nome_snapshot / preco_servico_snapshot` | `20260813120000` | Vincula o técnico ao serviço específico (antes era sobre o total da OS) |
| `loja_funcionarios.comissao_calculo` (`faturamento` \| `lucro`, default `faturamento`) | `20260827120000` | Sistema B — base do percentual |
| `loja_funcionarios.base_comissao` (`criacao` \| `entrega`) | _(não localizada nas migrations lidas; coluna existe em `types.ts`)_ | Ambos — qual data conta a OS no mês |
| `vendas.funcionario_id` / `ordens_servico.funcionario_id` | `20260214210052` | Quem leva a comissão |

> **Não há coluna de comissão em `vendas`.** Não há trigger de banco que calcule
> comissão. Todo cálculo é em TypeScript no cliente.

---

## Parte 2 — Comissão em Vendas de Produto/Peça (nunca auditada antes)

### 2.1 O que dispara e como é calculada

**Nada é calculado na hora da venda.** [`PDV.tsx`](../src/pages/PDV.tsx) só grava
`vendas` com `funcionario_id = funcionarioSelecionadoId` (linhas ~482 e ~632).
A comissão é **derivada na exibição**, sempre pelo Sistema A:

| Tela | Arquivo | Fórmula efetiva |
|---|---|---|
| Dashboard de Equipe (dono) | `useComissoes.ts` → `calcularComissaoEscopo` | Para escopo `vendas_produtos`: `Σ vendas.total (tipo IN ('produto','peca')) × (valor/100)`. Para `valor_fixo`: `nº de linhas de venda × valor`. |
| "Sua Comissão do Mês" (funcionário) | `DashboardComissaoFuncionario.tsx` | Igual em espírito, **com bugs próprios** (P1). |

- **Não existe** comissão por produto, nem por categoria. É um **percentual
  único por cargo/escopo do funcionário**, aplicado à soma do mês.
- `tipo` da venda: `'produto'` e `'peca'` são somados juntos em "produtos";
  `'dispositivo'` é separado. (No banco, peça é gravada como `tipo = 'produto'`
  com `peca_id` preenchido — ver `PDV.tsx`.)
- Produtos/peças **lançados dentro de uma OS** geram linha em `vendas` **sem
  `funcionario_id`** (`handleSubmitOrdemServico.ts` linha ~1014) → **não entram**
  no Sistema A (e já estão no total da OS). Não há dupla contagem, mas o
  vendedor/estoquista também não recebe por peça usada em OS.

### 2.2 É separada da lógica de OS? Sofre dos mesmos bugs?

**É completamente separada.** Vendas de produto **não** tocam
`comissaoPorTipoServico.ts`, `comissoes_tipo_servico`, nem snapshots.
Consequências:

- **Total da venda vs item:** o Sistema A **sempre** soma o total do período
  antes de aplicar o `%`. Para porcentagem isso dá o mesmo resultado que
  item-a-item (distributiva), então o bug clássico "aplicou sobre o total" **não
  afeta o `%`**. **Mas afeta o `valor_fixo`**: `quantidade × valor` conta
  **linhas da tabela `vendas`**, e uma venda `a_receber` parcelada gera N linhas
  → N× a comissão fixa (P2).
- **Faturamento vs lucro:** **não há opção "lucro" para vendas.** `comissao_calculo`
  só é lido pelo Sistema B. Vendas são sempre sobre faturamento — e sobre
  faturamento **bruto** (ver abaixo).
- **Proteção de "custo não confirmado":** **não existe** para vendas. `vendas`
  tem `custo_unitario`, mas ninguém usa em cálculo de comissão.

### 2.3 Faturamento bruto (antes do desconto)

`PDV.tsx` grava `vendas.total` = **total bruto do item, sem desconto**
(o desconto vai para `valor_desconto_manual` / `valor_desconto_cupom` e só é
subtraído na exibição da tela de Vendas). `useComissoes` e
`DashboardComissaoFuncionario` somam `vendas.total` **sem subtrair esses
descontos** → o funcionário recebe comissão sobre um valor que a loja
descontou. Ver P0-b.

---

## Parte 3 — Consistência entre os caminhos

### 3.1 Qual caminho a OS usa ao salvar (`handleSubmitOrdemServico.ts`)

Seja `funcId = tecnicoId || funcionarioId` e `tsId = tipoServicoId` (Etapa 4):

| Condição | Caminho | Base do cálculo | Respeita "lucro"? | Respeita match/marca/ambiguidade? |
|---|---|---|---|---|
| `funcId` **e** `servicos.length > 0` (**1 ou N serviços** — desde a Fase 1) | `calcularComissaoPorServico` (item a item) | **preço de cada serviço** | ✅ | ✅ |
| `funcId` e **0 serviços** | — | nada é gravado (`snapshot = null`) | — | — |
| Linhas em `os_tecnicos` (qualquer nº de serviços) | `salvarTecnicosOS` (por linha) | **preço do serviço vinculado** (ou total da OS se legado) | ✅ | ✅ |

➡️ **Fase 1 (2026-09-02):** o ponto cego "OS de 1 serviço" foi eliminado — o
guard `> 1` virou `> 0` e o ramo `(total da OS) × %` foi removido. `tsId` da
Etapa 4 não é mais base de cálculo (só alimenta `tipo_servico_nome_snapshot`).
Ver P1-c.

### 3.2 Mesmo funcionário, mesmo mês, telas diferentes

| Tela | Motor | Base OS | Base Vendas | "lucro"? | Filtra `is_teste`? | Filtra `empresa_id`? | Snapshot ou ao vivo? |
|---|---|---|---|---|---|---|---|
| Dashboard Equipe — "Comissões a Pagar" e tabela | A | `Σ ordens_servico.total` (entregue) × `%` do escopo | `Σ vendas.total` bruto × `%` | ❌ | ❌ | ❌ | ao vivo (config de hoje) |
| Perfil de Desempenho (aberto da mesma tela) | B | `Σ comissao_calculada_snapshot` (item a item) | — (não mostra vendas) | ✅ | ✅ | ❌ | snapshot (config do save) |
| "Sua Comissão do Mês" (funcionário) | A' | `Σ ordens_servico.total` (entregue) | `Σ vendas.total` bruto | ❌ | ❌ | ❌ | ao vivo |

`A'` = variante com bugs próprios (P1-a): no ramo legado ignora `comissao_escopo`
e sempre usa "tudo"; `vendasAnt` (mês anterior) não exclui
`pagamento_duplo_secundario`.

**Resultado:** para praticamente qualquer loja que usa "Comissão por Tipo de
Serviço", os três números divergem. Casos típicos:

- Loja **só com Sistema B** (per-tipo) configurado, técnicos **sem**
  `comissao_escopo`/`comissoes_por_cargo`: Dashboard Equipe mostra
  **Comissão R$ 0** para o técnico e o card "Comissões a Pagar" **não inclui**
  a comissão dele; o Perfil mostra o valor real. O dono paga pelo número errado.
- Loja **só com Sistema A** (escopo `servicos_os` 10%), **sem** linhas
  `comissoes_tipo_servico`: Dashboard Equipe mostra 10% × total; o Perfil mostra
  **"—"** em toda OS (snapshot null, fallback vazio).
- Loja com **os dois** configurados com valores diferentes: cada tela usa o seu.

### 3.3 As correções de OS foram aplicadas em todo lugar?

> Coluna "OS de 1 serviço" = ✅ desde a Fase 1 (agora é o mesmo caminho de
> `calcularComissaoPorServico`); mantida na tabela só para registrar o antes/depois.

| Correção | `calcularComissaoPorServico` (principal, 1 ou N serviços — Fase 1) | `salvarTecnicosOS` (técnicos por serviço) | OS de 1 serviço (antes → depois da Fase 1) | `resolverComissaoOS` fallback (Perfil) | Sistema A (dashboards) |
|---|:--:|:--:|:--:|:--:|:--:|
| Item a item (não sobre o total) | ✅ | ✅ | ❌ → ✅ | ❌ | n/a (distributiva p/ %) |
| Match bidirecional (`encontrarComissaoPorNomeServico`) | ✅ | ✅ | ❌ → ✅ | ❌ | ❌ |
| Desambiguação por marca | ✅ | ✅ | ❌ → ✅ | ❌ | ❌ |
| Faturamento × Lucro (`comissao_calculo`) | ✅ | ✅ | ❌ → ✅ | ❌ | ❌ |
| Aviso "custo não confirmado" | ✅ | ✅ | ❌ → ✅ | ✅ (só exibe) | ❌ |
| Aviso visível ao salvar (toast) | ✅ | ✅ | ❌ | n/a | n/a |

---

## Parte 4 — Regras de desempate / ambiguidade (Sistema B)

Implementadas em `encontrarComissaoPorNomeServico`
([`comissaoPorTipoServico.ts`](../src/lib/ordemServico/comissaoPorTipoServico.ts)):

1. **Casamento de nome** (case-insensitive, `trim`): bidirecional —
   `nomeItem.includes(nomeTipo) || nomeTipo.includes(nomeItem)`.
2. **0 candidatos** → sem comissão para o item (não é erro; contribui R$ 0 e
   entra em `itensSemComissaoConfigurada`).
3. **1 candidato** → aplica.
4. **\>1 candidato**:
   1. **Igualdade exata** de nome vence (se houver ≥1 exato, reduz o pool a eles).
   2. **Marca real do aparelho** (`dispositivo_marca` da OS): `apple` →
      `iphone/apple/ios/ipad`; qualquer outra marca → `android` + o nome da marca.
      Se sobrar exatamente 1 tipo compatível com a marca, aplica.
   3. Ainda empatado → **`ambiguo: true`**: comissão do item = R$ 0, item entra em
      `itensComissaoAmbigua`, toast "⚠️ Comissão do técnico incompleta — revise",
      e ícone ⚠️ no Perfil. **Nunca** se escolhe por tamanho de string.
5. **Custo não confirmado** (só `calculo === "lucro"`, item com `%` e custo `0`
   não confirmado): comissão do item = R$ 0, entra em `itensCustoNaoConfirmado`,
   mesmo tratamento seguro. O banner na OS (`SelecionadorServico.tsx`) pede a
   confirmação; `custo_confirmado` é gravado em `avarias.servicos_realizados`.

Casos conhecidos que caem em "ambíguo" (ver
[`scripts/recalculo-comissao/output/relatorio.md`](../scripts/recalculo-comissao/output/relatorio.md)):
- **Tipos de serviço com nome duplicado** ("MÃO DE OBRA" 15% vs "MÃO DE OBRA" 15%)
  — não há como o algoritmo decidir; sempre ambíguo.
- Famílias que se contêm ("FRONTAL" vs "TROCA DE FRONTAL" vs "troca de frontal")
  quando a marca não separa.

---

## Parte 5 — Inconsistências e bugs ainda não corrigidos (priorizado)

Prioridade por impacto em **pagamento real de funcionário**.

### 🔴 P0-a — Dois motores irreconciliáveis para comissão de OS

- **O quê:** "Comissões a Pagar" / tabela do Dashboard de Equipe usam o Sistema A
  (`%` do escopo × soma das OS). O "Perfil de Desempenho", aberto **da mesma
  tela**, usa o Sistema B (soma dos snapshots item a item). Não há conciliação.
- **Efeito:** o número que o dono usa para pagar (card "Comissões a Pagar") e o
  detalhamento por funcionário mostram valores diferentes. Numa loja que adotou
  "Comissão por Tipo de Serviço" sem preencher `comissao_escopo`, o card ignora
  os técnicos (R$ 0).
- **Arquivos:** `useComissoes.ts`, `DashboardEquipe.tsx` vs
  `useDesempenhoFuncionario.ts`, `PerfilDesempenhoFuncionario.tsx`.
- **Decisão de produto necessária:** qual motor é a verdade? (Recomendação:
  Sistema B — snapshot — é o único item a item, com lucro e com trilha de
  auditoria; o Sistema A deveria ler os snapshots para OS e ficar só com vendas.)

### 🔴 P0-b — Comissão de venda de produto é sobre faturamento BRUTO e conta vendas apagadas

- **O quê:** `useComissoes.ts` e `DashboardComissaoFuncionario.tsx` somam
  `vendas.total` **sem subtrair** `valor_desconto_manual` / `valor_desconto_cupom`
  e **sem filtrar `deleted_at IS NULL`** (só filtram `cancelada = false`).
- **Efeito:** funcionário recebe comissão sobre o valor cheio de vendas com
  desconto, e sobre vendas que foram soft-deletadas.
- **Arquivos:** `useComissoes.ts` (query `vendas`, ~linha 129 e ~276),
  `DashboardComissaoFuncionario.tsx` (~linha 40).

### 🟠 P1-a — "Sua Comissão do Mês" (funcionário) diverge do Dashboard do dono

- **O quê:** `DashboardComissaoFuncionario.tsx`, no ramo legado
  (`comissao_tipo` sem `comissoes_por_cargo`), faz
  `comissaoTotal = (vendasProdutos + vendasDispositivos + totalServicos) × %`
  **ignorando `comissao_escopo`** — sempre "tudo". `useComissoes` respeita o
  escopo. Também: a query `vendasAnt` não exclui `pagamento_duplo_secundario`.
- **Efeito:** o funcionário vê uma comissão estimada maior/menor do que a que o
  dono vê para ele, na mesma competência.
- **Arquivo:** `DashboardComissaoFuncionario.tsx` (~linhas 101-107).

### 🟠 P1-b — Modo "Comissão sobre Lucro" só existe no Sistema B

- **O quê:** `comissao_calculo = 'lucro'` só é lido em
  `handleSubmitOrdemServico.ts` / `salvarTecnicosOS` / `useDesempenhoFuncionario.ts`.
  Os dashboards (Sistema A) sempre calculam sobre faturamento.
- **Efeito:** loja que configurou "lucro" vê comissão sobre lucro no Perfil e
  sobre faturamento no card "Comissões a Pagar" e no dashboard do funcionário.

### ✅ P1-c — OS com 1 serviço só: comissão sobre o TOTAL da OS, sem lucro, sem match por nome — **CORRIGIDO na Fase 1 (2026-09-02)**

- **O quê (era):** ramo `funcId && tsId && servicos.length <= 1` em
  `handleSubmitOrdemServico.ts`: `snapshot = total_da_OS × %` do
  `tipo_servico_id` da Etapa 4.
- **Efeito (era):** a base incluía produtos lançados na OS e era reduzida pelo
  desconto; nunca aplicava lucro; usava o Tipo escolhido na Etapa 4, que pode
  não ser o do serviço realmente feito; o banner de custo não confirmado não
  protegia nada aqui.
- **Correção (base):** o guard virou `formData.servicos.length > 0` e o ramo à
  parte foi removido. Agora **toda** OS com serviço(s) passa por
  `calcularComissaoPorServico` (o mesmo motor da OS multi-serviço): item a item,
  base = preço do serviço (ou preço − custo no modo lucro), proteção de custo
  não confirmado, match por nome + marca.
- **B — fallback do Tipo de Serviço do formulário (só OS de 1 serviço):**
  quando o match por nome **falha** (sem config OU ambíguo mesmo após o
  desempate c1) e o Tipo selecionado na Etapa 4 tem comissão > 0 para o
  técnico, a comissão é aplicada com essa config — **mas na base correta por
  serviço** (preço, ou preço − custo no lucro) e com a proteção de custo
  ativa. O fallback **nunca** sobrepõe um match por nome bem-sucedido. O item
  entra num aviso **brando** (`ℹ️`, não "revise"): _"comissão aplicada pelo
  Tipo de Serviço selecionado no formulário; renomeie o serviço no catálogo
  para casar automaticamente"_. O título do toast **não** vira "precisa de
  revisão". Não vale para 2+ serviços (não há um dropdown único por serviço).
- **c1 — desempate por valor idêntico:** em `encontrarComissaoPorNomeServico`,
  se todos os candidatos ambíguos restantes dão a **mesma** comissão (mesmo
  `comissao_tipo` + mesmo `comissao_valor`), aplica esse valor em vez de
  marcar ambíguo (cobre o catálogo com Tipos duplicados: "TROCA DE FRONTAL" /
  "troca de frontal" / "FRONTAL" todos a 3%).
- **c2 — `palavrasChaveDaMarca`:** reconhece `iphone`, `ipad`, `ipod`, `ios`
  (por `contains`, além de `apple`) como família Apple — antes só a string
  literal `"apple"` contava, e a maioria das lojas grava `dispositivo_marca`
  como "iPhone".
- `comissao_tipo_snapshot` / `comissao_valor_snapshot` seguem sempre `null`
  (não são lidos por nada), inclusive quando o fallback B é usado.
- **Consequência conhecida (aceita):** para OS de 1 serviço, o **match por
  nome tem prioridade sobre o Tipo escolhido na Etapa 4**. Se o nome do
  serviço casa com um Tipo cadastrado diferente do que foi selecionado no
  dropdown, a comissão passa a usar o do **nome**. Sem nenhum Tipo cadastrado
  que case e sem Tipo válido no formulário, o item fica R$ 0 + aviso "revise",
  como na OS de 2+ serviços.
- **Impacto medido (janela de 60 dias, todo o sistema —
  `scripts/fase1-impacto/`):** só 3 lojas usam "Comissão por Tipo de Serviço".
  Das **91** OS de 1 serviço que a versão base da Fase 1 zerava (todas de
  `glaucio.reis@hotmail.com`), **B + c1 + c2 recuperam as 91** (B: 60 · c1: 30
  · c2: 1); **0 continuam sem cálculo**. `NOVO_NULL_ANTES_TINHA_VALOR = 0`.
  17 OS mudam de valor (net −R$ 199,40) porque o nome casa com um Tipo
  diferente do dropdown, ou porque o snapshot antigo estava obsoleto. A outra
  loja ativa com a feature (`lucy...`) não tem **nenhuma** mudança vinda de
  B/c1/c2.
- **Testes:** [`scripts/fase1-comissao-os-servico-unico/testes-regressao.mjs`](../scripts/fase1-comissao-os-servico-unico/testes-regressao.mjs)
  (10 cenários) e [`scripts/fase1-impacto/`](../scripts/fase1-impacto/)
  (análise de impacto, só leitura), usando as funções reais e puras de
  `comissaoPorTipoServico.ts`.
- **`salvarTecnicosOS` ("Técnicos por Serviço"):** herda c1 + c2 (chama a
  mesma `encontrarComissaoPorNomeServico`). O fallback B **não** foi estendido
  para lá — cada linha já é vinculada a um serviço específico e o `tsId` da
  Etapa 4 não representa um serviço em particular quando há vários.
- **Texto de UI** em `EtapaInformacoesServico.tsx` atualizado para descrever o
  cálculo serviço a serviço.
- **Ponta solta (levar para a Fase 2):** com B, quase toda OS de 1 serviço
  passa a ter snapshot real, então o **fallback de exibição** em
  `resolverComissaoOS` (`PerfilDesempenhoFuncionario.tsx`, passo 3-4) quase
  não é mais alcançado. Ainda assim, quando o snapshot fica `null` (nem nome
  nem Tipo do formulário casaram), esse passo pode mostrar `os.total × %` do
  `tipo_servico_id` da Etapa 4 se o técnico tiver config para aquele tipo — um
  valor que o snapshot (base de pagamento) não tem. E `avaliarAlertasComissaoOS`
  só reavalia "sem config / ambíguo" para OS com **2+** serviços
  (`servicosRealizados.length < 2` → `continue`), então a OS de 1 serviço não
  ganha o ícone ⚠️ nesses casos. Nada disso muda o valor **gravado**; é só
  inconsistência de tela. Corrigir junto com a Fase 2.

### 🟡 P2-a — `valor_fixo` em vendas conta linhas de `vendas`, não vendas

- **O quê:** `calcularComissaoEscopo` faz `quantidade × valor` com
  `quantidade = vendasFunc.length`. Venda `a_receber` parcelada = N linhas em
  `vendas` (uma por parcela) → N× a comissão fixa. Idem se um mesmo item vira
  várias linhas.
- **Arquivo:** `useComissoes.ts` (~linha 61-64); `DashboardComissaoFuncionario.tsx`
  (`qtdVendas = (vendas||[]).length`).

### 🟡 P2-b — Snapshots ficam obsoletos; Sistema A recalcula ao vivo

- **O quê:** `comissao_calculada_snapshot` só é regravado ao criar/editar a OS.
  Mudar a config depois: o Perfil segue mostrando o valor antigo (o que é
  correto do ponto de vista "foi isso que combinamos quando fechou a OS"), mas o
  Dashboard de Equipe recalcula tudo com o `comissao_valor` de hoje. Divergem
  retroativamente, inclusive para meses fechados.

### 🟡 P2-c — Filtros divergentes entre as queries

| Filtro | `useComissoes` (A) | `DashboardComissaoFuncionario` (A') | `useDesempenhoFuncionario` (B) |
|---|:--:|:--:|:--:|
| `deleted_at IS NULL` em `ordens_servico` | ✅ | ✅ | ✅ |
| `deleted_at IS NULL` em `vendas` | ❌ | ❌ | n/a |
| `is_teste = false` em `ordens_servico` | ❌ | ❌ | ✅ |
| `empresa_id` (multi-empresa) | ❌ | ❌ | ❌ |
| exclui `pagamento_duplo_secundario` | ✅ (mês atual e anterior) | ✅ atual / ❌ anterior | n/a |
| `nao_conta_limite` (1ª OS de onboarding) | não trata | não trata | não trata |

- **Efeito:** OS de teste entram na comissão do dashboard mas não no Perfil;
  filiais são misturadas em todas as telas; vendas apagadas contam (ver P0-b).

### 🟡 P2-d — "Comissões a Pagar" de um mês fechado pode mudar depois

- **O quê:** no `base_comissao = 'criacao'`, `useComissoes` filtra
  `status = 'entregue'` **e** `created_at` no mês. Uma OS criada em janeiro e só
  entregue em março passa a contar **em janeiro** assim que é entregue —
  alterando um mês já pago.

### 🟢 P3-a — "Total Vendido" (coluna da linha) exclui serviços de OS

- `DashboardEquipe.tsx` mostra `c.totalVendas` (só produtos + dispositivos) na
  coluna "Total Vendido", mas o card "Total Vendido (Equipe)" soma
  `totalVendas + totalServicos`. Um técnico puro aparece com "Total Vendido:
  R$ 0" e "Comissão: R$ X". Confuso, não afeta pagamento.

### 🟢 P3-b — Tipos de serviço com nome duplicado ⇒ ambiguidade permanente

- Ver Parte 4. Solução é de dados (não permitir/mesclar nomes iguais) + talvez
  desempate por `tipo_servico_id` gravado na OS.

### 🟢 P3-c — Fallback legado do Perfil sempre em faturamento

- `resolverComissaoOS` passo 4: OS antiga sem snapshot → `os.total × %` da config
  atual, sempre faturamento, sempre sobre o total. Só afeta OS pré-snapshot.

### 🟢 P3-d — Risco latente de dupla contagem de snapshot

- Numa OS multi-serviço em que o mesmo técnico é o principal **e** tem linhas em
  `os_tecnicos`, o valor fica gravado **nos dois lugares**
  (`ordens_servico.comissao_calculada_snapshot` **e** `os_tecnicos.*`).
  `resolverComissaoOS` prefere `os_tecnicos` e não soma o outro — então hoje não
  há bug —, mas qualquer relatório novo que some as duas colunas vai contar em
  dobro.

---

## Parte 6 — Glossário de colunas

### `loja_funcionarios` (config)
| Coluna | Sistema | Significado |
|---|---|---|
| `comissao_tipo` | A (legado) | `porcentagem` \| `valor_fixo` |
| `comissao_valor` | A (legado) | número (% ou R$) |
| `comissao_escopo` | A (legado) | `vendas_produtos` \| `vendas_dispositivos` \| `vendas_todos` \| `servicos_os` \| `tudo` |
| `comissoes_por_cargo` | A (atual) | `{ "<cargo>": { tipo, valor, escopo } }` — se preenchido, tem precedência sobre o trio legado |
| `base_comissao` | A + B | `criacao` (conta pela data de abertura da OS) \| `entrega` (pela `data_saida`) |
| `comissao_calculo` | **B apenas** | `faturamento` \| `lucro` (percentual sobre `preco − custo` do serviço) |

### `comissoes_tipo_servico` (config — Sistema B)
| Coluna | Significado |
|---|---|
| `funcionario_id` → `loja_funcionarios.id` | dono da regra |
| `tipo_servico_id` → `tipos_servico.id` | tipo de serviço |
| `comissao_tipo` | `porcentagem` \| `valor_fixo` |
| `comissao_valor` | número; só linhas com `> 0` são gravadas |

### `ordens_servico` (resultado — Sistema B)
| Coluna | Significado |
|---|---|
| `funcionario_id` | técnico principal |
| `tipo_servico_id` | tipo escolhido na Etapa 4 (usado só no caminho de 1 serviço) |
| `comissao_tipo_snapshot` / `comissao_valor_snapshot` | config aplicada; **`null` de propósito** no caminho multi-serviço (não há um `%` único) |
| `comissao_calculada_snapshot` | R$ da comissão congelado no save; `null` = não calculado |
| `tipo_servico_nome_snapshot` | nome do tipo no momento do save |

### `os_tecnicos` (resultado — Sistema B, múltiplos técnicos)
| Coluna | Significado |
|---|---|
| `funcionario_id` | técnico da linha |
| `servico_id` / `servico_nome_snapshot` / `preco_servico_snapshot` | serviço vinculado e seu preço no save |
| `comissao_*_snapshot` | igual à OS, mas por serviço/linha |

### `vendas` (entrada — Sistema A)
| Coluna | Uso na comissão |
|---|---|
| `funcionario_id` | quem leva |
| `tipo` | `produto` / `dispositivo` (peça é gravada como `produto` com `peca_id`) |
| `total` | **base** da comissão — é o **bruto**, antes de `valor_desconto_manual`/`valor_desconto_cupom` |
| `cancelada` | filtrado (`= false`) |
| `deleted_at` | **não** filtrado (bug P0-b) |
| `observacoes = 'pagamento_duplo_secundario'` | linha auxiliar, excluída do cálculo |
| `custo_unitario` | **não usado** em comissão (não há modo lucro para vendas) |

---

## Parte 7 — Onde cada valor aparece para o usuário (mapa rápido)

| Tela / componente | O que mostra | Motor |
|---|---|---|
| Equipe → Dashboard → card "Comissões a Pagar" | soma da equipe no mês | A |
| Equipe → Dashboard → tabela "Desempenho por Funcionário", coluna "Comissão" | por funcionário no mês | A |
| Equipe → Dashboard → export XLSX | idem tabela | A |
| Equipe → Dashboard → botão 👁 "Perfil" → cards e tabela de OS + dialog "OS ####" | por OS e total do período | **B** (com fallback) |
| Equipe → Dashboard → sparkline dos 6 meses | série de "Total Vendido" e "Comissões" | A |
| Dashboard do funcionário → "Sua Comissão do Mês" | estimativa do próprio mês | A' |
| Wizard da OS → toast ao salvar | "⚠️ Comissão do técnico incompleta — revise: ..." | B |
| Wizard da OS → banner "custo R$ 0,00 está correto?" | pedido de confirmação de custo | B (só se `comissao_calculo = lucro`) |
| PDV | — (nenhum valor de comissão é exibido ou calculado) | — |

---

## Apêndice — scripts de investigação já existentes

- [`scripts/recalculo-comissao/`](../scripts/recalculo-comissao/) — dry-run de
  2026-08-26 que recomparou 100 OS do Sistema B com a "função real + marca real".
  Achou 69/100 divergentes e 6 ambíguas. **É anterior à feature de "lucro"
  (migration de 2026-08-27)** e só considerou faturamento. `updates.sql` /
  `updates-seguros.sql` nunca foram, até onde se sabe, aplicados — confirmar
  antes de qualquer novo recálculo.
- [`scripts/investigacao-lucro-vendas/`](../scripts/investigacao-lucro-vendas/) —
  investigação de lucro em vendas (não de comissão diretamente).

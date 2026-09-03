# COMISSÃO — Fonte única de verdade

> Auditoria completa do sistema de comissão de funcionários (OS + Vendas de Produto/Peça).
> Data da auditoria: **2026-09-02**. Nenhum código foi alterado — este documento é só o mapa.
>
> **Leia o "Resumo executivo" primeiro.** Se você só tem 2 minutos, leia isso e a
> "Parte 5 — Inconsistências e bugs".

---

## Resumo executivo

> **Status pós-Fase 2 (2026-09-02):** os dois motores foram **conciliados para
> a comissão de OS**. O card "Comissões a Pagar" e o "Perfil de Desempenho"
> agora leem o MESMO valor — o snapshot do Sistema B — via o helper único
> [`src/lib/comissao/comissaoOsDoSnapshot.ts`](../src/lib/comissao/comissaoOsDoSnapshot.ts).
> O Sistema A (escopo/cargo) só continua responsável pela **comissão de venda
> de produto/peça** (e pela comissão de OS de quem NÃO configurou "Comissão
> por Tipo de Serviço"). `DashboardComissaoFuncionario.tsx` (código morto) foi
> removido. Detalhes: P0-a, P1-a e P1-c abaixo. A seção histórica a seguir
> descreve o estado ANTES das correções.
>
> **Status pós-Fase 3 (2026-09-03):** o Sistema B ganhou um **vínculo direto
> `servicos.tipo_servico_id`** (FK nullable → `tipos_servico`, `ON DELETE SET
> NULL`). No cálculo da comissão de OS (`calcularComissaoPorServico` e
> `salvarTecnicosOS`), quando o serviço de catálogo do item tem esse vínculo, o
> Tipo é usado **DIRETO** — sem correspondência de nome, sem desempate por
> marca, sem ambiguidade (novo `resolverComissaoDoServico` em
> [`comissaoPorTipoServico.ts`](../src/lib/ordemServico/comissaoPorTipoServico.ts)).
> Serviço sem vínculo mantém **exatamente** o fluxo Fase 1 (match por nome
> B+c1+c2). Vínculo sem % para o técnico → comissão R$ 0,00 intencional (aviso
> brando `ℹ️`, não "revise"). **Nenhuma OS existente muda de valor** com a
> entrega — só OS novas ou re-salvas. Tela nova: catálogo "Tipos de Serviço"
> em `/servicos` com contador de serviços vinculados e mesclagem de tipos
> duplicados. Backfill das OS antigas afetadas = tarefa separada (dry-run
> primeiro). Detalhes: P3-e abaixo.

Historicamente existiam **dois motores de cálculo de comissão completamente
separados**, que **não se conciliavam** e podiam mostrar números diferentes
para o mesmo funcionário no mesmo mês:

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
- ~~O card **"Comissões a Pagar"** que o dono usa para pagar a equipe é 100%
  Sistema A e mostra **R$ 0** para técnicos com "Comissão por Tipo de Serviço".~~
  **Corrigido na Fase 2** — o card lê o snapshot (P0-a).

Ver a lista priorizada na **Parte 5** (itens ✅ = já corrigidos nas Fases 1 e 2).

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
- `resolverComissaoDoServico(nomeServico, tipoServicoIdVinculado, tiposComComissao, mapaConfig, dispositivoMarca)`
  **(Fase 3)** → ponto de entrada único da resolução por item:
  - `tipoServicoIdVinculado` presente (de `servicos.tipo_servico_id`) → usa esse
    Tipo DIRETO. Config com valor > 0 → aplica; sem config / valor 0 →
    `{ config: undefined, viaVinculoDireto: true, vinculoSemConfig: true }`
    (comissão 0 intencional, aviso brando).
  - ausente → delega a `encontrarComissaoPorNomeServico` (abaixo). O vínculo
    SEMPRE vence o nome quando existir.
- `sugerirTipoServicoPorNome(nomeServico, tipos)` **(Fase 3)** → versão "nível
  loja" (sem funcionário, sem marca) da regra de nome, para o assistente de
  vinculação em massa pré-preencher `servicos.tipo_servico_id` só onde o match
  é único ou exato (nunca nos ambíguos).
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
| `servicos.tipo_servico_id` (FK nullable → `tipos_servico`, `ON DELETE SET NULL`) | `20260903120000` | **Fase 3** — vínculo direto do item de catálogo ao Tipo; tem prioridade sobre o match por nome |
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

**Passo 0 (Fase 3) — vínculo direto:** antes de qualquer regra de nome,
`resolverComissaoDoServico` checa `servicos.tipo_servico_id` do item. Se houver
vínculo, o Tipo é usado direto e **nada abaixo se aplica** (nem marca, nem
ambiguidade). Sem % configurada para o técnico nesse Tipo → comissão 0
intencional (`itensVinculoSemConfig`, aviso brando). O que segue vale só para
itens **sem** vínculo.

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

### ✅ P0-a — Dois motores irreconciliáveis para comissão de OS — **CORRIGIDO na Fase 2 (2026-09-02)**

- **O quê (era):** "Comissões a Pagar" / tabela do Dashboard de Equipe usavam o
  Sistema A (`%` do escopo × soma das OS); o "Perfil de Desempenho", aberto da
  mesma tela, usava o Sistema B (soma dos snapshots). Sem conciliação. Loja que
  adotou "Comissão por Tipo de Serviço" sem `comissao_escopo` → card ignorava os
  técnicos (R$ 0), Perfil mostrava o real.
- **Correção:** helper único
  [`comissaoOsDoSnapshot.ts`](../src/lib/comissao/comissaoOsDoSnapshot.ts) —
  comissão de OS = **sempre** o snapshot do Sistema B:
  - OS não entregue → 0;
  - funcionário tem linha(s) em `os_tecnicos` na OS → Σ dessas linhas
    (o snapshot do nível-OS é ignorado — sem dupla contagem);
  - senão `ordens_servico.comissao_calculada_snapshot` → esse valor;
  - senão → `null` (Perfil mostra "—", a soma trata como 0).
  `useComissoes` / `useComissoesSerieMensal` passaram a: (a) buscar
  `comissoes_tipo_servico` para saber quem tem config; (b) para quem TEM,
  somar os snapshots das OS onde é Técnico Principal (mesmíssimo conjunto que o
  Perfil, via `comissaoOsDoSnapshot`); (c) para quem NÃO tem, seguir no
  Sistema A. `calcularComissaoSistemaA` agora devolve `{ total, parteVendas,
  parteOS }` — a `parteOS` é substituída pelo snapshot para quem tem config; a
  `parteVendas` continua Sistema A para todo mundo (até a Fase 3).
- **Impacto medido (`scripts/fase2-impacto/`, jul–set/2026):** só **1 conta**
  muda — `glaucio.reis@hotmail.com`: "Comissões a Pagar" sai de **R$ 0** para
  **R$ 3.522,17 (jul) / R$ 2.266,40 (ago) / R$ 149,09 (set parcial)** — que é o
  valor que o Perfil já mostrava. **Todas as outras contas: R$ 0 de mudança.**
- **Arquivos:** novo `src/lib/comissao/comissaoOsDoSnapshot.ts`;
  `src/hooks/useComissoes.ts`; `src/components/equipe/PerfilDesempenhoFuncionario.tsx`
  (usa o helper, sem fallback); `src/components/equipe/DashboardEquipe.tsx`
  (ℹ️ explicando o efeito retroativo).
- **Testes:** [`scripts/fase2-comissao-unificada/testes-regressao.mjs`](../scripts/fase2-comissao-unificada/testes-regressao.mjs)
  e [`scripts/fase2-impacto/`](../scripts/fase2-impacto/).

### 🔴 P0-b — Comissão de venda de produto é sobre faturamento BRUTO (Fase 3)

- **O quê:** `useComissoes.ts` soma `vendas.total` **sem subtrair**
  `valor_desconto_manual` / `valor_desconto_cupom`.
- **Efeito:** funcionário recebe comissão sobre o valor cheio de vendas com
  desconto.
- **Parcialmente tratado na Fase 2:** as queries de `vendas` do `useComissoes`
  passaram a filtrar `deleted_at IS NULL` (vendas soft-deletadas não contam
  mais). Falta subtrair os descontos — **escopo da Fase 3**.
- **Arquivo:** `useComissoes.ts` (queries `vendas`). `DashboardComissaoFuncionario.tsx`
  foi removido (era código morto).

### ✅ P1-a — "Sua Comissão do Mês" (funcionário) divergia do Dashboard do dono — **RESOLVIDO na Fase 2 (removido)**

- **O quê (era):** `DashboardComissaoFuncionario.tsx`, no ramo legado, fazia
  `comissaoTotal = (vendas + serviços) × %` ignorando `comissao_escopo`.
- **Descoberta na Fase 2:** o componente **não era importado nem renderizado em
  lugar nenhum** — código morto (tinha histórico git, foi usado e removido da
  UI). "Sua Comissão do Mês" não existia para nenhum usuário.
- **Correção:** arquivo **deletado**. Se um dia voltar um card para o
  funcionário, ele deve nascer lendo o snapshot (helper `comissaoOsDoSnapshot`),
  não recalculando.

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
- **✅ Ponta solta do `resolverComissaoOS` — RESOLVIDA na Fase 2:** o fallback
  de exibição (`os.total × config atual`) foi **removido**. `resolverComissaoOS`
  agora delega tudo ao helper `comissaoOsDoSnapshot` — sem snapshot, mostra
  "—". O Perfil e o card "Comissões a Pagar" passam a exibir sempre o mesmo
  número por construção. `avaliarAlertasComissaoOS` continua só reavaliando
  "sem config / ambíguo" para OS com 2+ serviços (o ⚠️ da OS de 1 serviço
  segue via toast no save) — melhoria menor deixada para depois.

### 🟡 P2-a — `valor_fixo` em vendas conta linhas de `vendas`, não vendas

- **O quê:** `calcularComissaoEscopo` faz `quantidade × valor` com
  `quantidade = vendasFunc.length`. Venda `a_receber` parcelada = N linhas em
  `vendas` (uma por parcela) → N× a comissão fixa. Idem se um mesmo item vira
  várias linhas.
- **Arquivo:** `useComissoes.ts` (~linha 61-64); `DashboardComissaoFuncionario.tsx`
  (`qtdVendas = (vendas||[]).length`).

### ✅ P2-b — Snapshots obsoletos vs recálculo ao vivo — **MITIGADO na Fase 2**

- **O quê (era):** `comissao_calculada_snapshot` só é regravado ao criar/editar
  a OS. Mudar a config depois: o Perfil mostrava o valor antigo; o Dashboard de
  Equipe recalculava ao vivo com o `comissao_valor` de hoje → divergiam
  retroativamente, inclusive meses fechados.
- **Depois da Fase 2:** o Dashboard de Equipe também lê o snapshot → mudar a %
  **não** altera mais meses passados (fica MAIS estável, não menos). Resta a
  variação natural de P2-d (uma OS entregue/editada depois entra no mês dela) —
  coberta pelo aviso `ℹ️` adicionado ao card "Comissões a Pagar".

### 🟡 P2-c — Filtros divergentes entre as queries

| Filtro | `useComissoes` (A) | `useDesempenhoFuncionario` (B) |
|---|:--:|:--:|
| `deleted_at IS NULL` em `ordens_servico` | ✅ | ✅ |
| `deleted_at IS NULL` em `vendas` | ✅ (Fase 2) | n/a |
| `is_teste = false` em `ordens_servico` | ✅ (Fase 2) | ✅ |
| `empresa_id` (multi-empresa) | ❌ | ❌ |
| exclui `pagamento_duplo_secundario` | ✅ | n/a |
| `nao_conta_limite` (1ª OS de onboarding) | não trata | não trata |

- **Depois da Fase 2:** `useComissoes` alinhou `is_teste` e `deleted_at` (vendas)
  com o Perfil. Resta o **`empresa_id`** — bug transversal (multi-empresa mistura
  filiais em todas as telas de comissão), merece item próprio fora deste ciclo.

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
- **Fase 3:** a tela "Tipos de Serviço" (`/servicos`) ganhou **mesclagem de
  duplicados** — agrupa por nome normalizado (minúsculas, espaços colapsados),
  o dono escolhe o sobrevivente e os vínculos (`comissoes_tipo_servico` com
  tratamento do `UNIQUE(func,tipo)`, `servicos.tipo_servico_id`,
  `ordens_servico.tipo_servico_id`) são transferidos antes de apagar. Reduz a
  ambiguidade na origem para os itens sem vínculo direto.

### 🟢 P3-e — Vínculo direto Serviço → Tipo (Fase 3) só vale para OS novas/re-salvas

- **O quê:** `servicos.tipo_servico_id` passou a ter prioridade sobre o match
  por nome em `calcularComissaoPorServico` / `salvarTecnicosOS`. Mas
  `comissao_calculada_snapshot` continua congelado no save — OS já existentes
  não recalculam sozinhas ao criar o vínculo.
- **Consequência aceita:** depois que a loja vincula seus serviços (manual +
  assistente em massa), as OS antigas afetadas precisam de um **backfill** que
  recompute o snapshot pela mesma lógica pura (`resolverComissaoDoServico`).
  Backfill = tarefa separada, com **dry-run + relatório** antes de aplicar,
  escopada só às contas que vincularam algo. A lógica de cálculo já está
  reutilizável (funções puras em `comissaoPorTipoServico.ts`); ver
  `scripts/recalculo-comissao/` como molde.
- **Perfil de Desempenho / alertas:** `PerfilDesempenhoFuncionario.tsx` ainda
  reavalia "melhor esforço" via `encontrarComissaoPorNomeServico` (sem
  considerar o vínculo). Só afeta o ícone ⚠️, não o valor pago (que é o
  snapshot). Alinhar é melhoria menor deixada para depois.

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

# i18n no MecApp: convenções e plano dos formatadores

Para quem for traduzir uma tela (etapa 5 em diante). A base está em `src/lib/i18n/`; os textos, em `src/locales/`.

## Como está montado

- **Biblioteca:** i18next 26 + react-i18next 17.
- **pt-BR é a fonte.** `src/locales/pt-BR/<namespace>.ts` vai **embutido** no pacote principal e o i18next inicia **síncrono** em `main.tsx`. A primeira tela já sai em pt-BR, sem requisição e sem piscar.
- **Outros idiomas:** `src/locales/<es|en|it>/<namespace>.ts`. Cada arquivo vira um chunk `idioma-<idioma>-<namespace>` (ver `TRADUCAO` em `vite.config.ts`). Esse chunk é baixado **só** quando o idioma é aplicado e fica **fora do precache** do service worker.
- **Tipagem:** cada tradução é `Traducao<typeof <pt-BR>>`, com as mesmas chaves do pt-BR, todas opcionais. Chave digitada errado é erro de `tsc`. Chave que falta cai no pt-BR (`fallbackLng`).
- **Quem tem i18n:** a regra única fica em `src/lib/i18n/visibilidadeI18n.ts` (`I18N_PARA_TODOS`). Hoje vale só para admin. Para os demais, `useMercado()` devolve `MERCADO_BRASIL` sem consultar nada.
- **Idioma aplicado:** `SincronizarIdioma` (no `AppLayout`) segue `useMercado().idioma`. A ordem de resolução: perfil → subdomínio configurado → `?lang=` → localStorage → navegador (fora do domínio principal) → pt-BR.
- **Mercado e capacidades:** use `useMercado()`, que devolve `{ idioma, mercado, moeda, pais, fuso, capacidades }`. Esconda Pix/CEP/fiscal/CPF por `capacidades`, nunca por `mercado === "BR"` espalhado pelo código.

## Convenções de texto

1. **Nunca concatenar frases.** A ordem das palavras muda entre idiomas.
   ```tsx
   // ERRADO
   {"OS " + numero + " salva com sucesso"}
   // CERTO — pt-BR: salva: "OS {{numero}} salva com sucesso"
   {t("os:salva", { numero })}
   ```
2. **Interpolação com nome**, sempre `{{nome}}`, nunca `${}` dentro do texto. Valores formatados (moeda, data) entram já formatados pelos formatadores centrais:
   ```tsx
   t("vendas:totalDoDia", { valor: formatarMoeda(total, ctx) })   // "Total do dia: {{valor}}"
   ```
3. **Plural só com `count`**, e as chaves `_one` / `_other` (o i18next usa o `Intl.PluralRules`):
   ```ts
   aparelhos_zero: "Nenhum aparelho",
   aparelhos_one: "{{count}} aparelho",
   aparelhos_other: "{{count}} aparelhos",
   ```
   ```tsx
   t("os:aparelhos", { count: lista.length })
   ```
   ⚠️ **Em pt-BR o Intl trata 0 como singular** (`0 → "one"`): sem `_zero`, sai "0 aparelho". Ponha **`_zero` sempre** que a contagem puder ser 0. Em espanhol, 0 já cai em `_other` ("0 equipos").
   Nunca `count === 1 ? "aparelho" : "aparelhos"` no componente.
4. **Texto com marcação** (negrito, link no meio da frase): use `<Trans>` com componentes nomeados, nunca quebre a frase em três `t()`:
   ```tsx
   <Trans i18nKey="plano:venceEm" values={{ data }} components={{ b: <strong /> }} />
   // pt-BR: "Seu plano vence em <b>{{data}}</b>."
   ```
5. **Chaves:** `camelCase` em português, agrupadas por assunto (`idioma.titulo`, `os.status.entregue`). A chave descreve o **sentido**, não o texto ("botaoSalvar", não "salvarAlteracoes2").
6. **Namespaces:** um por área grande (`comum`, `menu`, depois `os`, `vendas`, `financeiro`...). Cada namespace novo entra em `NAMESPACES` (`instancia.ts`) e no `resources` do pt-BR.
7. **Dados do banco não se traduzem por `t()`:** nome de produto, status que o lojista renomeou, observações. Só os **padrões** gravados pelo sistema (ex.: os 8 status padrão da OS, por `slug`) ganham tradução, procurada pelo `slug` e não pelo nome.
8. **Texto de impressão e de mensagens ao cliente** (recibo, OS impressa, WhatsApp) usa o idioma **da loja**, não o de quem está logado. Isso entra quando funcionário e filial herdarem o mercado da loja (ver pendências).
9. **pt-BR não muda ao traduzir.** Ao trocar `"Texto"` por `t("chave")`, o valor pt-BR tem de ser o texto antigo **letra por letra**. Para o menu isso é testado em `scripts/testes-i18n/recursos.test.ts`; repetir o mesmo padrão para cada tela.
10. **Fora do React** (toasts após `await`, funções puras): use `i18n.t("chave", { ns })` no momento do uso. O `t` capturado na renderização pode estar no idioma anterior; esse caso aconteceu no seletor de idioma e foi corrigido.

## Adicionar um idioma ou namespace

- **Idioma:** crie `src/locales/<idioma>/<ns>.ts` com `Traducao<typeof <pt-BR>>`. O seletor passa a oferecê-lo sozinho (`IDIOMAS_DISPONIVEIS`), e o `vite.config.ts` já separa o chunk para `es|en|it`.
- **Namespace:** crie o arquivo pt-BR, importe-o em `instancia.ts` (`resources` e `NAMESPACES`) e escreva as traduções.

## Formatadores centrais

Ficam em `src/lib/i18n/formatadores.ts`, são puros e recebem o contexto da conta (`{ idioma, moeda, fuso, pais }`; padrão `FORMATO_BRASIL`):

| Função | Brasil (byte a byte igual a) | Fora do Brasil |
|---|---|---|
| `formatarMoeda(v, ctx)` | `formatCurrency`, `formatCurrencyPDF`, `toLocaleString("pt-BR", {currency:"BRL"})`; `null` → `"R$ 0,00"` com espaço comum, como hoje | `USD 1,234.50` (es-419), `US$ 1.234,50` (es-AR) |
| `formatarNumero(v, opcoes, ctx)` | `toLocaleString("pt-BR", opcoes)`, `formatarNumeroParaInputBR` | `1,234.5` (es-419) |
| `formatarData(v, ctx)` | `formatDate` (date-fns `dd/MM/yyyy`) com o navegador em SP; `formatarDataRecibo` em qualquer fuso | `26/10/2026` (es), `10/26/2026` (en-US) |
| `formatarHora(v, ctx)` | `formatTime` (`HH:mm`) | relógio do país (`06:55 p.m.` em es-419) |
| `formatarDataHora(v, ctx)` | `formatDateTime` (`dd/MM/yyyy HH:mm`); com `" às "` no lugar do espaço = `formatarDataHoraRecibo` | |

- **"AAAA-MM-DD" (coluna date)** é dia de calendário e nunca muda de dia em fuso nenhum.
- **Timestamp** é lido no **fuso da conta**, não no do navegador. No Brasil isso é igual ao de hoje para quem está em São Paulo. Quem abre o app com outro fuso no navegador passa a ver a hora de Brasília, como o recibo já faz. É uma mudança de comportamento intencional, que fica para decidir na etapa 5.
- `localeIntl`: `es` sem país (ou com o `BR` que a etapa 1 grava por padrão) vira `es-419`. O `es` puro é o da Espanha: `1234,50 US$`, sem separador de milhar abaixo de 10 000.
- **date-fns:** `carregarLocaleDateFns(idioma)` em `src/lib/i18n/localeDateFns.ts`. O `ptBR` já está carregado; `es`/`en`/`it` vêm por `import()`. Ainda ninguém usa; entra na etapa 5 (`format(..., { locale })` e calendários).

### Diferenças conhecidas (testadas em `scripts/testes-i18n/formatadores.test.ts`)

| Caso | Hoje | Formatador central | Decisão para a etapa 5 |
|---|---|---|---|
| `formatarMoedaRecibo(-0)` | `R$ 0,00` | `-R$ 0,00` (igual a `formatCurrency(-0)`) | O recibo continua com um adaptador próprio que arredonda antes |
| `formatarMoedaRecibo(1.005)` | `R$ 1,00` (arredonda `Math.round(v*100)/100`) | `R$ 1,01` (Intl) | Idem |
| `formatDateTime("2018-11-04")` | `04/11/2018 01:00` (meia-noite que não existiu no horário de verão) | `04/11/2018 00:00` | Aceitar; só data pura **com** hora, e só antes de 2019 |
| Data inválida | date-fns lança `RangeError` | `""` | Aceitar (melhora) |

### Inventário dos formatadores de hoje e o plano de migração (etapa 5)

Contagem aproximada de chamadas em `src/` (grep de 2026-10-26):

| Formatador atual | Onde | Chamadas / arquivos | Plano |
|---|---|---|---|
| `formatCurrency` | `src/lib/formatters.ts` (+ cópias locais em `GraficosDashboard`, `CardStatusOS`, `gerarOrcamentoPDF`) | ~250 / 78 | Vira `formatarMoeda(v, FORMATO_BRASIL)` por dentro (mesma assinatura). As telas passam a usar `useFormatadores()` (hook a criar na etapa 5, ligado ao `useMercado`) em ondas por área. |
| `formatCurrencyPDF` | `src/lib/pdfHelpers.ts` | ~69 / 6 | Recebe `ctx` opcional; PDF usa o contexto **da loja**. |
| `formatarMoeda` (locais) | `gerarOrdemServicoPDF`, `gerarReciboLegalPDF`, `AdminAnalytics`, `AdminUsuarios`, `CardSaldo*`, `Fidelidade`, `MultiEmpresas` | ~48 / 9 | Trocar pela central. As telas `/admin/*` ficam em BRL de propósito (faturamento do MecApp), com `FORMATO_BRASIL` fixo. |
| `formatarMoedaRecibo` | `src/lib/vendas/reciboTroca.ts` | 6 / 2 | Adaptador: arredonda como hoje e chama `formatarMoeda`. |
| `formatBRL` | `AdminFinanceiro` | 18 / 1 | Admin: `FORMATO_BRASIL` fixo. |
| `formatarReais` | `src/lib/estoque/montarEntradaEstoque.ts` | 7 / 2 | Central com `ctx`. |
| `formatDate` | `src/lib/formatters.ts` (+ locais) | ~84 / 38 | `formatarData(v, ctx)`. |
| `formatDateTime`, `formatDataVenda`, `formatTime` | `src/lib/formatters.ts` | 5 + 4 + 7 | `formatarDataHora` / `formatarHora`. O `formatDataVenda` mantém o "só data se for data pura". |
| `formatarDataHoraBrasil` | `gerarOrdemServicoPDF`, `gerarReciboLegalPDF` (date-fns `'às'`) | 14 / 2 | `t("comum:dataHora", { data, hora })` com `"{{data}} às {{hora}}"` em pt-BR e `"{{data}} a las {{hora}}"` em es. |
| `formatarDataHoraRecibo`, `formatarDataRecibo` | `src/lib/vendas/reciboVendaModelo.ts` (Brasília fixo) | 5 / 1 | Recebem `ctx` (fuso da loja). |
| `formatarDataHoraBrasilia` | `src/lib/nfe/gravarImportacao.ts` | 1 | Fiscal: só Brasil, fica como está. |
| `dataBrasilia.ts` (`dataBrasiliaISO`, `limitesDiaBrasilia`, `toBrasilia`...) | filtros de período, relatórios, financeiro | — | Ganha versão por fuso (`dataNoFusoISO(instante, fuso)`, `limitesDiaNoFuso`), com estas como atalhos de `America/Sao_Paulo`. Sem isso, "Hoje" no México corta o dia na hora errada. |
| `toLocaleString("pt-BR")` / `toLocaleDateString` / `toLocaleTimeString` / `new Intl.*` diretos | espalhados | ~30 / ~34 / ~6 / ~19 | Trocar pelos centrais, arquivo por arquivo. |
| date-fns `format(..., { locale: ptBR })` | 69 arquivos importam date-fns; ~89 `locale: ptBR` | — | Datas por extenso ("26 de outubro") passam a usar `localeDateFnsCarregado(idioma) ?? ptBR`. Padrões numéricos (`dd/MM/yyyy`) vão para `formatarData`. |

**Ordem sugerida (etapa 5):** `formatters.ts` por dentro (risco zero, saída idêntica) → `dataBrasilia.ts` por fuso → telas em ondas (OS, Vendas/PDV, Financeiro, Estoque, Clientes), cada onda com o mesmo teste main × branch em pt-BR → impressos e PDFs por último, com o contexto da loja.

## Pendências conhecidas

- **Funcionário e gerente de filial:** `useMercado` lê o perfil de quem está logado. Antes de liberar a todos, mercado, moeda, fuso e país têm de vir da loja. Hoje `get_mercado_loja()` só devolve o mercado; falta uma RPC (ou ampliar essa) que devolva também `pais`, `moeda` e `fuso_horario`, o que exige migration.
- **Menu do celular** (`MobileMenuDrawer`, `MobileBottomNav`): continua com os textos de `menuPrincipal.ts`. O piloto foi só o menu lateral. Na próxima etapa ele passa a usar as mesmas chaves (`itens.<rota>`).
- **Telas fora do AppLayout** (login, landing, acompanhamento público): `useI18nVisivel` só lê o cache de admin que o menu preenche, por isso só deve ser usado dentro do `AppLayout`.

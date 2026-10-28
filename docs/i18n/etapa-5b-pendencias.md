# Etapa 5B: o que ficou de fora (telas de PDV e Vendas)

Estado em 2026-10-27, branch `feat/i18n-modulo-2`. Vale só para quem tem i18n (hoje, admin). Para todos os outros usuários o app continua idêntico em pt-BR (HTML, requisições e arquivos baixados iguais aos da `origin/main`: ver `scripts/testes-i18n/modulo2.playwright.mjs`).

Os recibos (impressão, PDF, Termo de Garantia, "Copiar texto", reimpressão) e as prévias 80 mm do "Layout de Impressão" ficaram para a etapa 5C.

## 1. Formas de pagamento: tabela única

`comum.formaPagamento` (`src/locales/<idioma>/comum.ts`), lida na tela por `useNomesFormaPagamento()`.

- **pt-BR:** as variantes de hoje viraram chaves próprias, para cada tela continuar letra por letra igual.
  - `curto`: PDV, pagamento duplo, filtro de Vendas, formas padrão, Financeiro.
  - `longo`: lista de Vendas ("Cartão de Débito", "Cartão Parcelado", "A Prazo").
  - `aReceberAPrazo`: editar venda ("A Receber (A Prazo)").
  - `pixAvulsa`: venda avulsa e devolução da troca ("Pix").
  - `transferencia` e `naoInformada`.
- **es:** um nome só por forma em todas as telas.

| Forma | es |
|---|---|
| dinheiro | Efectivo |
| pix | Pix |
| debito | Débito |
| credito | Crédito |
| credito_parcelado | **Crédito en cuotas** |
| a_receber / a_prazo | Por cobrar |
| transferencia | Transferencia |

"Crédito en cuotas" é como se diz em AR, CL, CO, PE e UY. No México o usual é "a meses" / "meses sin intereses", que pode virar um ajuste por país depois.

- **O que vai para o banco e para o recibo continua em pt-BR:** `[forma:Nome]` em `observacoes`, `nomeFormaPagamento` do recibo, o agrupador do `useCaixa`. `lib/formaPagamento.ts` lê o mesmo arquivo pt-BR e só traduz quando a tela passa os nomes.

## 2. Textos que sobraram em português, por tela (admin com es)

Levantado pelo Playwright (admin em es, celular 375 px e computador 1366 px, 40 fluxos). Os "suspeitos" que são espanhol ("Cancelar", "Número de serie", "Calle y número") ou dado ("Loja Teste") ficaram de fora.

| Tela | Texto | Origem | Motivo |
|---|---|---|---|
| PDV, depois de "Finalizar venda" | "Obrigado pela sua confiança!", "Obrigado por escolher a {loja}!", "Produto / Serviço", "Loja", "Fechar" e o resto do recibo | `components/pdv/DialogReciboPDV.tsx` | Recibo: etapa 5C |
| PDV › Configuración › Diseño de impresión; Vendas › Configuración | Diálogo do layout de impressão e prévia 80 mm | `DialogConfiguracaoLayoutPDV.tsx`, `Preview80mmPDV.tsx`, `DialogConfiguracaoLayoutVendas.tsx`, `Preview80mmVendas.tsx` | Etapa 5C |
| Vendas › Imprimir recibo | Diálogo de reimpressão | `components/vendas/DialogReimpressaoRecibo.tsx` | Etapa 5C |
| PDV › Equipo como parte de pago | Checklist ("Selecione o sistema", "Botões", "❌ Não Funciona", "Peça Trocada", "Marque se o aparelho chegou desligado…") | `components/ordens/ChecklistDispositivo.tsx` | Compartilhado com a OS (9 lugares) |
| PDV › Comisiones de tarjeta | Diálogo de taxas de cartão | `components/configuracoes/ConfiguracaoTaxasCartao.tsx` | Compartilhado com a OS |
| PDV › Seletor de itens (equipo) | Tempo de garantia e modelos do termo | `components/dispositivos/SeletorTempoGarantia.tsx` (+ `useTiposGarantia`) | Compartilhado com Dispositivos; termo é da 5C |
| PDV › Seletor de itens | Botão e leitor de código de barras | `components/scanner/LeitorCodigoBarras.tsx` | Compartilhado com Produtos e Dispositivos |
| PDV › Datos del cliente (criar cliente) | Toasts de criar cliente | `hooks/useClientes.ts` | Tela de Clientes |
| Vendas (fechamento do caixa e lista) | "transferencia", "dinheiro" (forma crua) | dado de `vendas_avulsas` e das OS | Hoje já aparece cru em pt-BR também |
| Todas | "Toggle Sidebar", "Close" (leitor de tela) | shadcn/Radix | Biblioteca |

Nada estourou nem cortou além do que já é cortado de propósito: número da venda e item com "…" e tooltip, e "Compatibilidad de protector y vidrio" no menu (5A). Sem rolagem horizontal em nenhum dos 80 casos em es.

Ajustes feitos por causa do tamanho:
- placeholder da busca de cliente encurtado ("Buscar o crear cliente...");
- "Artículo" com maiúscula no botão do carrinho, que mostra só a segunda palavra.

## 3. Termos só do Brasil (não escondidos; ficam para a etapa de capacidades)

Nada foi escondido nem teve a lógica trocada. Onde fazia sentido, só o texto visível em espanhol ficou genérico.

| Termo / regra | Onde | Arquivo:linha | Hoje em es |
|---|---|---|---|
| PIX como forma de pagamento | PDV (forma, pagamento duplo), filtro de Vendas, formas padrão, caixa | `pages/PDV.tsx:1407`, `components/pdv/PagamentoDuplo.tsx:17`, `pages/Vendas.tsx:413`, `components/pdv/DialogFormasPagamentoConfig.tsx:50, 58`, `components/pdv/DialogStatusCaixa.tsx` e `DialogHistoricoCaixas.tsx:94` (total em PIX), `components/pdv/DialogFechamentoCaixa.tsx:123, 142, 444` | "Pix" (capacidade `temPix` decide depois) |
| Devolução da troca "Dinheiro ou Pix" | PDV (troca maior que a venda) | `pages/PDV.tsx:446, 1588`; `lib/vendas/trocaPDV.ts` (`NOMES_FORMA_DEVOLUCAO`) | "Efectivo" / "Pix" |
| Pix na venda avulsa | Venda avulsa | `components/pdv/DialogVendaAvulsa.tsx:42, 61` | "Pix" |
| CPF do cliente (rótulo, máscara `000.000.000-00`, `maxLength={14}`, busca pelo CPF) | PDV › Dados do cliente › novo cliente | `components/pdv/SelecionadorCliente.tsx:50, 191, 283, 287, 292`; validação `pages/PDV.tsx:133` (`max(14)`) | "Documento" / "Número de documento" |
| CPF / CNPJ de quem entrega o aparelho | PDV › Aparelho de entrada (troca) | `components/pdv/DialogDispositivoEntrada.tsx:171, 174` | "Documento / ID fiscal" |
| Telefone com máscara brasileira `(00) 00000-0000` | Novo cliente; aparelho de entrada | `components/pdv/SelecionadorCliente.tsx:271`; `components/pdv/DialogDispositivoEntrada.tsx:183` | "Teléfono o WhatsApp" |
| "Crédito parcelado" (forma própria, parcelas de 2 a 12 com "3x de …") | PDV, pagamento duplo, lista e edição de Vendas, bandeira/taxa | `pages/PDV.tsx:1431, 1466`; `components/pdv/SeletorBandeiraCartao.tsx:33`; `components/pdv/DialogFechamentoCaixa.tsx:111, 137` | "Crédito en cuotas" / "3 cuotas de US$ 29.97" |
| Valor digitado com vírgula decimal (`replace(",", ".")`) e exemplos "0,00" | Preço no carrinho, venda avulsa, sangria, aparelho de entrada | `components/pdv/ItemCarrinho.tsx:31`; `components/pdv/DialogVendaAvulsa.tsx:117, 138`; `components/pdv/DialogSangria.tsx:39`; `components/pdv/DialogDispositivoEntrada.tsx:92, 97` | Exemplo "0.00"; a leitura aceita ponto e vírgula como decimal, mas "1,234.50" seria lido errado |
| Dia da venda sempre em Brasília: atalhos Hoje/Ontem/7 dias, filtro de período, alterar data ("Horário de Brasília") | Vendas | `pages/Vendas.tsx:73-77, 231-254`; `hooks/useVendas.ts:99-100`; `components/vendas/DialogAlterarDataVenda.tsx:38, 57, 61, 82, 142` | Texto diz "Hora de Brasilia" (verdade, mas errado para o México). Precisa de `dataBrasilia.ts` por fuso |
| "Hoje" da venda avulsa e data mínima dos recebimentos pelo dia do navegador / UTC (`toISOString().split("T")[0]`) | Venda avulsa; PDV e pagamento duplo (datas de parcela) | `components/pdv/DialogVendaAvulsa.tsx:80-81`; `pages/PDV.tsx:1516, 1560`; `components/pdv/PagamentoDuplo.tsx:56` | Igual (regra de fuso, já sinalizada pelo eslint) |
| Exemplo "Sangria de R$200" | Fechar caixa (observações) | `components/pdv/DialogFechamentoCaixa.tsx:506` | "Retiro de 200 realizado" |
| Boleto, maquininha, NF-e | Não aparecem nestas telas | — | — |

## 4. Textos que não são da tela (listados, não traduzidos)

- **Gravados no banco** (dado, não texto de tela; continuam em pt-BR):
  - nome e categoria da conta a receber da venda a prazo (`"Venda - {item} - {cliente} (1/3)"`, `"Vendas"`, `"(2ª forma)"`), em `pages/PDV.tsx:707-729, 855-865`;
  - taxa de cartão (`"Taxa Cartão {bandeira} - Venda PDV"`, `"Taxa de Cartão"`, `"Taxa 2.5% da bandeira … sobre venda de R$ …"`), em `pages/PDV.tsx:884-891`;
  - `[forma:Nome]` em `observacoes`;
  - "Cliente avulso" no evento `SALE_CREATED`.
- **Erros do banco/servidor**: `error.message` nos toasts de cancelar, confirmar recebimento, editar, excluir e status (`hooks/useVendas.ts`), e de abrir e fechar caixa.
- **Mensagens de bibliotecas do app** que a tela repete como vêm:
  - `resultado.erro` de `lib/vendas/alterarDataVenda.ts` (14 mensagens);
  - `reconhecimento.mensagem` de `lib/vendas/reconhecerSegundaForma.ts`;
  - `cascata.mensagem`;
  - `resultado.mensagem` da entrada da troca (`lib/vendas/registrarEntradaTroca.ts`, mostrado em "Motivo:");
  - "Cliente não informado" de `lib/caixa/servicosCaixa.ts`;
  - a forma de pagamento crua das OS no fechamento do caixa (`os.forma_pagamento`).
  - **Traduzidas** (constantes fixas, com teste de igualdade com a lib): `MENSAGEM_TROCA_MAIOR_QUE_ITENS_SEM_PECA`, `MENSAGEM_APARELHO_TROCA_VENDIDO`, `MENSAGEM_VENDA_COM_TROCA_INTEIRA`, `MENSAGEM_EDITAR_VENDA_COM_TROCA`, `MENSAGEM_CUSTO_NAO_CONFIRMADO` e o aviso de devolução.
- **Dados**: nomes de produto, cliente, vendedor e formas personalizadas; tipo do aparelho no seletor de itens (`dispositivo.tipo`, ex.: "celular"); "transferencia" cru na lista de Vendas (venda avulsa: a forma é gravada e mostrada sem rótulo, como hoje).
- **Bibliotecas de UI**: rótulos de leitor de tela do shadcn/Radix ("Close").
- **Componente de outro módulo dentro do PDV**: `ChecklistDispositivo` (checklist do aparelho de entrada), compartilhado com a OS em 9 lugares; fica para a etapa da OS.
- **Recibos e "Layout de Impressão"**: etapa 5C.

## 5. Adaptadores e decisões

- **Moeda**: as telas usam `useFormatadores().moeda`, e os `ValorMonetario` delas, o `<FormatoMoedaProvider>`. No Brasil é byte a byte o `formatCurrency` de antes (conferido pelo HTML do Playwright).
- **"(R$50,00)" da 2ª forma na lista de Vendas**: era `R$` + `toFixed(2)` com vírgula, sem espaço. No Brasil continua esse texto (`valorSegundaForma`, `TabelaVendas.tsx`); fora do Brasil usa o formatador central.
- **Data e hora do Status do caixa**: era `toLocaleString("pt-BR")`, que gera "26/10/2026, 08:00", com vírgula. No Brasil continua assim; com i18n usa `fmt.dataHora` ("26/10/2026 08:00").
- **Símbolo da moeda nos rótulos** ("Saldo Inicial (R$)", seletor do desconto): `useFormatadores().simboloMoeda` ("R$" no Brasil, "US$" em espanhol).
- **"Desconto: -R$ …", "3x de R$ …", "Total"**: valores pelo formatador central, mesmo texto no Brasil. Não existe campo de troco no PDV (não há "valor recebido"); troco só no recibo, que é da 5C.
- **Concordâncias erradas que já existiam**, mantidas no pt-BR; no es o plural está certo:
  - "+2 itens" e "N itens" (só aparecem com 2 ou mais);
  - "caixa(s) ajustado(s)", "parcela(s)", "linha(s)";
  - o toast "2 caixas fechados foram ajustados", que diz "2" para qualquer quantidade acima de 1.
- **Negrito em frase traduzida**: `ComNegrito` (`<b>…</b>` → `<strong>`) em vez do `Trans` do react-i18next. O `Trans` virava um chunk de 11 KB a mais em PDV e Vendas para todo mundo. O `ComNegrito` vai no `vendor-utils` (`vite.config.ts`), senão renomeava o chunk que PDV e Vendas compartilham.
- **"Adicionar Item" do PDV**: o "Adicionar" tem `xs:inline`, que o tema não define; na prática aparece só "Item" (em es, "Artículo"). Foi mantido.
- **Moeda do perfil em espanhol no Playwright**: mercado ES_LATAM, país MX, USD, America/Mexico_City (a conta realista do mercado).

## 6. Componentes compartilhados (mudam só para admin com es)

| Componente / hook | Outras telas afetadas |
|---|---|
| `TabelaVendas` (e os diálogos dela) | **Financeiro** › Análise de lucros e custos (`components/financeiro/SecaoAnaliseLucrosCustos.tsx`, sem ações: só a tabela, os selos e os tooltips) |
| `useVendas` (toasts) | **Financeiro** › Análise de lucros e custos (só o "Erro ao carregar vendas") |
| `SeletorBandeiraCartao` | **Ordem de Serviço**: Resumo financeiro do assistente (`ordem-servico-wizard/EtapaResumoAssinatura.tsx`) e da OS simplificada (`ordens/DialogOrdemServicoSimplificada.tsx`) |
| `DialogDispositivoEntrada` | **Dispositivos**: cartão do aparelho (`components/dispositivos/CardDispositivo.tsx`, pela grade) |
| `useFormasPagamentoCustomizadas` (toasts) | Usado também em Contas (cadastro e baixa), Repor estoque e Editar venda, mas os toasts traduzidos só saem ao criar ou remover forma, o que só acontece no PDV |
| `lib/formaPagamento.ts`, `getNomeItem`, `useFormatadores` | Sem mudança para ninguém: nomes padrão em pt-BR e funções novas opcionais |

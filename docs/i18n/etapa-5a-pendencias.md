# Etapa 5A: o que ficou de fora (menu do celular, Dashboard e Configurações)

Estado em 2026-10-27, branch `feat/i18n-modulo-1`. Vale só para quem tem i18n (hoje, admin). Para todos os outros usuários o app continua idêntico em pt-BR.

## 1. Textos que sobraram em português, por tela

Todos vêm de componentes que **não são destas telas**: o layout geral, o app inteiro ou outros módulos. Ficaram de fora porque traduzi-los mudaria outras telas.

| Tela | Texto | Origem | Motivo |
|---|---|---|---|
| Dashboard (celular e computador) | "Plano ativo", "Ver plano atual", avisos de pagamento/renovação | `components/layout/BannerVencimentoPlano.tsx` | Banner de assinatura do layout. Depende da cobrança ES_LATAM (Hotmart). |
| Dashboard | "O que melhor descreve seu negócio?", "Faço de Tudo", "Venda de Produtos/Peças", "Pra te mostrar só o que importa…", "Fechar", e os diálogos de criar a primeira OS | `components/onboarding/CardPrimeirosPassos.tsx` + `lib/primeirosPassos.ts` | Módulo de onboarding. |
| Dashboard | Imagens "NF-e em breve" / "lojas oficiais" (texto dentro da imagem), "Fechar aviso", "Banner anterior", etc. | `components/dashboard/BannerNfeEmBreve.tsx` | Só do Brasil (NF-e). A versão es exige imagem nova ou esconder o banner (`temFiscal`). |
| Dashboard | Cotação "USD/BRL" e "R$ 5,1234" | `pages/Dashboard.tsx:930-932`, `components/dashboard/CardCotacaoDolar.tsx:28,41` | Só do Brasil (cotação do real). |
| Dashboard | Conteúdo dos avisos do sistema | `components/dashboard/CardAvisosSistema.tsx` | Vem do banco (tabela de avisos). |
| Dashboard | Diálogo "Enviar feedback" (abre pelos botões do cartão) | `components/feedback/DialogCadastroFeedback.tsx` | Módulo de feedback. |
| Dashboard | Tutorial guiado | `components/tutorial/*` | Módulo de tutorial. |
| Todas (iPhone fora do app instalado) | "Toque no botão Compartilhar", "Adicionar à Tela Inicial", "Confirme tocando em \"Adicionar\"" | `components/pwa/InstallPrompt.tsx` | Aviso global de instalação do PWA. |
| Todas (barra do topo) | "Ative as notificações para receber alertas importantes", "Ativar" | `components/layout/BannerAtivarNotificacoes.tsx` | Barra do layout (OneSignal). |
| Menu do celular | Lista de notificações do sino; seletor de filial | `components/notifications/NotificationCenter.tsx`, `components/layout/SeletorFilial.tsx` | Outros módulos. Os textos das notificações vêm do banco. |
| Configurações › Exportação | Fluxo "Empezar de cero" (diálogo aberto pelo botão) | `components/configuracoes/comecar-do-zero/FluxoComecarDoZero.tsx` | Só o cartão foi traduzido; o fluxo tem captcha e confirmações próprias. |

## 2. Termos só do Brasil (não traduzidos nem escondidos; ficam para a etapa de capacidades)

| Termo | Onde | Arquivo:linha |
|---|---|---|
| CNPJ (rótulo, máscara `00.000.000/0000-00`, validação mín. 14) | Configurações › Perfil | `components/configuracoes/FormularioPerfilLoja.tsx:67, 263, 268, 271` |
| CEP (rótulo, máscara `00000-000`, validação mín. 8, botão Buscar via ViaCEP) | Configurações › Perfil | `FormularioPerfilLoja.tsx:68, 164-187, 295-325` |
| Estado com 2 letras (UF), `maxLength={2}`, exemplo "SP" | Configurações › Perfil | `FormularioPerfilLoja.tsx:74, 415-421` |
| Telefone com máscara brasileira `(00) 0000-0000` / `(00) 00000-0000`, validação mín. 10 | Configurações › Perfil | `FormularioPerfilLoja.tsx:75, 452, 455, 475, 478` |
| Inscrição Estadual / Inscrição Municipal | Configurações › Perfil (dados opcionais) | `FormularioPerfilLoja.tsx:541-560` |
| CNPJ, CEP, UF na prévia do recibo e nos campos obrigatórios | Configurações › Preview | `components/configuracoes/PreviewRecibo.tsx:67, 82, 84, 105, 108` |
| CEP entre os campos obrigatórios do perfil (% de progresso) | Configurações (topo e lateral) | `hooks/useConfiguracaoLoja.ts:22`, `components/configuracoes/ProgressoPerfil.tsx:18` |
| CNPJ citado no texto de filiais | Configurações (seletor de filial) | `pages/Configuracoes.tsx:183` (chave `filialDescricao`) |
| NF-e (banner) | Dashboard | `components/dashboard/BannerNfeEmBreve.tsx:33` |
| Cotação USD/BRL em R$ | Dashboard | `pages/Dashboard.tsx:930-932`, `components/dashboard/CardCotacaoDolar.tsx:28, 41` |
| PIX, CPF | Não aparecem nestas três telas | — |

## 3. Textos que não são da tela (listados, não traduzidos)

- **Mensagens dos hooks de push**: `activationStep` e `activationError` (`hooks/usePushNotifications.ts`), mostradas em Configurações › Notificações.
- **Erros do banco/servidor**:
  - `r.erro` no aviso de custo não confirmado.
  - Mensagens do Supabase nos toasts de erro.
  - `ConfiguracaoNumeracaoOS.tsx:92` **decide pelo texto em português da mensagem do banco** (`"maior que o último"`). Funciona porque a função do banco responde em pt; vale trocar por um código de erro um dia.
- **Navegador**:
  - Texto do `<input type="file">` ("Escolher arquivo / Nenhum arquivo escolhido"), em Configurações › Logo, que segue o idioma do navegador.
  - Validação nativa de e-mail.
- **Bibliotecas**: rótulos de leitor de tela do shadcn/Radix em inglês ("Close", "Toggle Sidebar").
- **Arquivo exportado**: nomes das abas e das colunas da planilha (Configurações › Exportação), que são dados.
- **Dados**: nome da loja e do usuário, avisos e notificações do banco, nomes de status de OS que o lojista renomeou.

## 4. Adaptadores e decisões

- **Prévia de cores (`PersonalizacaoCores.tsx`)**: o valor de exemplo era o texto fixo "R$ 2.350,00", com espaço comum. No Brasil sem i18n continua esse texto. Com i18n sai `formatarMoeda(2350)`, que no Brasil teria o espaço não separável do Intl.
- **`ValorMonetario`** continua com `formatCurrency` em todas as telas. O Dashboard envolve o conteúdo em `<FormatoMoedaProvider>` e os valores dele saem na moeda da conta.
- **Percentuais com `toFixed`** ("12.5%", com ponto em pt-BR) ficaram como estavam: trocar pelo formatador mudaria o pt-BR. Seria uma correção visual à parte.
- **Concordâncias erradas que já existiam** foram mantidas no pt-BR ("1 dias", "parcela(s)", "1 contas"). No es o plural está certo.
- **Componentes compartilhados também traduzidos**, com mudança só para admin com es:
  - `DialogDismissCard` (também em Clientes);
  - `AvisoCustoNaoConfirmado` (também onde mais aparece);
  - os botões do campo de assinatura (`AssinaturaDigital`, também na OS).

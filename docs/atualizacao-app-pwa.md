# Atualização do app instalado (PWA)

Levantamento de 2026-10-27, a partir do rascunho feito em `f893059` (branch `fix/os-produto-scroll-real`), conferido no código e na produção. As decisões já tomadas: **C** (número da versão em Configurações) e **A** (aviso "Nova versão disponível" com botão). **B** (atualização automática com recarga) **não** será feita.

## Como funciona hoje (origin/main `c034610`)

Arquivos: `vite.config.ts` (VitePWA), `src/main.tsx` (registro) e `src/sw.ts` (service worker).

- `registerType: "prompt"`, `strategies: "injectManifest"`. O SW **não** chama `skipWaiting()` sozinho; só quando recebe a mensagem `SKIP_WAITING` (`src/sw.ts`). Ao ativar, chama `clients.claim()`.
- Precache: cerca de 351 arquivos, 7,3 MB (`assets/*.js`, `assets/*.css`, ícones, manifesto). Ficam **fora** do precache: `jspdf*`, `html2canvas*`, `LeitorCodigoBarras*`, `templatePlanilha*`, `AdminOnboarding*` e `idioma-*`.
- Navegação (`index.html`) vem sempre da rede. JS/CSS fora do precache: `NetworkFirst`, 5 s.
- Registro: `registerSW()` de `virtual:pwa-register` (que usa `workbox-window`), depois do `load`.
- Procura versão nova: ao registrar e a cada `visibilitychange → visible` (`registration.update()`). **Não há verificação periódica.**

### Por que o usuário não vê nada

- `src/components/pwa/PWAUpdateBanner.tsx` está montado no `App.tsx`, mas **ninguém dispara** o evento `pwa-update-available` nem preenche `__pwaNeedRefresh`/`__pwaDoUpdate`. Quem disparava foi removido em `79b74b0`/`26857a9`. É código morto: o aviso nunca aparece.
- `onNeedRefresh` (em `main.tsx`) só escreve no console.

### Quando a página recarrega sozinha (achado crítico)

A cadeia exata:

1. O usuário volta ao app → `registration.update()` → o SW novo baixa (7,3 MB) e fica em `waiting`.
2. O `workbox-window` dispara `waiting` (ou `installed` com `isExternal`) → o `registerSW` do plugin chama `showSkipWaitingPrompt()`, que **registra um ouvinte `controlling` que faz `window.location.reload()`** (código do plugin, `vite-plugin-pwa/dist/client/build/register.js`) e chama nosso `onNeedRefresh`.
3. Nosso `onNeedRefresh` (`src/main.tsx`):
   - se a página já está `hidden` → `updateSW(true)` na hora;
   - se está visível → espera o **próximo `visibilitychange → hidden`** e então `updateSW(true)`.
4. `updateSW(true)` manda `SKIP_WAITING` → o SW novo ativa → `clients.claim()` → `controllerchange` na página → ouvinte `controlling` do passo 2 → **`window.location.reload()`**, com a página em segundo plano.

Ou seja: com versão pendente, **qualquer saída do app recarrega a página**. Não só "ir ao WhatsApp": abrir a câmera/galeria para anexar foto (o seletor de arquivo do Android/iOS deixa a página `hidden`), copiar o Pix e abrir o app do banco, compartilhar pelo WhatsApp, trocar de aba no computador.

**Também recarrega outras abas:** no computador, se duas abas estão abertas e a versão nova é ativada por uma delas, a outra recebe `controllerchange` e o ouvinte do plugin recarrega também.

### O que se perde numa recarga

Não existe rascunho salvo localmente nestas telas; tudo está em `useState`:

| Tela | O que se perde |
|---|---|
| Nova OS / editar OS (assistente em etapas, `ordem-servico-wizard`) | tudo que não foi salvo: cliente, aparelhos, checklist, avarias, fotos ainda não enviadas, serviços, valores |
| PDV | carrinho (`itensCarrinho`), cliente, desconto, formas de pagamento. Só a "entrada pendente" fica no localStorage |
| Diálogos de pagamento/recebimento (vendas, contas, OS) | valores digitados |
| Orçamentos, cadastro de produto/peça/cliente | o formulário aberto |
| Impressão | a tela de impressão fecha; o que já foi salvo não se perde |

### Um segundo problema do `workbox-window`

O `workbox-window` trata como "externa" toda atualização encontrada **mais de 60 s depois do carregamento** ou **depois da primeira**, e na primeira dessas remove o próprio ouvinte `updatefound`. Resultado: num app que fica aberto o dia todo, a **segunda** publicação do dia não é mais percebida por aquela página. Para o aviso funcionar com verificação periódica, o registro precisa ser feito direto com `navigator.serviceWorker` (API do navegador, sem o `workbox-window`).

### Mais de um registro de service worker?

- **VitePWA:** `/sw.js`, escopo `/` (o único que controla as páginas).
- **OneSignal:** escopo próprio `/push/onesignal/`. Não controla as páginas do app e não conflita.
- **`usePushNotifications`** (`getPushServiceWorkerRegistration`): chama `register("/sw.js", { scope: "/" })` **só se não houver** registro ativo. Mesmo arquivo e escopo: o navegador devolve o registro existente, sem conflito.

### `APP_BUILD_ID`

`src/lib/build.ts`, parado em `"2026-05-29-001"` desde `8efd22d`. É usado em dois lugares, **só para exibição**: o `console.log` do `main.tsx` e o rodapé "Build: …" da página Plano. Nada de cache, limpeza de dados ou migração local depende dele (`getBuildInfo` não tem uso). O comentário "cache bust" não procede: uma constante igual não muda hash nenhum. **Pode ser substituído por um valor gerado no build.**

### Arquivo antigo apagado (chunk)

Conferido em produção: `GET https://www.appmec.in/assets/jspdf-naoexiste123.js` devolve **200 `text/html`** (o rewrite `/(.*) → /index.html` do `vercel.json`). Uma página aberta antes da publicação que pede um arquivo **fora do precache** (`jspdf`, `html2canvas`, `LeitorCodigoBarras`, `idioma-*`...) recebe HTML no lugar do JS e o `import()` falha ("Failed to fetch dynamically imported module" / tipo MIME). O Vite avisa isso com o evento `vite:preloadError`, que hoje ninguém escuta.

Efeito colateral (registrado como risco, **não** corrigido aqui porque é regra de cache): o `NetworkFirst` de JS/CSS aceita status 200 e guarda esse HTML no `app-assets-cache` com o nome do arquivo JS.

## Correção proposta (mínima)

1. **Não recarregar sozinho.** Trocar o `registerSW` do plugin por um registro direto (`src/lib/pwa/atualizacaoApp.ts`), com `injectRegister: false` no `vite.config.ts` para o plugin não injetar outro registro. O SW (`src/sw.ts`), o precache, as rotas de cache e o push não mudam.
   - versão em `waiting` → só marca "há atualização";
   - `SKIP_WAITING` **só** quando o usuário toca em "Atualizar agora";
   - recarga **só** na página que pediu a atualização. Se a versão nova for ativada por outra aba, esta página não recarrega: mostra o mesmo aviso, e o botão apenas recarrega.
   - Na **próxima abertura do app do zero** (processo fechado), o navegador ativa a versão nova sozinho, porque não há página aberta: isso já é o comportamento padrão do service worker e não perde nada.
2. **Aviso** (componente `PWAUpdateBanner`, reaproveitado): "Nova versão disponível" com "Atualizar agora" e "Depois" (adia por 1 hora). Não aparece nas landings nem nas páginas públicas (catálogo, acompanhamento da OS); não sai na impressão.
   - **Celular:** faixa no fluxo da página, logo abaixo do cabeçalho (`AppLayout`). Empurra o conteúdo em vez de flutuar, então não cobre "+ Item", "Finalizar Venda" nem pagamento; diálogos e gavetas ficam por cima dela. (A primeira versão flutuava no canto e cobria o "+ Item" do PDV.) Telas do celular fora do `AppLayout` (login, onboarding) não mostram o aviso.
   - **Computador:** flutuante no canto inferior direito, ao lado do chat; some enquanto houver diálogo, gaveta ou menu aberto.
3. **Verificação periódica:** ao voltar ao app (como hoje) e a cada 1 hora com o app visível e on-line.
4. **Arquivo apagado:** ao `vite:preloadError`, o app procura a versão nova na hora (`registration.update()`); se ela existe, o aviso aparece. A falha em si continua igual (a tela mostra o erro de hoje); não há recarga automática.
5. **Versão:** gerada no build (`AAAA-MM-DD HH:mm · <commit curto>`, horário de Brasília; commit de `VERCEL_GIT_COMMIT_SHA` ou `git rev-parse`; sem git, `local`) e mostrada no rodapé de Configurações. O `APP_BUILD_ID` passa a ser esse valor (console e página Plano).

### Riscos da correção

- **Quem ignora o aviso fica na versão antiga** até fechar o app de verdade. É o preço de nunca recarregar sozinho; o aviso volta depois de 1 hora.
- **Transição:** quem está na versão de hoje recebe esta atualização pelo caminho antigo (recarga ao sair do app). Só a partir dela vale o comportamento novo.
- **"Atualizar agora" no meio de um formulário perde o que não foi salvo**, como qualquer recarga. O carrinho do PDV, por exemplo, não é diálogo; a decisão é do usuário.
- **Faixa do celular aparece e empurra o conteúdo** uns 80 px: se surgir no instante de um toque, o toque pode cair em outro ponto da tela. Não recarrega nada.
- **iOS instalado:** o Safari pode suspender a página em segundo plano e matar o processo; nesse caso a versão nova entra sozinha na próxima abertura (sem perda além da que o próprio iOS já causa).
- **Arquivo apagado continua possível** para quem não atualizar, nos arquivos fora do precache; o aviso passa a aparecer, mas a falha não é evitada.
- **Rodapé de versão** muda o hash do pacote principal a cada build (o valor muda sempre). Sem efeito para o usuário.

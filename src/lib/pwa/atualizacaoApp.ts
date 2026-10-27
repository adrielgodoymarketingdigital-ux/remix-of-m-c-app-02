// Registro do service worker (src/sw.ts) e estado de "há versão nova".
//
// Regra: a página NUNCA recarrega sozinha. A versão nova fica esperando
// (waiting) até o usuário tocar em "Atualizar agora" (PWAUpdateBanner) ou até a
// próxima abertura do app do zero, quando o navegador ativa a versão sozinho.
// Diagnóstico e motivos: docs/atualizacao-app-pwa.md.
//
// Feito direto com navigator.serviceWorker, sem o registerSW do plugin: ele
// recarrega a página no controllerchange (inclusive em outras abas), e o
// workbox-window deixa de perceber uma segunda versão no mesmo carregamento.

const URL_SW = "/sw.js";
const VERIFICAR_A_CADA_MS = 60 * 60 * 1000;
const ADIAR_POR_MS = 60 * 60 * 1000;
// Se o controllerchange não chegar (SW novo falhou ao ativar), recarrega assim mesmo.
const RESERVA_RECARGA_MS = 4000;

let registro: ServiceWorkerRegistration | null = null;
let pendente = false;
let adiadoAte = 0;
let aplicando = false;
const ouvintes = new Set<() => void>();

const avisar = () => ouvintes.forEach((f) => f());

function marcarPendente() {
  if (pendente) return;
  pendente = true;
  console.log("[PWA] Nova versão disponível");
  avisar();
}

/** Para useSyncExternalStore. */
export function assinarAtualizacao(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** Há versão nova e o usuário não pediu "Depois" na última hora. */
export function mostrarAvisoAtualizacao() {
  return pendente && Date.now() >= adiadoAte;
}

export function adiarAtualizacao() {
  adiadoAte = Date.now() + ADIAR_POR_MS;
  avisar();
  window.setTimeout(avisar, ADIAR_POR_MS);
}

/** "Atualizar agora": ativa a versão que está esperando e recarrega só esta página. */
export function aplicarAtualizacao() {
  aplicando = true;
  const esperando = registro?.waiting;
  if (!esperando) {
    // Já ativada (por outra aba) ou arquivo do app que sumiu: basta recarregar.
    window.location.reload();
    return;
  }
  esperando.postMessage({ type: "SKIP_WAITING" });
  window.setTimeout(() => window.location.reload(), RESERVA_RECARGA_MS);
}

function procurarVersaoNova() {
  if (!registro || document.visibilityState !== "visible" || !navigator.onLine) return;
  registro.update().catch(() => {});
}

async function registrar() {
  const sw = navigator.serviceWorker;
  const reg = await sw.register(URL_SW, { scope: "/" });
  registro = reg;

  // Só é atualização se já havia um SW controlando a página; na primeira
  // instalação o SW ativa direto, sem passar por waiting.
  const conferirEspera = () => {
    if (reg.waiting && sw.controller) marcarPendente();
  };
  conferirEspera();
  reg.addEventListener("updatefound", () => {
    const novo = reg.installing;
    novo?.addEventListener("statechange", () => {
      if (novo.state === "installed") conferirEspera();
    });
  });

  document.addEventListener("visibilitychange", procurarVersaoNova);
  window.setInterval(procurarVersaoNova, VERIFICAR_A_CADA_MS);
}

export function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const sw = navigator.serviceWorker;

  let controlada = Boolean(sw.controller);
  sw.addEventListener("controllerchange", () => {
    if (aplicando) {
      window.location.reload();
      return;
    }
    // Versão nova ativada por outra aba: esta continua com o código antigo e
    // não recarrega; o aviso aparece e o botão só recarrega. Na primeira
    // instalação (clients.claim sem SW anterior) não há nada a avisar.
    if (controlada) marcarPendente();
    controlada = true;
  });

  // Arquivo do app que não carregou (ex.: apagado por uma publicação nova):
  // procura a versão nova na hora, para o aviso aparecer se ela existir.
  window.addEventListener("vite:preloadError", procurarVersaoNova);

  const iniciar = () => {
    registrar().catch((e) => console.warn("[PWA] Falha ao registrar o service worker", e));
  };
  if (document.readyState === "complete") iniciar();
  else window.addEventListener("load", iniciar, { once: true });
}

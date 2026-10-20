import { useState, useEffect } from "react";
import OneSignal from "react-onesignal";

// Landings do funil: o SDK do OneSignal (push) só serve para quem está logado
// no app, então não é carregado nelas.
const ROTAS_LANDING = ["/", "/lp1", "/lp2", "/es"];
const ehLanding = (caminho: string) =>
  ROTAS_LANDING.includes(caminho.length > 1 ? caminho.replace(/\/+$/, "") : caminho);

let oneSignalIniciado = false;

/**
 * Inicia o SDK do OneSignal uma única vez (antes: em toda abertura, no main.tsx).
 * Todo uso do OneSignal chama isto antes, para o init ser sempre o primeiro da fila
 * (react-onesignal enfileira as chamadas até o SDK carregar).
 */
export function iniciarOneSignal() {
  if (oneSignalIniciado) return;
  oneSignalIniciado = true;
  OneSignal.init({
    appId: "99d55b78-2fbb-4594-bfff-a5bfa5bf8e8f",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
    serviceWorkerParam: { scope: "/push/onesignal/" },
  });
}

let usuarioPushPendente: string | null = null;

/** Pede permissão e identifica o usuário logado; numa landing espera ele sair dela. */
export function agendarPushDoUsuario(userId: string) {
  usuarioPushPendente = userId;
  liberarPushPendente(window.location.pathname);
}

/** Chamado a cada troca de rota: libera a identificação pendente fora das landings. */
export function liberarPushPendente(caminho: string) {
  if (!usuarioPushPendente || ehLanding(caminho)) return;
  const userId = usuarioPushPendente;
  usuarioPushPendente = null;
  inicializarOneSignal(userId).catch(console.error);
}

export function useNotificacoes() {
  const [notificacaoAtiva, setNotificacaoAtiva] = useState(false);

  useEffect(() => {
    iniciarOneSignal();
    OneSignal.Notifications.addEventListener("permissionChange", (granted: boolean) => {
      setNotificacaoAtiva(granted);
    });
    setNotificacaoAtiva(OneSignal.Notifications.permission);
  }, []);

  const solicitarPermissao = async () => {
    await OneSignal.Notifications.requestPermission();
    setNotificacaoAtiva(OneSignal.Notifications.permission);
  };

  const enviarNotificacao = async (titulo: string, mensagem: string) => {
    if (!notificacaoAtiva) return;
    await OneSignal.Notifications.push({
      headings: { en: titulo, pt: titulo },
      contents: { en: mensagem, pt: mensagem },
    });
  };

  return { solicitarPermissao, enviarNotificacao, notificacaoAtiva };
}

export async function inicializarOneSignal(userId: string): Promise<boolean> {
  iniciarOneSignal();
  if (!OneSignal.Notifications.permission) {
    await OneSignal.Notifications.requestPermission();
  }
  await OneSignal.login(userId);
  return OneSignal.Notifications.permission;
}

import { useState, useEffect } from "react";
import OneSignal from "react-onesignal";

export function useNotificacoes() {
  const [notificacaoAtiva, setNotificacaoAtiva] = useState(false);

  useEffect(() => {
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
  if (!OneSignal.Notifications.permission) {
    await OneSignal.Notifications.requestPermission();
  }
  await OneSignal.login(userId);
  return OneSignal.Notifications.permission;
}

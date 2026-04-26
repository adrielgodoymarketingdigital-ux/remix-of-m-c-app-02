// Biblioteca de sons de notificação pré-definidos.
// Os arquivos vivem em /public/sounds/ e são tocados pelo cliente
// quando o Service Worker recebe um push com `sound !== "default" | "silent"`.

export const NOTIFICATION_SOUNDS = [
  { value: "default", label: "🔔 Som padrão do sistema", file: null },
  { value: "silent", label: "🔕 Silenciosa (sem som nem vibração)", file: null },
  { value: "ding", label: "🛎️ Ding (sino curto)", file: "/sounds/ding.mp3" },
  { value: "success", label: "✅ Sucesso (acorde ascendente)", file: "/sounds/success.mp3" },
  { value: "coin", label: "🪙 Moeda (cash arcade)", file: "/sounds/coin.mp3" },
  { value: "cash", label: "💰 Caixa registradora (cha-ching)", file: "/sounds/cash.mp3" },
  { value: "bell", label: "🔔 Sininho (tilintar agudo)", file: "/sounds/bell.mp3" },
  { value: "chime", label: "🎵 Carrilhão (suave melódico)", file: "/sounds/chime.mp3" },
  { value: "hotmart", label: "🤑 Hotmart/Kiwify (dinheiro entrando)", file: "/sounds/hotmart.mp3" },
] as const;

export type NotificationSoundValue = (typeof NOTIFICATION_SOUNDS)[number]["value"];

export function getSoundFile(value: string): string | null {
  const opt = NOTIFICATION_SOUNDS.find((s) => s.value === value);
  return opt?.file ?? null;
}

let cachedAudio: Map<string, HTMLAudioElement> | null = null;

/**
 * Toca o som de notificação pelo seu identificador.
 * Retorna `true` se conseguiu disparar a reprodução.
 */
export async function playNotificationSound(value: string): Promise<boolean> {
  const file = getSoundFile(value);
  if (!file) return false;

  try {
    if (!cachedAudio) cachedAudio = new Map();
    let audio = cachedAudio.get(file);
    if (!audio) {
      audio = new Audio(file);
      audio.preload = "auto";
      cachedAudio.set(file, audio);
    }
    audio.currentTime = 0;
    audio.volume = 1;
    await audio.play();
    return true;
  } catch (err) {
    console.warn("[notification-sounds] Falha ao tocar som:", err);
    return false;
  }
}

/**
 * Registra listener global que escuta mensagens do Service Worker
 * para tocar sons de notificação quando o app está aberto/em background.
 */
export function registerNotificationSoundListener(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data;
    if (data?.type === "PLAY_NOTIFICATION_SOUND" && typeof data.sound === "string") {
      void playNotificationSound(data.sound);
    }
  });
}
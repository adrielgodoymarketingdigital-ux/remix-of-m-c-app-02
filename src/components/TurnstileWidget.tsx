import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const SITE_KEY = "0x4AAAAAAEuY-fQw6XyH-CVp";

let scriptPromise: Promise<void> | null = null;
function carregarScriptTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Falha ao carregar verificação de segurança."));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

/**
 * Widget de verificação anti-bot (Cloudflare Turnstile), usado nas telas de
 * cadastro e de checkout de assinatura — parte da mitigação ao ataque de
 * carding de 2026-09-09. A Site Key é pública de propósito; a Secret Key
 * fica só no painel do Supabase Auth (cadastro) e nas secrets das Edge
 * Functions (checkout) — nunca no client.
 */
export function TurnstileWidget({ onVerify, onExpire }: TurnstileWidgetProps) {
  const containerId = "turnstile-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    carregarScriptTurnstile().then(() => {
      if (cancelado || !window.turnstile) return;
      widgetId.current = window.turnstile.render(`#${containerId}`, {
        sitekey: SITE_KEY,
        theme: "auto",
        callback: onVerify,
        "expired-callback": () => onExpire?.(),
      });
    });
    return () => {
      cancelado = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id={containerId} />;
}

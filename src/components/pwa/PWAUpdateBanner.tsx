import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PWAUpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ((window as any).__pwaNeedRefresh) {
      setVisible(true);
    }

    const handler = () => setVisible(true);
    window.addEventListener("pwa-update-available", handler);
    return () => window.removeEventListener("pwa-update-available", handler);
  }, []);

  if (!visible) return null;

  const handleUpdate = () => {
    const doUpdate = (window as any).__pwaDoUpdate;
    if (typeof doUpdate === "function") doUpdate();
    else window.location.reload();
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-zinc-900 text-white text-sm px-4 py-3 rounded-lg shadow-xl border border-zinc-700 max-w-sm w-[calc(100%-2rem)]">
      <RefreshCw className="h-4 w-4 shrink-0 text-blue-400" />
      <span className="flex-1">Nova versão disponível</span>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 text-xs"
        onClick={handleUpdate}
      >
        Atualizar
      </Button>
      <button
        onClick={() => setVisible(false)}
        className="text-zinc-400 hover:text-white"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

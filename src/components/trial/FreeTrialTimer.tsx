import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Timer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFreeTrialExpirado } from "./DialogFreeTrialExpirado";

interface FreeTrialTimerProps {
  freeTrialEndsAt: string;
}

export function FreeTrialTimer({ freeTrialEndsAt }: FreeTrialTimerProps) {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogDismissed, setDialogDismissed] = useState(false);

  const calcTimeLeft = useCallback(() => {
    const diff = new Date(freeTrialEndsAt).getTime() - Date.now();
    if (diff <= 0) {
      setExpired(true);
      if (!dialogDismissed) setShowDialog(true);
      return { hours: 0, minutes: 0, seconds: 0 };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { hours, minutes, seconds };
  }, [freeTrialEndsAt, dialogDismissed]);

  useEffect(() => {
    setTimeLeft(calcTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calcTimeLeft());
    }, 1000);
    return () => clearInterval(interval);
  }, [calcTimeLeft]);

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (expired) {
    if (!showDialog) return null;
    return <DialogFreeTrialExpirado open={showDialog} onClose={() => { setShowDialog(false); setDialogDismissed(true); }} />;
  }

  return (
    <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white p-3 sm:p-4 rounded-xl mb-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-shrink-0">
            <Crown className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </span>
          </div>
          <p className="font-bold text-xs sm:text-base leading-snug min-w-0">
            ⭐ Teste todas as funcionalidades Premium por mais:
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 sm:ml-auto sm:justify-end sm:gap-3">
          <div className="flex items-center gap-0.5 sm:gap-1 font-mono text-sm sm:text-xl font-bold tracking-wider flex-shrink-0">
            <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1 opacity-80 flex-shrink-0" />
            <span className="bg-white/20 rounded px-1 py-0.5 sm:px-1.5">{pad(timeLeft.hours)}</span>
            <span className="animate-pulse">:</span>
            <span className="bg-white/20 rounded px-1 py-0.5 sm:px-1.5">{pad(timeLeft.minutes)}</span>
            <span className="animate-pulse">:</span>
            <span className="bg-white/20 rounded px-1 py-0.5 sm:px-1.5">{pad(timeLeft.seconds)}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/plano')}
            className="bg-white text-orange-600 hover:bg-white/90 whitespace-nowrap text-xs sm:text-sm h-7 sm:h-8 px-2.5 sm:px-3 flex-shrink-0 shadow-sm"
          >
            <Sparkles className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />
            Ver Planos
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Play } from "lucide-react";
import logoMec from "@/assets/logo-mec-auth.png";

export default function VideoBoasVindas() {
  const navigate = useNavigate();

  const handleContinuar = () => {
    navigate("/onboarding-inicial", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

      <Card className="relative w-full max-w-md p-6 sm:p-8 space-y-6 bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(59,130,246,0.3)]">
        <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/20 via-transparent to-violet-500/10 rounded-lg blur-sm -z-10" />

        {/* Header */}
        <div className="flex flex-col items-center space-y-3 text-center">
          <img src={logoMec} alt="Méc" className="h-16" />
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5 text-blue-400" />
            <h1 className="text-lg font-semibold text-white">Bem-vindo ao Méc! 🎉</h1>
          </div>
          <p className="text-sm text-slate-400 max-w-xs">
            Assista ao vídeo rápido abaixo para os próximos passos. É rápido.
          </p>
        </div>

        {/* Phone frame with video */}
        <div className="flex justify-center">
          <div className="relative w-[220px] sm:w-[240px]">
            {/* Phone bezel */}
            <div className="rounded-[2rem] border-[3px] border-slate-600 bg-black p-1.5 shadow-2xl shadow-blue-500/10">
              {/* Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-black rounded-b-xl z-10" />
              {/* Screen */}
              <div className="rounded-[1.6rem] overflow-hidden bg-black aspect-[9/19]">
                <video
                  src="/videos/boas-vindas.mp4"
                  controls
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            {/* Reflection effect */}
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Continue button */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleContinuar}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold shadow-lg shadow-blue-500/25 gap-2"
          >
            Continuar
            <ArrowRight className="h-4 w-4" />
          </Button>
          <button
            onClick={handleContinuar}
            className="text-xs text-slate-500 hover:text-slate-400 transition-colors text-center"
          >
            Pular vídeo
          </button>
        </div>
      </Card>
    </div>
  );
}

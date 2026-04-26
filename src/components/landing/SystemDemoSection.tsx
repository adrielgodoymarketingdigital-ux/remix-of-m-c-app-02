import { useState, useRef, useEffect } from "react";
import { Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SystemDemoSection() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [playing]);

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900">
            Veja como é nosso sistema{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              por dentro
            </span>
          </h2>
          <p className="mt-4 text-slate-600 text-lg max-w-2xl mx-auto">
            Uma visão completa de tudo que você terá acesso ao começar
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/10 border border-slate-200">
            {playing ? (
              <>
                <video
                  ref={videoRef}
                  src="/videos/demo-sistema.mp4"
                  autoPlay
                  controls
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 z-10">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            ) : (
              <button
                onClick={() => setPlaying(true)}
                className="group absolute inset-0 w-full h-full cursor-pointer bg-black"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-black to-slate-900" />
                <div className="absolute top-1/4 left-1/4 w-60 h-60 bg-cyan-500/15 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-60 h-60 bg-blue-500/15 rounded-full blur-3xl" />

                <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6">
                  <p className="text-cyan-400 text-xs md:text-sm font-bold uppercase tracking-[0.2em]">
                    Assista a demonstração
                  </p>
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.4)] group-hover:scale-110 transition-transform duration-300">
                    <Play className="h-7 w-7 md:h-9 md:w-9 text-white ml-1" fill="currentColor" />
                  </div>
                  <p className="text-white text-lg md:text-2xl font-extrabold text-center leading-tight max-w-md">
                    Tour completo pelo <span className="text-cyan-400">Sistema Méc</span>
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <Button
            onClick={() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' })}
            size="lg"
            className="h-12 md:h-14 px-8 text-base font-semibold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/25"
          >
            <Zap className="mr-2 h-4 w-4" />
            Começar Agora
          </Button>
        </div>
      </div>
    </section>
  );
}

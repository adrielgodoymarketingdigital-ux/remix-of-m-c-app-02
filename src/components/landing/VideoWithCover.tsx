import { useState, useRef, useEffect } from "react";
import { Play } from "lucide-react";

export function VideoWithCover() {
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
    <div className="w-full max-w-xs mx-auto lg:mx-0">
      <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden shadow-2xl shadow-blue-500/15 border border-slate-200">
        {playing ? (
          <>
            <video
              ref={videoRef}
              src="/videos/apresentacao.mp4"
              autoPlay
              controls
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Progress bar */}
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
            <div className="absolute top-1/4 left-1/4 w-40 h-40 bg-cyan-500/15 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-blue-500/15 rounded-full blur-3xl" />

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6">
              <p className="text-cyan-400 text-xs md:text-sm font-bold uppercase tracking-[0.2em]">
                Assista agora
              </p>
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.4)] group-hover:scale-110 transition-transform duration-300">
                <Play className="h-7 w-7 md:h-9 md:w-9 text-white ml-1" fill="currentColor" />
              </div>
              <p className="text-white text-lg md:text-2xl font-extrabold text-center leading-tight max-w-sm">
                Descubra como triplicar seu controle em <span className="text-cyan-400">5 minutos</span>
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
import { GraduationCap, Play } from "lucide-react";

/** Ilustração decorativa do hero de Tutoriais: balão + janela de vídeo + capelo. */
export function IlustracaoTutoriais({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none relative h-[190px] w-[300px] shrink-0 ${className}`}>
      <div className="absolute right-1 top-0 h-[185px] w-[260px] rotate-[17deg] rounded-[45%_55%_48%_52%] bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-500/10 dark:to-indigo-500/10" />
      <div className="absolute right-10 top-7 w-[220px] rotate-[5deg] rounded-2xl border-[8px] border-card bg-muted shadow-xl shadow-blue-900/10">
        <div className="flex gap-1.5 p-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-300 dark:bg-blue-400/50" />
          <span className="h-1.5 w-1.5 rounded-full bg-blue-300 dark:bg-blue-400/50" />
          <span className="h-1.5 w-1.5 rounded-full bg-blue-300 dark:bg-blue-400/50" />
        </div>
        <div className="mx-2 my-0.5 grid h-[78px] place-items-center rounded-md bg-gradient-to-br from-blue-200 to-indigo-300 dark:from-blue-500/30 dark:to-indigo-500/40">
          <Play className="h-8 w-8 fill-white/80 text-white/80" />
        </div>
        <div className="m-2 h-1.5 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-500/20">
          <div className="h-full w-[42%] bg-blue-600" />
        </div>
      </div>
      <GraduationCap className="absolute right-9 top-0 h-14 w-14 rotate-[8deg] text-blue-700 drop-shadow-md dark:text-blue-400" />
    </div>
  );
}

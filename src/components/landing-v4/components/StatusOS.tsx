import { useEffect, useState } from "react";

// Cartão flutuante que troca o status da OS (status reais do sistema), mostrando o caminho do aparelho.
const etapas = [
  { texto: "Aguardando aprovação", cor: "bg-amber-400" },
  { texto: "Em andamento", cor: "bg-brand-600" },
  { texto: "Finalizado", cor: "bg-emerald-500" },
  { texto: "Aguardando retirada", cor: "bg-orange-500" },
];

export function StatusOS({ compacta = false }: { compacta?: boolean }) {
  const [i, setI] = useState(1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % etapas.length), 2400);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1),0_8px_10px_-6px_rgb(0_0_0/0.1)] shadow-slate-900/10 ${compacta ? "w-44 p-2.5" : "w-56 p-3.5"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status da OS</p>
      {/* lista empilhada: só a etapa atual fica visível; troca com sobe + aparece (500 ms) */}
      <div className="relative mt-2 h-6" aria-live="polite">
        {etapas.map((e, n) => (
          <p
            key={e.texto}
            aria-hidden={n !== i}
            className={`absolute inset-0 flex items-center gap-2 whitespace-nowrap font-display font-semibold ${compacta ? "text-xs" : "text-sm"} text-slate-950 transition-[opacity,transform] duration-500 ${
              n === i ? "translate-y-0 opacity-100" : n < i ? "-translate-y-3 opacity-0" : "translate-y-3 opacity-0"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${e.cor}`} aria-hidden="true" />
            {e.texto}
          </p>
        ))}
      </div>
      <div className="mt-3 flex gap-1" aria-hidden="true">
        {etapas.map((e, n) => (
          <span key={e.texto} className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
            <span
              className={`block h-full w-full origin-left rounded-full bg-brand-600 transition-transform duration-500 ${n <= i ? "scale-x-100" : "scale-x-0"}`}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

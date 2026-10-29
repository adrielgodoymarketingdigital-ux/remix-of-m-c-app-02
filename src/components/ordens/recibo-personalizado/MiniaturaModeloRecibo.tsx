import type { ModeloReciboA4 } from "@/lib/ordemServico/modeloReciboOS";

/**
 * Miniatura simples (só CSS, sem imagem) de cada modelo do recibo A4 nos
 * cartões da tela "Layout da OS". É um desenho esquemático, não uma prévia.
 */
export function MiniaturaModeloRecibo({ modelo }: { modelo: ModeloReciboA4 }) {
  if (modelo === "personalizado") {
    return (
      <div aria-hidden="true" className="flex h-28 flex-col gap-1 overflow-hidden rounded border border-border bg-white p-1.5">
        <div className="flex h-5 items-center gap-1 rounded-sm px-1" style={{ background: "linear-gradient(135deg,#0a1a3f,#0f2a6b)" }}>
          <div className="h-3 w-4 rounded-[2px] border border-white/40" />
          <div className="h-1.5 w-10 rounded-sm bg-white/90" />
          <div className="ml-auto h-1 w-6 rounded-sm bg-white/50" />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <CartaoMini />
          <CartaoMini />
        </div>
        <div className="grid grid-cols-[7fr_3fr] gap-1">
          <CartaoMini />
          <div className="overflow-hidden rounded-sm border border-slate-200">
            <div className="h-1.5" style={{ background: "#e9f8ef" }} />
            <div className="mx-auto mt-1 h-1.5 w-5 rounded-sm" style={{ background: "#16a34a" }} />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_2fr] gap-1">
          <CartaoMini />
          <div className="overflow-hidden rounded-sm border border-slate-200">
            <div className="h-1.5" style={{ background: "#eef4ff" }} />
            <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 p-0.5">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-0.5">
                  <div className="h-0.5 flex-1 rounded-sm bg-slate-300" />
                  <div className="h-1 w-1 rounded-full" style={{ background: "#16a34a" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="flex h-28 flex-col gap-1 overflow-hidden rounded border border-border bg-white p-1.5">
      <div className="flex h-5 items-center gap-1 border-b-2 border-black px-0.5">
        <div className="h-3 w-3 rounded-[2px] bg-slate-300" />
        <div className="h-1.5 w-10 rounded-sm bg-black" />
      </div>
      <div className="grid grid-cols-2 gap-1">
        <BlocoMini />
        <BlocoMini />
      </div>
      <div className="grid grid-cols-[7fr_3fr] gap-1">
        <BlocoMini />
        <BlocoMini />
      </div>
      <div className="grid grid-cols-3 gap-1">
        <BlocoMini />
        <BlocoMini />
        <BlocoMini />
      </div>
    </div>
  );
}

function CartaoMini() {
  return (
    <div className="overflow-hidden rounded-sm border border-slate-200">
      <div className="h-1.5" style={{ background: "#eef4ff" }} />
      <div className="space-y-0.5 p-0.5">
        <div className="h-0.5 w-4/5 rounded-sm bg-slate-300" />
        <div className="h-0.5 w-3/5 rounded-sm bg-slate-300" />
      </div>
    </div>
  );
}

function BlocoMini() {
  return (
    <div className="space-y-0.5 border border-black border-l-2 p-0.5">
      <div className="h-0.5 w-3/5 rounded-sm bg-black" />
      <div className="h-0.5 w-4/5 rounded-sm bg-slate-300" />
      <div className="h-0.5 w-2/3 rounded-sm bg-slate-300" />
    </div>
  );
}

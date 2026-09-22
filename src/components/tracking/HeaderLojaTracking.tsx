import { Wrench } from "lucide-react";
import { TrackingPageConfig } from "@/types/configuracao-loja";

interface HeaderLojaTrackingProps {
  nomeLoja: string | null;
  logoUrl: string | null;
  telefone: string | null;
  tc: TrackingPageConfig;
}

/** Cabeçalho da loja (logo + nome + telefone) nas páginas públicas de
 * acompanhamento — mostrado uma vez por página, num card próprio acima do(s)
 * card(s) de status de OS (CardStatusOS), tanto no link de uma OS quanto no
 * link de um cliente (que lista várias). */
export function HeaderLojaTracking({ nomeLoja, logoUrl, telefone, tc }: HeaderLojaTrackingProps) {
  if (!tc.mostrar_logo) return null;
  const prim = tc.cor_primaria;

  return (
    <div
      className="w-full max-w-md mb-4 rounded-3xl border overflow-hidden"
      style={{ background: tc.cor_card, borderColor: `${prim}25`, boxShadow: `0 0 80px ${prim}18, 0 25px 60px rgba(0,0,0,0.5)` }}
    >
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${prim}, ${prim}55)` }} />
      <div className="flex items-center gap-4 p-6">
      {logoUrl ? (
        <div className="h-14 w-14 rounded-2xl overflow-hidden shrink-0 border flex items-center justify-center"
          style={{ background: `${prim}10`, borderColor: `${prim}30` }}>
          <img
            src={logoUrl}
            alt={nomeLoja ?? ""}
            className="h-full w-full object-contain p-1.5"
          />
        </div>
      ) : (
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 border"
          style={{ background: `${prim}15`, borderColor: `${prim}35` }}>
          <Wrench className="h-6 w-6" style={{ color: prim }} />
        </div>
      )}
      <div className="min-w-0">
        <p className="font-bold text-base leading-tight truncate" style={{ color: tc.cor_texto }}>
          {nomeLoja || "Assistência Técnica"}
        </p>
        {telefone && (
          <p className="text-sm mt-0.5" style={{ color: tc.cor_texto_secundario }}>
            {telefone}
          </p>
        )}
      </div>
      </div>
    </div>
  );
}

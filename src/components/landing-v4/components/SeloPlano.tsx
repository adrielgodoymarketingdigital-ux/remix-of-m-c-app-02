// Selo que mostra em qual plano a função está liberada.
// Fonte: src/types/plano.ts e as rotas do MecApp (ComVerificacaoPlano). Não inventar planos.
export type NivelPlano = "basico" | "intermediario" | "profissional" | "ultra";

const selos: Record<NivelPlano, { texto: string; cor: string }> = {
  basico: { texto: "Desde o Básico", cor: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  intermediario: { texto: "A partir do Intermediário", cor: "border-brand-300 bg-brand-50 text-brand-700" },
  profissional: { texto: "A partir do Profissional", cor: "border-violet-300 bg-violet-50 text-violet-800" },
  ultra: { texto: "No plano Ultra", cor: "border-amber-300 bg-amber-50 text-amber-900" },
};

// Cores para fundo escuro (versão 3)
const escuros: Record<NivelPlano, string> = {
  basico: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  intermediario: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  profissional: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  ultra: "border-amber-300/40 bg-amber-300/10 text-amber-200",
};

export function SeloPlano({ nivel, className = "", escuro = false }: { nivel: NivelPlano; className?: string; escuro?: boolean }) {
  const s = { ...selos[nivel], cor: escuro ? escuros[nivel] : selos[nivel].cor };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cor} ${className}`}>
      {s.texto}
    </span>
  );
}

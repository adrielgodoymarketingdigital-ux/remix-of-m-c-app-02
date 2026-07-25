import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssinatura } from "@/hooks/useAssinatura";

export const NOMES_PLANO: Record<string, string> = {
  free: "Free",
  trial: "Trial",
  demonstracao: "Demonstração",
  basico_mensal: "Básico Mensal",
  basico_anual: "Básico Anual",
  intermediario_mensal: "Intermediário Mensal",
  intermediario_anual: "Intermediário Anual",
  profissional_mensal: "Profissional Mensal",
  profissional_anual: "Profissional Anual",
  profissional_ultra_mensal: "Profissional Ultra Mensal",
  profissional_ultra_anual: "Profissional Ultra Anual",
  admin: "Admin",
};

export const getInfoPlanoCompacto = (assinatura: { plano_tipo: string; data_fim?: string | null } | null | undefined) => {
  if (!assinatura) return null;
  const nome = NOMES_PLANO[assinatura.plano_tipo] || assinatura.plano_tipo;
  const dataFim = assinatura.data_fim;
  if (!dataFim || ["free", "admin"].includes(assinatura.plano_tipo)) {
    return { nome, diasRestantes: null as number | null };
  }
  const diffMs = new Date(dataFim).getTime() - Date.now();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return { nome, diasRestantes };
};

/**
 * Indicador compacto e puramente informativo (nome do plano + dias até
 * expirar). Não duplica a lógica de urgência do BannerVencimentoPlano
 * (que continua ativo globalmente no AppLayout) — aqui é só um resumo
 * neutro com atalho para /plano.
 */
export const StatusPlanoCompacto = () => {
  const { assinatura } = useAssinatura();
  const navigate = useNavigate();

  const info = useMemo(() => getInfoPlanoCompacto(assinatura as any), [assinatura]);

  if (!info) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 shadow-sm shrink-0">
      <Crown className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-xs font-medium whitespace-nowrap">
        {info.nome}
        {info.diasRestantes !== null && (
          <span className="text-muted-foreground">
            {" "}· {info.diasRestantes > 0 ? `${info.diasRestantes}d restantes` : "expirado"}
          </span>
        )}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-xs"
        onClick={() => navigate("/plano")}
      >
        Ver plano
      </Button>
    </div>
  );
};

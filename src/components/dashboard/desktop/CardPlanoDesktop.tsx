import { format } from "date-fns";
import { ArrowRight, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getInfoPlanoCompacto } from "@/components/dashboard/StatusPlanoCompacto";
import { useFormatadores } from "@/hooks/useFormatadores";

// Ponta esquerda mais escura que a do design (#009fe8): branco sobre ela não passava de 2,95:1.
const GRADIENTE_ATIVO = "linear-gradient(115deg, #0369a1, #1655df 65%, #6320ed)";

interface CardPlanoDesktopProps {
  assinatura: { plano_tipo: string; status?: string | null; data_fim?: string | null };
  planoVencido: boolean;
}

export function CardPlanoDesktop({ assinatura, planoVencido }: CardPlanoDesktopProps) {
  const { t } = useTranslation("dashboard");
  const { localeDateFns } = useFormatadores();
  const navigate = useNavigate();

  const info = getInfoPlanoCompacto(assinatura);
  // Vencido, em carência ou com cobrança falhando: o aviso fica só no quadro de limites
  // ou no BannerVencimentoPlano, ambos com a própria ação de renovar.
  const semPlanoAtivo = planoVencido
    || assinatura.status === "past_due"
    || assinatura.status === "unpaid"
    || (info?.diasRestantes ?? 1) <= 0;
  if (semPlanoAtivo) return null;

  const nome = t(`plano.nomes.${assinatura.plano_tipo}`, { defaultValue: info?.nome ?? assinatura.plano_tipo });
  // Free e admin não têm validade (getInfoPlanoCompacto devolve diasRestantes nulo).
  const validade = info?.diasRestantes !== null && assinatura.data_fim
    ? format(new Date(assinatura.data_fim), t("plano.formatoValidade"), { locale: localeDateFns })
    : null;

  return (
    <section
      className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl px-7 py-4 text-white shadow-lg shadow-blue-900/10 min-[1100px]:flex-nowrap"
      style={{ background: GRADIENTE_ATIVO }}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
        <Crown className="h-7 w-7" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-white/90">{t("plano.ativoRotulo")}</p>
        <p className="text-[22px] font-bold leading-tight">{nome}</p>
      </div>
      {validade && (
        <div className="border-l border-white/40 pl-6">
          <p className="text-sm text-white/90">{t("plano.validoAte")}</p>
          <p className="text-sm font-bold">{validade}</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => navigate("/plano")}
        className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition-colors hover:bg-white/90 min-[1100px]:ml-auto"
      >
        {t("plano.verAtual")}
        <ArrowRight className="h-4 w-4" />
      </button>
    </section>
  );
}

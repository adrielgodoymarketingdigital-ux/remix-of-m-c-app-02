import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Crown, Smartphone, Wrench, Package, RefreshCw } from "lucide-react";
import { useAssinatura } from "@/hooks/useAssinatura";
import { textoRenovarPlano } from "@/lib/planoVencido";
import { formatarRenovacao } from "@/lib/assinatura/limiteDispositivosPeriodo";
import { supabase } from "@/integrations/supabase/client";

interface ContagemItem {
  label: string;
  usados: number;
  limite: number;
  icon: React.ReactNode;
}

export function CardLimitesFree() {
  const { assinatura, limites, carregando, periodoDispositivos, obterContagemDispositivos, planoVencido, planoAnterior } = useAssinatura();
  // Com limite por período (marca na assinatura): dispositivos contados só no período atual.
  // No grátis a contagem vem sempre do hook, que soma os aparelhos apagados pelo
  // Começar do zero (mesma regra de total do limite real; sem apagados, mesmo número).
  const [usadosNoPeriodo, setUsadosNoPeriodo] = useState<number | null>(null);
  const contaPeloHook = !!periodoDispositivos || assinatura?.plano_tipo === "free";
  useEffect(() => {
    if (!contaPeloHook) { setUsadosNoPeriodo(null); return; }
    obterContagemDispositivos().then((c) => setUsadosNoPeriodo(c.usados));
  }, [contaPeloHook, obterContagemDispositivos]);
  const navigate = useNavigate();
  const [contagens, setContagens] = useState<ContagemItem[] | null>(null);
  const contagensCarregadas = useRef(false);

  const isFree = assinatura?.plano_tipo === "free";
  const freeTrialEndsAt = (assinatura as any)?.free_trial_ends_at;
  const freeTrialAtivo = freeTrialEndsAt && new Date(freeTrialEndsAt) > new Date();

  // Buscar contagens imediatamente ao montar (sem esperar assinatura)
  useEffect(() => {
    if (contagensCarregadas.current) return;

    const carregarContagens = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const userId = session.user.id;

        const [dispResult, osResult, prodResult] = await Promise.all([
          supabase.from("dispositivos").select("*", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("ordens_servico").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
          supabase.from("produtos").select("*", { count: "exact", head: true }).eq("user_id", userId),
        ]);

        contagensCarregadas.current = true;
        setContagens([
          { label: "Dispositivos", usados: dispResult.count || 0, limite: 0, icon: <Smartphone className="h-4 w-4 text-blue-400" /> },
          { label: "Ordens de Serviço", usados: osResult.count || 0, limite: 0, icon: <Wrench className="h-4 w-4 text-amber-400" /> },
          { label: "Produtos/Peças", usados: prodResult.count || 0, limite: 0, icon: <Package className="h-4 w-4 text-emerald-400" /> },
        ]);
      } catch (err) {
        console.error("Erro ao carregar contagens:", err);
      }
    };

    carregarContagens();
  }, []);

  // Atualizar limites quando assinatura carregar
  const contagensComLimites = contagens && !carregando && isFree
    ? [
        {
          ...contagens[0],
          usados: usadosNoPeriodo ?? contagens[0].usados,
          label: periodoDispositivos ? `Dispositivos (renova em ${formatarRenovacao(periodoDispositivos)})` : contagens[0].label,
          limite: limites.dispositivos,
        },
        { ...contagens[1], limite: limites.ordens_servico_mes },
        { ...contagens[2], limite: limites.produtos_mes },
      ]
    : null;

  if (!isFree || carregando || !contagensComLimites || freeTrialAtivo) return null;

  return (
    <div className="mx-4 sm:mx-6 mt-4 rounded-xl border border-blue-500/20 bg-gradient-to-br from-slate-900/80 to-slate-800/50 p-4 backdrop-blur-sm">
      {planoVencido ? (
        // Já foi pagante: plano venceu (limites continuam os do gratuito)
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-semibold text-slate-100">Seu plano venceu</span>
          </div>
          <p className="mt-1 text-xs text-slate-300">{textoRenovarPlano(planoAnterior)}</p>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Limites enquanto o plano estiver vencido</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-3">
          <Crown className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-slate-200">Seus limites do Plano Gratuito</span>
        </div>
      )}

      <div className="space-y-3">
        {contagensComLimites.map((item) => {
          const percentual = item.limite > 0 ? Math.min((item.usados / item.limite) * 100, 100) : 0;
          const critico = percentual >= 80;

          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-300">
                  {item.icon}
                  {item.label}
                </span>
                <span className={`font-medium ${critico ? "text-red-400" : "text-slate-400"}`}>
                  {item.usados} de {item.limite}
                </span>
              </div>
              <Progress
                value={percentual}
                className={`h-2 ${critico ? "[&>div]:bg-red-500" : "[&>div]:bg-blue-500"}`}
              />
            </div>
          );
        })}
      </div>

      <Button
        onClick={() => navigate("/plano")}
        className="w-full mt-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-semibold shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/40"
        size="sm"
      >
        {planoVencido ? (
          <>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Renovar agora
          </>
        ) : (
          <>
            <Crown className="h-4 w-4 mr-1.5" />
            Desbloqueie todo o potencial do Méc!
          </>
        )}
      </Button>
    </div>
  );
}

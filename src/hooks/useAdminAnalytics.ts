import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserAnalytics {
  user_id: string;
  nome: string;
  email: string;
  created_at: string;
  last_login_at: string | null;
  login_count: number;
  plano_tipo: string;
  status_assinatura: string;
  total_os: number;
  total_dispositivos: number;
  total_clientes: number;
  total_vendas: number;
  total_produtos: number;
  total_servicos: number;
  valor_total_vendas: number;
  data_proxima_cobranca: string | null;
}

export interface UsuarioVencimento {
  user_id: string;
  nome: string;
  email: string;
  data_proxima_cobranca: string;
  dias_restantes: number;
}

export function useAdminAnalytics() {
  const {
    data: usersAnalytics,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const { data: usersData, error: usersError } = await supabase.functions.invoke("admin-list-users");
      if (usersError) throw usersError;
      if (!usersData?.usuarios) return [];

      const profiles = usersData.usuarios;

      const analyticsPromises = profiles.map(async (profile: any) => {
        const [osResult, dispositivosResult, clientesResult, vendasResult, produtosResult, servicosResult] = await Promise.all([
          supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id).is("deleted_at", null),
          supabase.from("dispositivos").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
          supabase.from("clientes").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
          supabase.from("vendas").select("id, total", { count: "exact" }).eq("user_id", profile.user_id).eq("cancelada", false),
          supabase.from("produtos").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
          supabase.from("servicos").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
        ]);

        const valorTotalVendas = vendasResult.data?.reduce((acc, v) => acc + (Number(v.total) || 0), 0) || 0;

        return {
          user_id: profile.user_id,
          nome: profile.nome || "Sem nome",
          email: profile.email || "Sem email",
          created_at: profile.created_at,
          last_login_at: profile.last_login_at,
          login_count: profile.login_count || 0,
          plano_tipo: profile.plano_tipo || "sem_plano",
          status_assinatura: profile.status || "inactive",
          total_os: osResult.count || 0,
          total_dispositivos: dispositivosResult.count || 0,
          total_clientes: clientesResult.count || 0,
          total_vendas: vendasResult.count || 0,
          total_produtos: produtosResult.count || 0,
          total_servicos: servicosResult.count || 0,
          valor_total_vendas: valorTotalVendas,
          data_proxima_cobranca: profile.data_proxima_cobranca || null,
        } as UserAnalytics;
      });

      return await Promise.all(analyticsPromises);
    },
  });

  const metricsOverview = usersAnalytics
    ? {
        totalUsuarios: usersAnalytics.length,
        totalOS: usersAnalytics.reduce((acc, u) => acc + u.total_os, 0),
        totalDispositivos: usersAnalytics.reduce((acc, u) => acc + u.total_dispositivos, 0),
        totalClientes: usersAnalytics.reduce((acc, u) => acc + u.total_clientes, 0),
        totalVendas: usersAnalytics.reduce((acc, u) => acc + u.total_vendas, 0),
        valorTotalVendas: usersAnalytics.reduce((acc, u) => acc + u.valor_total_vendas, 0),
        usuariosAtivos: usersAnalytics.filter((u) => u.status_assinatura === "active" || u.status_assinatura === "trialing").length,
        usuariosPagantes: usersAnalytics.filter((u) =>
          u.status_assinatura === "active" &&
          u.plano_tipo !== "trial" &&
          u.plano_tipo !== "demonstracao" &&
          u.plano_tipo !== "admin" &&
          u.plano_tipo !== "free"
        ).length,
      }
    : null;

  // Calcular vencimentos por faixa
  const agora = new Date();
  
  const calcularVencimentos = (dias: number): UsuarioVencimento[] => {
    if (!usersAnalytics) return [];
    return usersAnalytics
      .filter((u) => {
        if (!u.data_proxima_cobranca) return false;
        if (u.status_assinatura !== "active") return false;
        const dataVenc = new Date(u.data_proxima_cobranca);
        const diffMs = dataVenc.getTime() - agora.getTime();
        const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return diffDias > 0 && diffDias <= dias;
      })
      .map((u) => {
        const dataVenc = new Date(u.data_proxima_cobranca!);
        const diffDias = Math.ceil((dataVenc.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
        return {
          user_id: u.user_id,
          nome: u.nome,
          email: u.email,
          data_proxima_cobranca: u.data_proxima_cobranca!,
          dias_restantes: diffDias,
        };
      })
      .sort((a, b) => a.dias_restantes - b.dias_restantes);
  };

  const vencendo10dias = calcularVencimentos(10);
  const vencendo5dias = calcularVencimentos(5);
  const vencendo1dia = calcularVencimentos(1);

  return {
    usersAnalytics: usersAnalytics || [],
    metricsOverview,
    vencendo10dias,
    vencendo5dias,
    vencendo1dia,
    isLoading,
    error,
    refetch,
  };
}

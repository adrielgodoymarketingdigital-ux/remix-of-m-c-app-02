import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verificar autenticação do proprietário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Token inválido");

    // Buscar filiais do proprietário
    const { data: empresas, error: empresasError } = await supabase
      .from("empresas")
      .select("id, nome, cidade, estado, cnpj, telefone, endereco, ativa, created_at, proprietario_id")
      .eq("proprietario_id", user.id)
      .eq("ativa", true)
      .order("created_at", { ascending: true });

    if (empresasError) throw new Error("Erro ao buscar filiais: " + empresasError.message);
    if (!empresas || empresas.length === 0) {
      return new Response(JSON.stringify({ empresas: [], matrizMetricas: { faturamento_mes: 0, os_mes: 0, vendas_mes: 0 } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const empresaIds = empresas.map((e: any) => e.id);
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    // Buscar gerentes sem restrição de RLS (service role)
    const { data: gerentes } = await supabase
      .from("empresa_usuarios")
      .select("empresa_id, gerente_id, permissoes, ativa, id, proprietario_id, created_at")
      .in("empresa_id", empresaIds)
      .eq("ativa", true);

    // Buscar metas
    const { data: todasMetas } = await supabase
      .from("empresa_metas")
      .select("*")
      .in("empresa_id", empresaIds);

    // Calcular métricas de cada filial pelo gerente_id
    const empresasComMetricas = await Promise.all(
      empresas.map(async (empresa: any) => {
        const gerentesFilial = (gerentes || []).filter((g: any) => g.empresa_id === empresa.id);
        const gerenteId = gerentesFilial[0]?.gerente_id ?? null;

        let faturamento = 0;
        let osCount = 0;
        let vendasCount = 0;

        if (gerenteId) {
          const [vendasRes, osRes] = await Promise.all([
            supabase
              .from("vendas")
              .select("total")
              .eq("user_id", gerenteId)
              .eq("cancelada", false)
              .gte("data", inicioMes.toISOString()),
            supabase
              .from("ordens_servico")
              .select("valor_total")
              .eq("user_id", gerenteId)
              .gte("created_at", inicioMes.toISOString()),
          ]);

          faturamento = [
            ...(vendasRes.data || []).map((v: any) => v.total || 0),
            ...(osRes.data || []).map((o: any) => o.valor_total || 0),
          ].reduce((sum: number, v: number) => sum + v, 0);

          osCount = osRes.data?.length || 0;
          vendasCount = vendasRes.data?.length || 0;
        }

        return {
          ...empresa,
          gerentes: gerentesFilial,
          metas: (todasMetas || []).filter((m: any) => m.empresa_id === empresa.id),
          metricas: {
            faturamento_mes: faturamento,
            os_mes: osCount,
            vendas_mes: vendasCount,
            clientes_ativos: 0,
          },
        };
      })
    );

    // Métricas da matriz (proprietário)
    const [vendasMatriz, osMatriz] = await Promise.all([
      supabase
        .from("vendas")
        .select("total")
        .eq("user_id", user.id)
        .eq("cancelada", false)
        .gte("data", inicioMes.toISOString()),
      supabase
        .from("ordens_servico")
        .select("valor_total")
        .eq("user_id", user.id)
        .gte("created_at", inicioMes.toISOString()),
    ]);

    const faturamentoMatriz = [
      ...(vendasMatriz.data || []).map((v: any) => v.total || 0),
      ...(osMatriz.data || []).map((o: any) => o.valor_total || 0),
    ].reduce((sum: number, v: number) => sum + v, 0);

    return new Response(
      JSON.stringify({
        empresas: empresasComMetricas,
        matrizMetricas: {
          faturamento_mes: faturamentoMatriz,
          os_mes: osMatriz.data?.length || 0,
          vendas_mes: vendasMatriz.data?.length || 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

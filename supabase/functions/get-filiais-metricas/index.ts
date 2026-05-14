import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIPOS_LABEL: Record<string, string> = {
  produto: "Produto",
  peca: "Peça",
  servico: "Serviço",
  dispositivo: "Dispositivo",
  servico_avulso: "Serviço Avulso",
};

function calcularVendaLiquida(v: any): number {
  return (Number(v.total) || 0) - (Number(v.valor_desconto_manual) || 0) - (Number(v.valor_desconto_cupom) || 0);
}

async function buscarMetricasEmpresa(supabase: any, userId: string, empresaId: string, inicioMes: Date, isMatriz: boolean) {
  // Para a matriz: inclui registros com empresa_id = empresaId OU empresa_id = null (dados legados sem empresa vinculada)
  const buildVendasQuery = (select: string) => {
    const base = supabase.from("vendas").select(select).eq("user_id", userId).eq("cancelada", false);
    if (isMatriz) return base.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
    return base.eq("empresa_id", empresaId);
  };

  const buildOsQuery = (select: string) => {
    const base = supabase.from("ordens_servico").select(select).eq("user_id", userId);
    if (isMatriz) return base.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
    return base.eq("empresa_id", empresaId);
  };

  const [vendasRes, osRes, ultimasVendasRes] = await Promise.all([
    buildVendasQuery("total, valor_desconto_manual, valor_desconto_cupom, tipo")
      .gte("data", inicioMes.toISOString()),
    buildOsQuery("valor_total, status")
      .gte("created_at", inicioMes.toISOString()),
    buildVendasQuery("id, data, tipo, total, valor_desconto_manual, valor_desconto_cupom, forma_pagamento, quantidade, cliente_id, produto_id, peca_id")
      .order("data", { ascending: false })
      .limit(5),
  ]);

  // Status que indicam OS finalizada
  const STATUS_FINAIS = ["finalizado", "entregue", "concluido", "pago", "concluída", "entregue ao cliente"];
  const osData = osRes.data || [];
  const isStatusFinal = (status: string) =>
    STATUS_FINAIS.some(f => (status || "").toLowerCase().includes(f));

  const faturamentoVendas = (vendasRes.data || []).reduce((sum: number, v: any) => sum + calcularVendaLiquida(v), 0);
  const faturamentoOS = osData
    .filter((o: any) => isStatusFinal(o.status))
    .reduce((sum: number, o: any) => sum + (Number(o.valor_total) || 0), 0);
  const faturamento = faturamentoVendas + faturamentoOS;

  const porTipo: Record<string, { tipo: string; label: string; total: number; quantidade: number }> = {};
  for (const v of vendasRes.data || []) {
    const tipo = v.tipo || "outros";
    if (!porTipo[tipo]) porTipo[tipo] = { tipo, label: TIPOS_LABEL[tipo] || tipo, total: 0, quantidade: 0 };
    porTipo[tipo].total += calcularVendaLiquida(v);
    porTipo[tipo].quantidade += 1;
  }

  const ultimas = ultimasVendasRes.data || [];
  const clienteIds = [...new Set(ultimas.map((v: any) => v.cliente_id).filter(Boolean))];
  const produtoIds = [...new Set(ultimas.map((v: any) => v.produto_id).filter(Boolean))];
  const pecaIds = [...new Set(ultimas.map((v: any) => v.peca_id).filter(Boolean))];

  const [clientesRes, produtosRes, pecasRes] = await Promise.all([
    clienteIds.length ? supabase.from("clientes").select("id, nome").in("id", clienteIds) : { data: [] },
    produtoIds.length ? supabase.from("produtos").select("id, nome").in("id", produtoIds) : { data: [] },
    pecaIds.length ? supabase.from("pecas").select("id, nome").in("id", pecaIds) : { data: [] },
  ]);

  const clienteMap = Object.fromEntries((clientesRes.data || []).map((c: any) => [c.id, c.nome]));
  const produtoMap = Object.fromEntries((produtosRes.data || []).map((p: any) => [p.id, p.nome]));
  const pecaMap = Object.fromEntries((pecasRes.data || []).map((p: any) => [p.id, p.nome]));

  const ultimasVendas = ultimas.map((v: any) => ({
    id: v.id,
    data: v.data,
    tipo: v.tipo,
    label: TIPOS_LABEL[v.tipo] || v.tipo,
    nome: produtoMap[v.produto_id] || pecaMap[v.peca_id] || (v.tipo === "servico_avulso" ? "Serviço Avulso" : "Item"),
    cliente: clienteMap[v.cliente_id] || null,
    valor: calcularVendaLiquida(v),
    forma_pagamento: v.forma_pagamento,
    quantidade: v.quantidade,
  }));

  return {
    faturamento_mes: faturamento,
    faturamento_os: faturamentoOS,
    faturamento_vendas: faturamentoVendas,
    os_mes: osData.length,
    os_em_aberto: osData.filter((o: any) => !isStatusFinal(o.status)).length,
    os_finalizadas: osData.filter((o: any) => isStatusFinal(o.status)).length,
    vendas_mes: vendasRes.data?.length || 0,
    ultimas_vendas: ultimasVendas,
    vendas_por_tipo: Object.values(porTipo),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Token inválido");

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    // Busca todas as empresas do proprietário (matriz + filiais)
    const { data: empresas, error: empresasError } = await supabase
      .from("empresas")
      .select("id, nome, cidade, estado, cnpj, telefone, endereco, ativa, tipo, created_at, proprietario_id")
      .eq("proprietario_id", user.id)
      .eq("ativa", true)
      .order("created_at", { ascending: true });

    if (empresasError) throw new Error("Erro ao buscar empresas: " + empresasError.message);

    // Se o usuário não tem empresa cadastrada, cria a matriz automaticamente
    if (!empresas || empresas.length === 0) {
      const { data: perfil } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", user.id)
        .maybeSingle();

      const nomeMatriz = perfil?.nome || user.email?.split("@")[0] || "Minha Empresa";

      const { data: novaMatriz, error: erroMatriz } = await supabase
        .from("empresas")
        .insert({ nome: nomeMatriz, proprietario_id: user.id, tipo: "matriz", ativa: true })
        .select()
        .single();

      if (erroMatriz || !novaMatriz) throw new Error("Erro ao criar empresa matriz: " + erroMatriz?.message);

      // Vincula registros existentes sem empresa_id à nova matriz
      await Promise.all([
        supabase.from("ordens_servico").update({ empresa_id: novaMatriz.id }).eq("user_id", user.id).is("empresa_id", null),
        supabase.from("vendas").update({ empresa_id: novaMatriz.id }).eq("user_id", user.id).is("empresa_id", null),
      ]);

      const metricas = await buscarMetricasEmpresa(supabase, user.id, novaMatriz.id, inicioMes, true);
      const empresaCompleta = { ...novaMatriz, gerentes: [], metas: [], metricas: { ...metricas, clientes_ativos: 0 } };

      return new Response(
        JSON.stringify({ empresas: [], matrizMetricas: metricas, todasEmpresas: [empresaCompleta] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Garante que exista exatamente uma empresa com tipo 'matriz'
    const temMatriz = empresas.some((e: any) => e.tipo === "matriz");
    if (!temMatriz) {
      await supabase.from("empresas").update({ tipo: "matriz" }).eq("id", empresas[0].id);
      empresas[0].tipo = "matriz";
    }

    // Vincula registros sem empresa_id à empresa matriz
    const matrizExistente = empresas.find((e: any) => e.tipo === "matriz") || empresas[0];
    await Promise.all([
      supabase.from("ordens_servico").update({ empresa_id: matrizExistente.id }).eq("user_id", user.id).is("empresa_id", null),
      supabase.from("vendas").update({ empresa_id: matrizExistente.id }).eq("user_id", user.id).is("empresa_id", null),
    ]);

    const empresaIds = empresas.map((e: any) => e.id);

    const { data: todasMetas } = await supabase
      .from("empresa_metas")
      .select("*")
      .in("empresa_id", empresaIds);

    // Busca métricas de cada empresa pelo empresa_id (correto)
    const empresasComMetricas = await Promise.all(
      empresas.map(async (empresa: any) => {
        const metricas = await buscarMetricasEmpresa(supabase, user.id, empresa.id, inicioMes, empresa.tipo === "matriz");
        return {
          ...empresa,
          gerentes: [],
          metas: (todasMetas || []).filter((m: any) => m.empresa_id === empresa.id),
          metricas: { ...metricas, clientes_ativos: 0 },
        };
      })
    );

    // Matriz = empresa com tipo 'matriz'
    const matriz = empresasComMetricas.find((e: any) => e.tipo === "matriz");
    const filiais = empresasComMetricas.filter((e: any) => e.tipo !== "matriz");

    return new Response(
      JSON.stringify({
        empresas: filiais,
        matrizMetricas: matriz?.metricas ?? { faturamento_mes: 0, os_mes: 0, vendas_mes: 0, ultimas_vendas: [], vendas_por_tipo: [] },
        todasEmpresas: empresasComMetricas,
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

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

async function buscarDadosUsuario(supabase: any, userId: string, inicioMes: Date) {
  const [vendasRes, osRes, ultimasVendasRes] = await Promise.all([
    supabase
      .from("vendas")
      .select("total, valor_desconto_manual, valor_desconto_cupom, tipo")
      .eq("user_id", userId)
      .eq("cancelada", false)
      .gte("data", inicioMes.toISOString()),
    supabase
      .from("ordens_servico")
      .select("valor_total")
      .eq("user_id", userId)
      .gte("created_at", inicioMes.toISOString()),
    supabase
      .from("vendas")
      .select("id, data, tipo, total, valor_desconto_manual, valor_desconto_cupom, forma_pagamento, quantidade, cliente_id, produto_id, peca_id")
      .eq("user_id", userId)
      .eq("cancelada", false)
      .order("data", { ascending: false })
      .limit(5),
  ]);

  const faturamento = [
    ...(vendasRes.data || []).map((v: any) => calcularVendaLiquida(v)),
    ...(osRes.data || []).map((o: any) => Number(o.valor_total) || 0),
  ].reduce((sum: number, v: number) => sum + v, 0);

  const porTipo: Record<string, { tipo: string; label: string; total: number; quantidade: number }> = {};
  for (const v of vendasRes.data || []) {
    const tipo = v.tipo || "outros";
    if (!porTipo[tipo]) porTipo[tipo] = { tipo, label: TIPOS_LABEL[tipo] || tipo, total: 0, quantidade: 0 };
    porTipo[tipo].total += calcularVendaLiquida(v);
    porTipo[tipo].quantidade += 1;
  }

  // Busca nomes de clientes/produtos/pecas das ultimas vendas
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
    os_mes: osRes.data?.length || 0,
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

    const { data: empresas, error: empresasError } = await supabase
      .from("empresas")
      .select("id, nome, cidade, estado, cnpj, telefone, endereco, ativa, created_at, proprietario_id")
      .eq("proprietario_id", user.id)
      .eq("ativa", true)
      .order("created_at", { ascending: true });

    if (empresasError) throw new Error("Erro ao buscar filiais: " + empresasError.message);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    if (!empresas || empresas.length === 0) {
      const matrizDados = await buscarDadosUsuario(supabase, user.id, inicioMes);
      return new Response(JSON.stringify({ empresas: [], matrizMetricas: matrizDados, _uid: user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const empresaIds = empresas.map((e: any) => e.id);

    const { data: gerentes } = await supabase
      .from("empresa_usuarios")
      .select("empresa_id, gerente_id, permissoes, ativa, id, proprietario_id, created_at")
      .in("empresa_id", empresaIds)
      .eq("ativa", true);

    const { data: todasMetas } = await supabase
      .from("empresa_metas")
      .select("*")
      .in("empresa_id", empresaIds);

    const empresasComMetricas = await Promise.all(
      empresas.map(async (empresa: any) => {
        const gerentesFilial = (gerentes || []).filter((g: any) => g.empresa_id === empresa.id);
        const gerenteId = gerentesFilial[0]?.gerente_id ?? null;

        // Tenta pelo gerente primeiro; se vazio, usa o proprietário da empresa
        let metricas = { faturamento_mes: 0, os_mes: 0, vendas_mes: 0, ultimas_vendas: [] as any[], vendas_por_tipo: [] as any[] };
        if (gerenteId) {
          metricas = await buscarDadosUsuario(supabase, gerenteId, inicioMes);
        }
        if (metricas.vendas_mes === 0 && metricas.os_mes === 0) {
          metricas = await buscarDadosUsuario(supabase, empresa.proprietario_id, inicioMes);
        }

        return {
          ...empresa,
          gerentes: gerentesFilial,
          metas: (todasMetas || []).filter((m: any) => m.empresa_id === empresa.id),
          metricas: { ...metricas, clientes_ativos: 0 },
        };
      })
    );

    // Métricas da matriz: dados do dono MENOS o que já foi contabilizado nas filiais
    const matrizMetricas = await buscarDadosUsuario(supabase, user.id, inicioMes);

    return new Response(
      JSON.stringify({ empresas: empresasComMetricas, matrizMetricas }),
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

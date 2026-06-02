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

const FORMA_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "Pix", cartao_credito: "Crédito",
  cartao_debito: "Débito", a_receber: "A receber", a_prazo: "A prazo",
};

function calcularVendaLiquida(v: any): number {
  return (Number(v.total) || 0) - (Number(v.valor_desconto_manual) || 0) - (Number(v.valor_desconto_cupom) || 0);
}

const STATUS_FINAIS = ["finalizado", "entregue"];
const isStatusFinal = (status: string) =>
  STATUS_FINAIS.includes((status || "").toLowerCase());
const isItemOS = (v: any) =>
  v.peca_id != null ||
  v.tipo === "servico" ||
  (typeof v.observacoes === "string" && (
    v.observacoes.includes("utilizado na OS") ||
    v.observacoes === "pagamento_duplo_secundario"
  ));

async function buscarMetricasEmpresa(
  supabase: any,
  userId: string,
  empresaId: string,
  dataInicio: Date,
  dataFim: Date,
  isMatriz: boolean,
) {
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
    buildVendasQuery("total, valor_desconto_manual, valor_desconto_cupom, tipo, peca_id, observacoes, forma_pagamento, produto_id, quantidade")
      .gte("data", dataInicio.toISOString())
      .lte("data", dataFim.toISOString()),
    buildOsQuery("total, status")
      .gte("created_at", dataInicio.toISOString())
      .lte("created_at", dataFim.toISOString())
      .is("deleted_at", null),
    buildVendasQuery("id, data, tipo, total, valor_desconto_manual, valor_desconto_cupom, forma_pagamento, quantidade, cliente_id, produto_id, peca_id, observacoes")
      .order("data", { ascending: false })
      .limit(5),
  ]);

  const osData = osRes.data || [];
  const vendasFaturamento = (vendasRes.data || []).filter((v: any) => !isItemOS(v));
  const faturamentoVendas = vendasFaturamento.reduce((sum: number, v: any) => sum + calcularVendaLiquida(v), 0);
  const faturamentoOS = osData
    .filter((o: any) => isStatusFinal(o.status))
    .reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
  const faturamento = faturamentoVendas + faturamentoOS;



  // Por tipo
  const porTipo: Record<string, { tipo: string; label: string; total: number; quantidade: number }> = {};
  for (const v of vendasFaturamento) {
    const tipo = v.tipo || "outros";
    if (!porTipo[tipo]) porTipo[tipo] = { tipo, label: TIPOS_LABEL[tipo] || tipo, total: 0, quantidade: 0 };
    porTipo[tipo].total += calcularVendaLiquida(v);
    porTipo[tipo].quantidade += 1;
  }

  // Por forma de pagamento
  const porForma: Record<string, { forma: string; label: string; total: number; quantidade: number }> = {};
  for (const v of vendasFaturamento) {
    const forma = v.forma_pagamento || "outros";
    if (!porForma[forma]) porForma[forma] = { forma, label: FORMA_LABEL[forma] || forma, total: 0, quantidade: 0 };
    porForma[forma].total += calcularVendaLiquida(v);
    porForma[forma].quantidade += 1;
  }

  // Top produtos/peças
  const topMap: Record<string, { id: string; tipo: string; total: number; quantidade: number }> = {};
  for (const v of vendasFaturamento) {
    const key = v.produto_id || v.peca_id;
    if (!key) continue;
    if (!topMap[key]) topMap[key] = { id: key, tipo: v.tipo, total: 0, quantidade: 0 };
    topMap[key].total += calcularVendaLiquida(v);
    topMap[key].quantidade += v.quantidade || 1;
  }

  // Resolver nomes dos top produtos
  const topIds = Object.keys(topMap);
  let topItens: { id: string; nome: string; tipo: string; label: string; total: number; quantidade: number }[] = [];
  if (topIds.length > 0) {
    const produtoIds = topIds.filter(id => topMap[id].tipo === "produto" || topMap[id].tipo === "dispositivo");
    const pecaIds = topIds.filter(id => topMap[id].tipo === "peca" || topMap[id].tipo === "servico_avulso");
    const [prodRes, pecRes] = await Promise.all([
      produtoIds.length ? supabase.from("produtos").select("id, nome").in("id", produtoIds) : { data: [] },
      pecaIds.length ? supabase.from("pecas").select("id, nome").in("id", pecaIds) : { data: [] },
    ]);
    const nomeMap: Record<string, string> = {};
    for (const p of (prodRes.data || [])) nomeMap[p.id] = p.nome;
    for (const p of (pecRes.data || [])) nomeMap[p.id] = p.nome;
    topItens = Object.entries(topMap)
      .map(([id, item]) => ({
        id,
        nome: nomeMap[id] || "Item",
        tipo: item.tipo,
        label: TIPOS_LABEL[item.tipo] || item.tipo,
        total: item.total,
        quantidade: item.quantidade,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }

  // Últimas vendas
  const ultimas = ultimasVendasRes.data || [];
  const clienteIds = [...new Set(ultimas.map((v: any) => v.cliente_id).filter(Boolean))];
  const produtoIds2 = [...new Set(ultimas.map((v: any) => v.produto_id).filter(Boolean))];
  const pecaIds2 = [...new Set(ultimas.map((v: any) => v.peca_id).filter(Boolean))];
  const [clientesRes, produtosRes, pecasRes] = await Promise.all([
    clienteIds.length ? supabase.from("clientes").select("id, nome").in("id", clienteIds) : { data: [] },
    produtoIds2.length ? supabase.from("produtos").select("id, nome").in("id", produtoIds2) : { data: [] },
    pecaIds2.length ? supabase.from("pecas").select("id, nome").in("id", pecaIds2) : { data: [] },
  ]);
  const clienteMap = Object.fromEntries((clientesRes.data || []).map((c: any) => [c.id, c.nome]));
  const produtoMap = Object.fromEntries((produtosRes.data || []).map((p: any) => [p.id, p.nome]));
  const pecaMap = Object.fromEntries((pecasRes.data || []).map((p: any) => [p.id, p.nome]));
  const ultimasVendas = ultimas.map((v: any) => ({
    id: v.id, data: v.data, tipo: v.tipo,
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
    vendas_mes: vendasFaturamento.length,
    ultimas_vendas: ultimasVendas,
    vendas_por_tipo: Object.values(porTipo),
    vendas_por_forma: Object.values(porForma).sort((a, b) => b.total - a.total),
    top_produtos: topItens,
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

    // Parsear filtro de data do body (POST) ou usar mês atual como padrão
    let dataInicio: Date;
    let dataFim: Date;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.data_inicio && body.data_fim) {
          dataInicio = new Date(body.data_inicio);
          dataFim = new Date(body.data_fim);
          dataFim.setHours(23, 59, 59, 999);
        } else {
          dataInicio = new Date();
          dataInicio.setDate(1);
          dataInicio.setHours(0, 0, 0, 0);
          dataFim = new Date();
          dataFim.setHours(23, 59, 59, 999);
        }
      } catch {
        dataInicio = new Date();
        dataInicio.setDate(1);
        dataInicio.setHours(0, 0, 0, 0);
        dataFim = new Date();
        dataFim.setHours(23, 59, 59, 999);
      }
    } else {
      dataInicio = new Date();
      dataInicio.setDate(1);
      dataInicio.setHours(0, 0, 0, 0);
      dataFim = new Date();
      dataFim.setHours(23, 59, 59, 999);
    }

    const { data: empresas, error: empresasError } = await supabase
      .from("empresas")
      .select("id, nome, cidade, estado, cnpj, telefone, endereco, ativa, tipo, created_at, proprietario_id")
      .eq("proprietario_id", user.id)
      .eq("ativa", true)
      .order("created_at", { ascending: true });

    if (empresasError) throw new Error("Erro ao buscar empresas: " + empresasError.message);

    if (!empresas || empresas.length === 0) {
      const { data: perfil } = await supabase
        .from("profiles").select("nome").eq("user_id", user.id).maybeSingle();
      const nomeMatriz = perfil?.nome || user.email?.split("@")[0] || "Minha Empresa";
      const { data: novaMatriz, error: erroMatriz } = await supabase
        .from("empresas")
        .insert({ nome: nomeMatriz, proprietario_id: user.id, tipo: "matriz", ativa: true })
        .select().single();
      if (erroMatriz || !novaMatriz) throw new Error("Erro ao criar empresa matriz: " + erroMatriz?.message);
      await Promise.all([
        supabase.from("ordens_servico").update({ empresa_id: novaMatriz.id }).eq("user_id", user.id).is("empresa_id", null),
        supabase.from("vendas").update({ empresa_id: novaMatriz.id }).eq("user_id", user.id).is("empresa_id", null),
      ]);
      const metricas = await buscarMetricasEmpresa(supabase, user.id, novaMatriz.id, dataInicio, dataFim, true);
      const empresaCompleta = { ...novaMatriz, gerentes: [], metas: [], metricas };
      return new Response(
        JSON.stringify({ empresas: [], matrizMetricas: metricas, todasEmpresas: [empresaCompleta] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const temMatriz = empresas.some((e: any) => e.tipo === "matriz");
    if (!temMatriz) {
      await supabase.from("empresas").update({ tipo: "matriz" }).eq("id", empresas[0].id);
      empresas[0].tipo = "matriz";
    }

    const matrizExistente = empresas.find((e: any) => e.tipo === "matriz") || empresas[0];
    await Promise.all([
      supabase.from("ordens_servico").update({ empresa_id: matrizExistente.id }).eq("user_id", user.id).is("empresa_id", null),
      supabase.from("vendas").update({ empresa_id: matrizExistente.id }).eq("user_id", user.id).is("empresa_id", null),
    ]);

    const empresaIds = empresas.map((e: any) => e.id);
    const { data: todasMetas } = await supabase.from("empresa_metas").select("*").in("empresa_id", empresaIds);

    const empresasComMetricas = await Promise.all(
      empresas.map(async (empresa: any) => {
        const metricas = await buscarMetricasEmpresa(supabase, user.id, empresa.id, dataInicio, dataFim, empresa.tipo === "matriz");
        return {
          ...empresa,
          gerentes: [],
          metas: (todasMetas || []).filter((m: any) => m.empresa_id === empresa.id),
          metricas,
        };
      })
    );

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

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { filtrarRegistrosDaLoja, filtroLeituraLoja, type LojaLeitura } from "./lojas.ts";
import {
  calcularMetricasLegado,
  calcularMetricasLoja,
  janelaBrasilia,
  janelaConsulta,
  janelaLegado,
  STATUS_OS_FATURAVEL_METRICAS,
  type DadosLoja,
  type JanelaBrasilia,
  type JanelaLegado,
  type OSMetrica,
  type ServicoAvulsoMetrica,
  type VendaAvulsaMetrica,
  type VendaMetrica,
} from "./calculoMetricas.ts";

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

/** Valor exibido na lista "últimas vendas" (como antes). */
function calcularVendaLiquida(v: { total?: unknown; valor_desconto_manual?: unknown; valor_desconto_cupom?: unknown }): number {
  return (Number(v.total) || 0) - (Number(v.valor_desconto_manual) || 0) - (Number(v.valor_desconto_cupom) || 0);
}

const TAMANHO_PAGINA = 1000;

/**
 * Lê TODAS as linhas de uma consulta, de 1000 em 1000 (o PostgREST corta em
 * 1000 sem avisar). `montar` precisa devolver uma consulta nova a cada chamada.
 * Erro de leitura LANÇA: melhor a tela avisar do que mostrar número errado.
 */
async function buscarTodas<T>(montar: () => any, rotulo: string): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await montar().order("id", { ascending: true }).range(de, de + TAMANHO_PAGINA - 1);
    if (error) throw new Error(`Erro ao ler ${rotulo}: ${error.message}`);
    const pagina = (data ?? []) as T[];
    linhas.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return linhas;
  }
}

const SELECT_VENDAS =
  "id, empresa_id, tipo, peca_id, produto_id, cliente_id, data, data_recebimento, forma_pagamento, recebido, cancelada, " +
  "parcela_numero, total_parcelas, total, valor_desconto_manual, valor_desconto_cupom, custo_unitario, quantidade, " +
  "grupo_venda, segunda_forma_pagamento, valor_segunda_forma, observacoes, deleted_at";
// Só o pedaço de avarias que a regra usa (avarias pode ter fotos e assinaturas).
const SELECT_OS =
  "id, empresa_id, numero_os, total, status, is_teste, created_at, data_saida, deleted_at, forma_pagamento, " +
  "dados_pagamento:avarias->dados_pagamento";

async function buscarMetricasEmpresa(
  supabase: any,
  userId: string,
  loja: LojaLeitura,
  janela: JanelaBrasilia,
  antiga: JanelaLegado,
) {
  // Regra de loja da F1: matriz = matriz + sem loja; filial = só a filial.
  const filtro = filtroLeituraLoja(loja);
  const filtroSemLoja = `empresa_id.eq.${filtro.empresaId},empresa_id.is.null`;
  const daLoja = (q: any) => (filtro.incluirSemLoja ? q.or(filtroSemLoja) : q.eq("empresa_id", filtro.empresaId));
  // Uma leitura só atende a conta nova (Brasília, competência) e a antiga (campo legado).
  const consulta = janelaConsulta(janela, antiga);

  const [vendas, osCriadas, osEntregues, servicosAvulsos, vendasAvulsas, ultimasRes] = await Promise.all([
    buscarTodas<VendaMetrica>(
      () =>
        daLoja(supabase.from("vendas").select(SELECT_VENDAS).eq("user_id", userId).eq("cancelada", false)).or(
          // Valores entre aspas: o ISO tem "." e ":" dentro do filtro or() do PostgREST.
          `and(data.gte."${consulta.dataDeISO}",data.lte."${consulta.dataAteISO}"),` +
            `and(data_recebimento.not.is.null,data_recebimento.gte."${consulta.recebimentoDe}",data_recebimento.lte."${consulta.recebimentoAte}T23:59:59")`,
        ),
      "vendas",
    ),
    buscarTodas<OSComPagamento>(
      () =>
        daLoja(supabase.from("ordens_servico").select(SELECT_OS).eq("user_id", userId).is("deleted_at", null))
          .gte("created_at", consulta.criacaoDeISO)
          .lte("created_at", consulta.criacaoAteISO),
      "ordens de serviço",
    ),
    buscarTodas<OSComPagamento>(
      () =>
        daLoja(supabase.from("ordens_servico").select(SELECT_OS).eq("user_id", userId).is("deleted_at", null))
          .in("status", [...STATUS_OS_FATURAVEL_METRICAS])
          .not("data_saida", "is", null)
          .gte("data_saida", janela.inicioISO)
          .lte("data_saida", janela.fimISO),
      "ordens de serviço entregues",
    ),
    buscarTodas<ServicoAvulsoMetrica>(
      () =>
        daLoja(supabase.from("servicos_avulsos").select("id, empresa_id, preco, status, created_at").eq("user_id", userId))
          .in("status", [...STATUS_OS_FATURAVEL_METRICAS])
          .gte("created_at", janela.inicioISO)
          .lte("created_at", janela.fimISO),
      "serviços avulsos",
    ),
    // Vendas avulsas não têm loja: só a matriz lê (sem loja = matriz).
    filtro.incluirSemLoja
      ? buscarTodas<VendaAvulsaMetrica>(
          () =>
            supabase.from("vendas_avulsas").select("id, valor, created_at, deleted_at").eq("user_id", userId)
              .is("deleted_at", null)
              .gte("created_at", janela.inicioISO)
              .lte("created_at", janela.fimISO),
          "vendas avulsas",
        )
      : Promise.resolve([] as VendaAvulsaMetrica[]),
    daLoja(
      supabase.from("vendas")
        .select("id, empresa_id, data, tipo, total, valor_desconto_manual, valor_desconto_cupom, forma_pagamento, quantidade, cliente_id, produto_id, peca_id, observacoes")
        .eq("user_id", userId)
        .eq("cancelada", false)
        .is("deleted_at", null),
    )
      .order("data", { ascending: false })
      .limit(5),
  ]);

  // OS: as criadas no período (contagem, conta antiga) + as entregues no período (faturamento), sem repetir.
  const osPorId = new Map<string, OSMetrica>();
  for (const o of [...osCriadas, ...osEntregues]) {
    const { dados_pagamento, ...resto } = o;
    osPorId.set(o.id, { ...resto, avarias: dados_pagamento ? { dados_pagamento } : null });
  }
  const os = [...osPorId.values()];

  // Status da conta a receber de cada OS faturável (mesmo filtro de loja do Dashboard).
  const numeros = [...new Set(os.map((o) => o.numero_os).filter((n): n is string => !!n))];
  const statusContaPorOS: Record<string, string | null> = {};
  for (let i = 0; i < numeros.length; i += 200) {
    const lote = numeros.slice(i, i + 200);
    const contas = await buscarTodas<{ os_numero: string | null; status: string | null }>(
      () =>
        daLoja(supabase.from("contas").select("id, os_numero, status").eq("user_id", userId).eq("tipo", "receber"))
          .in("os_numero", lote),
      "contas das OS",
    );
    for (const c of contas) if (c.os_numero) statusContaPorOS[c.os_numero] = c.status;
  }

  const dados: DadosLoja = { vendas, os, statusContaPorOS, servicosAvulsos, vendasAvulsas };
  const m = calcularMetricasLoja(dados, janela, loja);
  const legado = calcularMetricasLegado({ vendas, os }, antiga, loja);

  // Nomes do top produtos/peças.
  const produtoIds = m.top_ids.filter((t) => t.tipo === "produto" || t.tipo === "dispositivo").map((t) => t.id);
  const pecaIds = m.top_ids.filter((t) => t.tipo === "peca" || t.tipo === "servico_avulso").map((t) => t.id);
  const [prodRes, pecRes] = await Promise.all([
    produtoIds.length ? supabase.from("produtos").select("id, nome").in("id", produtoIds) : { data: [] },
    pecaIds.length ? supabase.from("pecas").select("id, nome").in("id", pecaIds) : { data: [] },
  ]);
  const nomeMap: Record<string, string> = {};
  for (const p of (prodRes.data || [])) nomeMap[p.id] = p.nome;
  for (const p of (pecRes.data || [])) nomeMap[p.id] = p.nome;
  const topItens = m.top_ids.map((t) => ({
    id: t.id,
    nome: nomeMap[t.id] || "Item",
    tipo: t.tipo,
    label: TIPOS_LABEL[t.tipo] || t.tipo,
    total: t.total,
    quantidade: t.quantidade,
  }));

  // Últimas vendas (lista de exibição; agora sem as apagadas).
  const ultimas = filtrarRegistrosDaLoja((ultimasRes.data || []) as Array<VendaMetrica & { cliente_id: string | null }>, loja);
  const clienteIds = [...new Set(ultimas.map((v) => v.cliente_id).filter(Boolean))];
  const produtoIds2 = [...new Set(ultimas.map((v) => v.produto_id).filter(Boolean))];
  const pecaIds2 = [...new Set(ultimas.map((v) => v.peca_id).filter(Boolean))];
  const [clientesRes, produtosRes, pecasRes] = await Promise.all([
    clienteIds.length ? supabase.from("clientes").select("id, nome").in("id", clienteIds) : { data: [] },
    produtoIds2.length ? supabase.from("produtos").select("id, nome").in("id", produtoIds2) : { data: [] },
    pecaIds2.length ? supabase.from("pecas").select("id, nome").in("id", pecaIds2) : { data: [] },
  ]);
  const clienteMap: Record<string, string> = Object.fromEntries((clientesRes.data || []).map((c: { id: string; nome: string }) => [c.id, c.nome]));
  const produtoMap: Record<string, string> = Object.fromEntries((produtosRes.data || []).map((p: { id: string; nome: string }) => [p.id, p.nome]));
  const pecaMap: Record<string, string> = Object.fromEntries((pecasRes.data || []).map((p: { id: string; nome: string }) => [p.id, p.nome]));
  const ultimasVendas = ultimas.map((v) => ({
    id: v.id, data: v.data, tipo: v.tipo,
    label: TIPOS_LABEL[v.tipo] || v.tipo,
    nome: (v.produto_id && produtoMap[v.produto_id]) || (v.peca_id && pecaMap[v.peca_id]) || (v.tipo === "servico_avulso" ? "Serviço Avulso" : "Item"),
    cliente: (v.cliente_id && clienteMap[v.cliente_id]) || null,
    valor: calcularVendaLiquida(v),
    forma_pagamento: v.forma_pagamento,
    quantidade: v.quantidade,
  }));

  return {
    faturamento_mes: m.faturamento_mes,
    faturamento_os: m.faturamento_os,
    faturamento_vendas: m.faturamento_vendas,
    faturamento_avulsos: m.faturamento_avulsos,
    os_mes: m.os_mes,
    os_em_aberto: m.os_em_aberto,
    os_finalizadas: m.os_finalizadas,
    os_faturadas: m.os_faturadas,
    vendas_mes: m.vendas_mes,
    ultimas_vendas: ultimasVendas,
    vendas_por_tipo: m.vendas_por_tipo,
    vendas_por_forma: m.vendas_por_forma,
    top_produtos: topItens,
    // Conta ANTIGA, só para comparação por um período. A tela não mostra.
    legado,
  };
}

type OSComPagamento = Omit<OSMetrica, "avarias"> & {
  dados_pagamento: NonNullable<NonNullable<OSMetrica["avarias"]>["dados_pagamento"]> | null;
};

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

    // Período: a tela manda "AAAA-MM-DD" (dias de Brasília). Sem datas: mês atual até hoje.
    let dataInicioCorpo: string | null = null;
    let dataFimCorpo: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.data_inicio && body?.data_fim) {
          dataInicioCorpo = String(body.data_inicio);
          dataFimCorpo = String(body.data_fim);
        }
      } catch { /* corpo vazio: mês atual */ }
    }
    const janela = janelaBrasilia(dataInicioCorpo, dataFimCorpo);
    const antiga = janelaLegado(dataInicioCorpo, dataFimCorpo);

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
      // Vendas e OS sem empresa_id NÃO são regravadas: contam na matriz só na leitura.
      const metricas = await buscarMetricasEmpresa(supabase, user.id, { id: novaMatriz.id, tipo: "matriz" }, janela, antiga);
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

    // Vendas e OS sem empresa_id NÃO são regravadas: contam na matriz só na leitura.
    // Só UMA loja é lida como matriz (a mesma que a tela mostra como Matriz), para
    // que um registro sem loja nunca conte duas vezes.
    const matrizExistente = empresas.find((e: any) => e.tipo === "matriz") || empresas[0];

    const empresaIds = empresas.map((e: any) => e.id);
    const { data: todasMetas } = await supabase.from("empresa_metas").select("*").in("empresa_id", empresaIds);

    const empresasComMetricas = await Promise.all(
      empresas.map(async (empresa: any) => {
        const loja: LojaLeitura = { id: empresa.id, tipo: empresa.id === matrizExistente.id ? "matriz" : "filial" };
        const metricas = await buscarMetricasEmpresa(supabase, user.id, loja, janela, antiga);
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
        periodo: { inicio: janela.inicioDia, fim: janela.fimDia },
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

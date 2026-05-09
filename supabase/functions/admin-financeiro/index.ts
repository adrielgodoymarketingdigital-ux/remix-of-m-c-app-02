import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ADMIN-FINANCEIRO] ${step}${d}`);
};

const MES_NOMES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// Meses excluídos do cálculo de crescimento/projeção por serem dados de migração
const MESES_MIGRAÇÃO = ["2026-04"];

function buildSnapshots(
  todasAss: Array<{ user_id: string; data_inicio: string | null; data_fim: string | null; cancelado_em: string | null }>,
  todosProf: Array<{ user_id: string; created_at: string | null }>,
  agora: Date,
  historicoMeses: number
) {
  const primeirasPorUser = new Map<string, Date>();
  for (const a of todasAss) {
    if (!a.data_inicio) continue;
    const di = new Date(a.data_inicio);
    const atual = primeirasPorUser.get(a.user_id);
    if (!atual || di < atual) primeirasPorUser.set(a.user_id, di);
  }

  const snapshots = [];
  for (let i = historicoMeses - 1; i >= 0; i--) {
    const refDate = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const inicioMes = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const fimMes = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59, 999);
    const mesStr = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}`;
    const mesLabel = `${MES_NOMES_PT[refDate.getMonth()]}/${String(refDate.getFullYear()).slice(2)}`;

    const cadastros_acumulados = todosProf.filter((p) => p.created_at && new Date(p.created_at) <= fimMes).length;
    const novos_cadastros = todosProf.filter((p) => {
      if (!p.created_at) return false;
      const d = new Date(p.created_at);
      return d >= inicioMes && d <= fimMes;
    }).length;

    const pagantes_ativos = todasAss.filter((a) => {
      if (!a.data_inicio) return false;
      if (new Date(a.data_inicio) > fimMes) return false;
      if (a.cancelado_em && new Date(a.cancelado_em) <= inicioMes) return false;
      if (a.data_fim && new Date(a.data_fim) < inicioMes) return false;
      return true;
    }).length;

    const novos_pagantes = Array.from(primeirasPorUser.values()).filter((di) => di >= inicioMes && di <= fimMes).length;
    const isMigracao = MESES_MIGRAÇÃO.includes(mesStr);

    snapshots.push({
      mes: mesLabel, data: mesStr,
      cadastros_acumulados, novos_cadastros,
      pagantes_ativos, novos_pagantes,
      crescimento_cadastros_pct: null as number | null,
      crescimento_pagantes_pct: null as number | null,
      migracao: isMigracao,
    });
  }

  for (let i = 1; i < snapshots.length; i++) {
    // Não calcular crescimento partindo de um mês de migração (o anterior)
    if (snapshots[i - 1].migracao || snapshots[i].migracao) {
      snapshots[i].crescimento_cadastros_pct = null;
      snapshots[i].crescimento_pagantes_pct = null;
      continue;
    }
    const ac = snapshots[i - 1].cadastros_acumulados;
    snapshots[i].crescimento_cadastros_pct = ac > 0
      ? ((snapshots[i].cadastros_acumulados - ac) / ac) * 100
      : snapshots[i].cadastros_acumulados > 0 ? 100 : 0;

    const ap = snapshots[i - 1].pagantes_ativos;
    snapshots[i].crescimento_pagantes_pct = ap > 0
      ? ((snapshots[i].pagantes_ativos - ap) / ap) * 100
      : snapshots[i].pagantes_ativos > 0 ? 100 : 0;
  }

  return snapshots;
}

// Retorna a média de novos por mês (absoluto), excluindo meses de migração e o mês atual incompleto
function calcMediaNovos(snapshots: ReturnType<typeof buildSnapshots>, campo: "novos_cadastros" | "novos_pagantes", mesAtualStr: string) {
  const vals = snapshots.filter((s) => !s.migracao && s.data !== mesAtualStr && s[campo] > 0);
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((acc, s) => acc + s[campo], 0) / vals.length);
}

// Projeção somando média de novos por mês ao total atual (crescimento linear/absoluto)
function calcProj(totalAtual: number, mediaNovosPosMes: number) {
  return [1, 3, 6, 12].map((meses) => ({
    meses,
    label: meses === 1 ? "1 mês" : `${meses} meses`,
    projetado: totalAtual + mediaNovosPosMes * meses,
    novos_esperados: mediaNovosPosMes * meses,
  }));
}

function calcCrescimentoAbsoluto(
  snapshots: ReturnType<typeof buildSnapshots>,
  agora: Date
) {
  const mesAtualStr = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const mesPassadoDate = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const mesPassadoStr = `${mesPassadoDate.getFullYear()}-${String(mesPassadoDate.getMonth() + 1).padStart(2, "0")}`;

  const snapAtual = snapshots.find((s) => s.data === mesAtualStr);
  const snapPassado = snapshots.find((s) => s.data === mesPassadoStr);

  // Últimos 3 meses excluindo migração
  const ultimos3 = snapshots
    .filter((s) => !s.migracao)
    .slice(-3);

  const novos_cadastros_3m = ultimos3.reduce((acc, s) => acc + s.novos_cadastros, 0);
  const novos_pagantes_3m = ultimos3.reduce((acc, s) => acc + s.novos_pagantes, 0);
  const media_cadastros_3m = ultimos3.length > 0 ? Math.round(novos_cadastros_3m / ultimos3.length) : 0;
  const media_pagantes_3m = ultimos3.length > 0 ? Math.round(novos_pagantes_3m / ultimos3.length) : 0;

  return {
    mes_atual: {
      label: snapAtual?.mes ?? "",
      novos_cadastros: snapAtual?.novos_cadastros ?? 0,
      novos_pagantes: snapAtual?.novos_pagantes ?? 0,
    },
    mes_passado: {
      label: snapPassado?.mes ?? "",
      novos_cadastros: snapPassado && !snapPassado.migracao ? snapPassado.novos_cadastros : null,
      novos_pagantes: snapPassado && !snapPassado.migracao ? snapPassado.novos_pagantes : null,
    },
    ultimos_3_meses: {
      novos_cadastros: novos_cadastros_3m,
      novos_pagantes: novos_pagantes_3m,
      media_mensal_cadastros: media_cadastros_3m,
      media_mensal_pagantes: media_pagantes_3m,
    },
    previsao_proximo_mes: {
      cadastros: media_cadastros_3m,
      pagantes: media_pagantes_3m,
    },
  };
}

// Preços mensalizados em reais (para cálculo de MRR)
const PRECOS_MES: Record<string, number> = {
  basico_mensal: 19.90,
  intermediario_mensal: 39.90,
  profissional_mensal: 79.90,
  basico_anual: 15.90,
  intermediario_anual: 31.90,
  profissional_anual: 74.90,
};

const PLANO_NOMES: Record<string, string> = {
  basico_mensal: "Básico Mensal",
  intermediario_mensal: "Intermediário Mensal",
  profissional_mensal: "Profissional Mensal",
  basico_anual: "Básico Anual",
  intermediario_anual: "Intermediário Anual",
  profissional_anual: "Profissional Anual",
};

// Taxas Pagar.me padrão (configuráveis aqui)
const TAXA_CARTAO_PERCENTUAL = 0.0379; // 3,79%
const TAXA_CARTAO_FIXA = 0.39;          // R$ 0,39 por transação
const TAXA_PIX_PERCENTUAL = 0.0099;     // 0,99%
const TAXA_PIX_FIXA = 0;

function liquidoCartao(bruto: number): number {
  return Math.max(0, bruto * (1 - TAXA_CARTAO_PERCENTUAL) - TAXA_CARTAO_FIXA);
}
function liquidoPix(bruto: number): number {
  return Math.max(0, bruto * (1 - TAXA_PIX_PERCENTUAL) - TAXA_PIX_FIXA);
}

async function pagarmeFetch(path: string, secretKey: string) {
  const auth = btoa(`${secretKey}:`);
  const url = `https://api.pagar.me/core/v5${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Pagar.me ${path} ${res.status}: ${txt.slice(0, 300)}`);
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Admin autenticado", { userId: userData.user.id });

    const agora = new Date();

    // Pagar.me neste projeto é usado APENAS para cobranças PIX avulsas
    // (não há subscriptions na Pagar.me). Por isso o MRR/contagem do
    // provedor Pagar.me é derivado da tabela local `assinaturas` filtrando
    // por payment_provider = 'pagarme'.
    const PAGARME_KEY = Deno.env.get("PAGARME_SECRET_KEY") || "";

    // ─── 1. Dados do banco (assinaturas pagas ativas) ───────────────────
    const { data: assinaturasAtivas, error: assErr } = await supabaseAdmin
      .from("assinaturas")
      .select("user_id, plano_tipo, status, data_fim, data_proxima_cobranca, payment_method, payment_provider, pagarme_subscription_id, stripe_subscription_id")
      .eq("status", "active")
      .in("plano_tipo", Object.keys(PRECOS_MES));

    if (assErr) throw new Error(`DB assinaturas: ${assErr.message}`);

    // ─── 1b. Histórico de crescimento (cadastros + pagantes) ────────────
    const { data: todasAssinaturas } = await supabaseAdmin
      .from("assinaturas")
      .select("user_id, data_inicio, data_fim, cancelado_em, status")
      .in("plano_tipo", Object.keys(PRECOS_MES))
      .in("status", ["active", "past_due"]) as { data: Array<{ user_id: string; data_inicio: string | null; data_fim: string | null; cancelado_em: string | null; status: string }> };

    // Usar auth.users para contar cadastros reais (profiles pode não ser criado por falha de trigger)
    const { data: todosProfiles } = await supabaseAdmin.auth.admin.listUsers({ perPage: 10000 });
    const todosUsers = (todosProfiles?.users ?? []).map((u) => ({ user_id: u.id, created_at: u.created_at }));

    // Total atual real: status active E dentro do prazo (data_fim no futuro ou nula)
    const totalPagantesAgora = (assinaturasAtivas ?? []).filter((a) =>
      !a.data_fim || new Date(a.data_fim) > agora
    ).length;

    const mesAtualStr = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
    const snapshots = buildSnapshots(todasAssinaturas ?? [], todosUsers, agora, 12);
    const ultimoSnap = snapshots[snapshots.length - 1];

    const mediaNovoCadastros = calcMediaNovos(snapshots, "novos_cadastros", mesAtualStr);
    const mediaNovosPagantes = calcMediaNovos(snapshots, "novos_pagantes", mesAtualStr);

    const crescimento_absoluto = calcCrescimentoAbsoluto(snapshots, agora);

    const historico_crescimento = {
      snapshots,
      cadastros: {
        total_atual: ultimoSnap?.cadastros_acumulados ?? 0,
        media_novos_por_mes: mediaNovoCadastros,
        crescimento_ultimo_mes_pct: ultimoSnap?.crescimento_cadastros_pct ?? null,
        projecoes: calcProj(ultimoSnap?.cadastros_acumulados ?? 0, mediaNovoCadastros),
      },
      pagantes: {
        total_atual: totalPagantesAgora,
        media_novos_por_mes: mediaNovosPagantes,
        crescimento_ultimo_mes_pct: ultimoSnap?.crescimento_pagantes_pct ?? null,
        projecoes: calcProj(totalPagantesAgora, mediaNovosPagantes),
      },
      crescimento_absoluto,
    };

    const assinaturas = assinaturasAtivas || [];

    // Buscar assinaturas EXPIRADAS (status != active mas com plano pago em algum momento)
    const { data: assinaturasExpiradas, error: expErr } = await supabaseAdmin
      .from("assinaturas")
      .select("user_id, plano_tipo, status, data_fim, data_proxima_cobranca, payment_provider, updated_at")
      .neq("status", "active")
      .in("plano_tipo", Object.keys(PRECOS_MES));

    if (expErr) log("⚠️ Erro buscando expiradas", { err: expErr.message });
    const expiradas = assinaturasExpiradas || [];

    // Stripe gerencia vigência internamente — assinatura active no banco = vigente
    // Para Pagar.me/manual, verificar se data_fim ainda não venceu
    const isVigenteParaMRR = (a: any) => {
      if (a.payment_provider === "stripe") return false; // MRR Stripe calculado separadamente
      if (!a.data_fim) return true;
      return new Date(a.data_fim).getTime() > agora.getTime();
    };

    const isVigente = (a: any) => {
      if ((a.payment_provider || "").toLowerCase() === "stripe") return true; // Stripe: confiar no status
      if (!a.data_fim) return true;
      return new Date(a.data_fim).getTime() > agora.getTime();
    };

    const vigentes = assinaturas.filter((a) => isVigente(a));
    const inadimplentes = assinaturas.filter((a) => !isVigente(a));
    const dbTotal = vigentes.length;
    const dbInadimplentes = inadimplentes.length;

    const vigentesParaMRR = assinaturas.filter((a) => isVigenteParaMRR(a));

    // MRR banco e detalhamento por plano: exclui Stripe (calculado separadamente).
    // Planos anuais já são mensalizados via PRECOS_MES.
    const planBreakdown: Record<string, { count: number; mrr: number; nome: string }> = {};
    let mrrBanco = 0;
    for (const a of vigentesParaMRR) {
      const p = a.plano_tipo as string;
      const valor = PRECOS_MES[p] || 0;
      if (!planBreakdown[p]) {
        planBreakdown[p] = { count: 0, mrr: 0, nome: PLANO_NOMES[p] || p };
      }
      planBreakdown[p].count += 1;
      planBreakdown[p].mrr += valor;
      mrrBanco += valor;
    }

    // Detalhes dos inadimplentes para listagem
    const inadimplentesDetalhes = inadimplentes.map((a) => ({
      user_id: a.user_id,
      plano_tipo: a.plano_tipo,
      plano_nome: PLANO_NOMES[a.plano_tipo as string] || a.plano_tipo,
      data_vencimento: a.data_proxima_cobranca || a.data_fim,
      payment_provider: a.payment_provider,
      valor_mensal: PRECOS_MES[a.plano_tipo as string] || 0,
    }));

    // Detalhes dos assinantes vigentes
    const assinantesDetalhes = vigentes.map((a) => ({
      user_id: a.user_id,
      plano_tipo: a.plano_tipo,
      plano_nome: PLANO_NOMES[a.plano_tipo as string] || a.plano_tipo,
      proxima_cobranca: a.data_proxima_cobranca || a.data_fim,
      payment_provider: a.payment_provider,
      payment_method: a.payment_method,
      valor_mensal: PRECOS_MES[a.plano_tipo as string] || 0,
    }));

    // Buscar profiles dos user_ids para enriquecer renovações
    const userIds = [
      ...new Set([
        ...assinaturas.map((a) => a.user_id),
        ...expiradas.map((a: any) => a.user_id),
      ]),
    ];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, nome, email")
      .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    // Enriquecer inadimplentes com nome/email
    for (const inad of inadimplentesDetalhes) {
      const prof = profileMap.get(inad.user_id) as any;
      (inad as any).nome = prof?.nome || null;
      (inad as any).email = prof?.email || null;
    }

    // Enriquecer assinantes vigentes com nome/email
    for (const ass of assinantesDetalhes) {
      const prof = profileMap.get(ass.user_id) as any;
      (ass as any).nome = prof?.nome || null;
      (ass as any).email = prof?.email || null;
    }

    // Ordenar assinantes por nome
    assinantesDetalhes.sort((a: any, b: any) =>
      (a.nome || a.email || "").localeCompare(b.nome || b.email || "")
    );

    // Detalhes dos expirados (status canceled, past_due, etc)
    const expiradosDetalhes = expiradas.map((a: any) => {
      const prof = profileMap.get(a.user_id) as any;
      return {
        user_id: a.user_id,
        plano_tipo: a.plano_tipo,
        plano_nome: PLANO_NOMES[a.plano_tipo as string] || a.plano_tipo,
        status: a.status,
        data_expiracao: a.data_fim || a.data_proxima_cobranca || a.updated_at,
        payment_provider: a.payment_provider,
        nome: prof?.nome || null,
        email: prof?.email || null,
      };
    });
    expiradosDetalhes.sort((a, b) =>
      new Date(b.data_expiracao || 0).getTime() - new Date(a.data_expiracao || 0).getTime()
    );

    // ─── 2. Dados Pagar.me (derivados do banco local) ───────────────────
    // O provedor Pagar.me só processa PIX avulso para este sistema. Como a
    // API de subscriptions sempre retornará vazia, calculamos os totais
    // a partir das assinaturas vigentes com payment_provider = 'pagarme'.
    const pagarmeError: string | null = null;
    const pagarmeStatusBreakdown: Record<string, number> = {};
    const pagarmeRawDebug: any = { source: "local_db", note: "Pagar.me usado apenas para PIX avulso" };

    const assinaturasPagarmeVigentes = vigentes.filter(
      (a: any) => (a.payment_provider || "").toLowerCase() === "pagarme",
    );
    const pagarmeTotal = assinaturasPagarmeVigentes.length;

    let mrrPagarmeBruto = 0;
    let mrrPagarmeLiquido = 0;
    for (const a of assinaturasPagarmeVigentes) {
      const valor = PRECOS_MES[(a as any).plano_tipo as string] || 0;
      mrrPagarmeBruto += valor;
      mrrPagarmeLiquido += liquidoPix(valor);
    }

    const mesInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const mesFim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);

    const recebimentosCartaoMes: any[] = [];
    const renovacoesPendentesMes: any[] = [];

    // Adicionar renovações Pix/manuais do banco que não estão na Pagar.me ativa
    // (assinaturas Pix que esperam renovação manual no mês)
    for (const a of assinaturas) {
      const ref = a.data_proxima_cobranca || a.data_fim;
      if (!ref) continue;
      const dt = new Date(ref);
      if (dt < mesInicio || dt > mesFim) continue;

      const pm = (a.payment_method || "").toLowerCase();
      const isPix = pm === "pix" || (!a.pagarme_subscription_id && !a.stripe_subscription_id);
      if (!isPix) continue; // cartão já vem da Pagar.me

      const profile = profileMap.get(a.user_id);
      const valor = PRECOS_MES[a.plano_tipo as string] || 0;
      renovacoesPendentesMes.push({
        subscription_id: null,
        customer_name: (profile as any)?.nome || null,
        customer_email: (profile as any)?.email || null,
        plan_name: PLANO_NOMES[a.plano_tipo as string] || a.plano_tipo,
        amount: valor,
        amount_liquido: liquidoPix(valor),
        next_billing_at: ref,
        payment_method: "pix",
        expected_payout_at: ref,
      });
    }

    // Ordenar por data
    renovacoesPendentesMes.sort((a, b) =>
      new Date(a.next_billing_at).getTime() - new Date(b.next_billing_at).getTime()
    );
    recebimentosCartaoMes.sort((a, b) =>
      new Date(a.next_billing_at).getTime() - new Date(b.next_billing_at).getTime()
    );

    const totalReceberMesBruto = recebimentosCartaoMes.reduce((s, r) => s + r.amount, 0);
    const totalReceberMesLiquido = recebimentosCartaoMes.reduce((s, r) => s + r.amount_liquido, 0);

    // ─── Recorrência do mês: entrou vs. falta entrar ───────────────────
    // "Entrou" = assinante vigente em dia cujo data_fim está além do mês atual
    //   (período já foi pago, o próximo vence mês que vem ou mais)
    // "Falta entrar" = assinante vigente em dia cujo data_fim cai dentro do
    //   mês atual (renovação ainda pendente este mês) ou sem data_fim
    let recorrenciaEntrouMes = 0;
    let recorrenciaFaltaMes = 0;
    for (const a of vigentes) {
      const valor = PRECOS_MES[a.plano_tipo as string] || 0;
      if (!valor) continue;
      const ref = a.data_proxima_cobranca || a.data_fim;
      if (!ref) {
        // Sem data: considera já pago (ex: Stripe gerencia internamente)
        recorrenciaEntrouMes += valor;
        continue;
      }
      const dtRef = new Date(ref);
      if (dtRef > mesFim) {
        // Próxima cobrança/expiração está além do mês: já pagou este ciclo
        recorrenciaEntrouMes += valor;
      } else {
        // Próxima cobrança/expiração cai neste mês ou está vencendo: ainda falta
        recorrenciaFaltaMes += valor;
      }
    }

    const result = {
      // KPIs principais
      assinantes_db: dbTotal,
      assinantes_inadimplentes: dbInadimplentes,
      inadimplentes_detalhes: inadimplentesDetalhes,
      assinantes_detalhes: assinantesDetalhes,
      expirados_detalhes: expiradosDetalhes,
      total_expirados: expiradosDetalhes.length,
      assinantes_pagarme: pagarmeTotal,
      mrr_db: mrrBanco,
      mrr_pagarme_bruto: mrrPagarmeBruto,
      mrr_pagarme_liquido: mrrPagarmeLiquido,
      // Distribuição
      plan_breakdown: planBreakdown,
      // Recebimentos do mês (cartão)
      mes: `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`,
      recebimentos_cartao_mes: recebimentosCartaoMes,
      total_receber_mes_bruto: totalReceberMesBruto,
      total_receber_mes_liquido: totalReceberMesLiquido,
      // Renovações pendentes
      renovacoes_pendentes_mes: renovacoesPendentesMes,
      // Taxas usadas
      taxas: {
        cartao_percentual: TAXA_CARTAO_PERCENTUAL,
        cartao_fixa: TAXA_CARTAO_FIXA,
        pix_percentual: TAXA_PIX_PERCENTUAL,
        pix_fixa: TAXA_PIX_FIXA,
      },
      pagarme_error: pagarmeError,
      pagarme_status_breakdown: pagarmeStatusBreakdown,
      pagarme_debug: pagarmeRawDebug,
      historico_crescimento,
      recorrencia_entrou_mes: recorrenciaEntrouMes,
      recorrencia_falta_mes: recorrenciaFaltaMes,
      last_update: agora.toISOString(),
    };

    log("✅ Resultado", {
      db: dbTotal,
      pagarme: pagarmeTotal,
      mrr_db: mrrBanco.toFixed(2),
      mrr_pagarme: mrrPagarmeBruto.toFixed(2),
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
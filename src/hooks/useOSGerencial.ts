import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, isWeekend, eachDayOfInterval } from "date-fns";

export interface OSGerencialData {
  // Banner
  osParadasCount: number;

  // Totais por grupo de status
  valorRealizado: number;       // em_andamento + concluida + aguardando_retirada + finalizado + entregue
  valorEmFluxo: number;         // pendente + em_andamento + aguardando_aprovacao
  countEmFluxo: number;

  // Indicadores por status
  indicadores: {
    total: number;
    totalValor: number;
    pendente: number;
    pendenteValor: number;
    emAndamento: number;
    emAndamentoValor: number;
    concluida: number;
    concluidaValor: number;
    finalizado: number;
    finalizadoValor: number;
    entregue: number;
    entregueValor: number;
    aguardandoRetirada: number;
    aguardandoRetiradaValor: number;
  };

  // Kanban paradas
  osParadas: Array<{
    id: string;
    numero_os: string;
    cliente_nome: string;
    status: string;
    diasParada: number;
    total: number | null;
    created_at: string;
  }>;

  // Maiores OS abertas
  maioresOS: Array<{
    id: string;
    numero_os: string;
    cliente_nome: string;
    status: string;
    diasParada: number;
    total: number | null;
  }>;

  // Meta
  meta: number | null;
  mes: number;
  ano: number;
}

export interface DiasUteisInfo {
  diasUteisMes: number;
  diasUteisPassados: number;
}

function calcularDiasUteis(inicio: Date, fim: Date): number {
  if (inicio > fim) return 0;
  return eachDayOfInterval({ start: inicio, end: fim }).filter(
    (d) => !isWeekend(d)
  ).length;
}

function calcularDiasUteisInfo(referencia: Date): DiasUteisInfo {
  const inicioMes = startOfMonth(referencia);
  const fimMes = endOfMonth(referencia);
  const hoje = new Date();
  const fimPassado = hoje < fimMes ? hoje : fimMes;

  return {
    diasUteisMes: calcularDiasUteis(inicioMes, fimMes),
    diasUteisPassados: calcularDiasUteis(inicioMes, fimPassado),
  };
}

const STATUS_REALIZADOS = ["em_andamento", "concluida", "aguardando_retirada", "finalizado", "entregue"];
const STATUS_EM_FLUXO = ["pendente", "em_andamento", "aguardando_aprovacao"];
const STATUS_PARADOS = ["pendente", "em_andamento", "aguardando_aprovacao"];

export function useOSGerencial(dataInicio?: Date, dataFim?: Date) {
  const hoje = new Date();
  const [data, setData] = useState<OSGerencialData | null>(null);
  const [diasUteis, setDiasUteis] = useState<DiasUteisInfo>(() =>
    calcularDiasUteisInfo(dataInicio ?? hoje)
  );
  const [meta, setMeta] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const mes = (dataInicio ?? hoje).getMonth() + 1;
  const ano = (dataInicio ?? hoje).getFullYear();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  const carregar = useCallback(async () => {
    if (!userId) return;

    setCarregando(true);
    setErro(null);

    try {
      const inicio = (dataInicio ?? startOfMonth(hoje)).toISOString();
      const fim = (dataFim ?? endOfMonth(hoje)).toISOString();

      const tresAtras = new Date(hoje);
      tresAtras.setDate(tresAtras.getDate() - 3);

      const [ordensRes, metaRes] = await Promise.all([
        supabase
          .from("ordens_servico")
          .select("id, numero_os, created_at, status, total, cliente:clientes(nome)")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .gte("created_at", inicio)
          .lte("created_at", fim),
        supabase
          .from("os_metas")
          .select("meta")
          .eq("user_id", userId)
          .eq("mes", mes)
          .eq("ano", ano)
          .maybeSingle(),
      ]);

      if (ordensRes.error) throw ordensRes.error;

      const ordens = ordensRes.data ?? [];
      const metaValor = metaRes.data?.meta ?? null;
      setMeta(metaValor);

      // --- Indicadores por status ---
      const soma = (statuses: string[]) =>
        ordens
          .filter((o) => o.status && statuses.includes(o.status))
          .reduce((acc, o) => acc + (o.total ?? 0), 0);
      const conta = (statuses: string[]) =>
        ordens.filter((o) => o.status && statuses.includes(o.status)).length;

      const indicadores = {
        total: ordens.length,
        totalValor: ordens.reduce((acc, o) => acc + (o.total ?? 0), 0),
        pendente: conta(["pendente", "aguardando_aprovacao"]),
        pendenteValor: soma(["pendente", "aguardando_aprovacao"]),
        emAndamento: conta(["em_andamento"]),
        emAndamentoValor: soma(["em_andamento"]),
        concluida: conta(["concluida"]),
        concluidaValor: soma(["concluida"]),
        aguardandoRetirada: conta(["aguardando_retirada"]),
        aguardandoRetiradaValor: soma(["aguardando_retirada"]),
        finalizado: conta(["finalizado"]),
        finalizadoValor: soma(["finalizado"]),
        entregue: conta(["entregue"]),
        entregueValor: soma(["entregue"]),
      };

      // --- Banner: OS paradas 3+ dias (busca sem filtro de data para pegar todas abertas) ---
      const { data: paradasData } = await supabase
        .from("ordens_servico")
        .select("id")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .in("status", STATUS_PARADOS)
        .lte("created_at", tresAtras.toISOString());

      const osParadasCount = paradasData?.length ?? 0;

      // --- Kanban paradas (sem filtro de período — todas abertas) ---
      const { data: paradasDetalhes } = await supabase
        .from("ordens_servico")
        .select("id, numero_os, created_at, status, total, cliente:clientes(nome)")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .in("status", STATUS_PARADOS)
        .order("created_at", { ascending: true })
        .limit(20);

      const osParadas = (paradasDetalhes ?? []).map((o) => {
        const criado = new Date(o.created_at);
        const diasParada = Math.floor(
          (hoje.getTime() - criado.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          id: o.id,
          numero_os: o.numero_os,
          cliente_nome: (o.cliente as { nome?: string } | null)?.nome ?? "—",
          status: o.status ?? "",
          diasParada,
          total: o.total,
          created_at: o.created_at,
        };
      });

      // --- Maiores OS abertas (sem filtro de período) ---
      const { data: maioresData } = await supabase
        .from("ordens_servico")
        .select("id, numero_os, created_at, status, total, cliente:clientes(nome)")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .in("status", STATUS_EM_FLUXO)
        .order("total", { ascending: false })
        .limit(10);

      const maioresOS = (maioresData ?? []).map((o) => {
        const criado = new Date(o.created_at);
        const diasParada = Math.floor(
          (hoje.getTime() - criado.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          id: o.id,
          numero_os: o.numero_os,
          cliente_nome: (o.cliente as { nome?: string } | null)?.nome ?? "—",
          status: o.status ?? "",
          diasParada,
          total: o.total,
        };
      });

      const valorRealizado = soma(STATUS_REALIZADOS);
      const valorEmFluxo = soma(STATUS_EM_FLUXO);
      const countEmFluxo = conta(STATUS_EM_FLUXO);

      setDiasUteis(calcularDiasUteisInfo(dataInicio ?? hoje));
      setData({
        osParadasCount,
        valorRealizado,
        valorEmFluxo,
        countEmFluxo,
        indicadores,
        osParadas,
        maioresOS,
        meta: metaValor,
        mes,
        ano,
      });
    } catch (e) {
      console.error("useOSGerencial:", e);
      setErro("Erro ao carregar dados gerenciais. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }, [userId, dataInicio, dataFim, mes, ano]);

  useEffect(() => {
    if (userId) carregar();
  }, [userId, carregar]);

  const salvarMeta = useCallback(
    async (novaMetaValor: number) => {
      if (!userId) return;
      const { error } = await supabase.from("os_metas").upsert(
        { user_id: userId, mes, ano, meta: novaMetaValor, updated_at: new Date().toISOString() },
        { onConflict: "user_id,mes,ano" }
      );
      if (!error) {
        setMeta(novaMetaValor);
        if (data) setData({ ...data, meta: novaMetaValor });
      }
      return error;
    },
    [userId, mes, ano, data]
  );

  return { data, diasUteis, meta, carregando, erro, carregar, salvarMeta };
}

export { calcularDiasUteis };

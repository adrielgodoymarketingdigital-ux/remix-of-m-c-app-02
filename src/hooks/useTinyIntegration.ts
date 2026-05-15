import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TinyIntegration {
  id: string;
  user_id: string;
  nome_assistencia: string | null;
  connected_at: string;
  updated_at: string;
  expires_at: string;
  auto_refresh_interval: number;
}

export interface TinyOS {
  id: string;
  numero: string;
  cliente: string;
  situacao: string;
  data_pedido: string;
  valor: number;
}

export type SituacaoTiny = "aberto" | "em_manutencao" | "concluido" | "finalizado";

// Situações V3: 0=Em Aberto, 1=Orçada, 2=Serv Concluído, 3=Finalizada,
//               4=Não Aprovada, 5=Aprovada, 6=Em Andamento, 7=Cancelada
export function mapSituacaoTiny(raw: string | number): string {
  const n = Number(raw);
  if (!isNaN(n)) {
    if (n === 0) return "em_aberto";
    if (n === 1) return "em_aberto";
    if (n === 5) return "em_aberto";
    if (n === 6) return "em_manutencao";
    if (n === 2) return "concluido";
    if (n === 3) return "finalizado";
    if (n === 7) return "finalizado";
    if (n === 4) return "finalizado";
    return String(raw);
  }
  const s = String(raw).toLowerCase().trim();
  if (s === "aberto" || s === "em aberto") return "em_aberto";
  if (s === "em andamento" || s === "em_andamento") return "em_manutencao";
  if (s === "aprovado") return "concluido";
  if (s === "faturado" || s === "concluido" || s === "finalizado") return "finalizado";
  return s;
}

export function calcularDiasUteis(inicio: Date, fim: Date): number {
  let count = 0;
  const cur = new Date(inicio);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(fim);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function diasParados(dataAbertura: string): number {
  const abertura = new Date(dataAbertura);
  const agora = new Date();
  const diff = agora.getTime() - abertura.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function useTinyIntegration() {
  const [integration, setIntegration] = useState<TinyIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegration = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error: dbError } = await supabase
        .from("tiny_integrations")
        .select("id, user_id, nome_assistencia, connected_at, updated_at, expires_at, auto_refresh_interval")
        .eq("user_id", user.id)
        .maybeSingle();

      if (dbError) { setError(dbError.message); } else { setIntegration(data); }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIntegration(); }, [fetchIntegration]);

  const iniciarOAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase.functions.invoke("tiny-oauth-start", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error || !data?.url) {
      console.error("Erro ao iniciar OAuth:", error);
      return;
    }
    window.location.href = data.url;
  }, []);

  const desconectar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("tiny_integrations").delete().eq("user_id", user.id);
    setIntegration(null);
  }, []);

  const atualizarNome = useCallback(async (nome: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("tiny_integrations")
      .update({ nome_assistencia: nome, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    setIntegration((prev) => prev ? { ...prev, nome_assistencia: nome } : prev);
  }, []);

  const atualizarIntervalo = useCallback(async (intervalo: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("tiny_integrations")
      .update({ auto_refresh_interval: intervalo, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    setIntegration((prev) => prev ? { ...prev, auto_refresh_interval: intervalo } : prev);
  }, []);

  return {
    integration,
    loading,
    error,
    fetchIntegration,
    iniciarOAuth,
    desconectar,
    atualizarNome,
    atualizarIntervalo,
  };
}

export function useTinyDados(
  dataInicio: Date,
  dataFim: Date,
  enabled: boolean
) {
  const [ordensRaw, setOrdensRaw] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimaSinc, setUltimaSinc] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const formataData = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  const buscarDados = useCallback(async () => {
    if (!enabled) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error: fnError } = await supabase.functions.invoke("tiny-api-proxy", {
        body: {
          endpoint: "ordem-servico",
          params: {
            dataInicialEmissao: formataData(dataInicio),
            dataFinalEmissao: formataData(dataFim),
          },
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (fnError) throw new Error(fnError.message);

      const items = (data?.items ?? []) as Record<string, unknown>[];
      setOrdensRaw(items);
      setUltimaSinc(new Date());
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [enabled, dataInicio, dataFim]);

  useEffect(() => {
    if (enabled) buscarDados();
  }, [buscarDados, enabled]);

  return { ordensRaw, loading, error, ultimaSinc, buscarDados };
}

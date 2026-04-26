import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PagarmePaymentItem {
  email: string | null;
  name: string | null;
  amount: number;
  paid_date?: string;
  expiration?: string;
  plan: string;
  created_at?: string;
}

export interface PagarmeRenewalItem {
  email: string | null;
  name: string | null;
  amount: number;
  renewal_date: string;
  plan: string;
}

export interface PagarmeMonthly {
  month: string;
  paid: PagarmePaymentItem[];
  total_paid: number;
  paid_count: number;
  upcoming_renewals: PagarmeRenewalItem[];
  total_pending_renewals: number;
  upcoming_count: number;
}

export interface PagarmePlanBreakdownItem {
  count: number;
  mrr: number;
}

export interface PagarmeBalance {
  total_received: number;
  total_pending: number;
  paid_count: number;
  pending_count: number;
  expired_count: number;
  active_subscriptions_count: number;
  mrr: number;
  plan_breakdown: Record<string, PagarmePlanBreakdownItem>;
  monthly: PagarmeMonthly;
  recent_payments: PagarmePaymentItem[];
  pending_payments: PagarmePaymentItem[];
  last_update: string;
}

export function usePagarmeBalance() {
  const [balance, setBalance] = useState<PagarmeBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("pagarme-balance");

      if (fnError) {
        setError(fnError.message || "Erro ao buscar dados Pagar.me");
        return null;
      }

      if (data?.error) {
        setError(data.error);
        return null;
      }

      setBalance(data as PagarmeBalance);
      return data as PagarmeBalance;
    } catch (err) {
      setError("Erro de conexão. Tente novamente.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => fetchBalance(), [fetchBalance]);

  return { balance, isLoading, error, fetchBalance, refetch };
}
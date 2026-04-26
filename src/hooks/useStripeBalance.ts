import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PendingByDate {
  date: string;
  amount: number;
  formatted_date: string;
}

export interface NextPayout {
  amount: number;
  arrival_date: string;
  status: string;
}

export interface PlanBreakdownItem {
  count: number;
  mrr: number;
}

export interface MonthlyRenewalItem {
  email: string | null;
  name: string | null;
  amount: number;
  paid_date?: string;
  renewal_date?: string;
  plan: string;
}

export interface MonthlyRenewals {
  month: string;
  paid: MonthlyRenewalItem[];
  pending: MonthlyRenewalItem[];
  total_paid: number;
  total_pending: number;
  total_expected: number;
  paid_count: number;
  pending_count: number;
}

export interface UnpaidUser {
  customer_id: string;
  email: string | null;
  name: string | null;
  subscription_id: string;
  current_period_end: string;
  status: string;
}

export interface StripeBalance {
  available: number;
  pending: number;
  total: number;
  currency: string;
  last_update: string;
  pending_by_date: PendingByDate[];
  next_payout: NextPayout | null;
  estimated_available_date: string | null;
  mrr_stripe?: number;
  mrr_active_only?: number;
  active_subscriptions_count?: number;
  all_subscriptions_count?: number;
  plan_breakdown?: Record<string, PlanBreakdownItem>;
  past_due_subscriptions?: UnpaidUser[];
  incomplete_subscriptions?: UnpaidUser[];
  unpaid_count?: number;
  monthly_renewals?: MonthlyRenewals;
}

export function useStripeBalance() {
  const [balance, setBalance] = useState<StripeBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("stripe-balance");

      if (fnError) {
        setError(fnError.message || "Erro ao buscar saldo da Stripe");
        return null;
      }

      if (data?.error) {
        setError(data.error);
        return null;
      }

      setBalance(data as StripeBalance);
      return data as StripeBalance;
    } catch (err) {
      setError("Erro de conexão. Tente novamente.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    return fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    fetchBalance,
    refetch,
  };
}

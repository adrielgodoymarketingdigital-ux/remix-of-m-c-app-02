import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Mesma formatação de src/pages/Fidelidade.tsx (cartões do celular). Duplicada aqui
// para o layout do computador não exigir mudança fora do desvio da página.

export function formatarMoedaFidelidade(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarDataFidelidade(data: string | null) {
  if (!data) return "—";
  try {
    return format(new Date(data), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

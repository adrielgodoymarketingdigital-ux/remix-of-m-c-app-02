import { useQuery } from "@tanstack/react-query";

interface CotacaoDolar {
  cotacao: number | null;
  cotacaoCompra: number | null;
  variacao: number | null;
  ultimaAtualizacao: Date | null;
  loading: boolean;
  erro: string | null;
  atualizar: () => void;
}

const INTERVALO_ATUALIZACAO_MS = 300000;

/** Cache compartilhado: quantos componentes usarem o hook, sai uma consulta só. */
export function useCotacaoDolar(): CotacaoDolar {
  const { data, dataUpdatedAt, isFetching, isError, refetch } = useQuery({
    queryKey: ["cotacao-dolar"],
    staleTime: INTERVALO_ATUALIZACAO_MS,
    refetchInterval: INTERVALO_ATUALIZACAO_MS,
    queryFn: async () => {
      const response = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
      if (!response.ok) throw new Error("Falha ao buscar cotação");
      const dados = await response.json();
      const usd = dados?.USDBRL;
      if (!usd) throw new Error("Dados inválidos da API");
      return {
        cotacao: parseFloat(usd.ask),
        cotacaoCompra: parseFloat(usd.bid),
        variacao: parseFloat(usd.pctChange),
      };
    },
  });

  return {
    cotacao: data?.cotacao ?? null,
    cotacaoCompra: data?.cotacaoCompra ?? null,
    variacao: data?.variacao ?? null,
    ultimaAtualizacao: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    loading: isFetching,
    erro: isError ? "Não foi possível carregar a cotação do dólar." : null,
    atualizar: () => {
      refetch();
    },
  };
}

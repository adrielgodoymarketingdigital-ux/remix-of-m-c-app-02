import { useState, useEffect, useCallback } from "react";

interface CotacaoDolar {
  cotacao: number | null;
  cotacaoCompra: number | null;
  variacao: number | null;
  ultimaAtualizacao: Date | null;
  loading: boolean;
  erro: string | null;
  atualizar: () => void;
}

export function useCotacaoDolar(): CotacaoDolar {
  const [cotacao, setCotacao] = useState<number | null>(null);
  const [cotacaoCompra, setCotacaoCompra] = useState<number | null>(null);
  const [variacao, setVariacao] = useState<number | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const response = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
      if (!response.ok) throw new Error("Falha ao buscar cotação");
      const data = await response.json();
      const usd = data?.USDBRL;
      if (!usd) throw new Error("Dados inválidos da API");
      setCotacao(parseFloat(usd.ask));
      setCotacaoCompra(parseFloat(usd.bid));
      setVariacao(parseFloat(usd.pctChange));
      setUltimaAtualizacao(new Date());
    } catch {
      setErro("Não foi possível carregar a cotação do dólar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    buscar();
    const intervalo = setInterval(buscar, 300000);
    return () => clearInterval(intervalo);
  }, [buscar]);

  return { cotacao, cotacaoCompra, variacao, ultimaAtualizacao, loading, erro, atualizar: buscar };
}

/**
 * Onde a venda escolhe a garantia do aparelho (PDV e cartão do dispositivo):
 *  - freio liberado (hoje: só admin) → SeletorGarantia (fase B);
 *  - senão → `legado` exatamente como era (SeletorTempoGarantia etc.), e a
 *    escolha nova fica null (o payload antigo não muda).
 * Regra em src/lib/garantias/visibilidadeMinhasGarantias.ts. O seletor novo é
 * carregado sob demanda: quem fica no antigo não baixa nada dele.
 */
import { lazy, type ReactNode, Suspense, useEffect } from "react";
import { useSeletorGarantiaVendaVisivel } from "@/hooks/useSeletorGarantiaVendaVisivel";
import type { EscolhaGarantia } from "@/lib/garantias/vendaGarantia";

// Só quem o freio libera baixa o seletor novo (chunk próprio, sob demanda).
const SeletorGarantia = lazy(() => import("./SeletorGarantia").then((m) => ({ default: m.SeletorGarantia })));

export interface CampoGarantiaVendaProps {
  dispositivo: { garantia?: boolean | null; tempo_garantia?: number | null };
  /** Seletor antigo, renderizado sem nenhuma mudança quando o freio não libera. */
  legado: ReactNode;
  onEscolha: (escolha: EscolhaGarantia | null) => void;
  /** true = seletor novo em uso (o confirmar espera uma escolha válida). */
  onModoNovo: (novo: boolean) => void;
}

export function CampoGarantiaVenda({ dispositivo, legado, onEscolha, onModoNovo }: CampoGarantiaVendaProps) {
  const novo = useSeletorGarantiaVendaVisivel();
  useEffect(() => {
    onModoNovo(novo);
    if (!novo) onEscolha(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novo]);
  if (!novo) return <>{legado}</>;
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando garantias…</p>}>
      <SeletorGarantia dispositivo={dispositivo} onEscolha={onEscolha} />
    </Suspense>
  );
}

/** Prévia REAL do fechamento (DialogFechamentoCaixa + useCaixa.fecharCaixa) com um cenário fictício. Só desenvolvimento. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DialogFechamentoCaixa } from "@/components/pdv/DialogFechamentoCaixa";
import { useCaixa } from "@/hooks/useCaixa";
import { CAIXA, CENARIOS } from "./cenarios";

declare global {
  interface Window {
    __cenariosCaixa?: typeof CENARIOS;
  }
}

window.__cenariosCaixa = CENARIOS;

const params = new URLSearchParams(window.location.search);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
const nada = () => undefined;

function Previa() {
  const { fecharCaixa } = useCaixa();
  return <DialogFechamentoCaixa open onOpenChange={nada} caixa={CAIXA} onCaixaFechado={nada} fecharCaixa={fecharCaixa} />;
}

export function PaginaFechamentoCaixa() {
  if (!CENARIOS[params.get("cenario") ?? ""]) return <p id="erro-cenario">Cenário não encontrado</p>;
  return (
    <QueryClientProvider client={queryClient}>
      <Previa />
    </QueryClientProvider>
  );
}

/** Diálogos de recibo abertos com um cenário fictício (ver main.tsx). Só desenvolvimento. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DialogReciboPDV } from "@/components/pdv/DialogReciboPDV";
import { DialogReimpressaoRecibo } from "@/components/vendas/DialogReimpressaoRecibo";
import { DialogReimprimirReciboVenda } from "@/components/dispositivos/DialogReimprimirReciboVenda";
import { CENARIOS_DIALOGOS, type CenarioDialogo } from "./cenariosDialogos";

declare global {
  interface Window {
    __cenariosDialogos?: Record<string, CenarioDialogo["tabelas"]>;
  }
}

window.__cenariosDialogos = Object.fromEntries(CENARIOS_DIALOGOS.map((c) => [c.id, c.tabelas]));

const params = new URLSearchParams(window.location.search);
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: false, refetchOnWindowFocus: false } } });
const nada = () => undefined;

function Dialogo({ lugar, cenario }: { lugar: string; cenario: CenarioDialogo }) {
  if (lugar === "pdv") return <DialogReciboPDV open onOpenChange={nada} dados={cenario.pdv} />;
  if (lugar === "vendas") return <DialogReimpressaoRecibo open onOpenChange={nada} venda={cenario.vendaVendas} vendasGrupo={cenario.grupoVendas} />;
  const modo = params.get("modo") === "garantia" ? "garantia" : "recibo";
  return <DialogReimprimirReciboVenda open onOpenChange={nada} venda={cenario.vendaDispositivo} modo={modo} grupoVendaId={cenario.grupo} />;
}

export function PaginaDialogosRecibo() {
  const lugar = params.get("lugar") ?? "pdv";
  const cenario = CENARIOS_DIALOGOS.find((c) => c.id === (params.get("cenario") ?? "simples"));
  if (!cenario) return <p id="erro-cenario">Cenário não encontrado</p>;
  return (
    <QueryClientProvider client={queryClient}>
      <Dialogo lugar={lugar} cenario={cenario} />
    </QueryClientProvider>
  );
}

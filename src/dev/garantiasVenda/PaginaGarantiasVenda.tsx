/** Página de teste da fase B (ver main.tsx). Só desenvolvimento. */
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { DialogSelecionarItem } from "@/components/pdv/DialogSelecionarItem";
import { CardDispositivo } from "@/components/dispositivos/CardDispositivo";
import type { Dispositivo } from "@/types/dispositivo";

declare global {
  interface Window { __capturas: unknown[] }
}
window.__capturas = [];

const params = new URLSearchParams(window.location.search);
const APARELHO_CARTAO: Dispositivo = {
  id: "disp-cartao", marca: "Marca", modelo: "Modelo Cartão", tipo: "celular", cor: "Preto", capacidade_gb: 128,
  imei: "350000000000001", garantia: params.get("sem") === "1" ? false : true, tempo_garantia: Number(params.get("meses") ?? 6),
  condicao: "semi_novo", custo: 2000, preco: 3000, vendido: false, quantidade: 1, created_at: "2026-11-01T10:00:00Z",
};

function DestinoPDV() {
  const location = useLocation();
  window.__capturas.push(location.state);
  return <pre id="state-pdv">{JSON.stringify(location.state, null, 2)}</pre>;
}

export function PaginaGarantiasVenda() {
  if (params.get("tela") === "cartao") {
    return (
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<div className="max-w-sm p-4"><CardDispositivo dispositivo={APARELHO_CARTAO} onEditar={() => {}} onExcluir={() => {}} /></div>} />
          <Route path="/pdv" element={<DestinoPDV />} />
        </Routes>
      </MemoryRouter>
    );
  }
  return (
    <MemoryRouter>
      <DialogSelecionarItem open onOpenChange={() => {}} onAdicionarItem={(item) => window.__capturas.push(item)} />
    </MemoryRouter>
  );
}


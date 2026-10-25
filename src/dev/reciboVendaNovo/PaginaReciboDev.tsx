/** Componentes da página de teste do recibo novo (ver main.tsx). Só desenvolvimento. */
import { useEffect, useState } from "react";
import { ReciboVendaNovo } from "@/components/vendas/recibo-novo/ReciboVendaNovo";
import { cssReciboVendaNovo } from "@/components/vendas/recibo-novo/cssReciboVendaNovo";
import { carregarReciboVenda } from "@/lib/vendas/carregarReciboVenda";
import { entradaDasLinhas, montarReciboVenda, type ReciboVendaModelo } from "@/lib/vendas/reciboVendaModelo";
import { CENARIOS, type CenarioRecibo } from "./cenarios";

declare global {
  interface Window {
    __rvnBanco?: Record<string, CenarioRecibo["banco"]>;
  }
}

const params = new URLSearchParams(window.location.search);
const idCenario = params.get("cenario");
const impressao = params.get("impressao") === "1";
const fonteSupabase = params.get("fonte") === "supabase";

window.__rvnBanco = Object.fromEntries(CENARIOS.filter((c) => c.banco).map((c) => [c.id, c.banco]));

function UmCenario({ cenario }: { cenario: CenarioRecibo }) {
  const [modelo, setModelo] = useState<ReciboVendaModelo | null>(fonteSupabase ? null : montarReciboVenda(cenario.entrada));
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!fonteSupabase) return;
    if (!cenario.banco) {
      setErro("Cenário sem dados de banco");
      return;
    }
    carregarReciboVenda({ vendaId: cenario.banco.vendaId, grupoVenda: cenario.banco.grupoVenda }).then((dados) => {
      if (!dados) {
        setErro("carregarReciboVenda devolveu null");
        return;
      }
      setModelo(montarReciboVenda(entradaDasLinhas(dados, { loja: cenario.entrada.loja, termo: cenario.entrada.termo, origemApp: cenario.entrada.origemApp })));
    });
  }, [cenario]);

  if (erro) return <p id="rvn-erro">{erro}</p>;
  if (!modelo) return <p>Carregando…</p>;
  return (
    <div id="rvn-recibo" data-pronto="1">
      <ReciboVendaNovo modelo={modelo} />
    </div>
  );
}

export function PaginaReciboDev() {
  const cenario = idCenario ? CENARIOS.find((c) => c.id === idCenario) : null;
  const css = cssReciboVendaNovo({ paraImpressao: impressao });
  if (idCenario && !cenario) return <p id="rvn-erro">Cenário não encontrado: {idCenario}</p>;
  return (
    <>
      <style>{css}</style>
      <style>{impressao
        ? "body { margin: 0; background: #ffffff; }"
        : "body { margin: 0; padding: 28px; background: #e9edf5; font-family: Arial, sans-serif; } @media (max-width: 600px) { body { padding: 0; } }"}</style>
      {cenario ? (
        <UmCenario cenario={cenario} />
      ) : (
        <div>
          <h1 style={{ maxWidth: 850, margin: "0 auto 12px" }}>Recibo de venda — layout novo (só dev)</h1>
          <ul style={{ maxWidth: 850, margin: "0 auto 24px" }}>
            {CENARIOS.map((c) => (
              <li key={c.id}>
                <a href={`?cenario=${c.id}`}>{c.titulo}</a> · <a href={`?cenario=${c.id}&impressao=1`}>impressão</a>
                {c.banco && (
                  <>
                    {" "}
                    · <a href={`?cenario=${c.id}&fonte=supabase`}>via Supabase (precisa do mock)</a>
                  </>
                )}
              </li>
            ))}
          </ul>
          {CENARIOS.map((c) => (
            <section key={c.id} style={{ marginBottom: 40 }}>
              <h2 style={{ maxWidth: 850, margin: "0 auto 8px", fontSize: 16 }}>{c.titulo}</h2>
              <ReciboVendaNovo modelo={montarReciboVenda(c.entrada)} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}

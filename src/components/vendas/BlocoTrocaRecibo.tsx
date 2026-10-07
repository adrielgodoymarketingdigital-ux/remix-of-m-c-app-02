import type { BlocoTrocaRecibo as Bloco } from "@/lib/vendas/reciboTroca";

/**
 * Bloco "TROCA DE APARELHO" nos recibos montados em JSX (PDV e histórico de
 * Vendas). Estilos inline porque a impressão copia o innerHTML para outra
 * janela (A4/80mm/58mm): rótulo quebra linha, valor nunca é cortado.
 * Texto e valores vêm de montarBlocoTrocaRecibo (src/lib/vendas/reciboTroca.ts).
 */
export function BlocoTrocaRecibo({ bloco }: { bloco: Bloco }) {
  const linha: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, margin: "2px 0" };
  return (
    <div
      className="recibo-troca"
      style={{ margin: "8px 0", padding: "6px 8px", border: "1px dashed #555", borderRadius: 4, pageBreakInside: "avoid", breakInside: "avoid" }}
    >
      <div style={{ fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>{bloco.titulo}</div>
      <div style={{ margin: "2px 0", overflowWrap: "anywhere" }}>
        <strong>{bloco.aparelhoTitulo}:</strong> {bloco.aparelhoDescricao}
      </div>
      {bloco.imei && <div style={{ margin: "2px 0", overflowWrap: "anywhere" }}>IMEI: {bloco.imei}</div>}
      {bloco.linhas.map((l) => (
        <div key={l.rotulo} style={{ ...linha, fontWeight: l.destaque ? 700 : undefined }}>
          <span style={{ flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" }}>{l.rotulo}:</span>
          <span style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}>{l.negativo ? "− " : ""}{l.valor}</span>
        </div>
      ))}
      {bloco.observacao && <div style={{ marginTop: 4, fontStyle: "italic", overflowWrap: "anywhere" }}>{bloco.observacao}</div>}
    </div>
  );
}

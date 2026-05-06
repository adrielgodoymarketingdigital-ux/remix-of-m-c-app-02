import { LayoutOSConfig } from "@/types/configuracao-loja";

interface PreviewA4Props {
  config: LayoutOSConfig;
  nomeLoja?: string;
  versao?: "padrao" | "tech";
}

export function PreviewA4({ config, nomeLoja = "Minha Loja", versao }: PreviewA4Props) {
  const v = versao ?? config.versao_layout_a4 ?? "padrao";
  const accent = config.cor_primaria && config.cor_primaria !== "#000000" ? config.cor_primaria : "#1e293b";

  const s = {
    // escala: A4 real = 194mm wide, preview = ~194px wide => fator ~1
    // mas usamos fonte ~6px para simular 9pt em escala reduzida
    wrap: {
      width: 194,
      background: "white",
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: 6.5,
      color: "#000",
      lineHeight: 1.35,
      padding: 4,
      boxSizing: "border-box" as const,
      overflow: "hidden",
    },
  };

  if (v === "tech") {
    return (
      <div style={s.wrap}>
        {/* Header tech — fundo escuro */}
        <div style={{ borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
          <div style={{ background: accent, padding: "4px 6px", display: "flex", alignItems: "center", gap: 4 }}>
            {config.mostrar_logo_impressao && (
              <div style={{ width: 14, height: 14, background: "rgba(255,255,255,0.2)", borderRadius: 1, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 4, color: "white" }}>
                L
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ color: "white", fontWeight: 800, fontSize: 7, letterSpacing: 0.4 }}>ORDEM DE SERVIÇO</div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 5.5, fontWeight: 600 }}>#0001</div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 5 }}>01/05/2026</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.18)", color: "white", borderRadius: 10, padding: "1px 4px", fontSize: 4.5, fontWeight: 700 }}>ABERTA</div>
          </div>
          <div style={{ background: "#f1f5f9", borderTop: "0.5px solid #e2e8f0", padding: "2px 6px", display: "flex", justifyContent: "space-between", fontSize: 5, color: "#475569" }}>
            <strong style={{ color: "#1e293b" }}>{nomeLoja}</strong>
            <span>CNPJ: 00.000.000/0001-00</span>
          </div>
        </div>

        {/* Cliente + Dispositivo */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginBottom: 3 }}>
          {["Cliente", "Dispositivo"].map((label) => (
            <div key={label} style={{ border: "0.5px solid #e2e8f0", borderLeft: `2px solid ${accent}`, borderRadius: 1, padding: "2px 3px" }}>
              <div style={{ fontSize: 5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 1 }}>{label}</div>
              <div style={{ color: "#1e293b" }}>João Silva</div>
              <div style={{ color: "#64748b", fontSize: 5.5 }}>iPhone 14 Pro</div>
            </div>
          ))}
        </div>

        {/* Defeito + Valor */}
        <div style={{ display: "grid", gridTemplateColumns: "7fr 3fr", gap: 3, marginBottom: 3 }}>
          <div style={{ border: "0.5px solid #e2e8f0", borderLeft: `2px solid ${accent}`, borderRadius: 1, padding: "2px 3px" }}>
            <div style={{ fontSize: 5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 1 }}>Defeito Relatado</div>
            <div style={{ color: "#1e293b" }}>Tela quebrada, não liga</div>
          </div>
          <div style={{ border: "0.5px solid #bbf7d0", borderRadius: 1, background: "#f0fdf4", padding: "2px 3px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 4.5, fontWeight: 600, color: "#16a34a" }}>TOTAL</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#15803d" }}>R$250</div>
          </div>
        </div>

        {/* Seções opcionais */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(55px, 1fr))", gap: 3, marginBottom: 3 }}>
          {config.mostrar_senha && (
            <div style={{ border: "0.5px solid #e2e8f0", borderLeft: `2px solid ${accent}`, borderRadius: 1, padding: "2px 3px" }}>
              <div style={{ fontSize: 5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Senha</div>
              <div style={{ fontFamily: "monospace", color: "#1e293b" }}>1234</div>
            </div>
          )}
          {config.mostrar_checklist && (
            <div style={{ border: "0.5px solid #e2e8f0", borderLeft: `2px solid ${accent}`, borderRadius: 1, padding: "2px 3px" }}>
              <div style={{ fontSize: 5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 1 }}>Checklist</div>
              <div style={{ fontSize: 5.5, color: "#16a34a" }}>✓ Tela</div>
              <div style={{ fontSize: 5.5, color: "#dc2626" }}>✗ Bateria</div>
            </div>
          )}
          {config.mostrar_avarias && (
            <div style={{ border: "0.5px solid #e2e8f0", borderLeft: `2px solid ${accent}`, borderRadius: 1, padding: "2px 3px" }}>
              <div style={{ fontSize: 5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 1 }}>Avarias</div>
              <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                <div style={{ width: 12, height: 20, background: "#f1f5f9", border: "0.5px solid #cbd5e1", borderRadius: 1 }} />
                <div style={{ width: 12, height: 20, background: "#f1f5f9", border: "0.5px solid #cbd5e1", borderRadius: 1 }} />
              </div>
            </div>
          )}
        </div>

        {/* Termo */}
        {config.mostrar_termos_condicoes && (
          <div style={{ border: "0.5px solid #e2e8f0", borderLeft: "2px solid #94a3b8", borderRadius: 1, background: "#f8fafc", padding: "2px 3px", marginBottom: 3 }}>
            <div style={{ fontSize: 5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 1 }}>Garantia</div>
            <div style={{ fontSize: 4.5, color: "#64748b" }}>90 dias conforme CDC.</div>
          </div>
        )}

        {/* Assinaturas */}
        {config.mostrar_assinaturas && (
          <div style={{ borderTop: "0.5px solid #e2e8f0", paddingTop: 3, display: "flex", justifyContent: "space-around", gap: 4 }}>
            {["Entrada", "Saída"].map((l) => (
              <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 40 }}>
                <div style={{ borderBottom: "0.5px solid #334155", width: "100%", height: 8, marginBottom: 1 }} />
                <div style={{ fontSize: 4.5, color: "#9ca3af" }}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Versão PADRÃO — preto e branco, bordas sólidas pretas
  return (
    <div style={s.wrap}>
      {/* Header padrão */}
      <div style={{ borderBottom: "1.5px solid #000", paddingBottom: 3, marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 2 }}>
          {config.mostrar_logo_impressao && (
            <div style={{ width: 14, height: 14, background: "#eee", border: "0.5px solid #ccc", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 4, color: "#555" }}>
              L
            </div>
          )}
          <div>
            <div style={{ fontWeight: 900, fontSize: 8, letterSpacing: 0.4 }}>ORDEM DE SERVIÇO</div>
            <div style={{ fontWeight: 800, fontSize: 6 }}>#0001</div>
            <div style={{ fontSize: 5, color: "#555" }}>01/05/2026 · ABERTA</div>
          </div>
        </div>
        <div style={{ background: "#f5f5f5", padding: "1px 2px", fontSize: 5, color: "#333" }}>
          <strong>{nomeLoja}</strong> · CNPJ: 00.000.000/0001-00
        </div>
      </div>

      {/* Cliente + Dispositivo */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginBottom: 3 }}>
        {["Cliente", "Dispositivo"].map((label) => (
          <div key={label} style={{ border: "1px solid #000", borderLeft: "3px solid #000", borderRadius: 1, padding: "2px 3px" }}>
            <div style={{ fontWeight: 800, fontSize: 5.5, textTransform: "uppercase", marginBottom: 1 }}>{label}</div>
            <div>João Silva</div>
            <div style={{ color: "#333", fontSize: 5.5 }}>iPhone 14 Pro</div>
          </div>
        ))}
      </div>

      {/* Defeito + Valor */}
      <div style={{ display: "grid", gridTemplateColumns: "7fr 3fr", gap: 3, marginBottom: 3 }}>
        <div style={{ border: "1px solid #000", borderLeft: "3px solid #000", borderRadius: 1, padding: "2px 3px" }}>
          <div style={{ fontWeight: 800, fontSize: 5.5, textTransform: "uppercase", marginBottom: 1 }}>Defeito Relatado</div>
          <div>Tela quebrada, não liga</div>
        </div>
        <div style={{ border: "1px solid #000", borderLeft: "3px solid #000", borderRadius: 1, padding: "2px 3px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 4.5, fontWeight: 700 }}>TOTAL</div>
          <div style={{ fontSize: 10, fontWeight: 900 }}>R$250</div>
        </div>
      </div>

      {/* Seções opcionais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(55px, 1fr))", gap: 3, marginBottom: 3 }}>
        {config.mostrar_senha && (
          <div style={{ border: "1px solid #000", borderLeft: "3px solid #000", borderRadius: 1, padding: "2px 3px" }}>
            <div style={{ fontWeight: 800, fontSize: 5.5, textTransform: "uppercase" }}>Senha</div>
            <div style={{ fontFamily: "monospace", fontWeight: 900 }}>1234</div>
          </div>
        )}
        {config.mostrar_checklist && (
          <div style={{ border: "1px solid #000", borderLeft: "3px solid #000", borderRadius: 1, padding: "2px 3px" }}>
            <div style={{ fontWeight: 800, fontSize: 5.5, textTransform: "uppercase", marginBottom: 1 }}>Checklist</div>
            <div style={{ fontSize: 5.5 }}>✓ Tela &nbsp; ✗ Bateria</div>
          </div>
        )}
        {config.mostrar_avarias && (
          <div style={{ border: "1px solid #000", borderLeft: "3px solid #000", borderRadius: 1, padding: "2px 3px" }}>
            <div style={{ fontWeight: 800, fontSize: 5.5, textTransform: "uppercase", marginBottom: 1 }}>Avarias</div>
            <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
              <div style={{ width: 12, height: 20, background: "#eee", border: "0.5px solid #999", borderRadius: 1 }} />
              <div style={{ width: 12, height: 20, background: "#eee", border: "0.5px solid #999", borderRadius: 1 }} />
            </div>
          </div>
        )}
      </div>

      {/* Termo */}
      {config.mostrar_termos_condicoes && (
        <div style={{ border: "0.5px solid #ccc", borderLeft: "3px solid #666", borderRadius: 1, background: "#fafafa", padding: "2px 3px", marginBottom: 3, fontSize: 4.5, color: "#444" }}>
          <strong>Garantia:</strong> 90 dias conforme CDC.
        </div>
      )}

      {/* Assinaturas */}
      {config.mostrar_assinaturas && (
        <div style={{ borderTop: "1px solid #000", paddingTop: 3, display: "flex", justifyContent: "space-around", gap: 4 }}>
          {["Entrada", "Saída"].map((l) => (
            <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 40 }}>
              <div style={{ borderBottom: "0.5px solid #000", width: "100%", height: 8, marginBottom: 1 }} />
              <div style={{ fontSize: 4.5, color: "#666" }}>{l}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

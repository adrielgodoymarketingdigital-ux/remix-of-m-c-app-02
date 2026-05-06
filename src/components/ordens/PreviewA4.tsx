import { LayoutOSConfig } from "@/types/configuracao-loja";

interface PreviewA4Props {
  config: LayoutOSConfig;
  nomeLoja?: string;
  versao?: "padrao" | "tech";
}

export function PreviewA4({ config, nomeLoja = "Minha Loja", versao }: PreviewA4Props) {
  const v = versao ?? config.versao_layout_a4 ?? "padrao";
  const accent = config.cor_primaria && config.cor_primaria !== "#000000" ? config.cor_primaria : "#1e293b";

  if (v === "tech") {
    return (
      <div className="border rounded-lg bg-white overflow-hidden shadow-sm" style={{ width: "210px", fontFamily: "system-ui, sans-serif" }}>
        <div className="bg-muted/50 px-2 py-1 text-[9px] text-muted-foreground text-center font-medium border-b">
          Preview A4 · Personalizado
        </div>
        <div className="p-2 space-y-1.5" style={{ fontSize: "6.5px", color: "#111" }}>
          {/* Header escuro */}
          <div className="rounded px-2 py-1.5 flex items-center gap-2" style={{ background: accent }}>
            {config.mostrar_logo_impressao && (
              <div className="rounded flex items-center justify-center flex-shrink-0" style={{ width: 20, height: 20, background: "rgba(255,255,255,0.25)", fontSize: 5, color: "white" }}>
                LOGO
              </div>
            )}
            <div style={{ color: "white" }}>
              <div style={{ fontWeight: 800, fontSize: 8, letterSpacing: 0.5 }}>ORDEM DE SERVIÇO</div>
              <div style={{ fontSize: 6, opacity: 0.85 }}>#0001 · {nomeLoja}</div>
            </div>
            <div className="ml-auto rounded-full px-1" style={{ background: "rgba(255,255,255,0.2)", color: "white", fontSize: 5, fontWeight: 700 }}>
              ABERTA
            </div>
          </div>

          {/* Cliente + Dispositivo */}
          <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {["Cliente", "Dispositivo"].map((label) => (
              <div key={label} className="rounded p-1" style={{ border: "1px solid #e2e8f0", borderLeft: `2px solid ${accent}` }}>
                <div style={{ fontWeight: 700, fontSize: 6, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                <div style={{ color: "#374151" }}>João Silva</div>
                <div style={{ color: "#9ca3af" }}>iPhone 14 Pro</div>
              </div>
            ))}
          </div>

          {/* Defeito + Valor */}
          <div className="grid gap-1" style={{ gridTemplateColumns: "7fr 3fr" }}>
            <div className="rounded p-1" style={{ border: "1px solid #e2e8f0", borderLeft: `2px solid ${accent}` }}>
              <div style={{ fontWeight: 700, fontSize: 6, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>Defeito</div>
              <div style={{ color: "#374151" }}>Tela quebrada</div>
            </div>
            <div className="rounded p-1 flex flex-col items-center justify-center" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: 5, fontWeight: 600, color: "#16a34a" }}>TOTAL</div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#15803d" }}>R$250</div>
            </div>
          </div>

          {/* Seções opcionais */}
          {config.mostrar_senha && (
            <div className="rounded p-1" style={{ border: "1px solid #e2e8f0", borderLeft: `2px solid ${accent}` }}>
              <div style={{ fontWeight: 700, fontSize: 6, color: "#6b7280", textTransform: "uppercase" }}>Senha</div>
              <div style={{ fontFamily: "monospace", color: "#374151" }}>1234</div>
            </div>
          )}
          {config.mostrar_checklist && (
            <div className="rounded p-1" style={{ border: "1px solid #e2e8f0", borderLeft: `2px solid ${accent}` }}>
              <div style={{ fontWeight: 700, fontSize: 6, color: "#6b7280", textTransform: "uppercase" }}>Checklist</div>
              <div style={{ color: "#16a34a" }}>✓ Tela</div>
            </div>
          )}
          {config.mostrar_termos_condicoes && (
            <div className="rounded p-1" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: `2px solid #94a3b8` }}>
              <div style={{ fontWeight: 700, fontSize: 6, color: "#64748b" }}>Garantia</div>
              <div style={{ fontSize: 5, color: "#64748b" }}>90 dias conforme CDC.</div>
            </div>
          )}
          {config.mostrar_assinaturas && (
            <div className="pt-1" style={{ borderTop: "1px solid #e2e8f0" }}>
              <div className="flex gap-3 justify-around">
                {["Entrada", "Saída"].map((l) => (
                  <div key={l} className="flex flex-col items-center" style={{ minWidth: 50 }}>
                    <div style={{ borderBottom: "1px solid #334155", width: "100%", height: 10, marginBottom: 1 }} />
                    <div style={{ fontSize: 5, color: "#9ca3af" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Versão padrão
  return (
    <div className="border rounded-lg bg-white overflow-hidden shadow-sm" style={{ width: "210px", fontFamily: "system-ui, sans-serif" }}>
      <div className="bg-muted/50 px-2 py-1 text-[9px] text-muted-foreground text-center font-medium border-b">
        Preview A4 · Padrão
      </div>
      <div className="p-2 space-y-1.5" style={{ fontSize: "6.5px", color: "#000" }}>
        {/* Header padrão */}
        <div style={{ borderBottom: "1.5px solid #000", paddingBottom: 4, marginBottom: 4 }}>
          <div className="flex items-center gap-2">
            {config.mostrar_logo_impressao && (
              <div className="flex items-center justify-center" style={{ width: 20, height: 20, background: "#eee", fontSize: 5, color: "#555" }}>
                LOGO
              </div>
            )}
            <div>
              <div style={{ fontWeight: 900, fontSize: 8, letterSpacing: 0.5 }}>ORDEM DE SERVIÇO</div>
              <div style={{ fontWeight: 700, fontSize: 6 }}>#0001</div>
              <div style={{ fontSize: 5, color: "#555" }}>{nomeLoja}</div>
            </div>
          </div>
          <div style={{ marginTop: 3, padding: "1px 2px", background: "#f5f5f5", fontSize: 5.5, color: "#333" }}>
            <strong>{nomeLoja}</strong> · CNPJ: 00.000.000/0001-00
          </div>
        </div>

        {/* Cliente + Dispositivo */}
        <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {["Cliente", "Dispositivo"].map((label) => (
            <div key={label} style={{ border: "1px solid #000", padding: 2 }}>
              <div style={{ fontWeight: 800, fontSize: 6, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
              <div>João Silva</div>
              <div style={{ color: "#333" }}>iPhone 14 Pro</div>
            </div>
          ))}
        </div>

        {/* Defeito + Valor */}
        <div className="grid gap-1" style={{ gridTemplateColumns: "7fr 3fr" }}>
          <div style={{ border: "1px solid #000", padding: 2 }}>
            <div style={{ fontWeight: 800, fontSize: 6, textTransform: "uppercase", marginBottom: 2 }}>Defeito Relatado</div>
            <div>Tela quebrada, não liga</div>
          </div>
          <div className="flex flex-col items-center justify-center" style={{ border: "1px solid #000", padding: 2 }}>
            <div style={{ fontSize: 5, fontWeight: 700 }}>TOTAL</div>
            <div style={{ fontSize: 10, fontWeight: 900 }}>R$250</div>
          </div>
        </div>

        {/* Seções opcionais */}
        {config.mostrar_senha && (
          <div style={{ border: "1px solid #000", padding: 2 }}>
            <div style={{ fontWeight: 800, fontSize: 6, textTransform: "uppercase" }}>Senha</div>
            <div style={{ fontFamily: "monospace", fontWeight: 900 }}>1234</div>
          </div>
        )}
        {config.mostrar_checklist && (
          <div style={{ border: "1px solid #000", padding: 2 }}>
            <div style={{ fontWeight: 800, fontSize: 6, textTransform: "uppercase" }}>Checklist</div>
            <div>✓ Tela &nbsp; ✗ Bateria</div>
          </div>
        )}
        {config.mostrar_termos_condicoes && (
          <div style={{ border: "0.5px solid #ccc", padding: 2, background: "#fafafa", fontSize: 5, color: "#444" }}>
            <strong>Garantia:</strong> 90 dias conforme CDC.
          </div>
        )}
        {config.mostrar_assinaturas && (
          <div style={{ borderTop: "1px solid #000", paddingTop: 3 }}>
            <div className="flex gap-3 justify-around">
              {["Entrada", "Saída"].map((l) => (
                <div key={l} className="flex flex-col items-center" style={{ minWidth: 50 }}>
                  <div style={{ borderBottom: "0.5px solid #000", width: "100%", height: 10, marginBottom: 1 }} />
                  <div style={{ fontSize: 5, color: "#666" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { LayoutOSConfig } from "@/types/configuracao-loja";

interface PreviewA4Props {
  config: LayoutOSConfig;
  nomeLoja?: string;
}

export function PreviewA4({ config, nomeLoja = "Minha Loja" }: PreviewA4Props) {
  const accent = config.cor_primaria || "#2563eb";

  return (
    <div
      className="border rounded-lg bg-white overflow-hidden shadow-sm"
      style={{ width: "210px", fontFamily: "system-ui, sans-serif" }}
    >
      <div className="bg-muted/50 px-2 py-1 text-[9px] text-muted-foreground text-center font-medium border-b">
        Preview A4
      </div>

      <div className="p-2 space-y-1.5" style={{ fontSize: "6.5px", color: "#111" }}>
        {/* Header */}
        <div
          className="rounded px-2 py-1.5 flex items-center gap-2"
          style={{ background: accent }}
        >
          {config.mostrar_logo_impressao && (
            <div
              className="rounded flex items-center justify-center flex-shrink-0"
              style={{ width: 20, height: 20, background: "rgba(255,255,255,0.25)", fontSize: 5, color: "white" }}
            >
              LOGO
            </div>
          )}
          <div style={{ color: "white" }}>
            <div style={{ fontWeight: 800, fontSize: 8, letterSpacing: 0.5 }}>ORDEM DE SERVIÇO</div>
            <div style={{ fontSize: 6, opacity: 0.85 }}>#0001 · {nomeLoja}</div>
          </div>
          <div
            className="ml-auto rounded-full px-1 flex items-center"
            style={{ background: "rgba(255,255,255,0.2)", color: "white", fontSize: 5, fontWeight: 700 }}
          >
            ABERTA
          </div>
        </div>

        {/* Cliente + Dispositivo */}
        <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="border rounded p-1" style={{ borderColor: "#e5e7eb" }}>
            <div style={{ fontWeight: 700, fontSize: 6, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>
              Cliente
            </div>
            <div style={{ color: "#374151" }}>João Silva</div>
            <div style={{ color: "#9ca3af" }}>Tel: (11) 99999-0000</div>
            <div style={{ color: "#9ca3af" }}>CPF: 000.000.000-00</div>
          </div>
          <div className="border rounded p-1" style={{ borderColor: "#e5e7eb" }}>
            <div style={{ fontWeight: 700, fontSize: 6, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>
              Dispositivo
            </div>
            <div style={{ color: "#374151" }}>iPhone 14 Pro</div>
            <div style={{ color: "#9ca3af" }}>IMEI: 000000…</div>
            <div style={{ color: "#9ca3af" }}>Preto</div>
          </div>
        </div>

        {/* Defeito + Valor */}
        <div className="grid gap-1" style={{ gridTemplateColumns: "7fr 3fr" }}>
          <div className="border rounded p-1" style={{ borderColor: "#e5e7eb" }}>
            <div style={{ fontWeight: 700, fontSize: 6, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>
              Defeito Relatado
            </div>
            <div style={{ color: "#374151" }}>Tela quebrada, não liga</div>
          </div>
          <div
            className="rounded p-1 flex flex-col items-center justify-center"
            style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
          >
            <div style={{ fontSize: 5, fontWeight: 600, color: "#16a34a", marginBottom: 1 }}>TOTAL</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#15803d" }}>R$250</div>
          </div>
        </div>

        {/* Serviços */}
        <div className="border rounded p-1" style={{ borderColor: "#e5e7eb" }}>
          <div style={{ fontWeight: 700, fontSize: 6, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>
            Itens do Serviço
          </div>
          <div className="flex justify-between" style={{ color: "#374151" }}>
            <span>• Troca de tela</span>
            <span style={{ fontWeight: 600 }}>R$ 250,00</span>
          </div>
        </div>

        {/* Seções opcionais */}
        {config.mostrar_senha && (
          <div className="border rounded p-1" style={{ borderColor: "#e5e7eb" }}>
            <div style={{ fontWeight: 700, fontSize: 6, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>
              Senha
            </div>
            <div style={{ fontFamily: "monospace", color: "#374151" }}>1234</div>
          </div>
        )}

        {config.mostrar_checklist && (
          <div className="border rounded p-1" style={{ borderColor: "#e5e7eb" }}>
            <div style={{ fontWeight: 700, fontSize: 6, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>
              Checklist de Entrada
            </div>
            <div style={{ color: "#16a34a" }}>✓ Tela &nbsp;</div>
            <div style={{ color: "#dc2626" }}>✗ Bateria</div>
          </div>
        )}

        {config.mostrar_avarias && (
          <div className="border rounded p-1 text-center" style={{ borderColor: "#e5e7eb", color: "#9ca3af" }}>
            <div style={{ fontWeight: 700, fontSize: 6, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>
              Avarias Visuais
            </div>
            <div style={{ fontSize: 5 }}>[Silhueta do dispositivo]</div>
          </div>
        )}

        {config.mostrar_termos_condicoes && (
          <div className="rounded p-1" style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#6b7280" }}>
            <div style={{ fontWeight: 700, fontSize: 6, marginBottom: 1 }}>Termo de Garantia</div>
            <div style={{ fontSize: 5 }}>Garantia de 90 dias para o serviço realizado conforme CDC.</div>
          </div>
        )}

        {config.mostrar_assinaturas && (
          <div className="pt-1" style={{ borderTop: "1px solid #e5e7eb" }}>
            <div className="flex gap-3 justify-around">
              <div className="flex flex-col items-center" style={{ minWidth: 50 }}>
                <div style={{ borderBottom: "1px solid #374151", width: "100%", height: 10, marginBottom: 1 }} />
                <div style={{ fontSize: 5, color: "#9ca3af" }}>Entrada</div>
              </div>
              <div className="flex flex-col items-center" style={{ minWidth: 50 }}>
                <div style={{ borderBottom: "1px solid #374151", width: "100%", height: 10, marginBottom: 1 }} />
                <div style={{ fontSize: 5, color: "#9ca3af" }}>Saída</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

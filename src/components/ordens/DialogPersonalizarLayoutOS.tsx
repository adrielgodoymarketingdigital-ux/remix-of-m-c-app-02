import { useState, useRef, useCallback } from "react";
import {
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  Minus,
  Plus,
  Monitor,
  Layers,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { SecaoOSConfig, SecaoOSId, LayoutOSConfig } from "@/types/configuracao-loja";

// ─── Seções disponíveis (ordem e rótulos) ───────────────────────────────────

export const SECOES_PADRAO: SecaoOSConfig[] = [
  { id: "cabecalho",               visivel: true,  ordem: 0,  tamanho_fonte: 100, altura_extra: 0 },
  { id: "dados_loja",              visivel: true,  ordem: 1,  tamanho_fonte: 100, altura_extra: 0 },
  { id: "cliente_dispositivo",     visivel: true,  ordem: 2,  tamanho_fonte: 100, altura_extra: 0 },
  { id: "defeito_valor",           visivel: true,  ordem: 3,  tamanho_fonte: 100, altura_extra: 0 },
  { id: "servicos",                visivel: true,  ordem: 4,  tamanho_fonte: 100, altura_extra: 0 },
  { id: "custos_adicionais",       visivel: true,  ordem: 5,  tamanho_fonte: 100, altura_extra: 0 },
  { id: "forma_pagamento",         visivel: true,  ordem: 6,  tamanho_fonte: 100, altura_extra: 0 },
  { id: "checklist_senha_avarias", visivel: true,  ordem: 7,  tamanho_fonte: 100, altura_extra: 0 },
  { id: "termos",                  visivel: true,  ordem: 8,  tamanho_fonte: 100, altura_extra: 0 },
  { id: "assinaturas",             visivel: true,  ordem: 9,  tamanho_fonte: 100, altura_extra: 0 },
];

const LABELS: Record<SecaoOSId, string> = {
  cabecalho:               "Cabeçalho (Título + Número OS)",
  dados_loja:              "Dados da Loja",
  cliente_dispositivo:     "Cliente & Dispositivo",
  defeito_valor:           "Defeito Relatado + Valor",
  servicos:                "Serviços Realizados",
  custos_adicionais:       "Custos Adicionais",
  forma_pagamento:         "Forma de Pagamento",
  checklist_senha_avarias: "Checklist / Senha / Avarias",
  termos:                  "Termo de Garantia",
  assinaturas:             "Assinaturas",
};

const ICONES: Record<SecaoOSId, string> = {
  cabecalho:               "📋",
  dados_loja:              "🏪",
  cliente_dispositivo:     "👤📱",
  defeito_valor:           "🔧💰",
  servicos:                "⚙️",
  custos_adicionais:       "📦",
  forma_pagamento:         "💳",
  checklist_senha_avarias: "✅🔒",
  termos:                  "📜",
  assinaturas:             "✍️",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface DialogPersonalizarLayoutOSProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layoutConfig: LayoutOSConfig;
  onSalvar: (secoes: SecaoOSConfig[], corSecundaria?: string) => void;
}

// ─── Preview miniaturizado A4 ────────────────────────────────────────────────

function PreviewA4({ secoes, corPrimaria }: { secoes: SecaoOSConfig[]; corPrimaria: string }) {
  const visiveis = [...secoes].filter((s) => s.visivel).sort((a, b) => a.ordem - b.ordem);

  return (
    <div
      className="bg-white border border-gray-300 shadow-lg rounded"
      style={{ width: 160, minHeight: 226, padding: 6, fontFamily: "sans-serif" }}
    >
      {visiveis.map((s) => {
        const fontScale = (s.tamanho_fonte ?? 100) / 100;
        const extraPad = (s.altura_extra ?? 0) * 0.4;
        return (
          <div
            key={s.id}
            style={{
              fontSize: 4 * fontScale,
              paddingTop: 2 + extraPad,
              paddingBottom: 2 + extraPad,
              paddingLeft: 3,
              paddingRight: 3,
              marginBottom: 2,
              borderLeft: `2px solid ${corPrimaria}`,
              background: "#f9f9f9",
              borderRadius: 1,
              lineHeight: 1.3,
              color: "#222",
              overflow: "hidden",
            }}
          >
            <span style={{ marginRight: 2 }}>{ICONES[s.id]}</span>
            {LABELS[s.id]}
          </div>
        );
      })}
      {visiveis.length === 0 && (
        <div style={{ fontSize: 5, color: "#aaa", textAlign: "center", marginTop: 20 }}>
          Nenhuma seção visível
        </div>
      )}
    </div>
  );
}

// ─── Item da lista (drag handle + controles) ─────────────────────────────────

interface SecaoItemProps {
  secao: SecaoOSConfig;
  index: number;
  total: number;
  onChange: (updated: SecaoOSConfig) => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
  dragging: boolean;
  dragOver: boolean;
}

function SecaoItem({
  secao,
  onChange,
  onDragStart,
  onDragOver,
  onDrop,
  dragging,
  dragOver,
}: SecaoItemProps) {
  const handleFonteChange = (delta: number) => {
    const atual = secao.tamanho_fonte ?? 100;
    const novo = Math.min(160, Math.max(60, atual + delta));
    onChange({ ...secao, tamanho_fonte: novo });
  };

  const handleAlturaChange = (delta: number) => {
    const atual = secao.altura_extra ?? 0;
    const novo = Math.min(20, Math.max(0, atual + delta));
    onChange({ ...secao, altura_extra: novo });
  };

  return (
    <div
      draggable
      onDragStart={() => onDragStart(secao.ordem)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(secao.ordem); }}
      onDrop={onDrop}
      className={[
        "flex items-start gap-2 rounded-lg border p-2 transition-all select-none",
        dragging ? "opacity-40 scale-95" : "",
        dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border bg-card",
        !secao.visivel ? "opacity-50" : "",
      ].join(" ")}
    >
      {/* Drag handle */}
      <div className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Icon + label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none">{ICONES[secao.id]}</span>
          <span className="text-sm font-medium truncate">{LABELS[secao.id]}</span>
          {!secao.visivel && (
            <Badge variant="outline" className="text-[10px] py-0 px-1 ml-1">oculto</Badge>
          )}
        </div>

        {/* Controls - only when visible */}
        {secao.visivel && (
          <div className="flex flex-wrap gap-3 mt-1.5">
            {/* Font size */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground w-10">Fonte</span>
              <button
                onClick={() => handleFonteChange(-10)}
                className="h-5 w-5 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted"
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <span className="text-[10px] font-mono w-8 text-center">
                {secao.tamanho_fonte ?? 100}%
              </span>
              <button
                onClick={() => handleFonteChange(10)}
                className="h-5 w-5 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted"
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
            </div>

            {/* Padding extra */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground w-10">Espaço</span>
              <button
                onClick={() => handleAlturaChange(-1)}
                className="h-5 w-5 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted"
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <span className="text-[10px] font-mono w-8 text-center">
                +{secao.altura_extra ?? 0}mm
              </span>
              <button
                onClick={() => handleAlturaChange(1)}
                className="h-5 w-5 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted"
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toggle visibility */}
      <button
        onClick={() => onChange({ ...secao, visivel: !secao.visivel })}
        className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
        title={secao.visivel ? "Ocultar seção" : "Mostrar seção"}
      >
        {secao.visivel ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ─── Dialog principal ─────────────────────────────────────────────────────────

export function DialogPersonalizarLayoutOS({
  open,
  onOpenChange,
  layoutConfig,
  onSalvar,
}: DialogPersonalizarLayoutOSProps) {
  const iniciarSecoes = useCallback((): SecaoOSConfig[] => {
    const existentes = layoutConfig.secoes_personalizadas;
    if (existentes && existentes.length > 0) {
      // Garantir que todas as seções padrão existam
      const ids = existentes.map((s) => s.id);
      const faltando = SECOES_PADRAO.filter((s) => !ids.includes(s.id));
      return [...existentes, ...faltando.map((s) => ({ ...s, ordem: existentes.length + s.ordem }))];
    }
    return SECOES_PADRAO.map((s) => ({ ...s }));
  }, [layoutConfig.secoes_personalizadas]);

  const [secoes, setSecoes] = useState<SecaoOSConfig[]>(iniciarSecoes);
  const [corSecundaria, setCorSecundaria] = useState(layoutConfig.cor_secundaria ?? "#1a73e8");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Reset ao abrir
  const prevOpen = useRef(false);
  if (open && !prevOpen.current) {
    prevOpen.current = true;
    setSecoes(iniciarSecoes());
    setCorSecundaria(layoutConfig.cor_secundaria ?? "#1a73e8");
  }
  if (!open && prevOpen.current) {
    prevOpen.current = false;
  }

  const secoesOrdenadas = [...secoes].sort((a, b) => a.ordem - b.ordem);

  const handleDrop = () => {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }

    setSecoes((prev) => {
      const sorted = [...prev].sort((a, b) => a.ordem - b.ordem);
      const fromIdx = sorted.findIndex((s) => s.ordem === dragIdx);
      const toIdx = sorted.findIndex((s) => s.ordem === dragOverIdx);
      const [moved] = sorted.splice(fromIdx, 1);
      sorted.splice(toIdx, 0, moved);
      return sorted.map((s, i) => ({ ...s, ordem: i }));
    });

    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleChange = (updated: SecaoOSConfig) => {
    setSecoes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleResetar = () => {
    setSecoes(SECOES_PADRAO.map((s) => ({ ...s })));
    setCorSecundaria("#1a73e8");
  };

  const handleSalvar = () => {
    onSalvar(secoes, corSecundaria);
    onOpenChange(false);
    toast.success("Layout personalizado salvo!");
  };

  const corPrimaria = layoutConfig.cor_primaria ?? "#000000";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Personalizar Layout da OS
          </DialogTitle>
          <DialogDescription>
            Arraste as seções para reordenar, mostre/oculte, ajuste fonte e espaçamento. O preview
            ao lado reflete as mudanças em tempo real.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="secoes">
          <TabsList className="mb-4">
            <TabsTrigger value="secoes" className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Seções
            </TabsTrigger>
            <TabsTrigger value="cores" className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" />
              Cores
            </TabsTrigger>
          </TabsList>

          {/* ── Aba Seções ── */}
          <TabsContent value="secoes">
            <div className="flex gap-6">
              {/* Lista de seções */}
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Arraste para reordenar · clique no olho para ocultar
                  </span>
                </div>

                {secoesOrdenadas.map((secao, idx) => (
                  <SecaoItem
                    key={secao.id}
                    secao={secao}
                    index={idx}
                    total={secoesOrdenadas.length}
                    onChange={handleChange}
                    onDragStart={setDragIdx}
                    onDragOver={setDragOverIdx}
                    onDrop={handleDrop}
                    dragging={dragIdx === secao.ordem}
                    dragOver={dragOverIdx === secao.ordem}
                  />
                ))}
              </div>

              {/* Preview A4 */}
              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Monitor className="h-3.5 w-3.5" />
                  Preview
                </div>
                <PreviewA4 secoes={secoesOrdenadas} corPrimaria={corPrimaria} />
                <span className="text-[10px] text-muted-foreground">A4 (miniatura)</span>
              </div>
            </div>
          </TabsContent>

          {/* ── Aba Cores ── */}
          <TabsContent value="cores">
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Cor de destaque / acento</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Usada nas bordas e cabeçalhos das seções no preview e na impressão
                  </p>
                </div>
                <input
                  type="color"
                  value={corSecundaria}
                  onChange={(e) => setCorSecundaria(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
              </div>

              <Separator />

              <div className="rounded-lg border p-3 bg-muted/30">
                <div className="text-xs font-medium mb-2">Pré-visualização das cores</div>
                <div className="flex gap-3">
                  <div
                    className="flex-1 rounded p-2 text-xs text-white"
                    style={{ background: corPrimaria }}
                  >
                    Cor primária
                  </div>
                  <div
                    className="flex-1 rounded p-2 text-xs text-white"
                    style={{ background: corSecundaria }}
                  >
                    Cor de acento
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Separator className="my-2" />

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleResetar} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Resetar padrão
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              Salvar layout
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

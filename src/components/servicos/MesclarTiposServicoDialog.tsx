import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { GrupoTiposSimilares } from "@/hooks/useTiposServico";

interface UsoDetalhe {
  servicos: number;
  ordensServico: number;
  configs: number;
}

interface MesclarTiposServicoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grupos: GrupoTiposSimilares[];
  onConfirm: (merges: { sobreviventeId: string; duplicadosIds: string[] }[]) => Promise<void>;
}

const fmtData = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
};

export function MesclarTiposServicoDialog({ open, onOpenChange, grupos, onConfirm }: MesclarTiposServicoDialogProps) {
  // sobrevivente escolhido por chave de grupo — default: o mais antigo
  const [sobreviventes, setSobreviventes] = useState<Record<string, string>>({});
  const [uso, setUso] = useState<Record<string, UsoDetalhe>>({});
  const [carregandoUso, setCarregandoUso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const todosIds = useMemo(
    () => grupos.flatMap((g) => g.tipos.map((t) => t.id)),
    [grupos],
  );

  useEffect(() => {
    if (!open) return;
    setSobreviventes(
      Object.fromEntries(grupos.map((g) => [g.chave, g.tipos[0]?.id])),
    );
  }, [open, grupos]);

  useEffect(() => {
    if (!open || todosIds.length === 0) return;
    let cancelado = false;
    setCarregandoUso(true);
    (async () => {
      const entradas = await Promise.all(
        todosIds.map(async (id) => {
          const [{ count: s }, { count: os }, { count: c }] = await Promise.all([
            supabase.from("servicos").select("id", { count: "exact", head: true }).eq("tipo_servico_id", id),
            supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("tipo_servico_id", id),
            supabase.from("comissoes_tipo_servico").select("id", { count: "exact", head: true }).eq("tipo_servico_id", id),
          ]);
          return [id, { servicos: s || 0, ordensServico: os || 0, configs: c || 0 }] as const;
        }),
      );
      if (cancelado) return;
      setUso(Object.fromEntries(entradas));
      setCarregandoUso(false);
    })();
    return () => { cancelado = true; };
  }, [open, todosIds]);

  const handleConfirmar = async () => {
    const merges = grupos
      .map((g) => {
        const sobreviventeId = sobreviventes[g.chave] || g.tipos[0].id;
        const duplicadosIds = g.tipos.map((t) => t.id).filter((id) => id !== sobreviventeId);
        return { sobreviventeId, duplicadosIds };
      })
      .filter((m) => m.duplicadosIds.length > 0);
    if (merges.length === 0) return;
    setSalvando(true);
    try {
      await onConfirm(merges);
      onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  };

  const totalDuplicados = grupos.reduce((acc, g) => acc + Math.max(0, g.tipos.length - 1), 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mesclar tipos duplicados</DialogTitle>
          <DialogDescription>
            {grupos.length === 0
              ? "Nenhum grupo de tipos com nome equivalente foi encontrado."
              : `Foram encontrados ${grupos.length} grupo(s) de tipos com nome equivalente (ignorando maiúsculas/minúsculas e espaços). Escolha qual manter em cada grupo — os demais serão apagados e todos os vínculos (configurações de comissão, serviços do catálogo e ordens de serviço) passam para o escolhido.`}
          </DialogDescription>
        </DialogHeader>

        {grupos.length > 0 && (
          <>
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Esta ação é <strong>irreversível</strong> depois de confirmada. Confira o preview abaixo — nada é
                apagado até você clicar em "Confirmar mesclagem".
              </span>
            </div>

            <div className="max-h-[45vh] overflow-y-auto space-y-4 pr-1">
              {grupos.map((g) => {
                const sobreviventeId = sobreviventes[g.chave] || g.tipos[0].id;
                return (
                  <div key={g.chave} className="rounded-md border p-3 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Grupo: "{g.chave}" — {g.tipos.length} tipos
                    </p>
                    <RadioGroup
                      value={sobreviventeId}
                      onValueChange={(v) => setSobreviventes((prev) => ({ ...prev, [g.chave]: v }))}
                      className="space-y-1.5"
                    >
                      {g.tipos.map((t) => {
                        const u = uso[t.id];
                        const ehSobrevivente = t.id === sobreviventeId;
                        return (
                          <div key={t.id} className="flex items-start gap-2 rounded p-1.5 hover:bg-muted/50">
                            <RadioGroupItem value={t.id} id={`merge-${t.id}`} className="mt-1" />
                            <Label htmlFor={`merge-${t.id}`} className="flex-1 cursor-pointer font-normal">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{t.nome}</span>
                                {ehSobrevivente ? (
                                  <Badge variant="default" className="text-[10px]">manter</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">apagar</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">criado {fmtData(t.created_at)}</span>
                              </span>
                              <span className="block text-xs text-muted-foreground mt-0.5">
                                {carregandoUso || !u
                                  ? "carregando uso..."
                                  : `${u.configs} config. de comissão · ${u.servicos} serviço(s) · ${u.ordensServico} OS`}
                                {!ehSobrevivente && u && (u.configs + u.servicos + u.ordensServico > 0) && (
                                  <span className="text-foreground"> → serão transferidos para o tipo mantido</span>
                                )}
                              </span>
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          {grupos.length > 0 && (
            <Button onClick={handleConfirmar} disabled={salvando || carregandoUso || totalDuplicados === 0}>
              {salvando ? "Mesclando..." : `Confirmar mesclagem (${totalDuplicados} a apagar)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

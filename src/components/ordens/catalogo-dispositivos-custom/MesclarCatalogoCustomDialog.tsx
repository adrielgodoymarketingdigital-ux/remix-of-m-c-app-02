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
import type {
  GrupoCatalogoCustomSimilares,
  RegistroCatalogoCustom,
  UsoCatalogoCustom,
} from "@/hooks/useCatalogoDispositivosCustom";

interface MesclarCatalogoCustomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grupos: GrupoCatalogoCustomSimilares[];
  verificarUso: (registro: RegistroCatalogoCustom) => Promise<UsoCatalogoCustom>;
  onConfirm: (merges: { sobreviventeId: string; duplicadosIds: string[]; grupo: GrupoCatalogoCustomSimilares }[]) => Promise<void>;
}

const fmtData = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
};

/**
 * Preview de contagem obrigatório antes de confirmar: pra cada registro do
 * grupo, mostra quantas OS e quantos registros filhos custom usam aquele
 * nome — nada é apagado até o usuário revisar e clicar em "Confirmar".
 */
export function MesclarCatalogoCustomDialog({ open, onOpenChange, grupos, verificarUso, onConfirm }: MesclarCatalogoCustomDialogProps) {
  const [sobreviventes, setSobreviventes] = useState<Record<string, string>>({});
  const [uso, setUso] = useState<Record<string, UsoCatalogoCustom>>({});
  const [carregandoUso, setCarregandoUso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const todosRegistros = useMemo(() => grupos.flatMap((g) => g.registros), [grupos]);

  useEffect(() => {
    if (!open) return;
    setSobreviventes(Object.fromEntries(grupos.map((g) => [g.chave, g.registros[0]?.id])));
  }, [open, grupos]);

  useEffect(() => {
    if (!open || todosRegistros.length === 0) return;
    let cancelado = false;
    setCarregandoUso(true);
    (async () => {
      const entradas = await Promise.all(
        todosRegistros.map(async (r) => [r.id, await verificarUso(r)] as const),
      );
      if (cancelado) return;
      setUso(Object.fromEntries(entradas));
      setCarregandoUso(false);
    })();
    return () => { cancelado = true; };
  }, [open, todosRegistros, verificarUso]);

  const handleConfirmar = async () => {
    const merges = grupos
      .map((g) => {
        const sobreviventeId = sobreviventes[g.chave] || g.registros[0].id;
        const duplicadosIds = g.registros.map((r) => r.id).filter((id) => id !== sobreviventeId);
        return { sobreviventeId, duplicadosIds, grupo: g };
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

  const totalDuplicados = grupos.reduce((acc, g) => acc + Math.max(0, g.registros.length - 1), 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mesclar duplicados</DialogTitle>
          <DialogDescription>
            {grupos.length === 0
              ? "Nenhum grupo com nome equivalente foi encontrado."
              : `Foram encontrados ${grupos.length} grupo(s) com nome equivalente (ignorando maiúsculas/minúsculas e espaços). Escolha qual manter em cada grupo — os demais serão apagados e todos os vínculos (ordens de serviço e registros filhos) passam para o escolhido.`}
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
                const sobreviventeId = sobreviventes[g.chave] || g.registros[0].id;
                return (
                  <div key={g.chave} className="rounded-md border p-3 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Grupo: "{g.chave}" — {g.registros.length} registros
                    </p>
                    <RadioGroup
                      value={sobreviventeId}
                      onValueChange={(v) => setSobreviventes((prev) => ({ ...prev, [g.chave]: v }))}
                      className="space-y-1.5"
                    >
                      {g.registros.map((r) => {
                        const u = uso[r.id];
                        const ehSobrevivente = r.id === sobreviventeId;
                        return (
                          <div key={r.id} className="flex items-start gap-2 rounded p-1.5 hover:bg-muted/50">
                            <RadioGroupItem value={r.id} id={`merge-${r.id}`} className="mt-1" />
                            <Label htmlFor={`merge-${r.id}`} className="flex-1 cursor-pointer font-normal">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{r.nome}</span>
                                {ehSobrevivente ? (
                                  <Badge variant="default" className="text-[10px]">manter</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">apagar</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">criado {fmtData(r.created_at)}</span>
                              </span>
                              <span className="block text-xs text-muted-foreground mt-0.5">
                                {carregandoUso || !u
                                  ? "carregando uso..."
                                  : `${u.ordensServico} OS${u.filhos > 0 ? ` · ${u.filhos} registro(s) filhos` : ""}`}
                                {!ehSobrevivente && u && (u.ordensServico + u.filhos > 0) && (
                                  <span className="text-foreground"> → serão transferidos para o registro mantido</span>
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

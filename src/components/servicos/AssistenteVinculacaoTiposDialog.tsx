import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Wand2 } from "lucide-react";
import type { Servico } from "@/types/servico";
import type { TipoServico } from "@/hooks/useTiposServico";
import { sugerirTipoServicoPorNome } from "@/lib/ordemServico/comissaoPorTipoServico";

interface AssistenteVinculacaoTiposDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicos: Servico[];
  tiposServico: TipoServico[];
  onAplicar: (pares: { servicoId: string; tipoServicoId: string }[]) => Promise<number>;
}

interface Sugestao {
  servico: Servico;
  tipoId: string;
  tipoNome: string;
}

export function AssistenteVinculacaoTiposDialog({
  open,
  onOpenChange,
  servicos,
  tiposServico,
  onAplicar,
}: AssistenteVinculacaoTiposDialogProps) {
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [aplicando, setAplicando] = useState(false);

  const tiposResumo = useMemo(
    () => tiposServico.map((t) => ({ id: t.id, nome: t.nome })),
    [tiposServico],
  );
  const nomePorTipoId = useMemo(
    () => Object.fromEntries(tiposServico.map((t) => [t.id, t.nome])),
    [tiposServico],
  );

  const { sugestoes, ambiguos, semMatch, jaVinculados } = useMemo(() => {
    const sugestoes: Sugestao[] = [];
    let ambiguos = 0;
    let semMatch = 0;
    let jaVinculados = 0;
    for (const s of servicos) {
      if (s.tipo_servico_id) { jaVinculados++; continue; }
      const r = sugerirTipoServicoPorNome(s.nome, tiposResumo);
      if (r.tipoId) {
        sugestoes.push({ servico: s, tipoId: r.tipoId, tipoNome: nomePorTipoId[r.tipoId] || "?" });
      } else if (r.ambiguo) {
        ambiguos++;
      } else {
        semMatch++;
      }
    }
    sugestoes.sort((a, b) => a.servico.nome.localeCompare(b.servico.nome, "pt-BR"));
    return { sugestoes, ambiguos, semMatch, jaVinculados };
  }, [servicos, tiposResumo, nomePorTipoId]);

  // Default: tudo marcado quando o dialog abre / a lista muda
  const marcados = useMemo(() => {
    const base: Record<string, boolean> = {};
    for (const s of sugestoes) base[s.servico.id] = selecionados[s.servico.id] ?? true;
    return base;
  }, [sugestoes, selecionados]);

  const qtdMarcados = Object.values(marcados).filter(Boolean).length;

  const handleAplicar = async () => {
    const pares = sugestoes
      .filter((s) => marcados[s.servico.id])
      .map((s) => ({ servicoId: s.servico.id, tipoServicoId: s.tipoId }));
    if (pares.length === 0) return;
    setAplicando(true);
    try {
      await onAplicar(pares);
      onOpenChange(false);
      setSelecionados({});
    } finally {
      setAplicando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !aplicando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Vincular tipos automaticamente
          </DialogTitle>
          <DialogDescription>
            Sugestão de Tipo de Serviço para cada serviço do catálogo <strong>ainda sem vínculo</strong>,
            usando a mesma correspondência por nome do cálculo de comissão. Revise e confirme —
            nada é gravado até você clicar em "Aplicar".
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">{sugestoes.length} sugestão(ões)</Badge>
          <Badge variant="outline">{jaVinculados} já vinculado(s) — não tocados</Badge>
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            {ambiguos} ambíguo(s) — revisão manual
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            {semMatch} sem correspondência
          </Badge>
        </div>

        {tiposServico.length === 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>Nenhum Tipo de Serviço cadastrado. Cadastre tipos primeiro para o assistente ter o que sugerir.</span>
          </div>
        ) : sugestoes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nenhuma sugestão automática. Serviços sem vínculo podem ser ambíguos ou não casar com
            nenhum tipo — vincule manualmente no cadastro de cada serviço.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                className="underline text-muted-foreground hover:text-foreground"
                onClick={() => setSelecionados(Object.fromEntries(sugestoes.map((s) => [s.servico.id, true])))}
              >
                marcar todos
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                className="underline text-muted-foreground hover:text-foreground"
                onClick={() => setSelecionados(Object.fromEntries(sugestoes.map((s) => [s.servico.id, false])))}
              >
                desmarcar todos
              </button>
            </div>
            <div className="max-h-[45vh] overflow-y-auto rounded-md border divide-y">
              {sugestoes.map(({ servico, tipoId, tipoNome }) => (
                <label
                  key={servico.id}
                  className="flex items-center gap-3 p-2.5 text-sm cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={!!marcados[servico.id]}
                    onCheckedChange={(v) =>
                      setSelecionados((prev) => ({ ...prev, [servico.id]: v === true }))
                    }
                  />
                  <span className="flex-1 min-w-0 truncate">{servico.nome}</span>
                  <span className="text-muted-foreground shrink-0">→</span>
                  <Badge variant="secondary" className="shrink-0 max-w-[45%] truncate" title={tipoNome}>
                    {tipoNome}
                  </Badge>
                </label>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={aplicando}>
            Cancelar
          </Button>
          <Button onClick={handleAplicar} disabled={aplicando || qtdMarcados === 0}>
            {aplicando ? "Aplicando..." : `Aplicar ${qtdMarcados} vínculo(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

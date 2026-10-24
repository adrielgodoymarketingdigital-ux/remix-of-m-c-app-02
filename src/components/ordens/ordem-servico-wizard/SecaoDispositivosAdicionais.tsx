import { useState } from "react";
import { AlertTriangle, Loader2, Pencil, Plus, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditorDispositivoAdicional } from "./EditorDispositivoAdicional";
import {
  avisosImeiRepetido,
  DispositivoAdicionalForm,
  MAX_DISPOSITIVOS_ADICIONAIS,
  novoDispositivoAdicionalForm,
} from "@/lib/ordemServico/gravacaoDispositivosAdicionaisOS";
import {
  contarServicosLigados,
  EstadoAdicionaisForm,
  podeAdicionarAparelho,
  rotuloCartaoAdicional,
  secaoAdicionaisTravada,
  textosRemoverAparelho,
} from "@/lib/ordemServico/formularioDispositivosAdicionaisOS";
import { numeroAdicional, tituloDispositivo } from "@/lib/ordemServico/dispositivosAdicionaisOS";
import type { CamposNovosLinhaServico } from "@/lib/ordemServico/linhaServicoOS";

interface SecaoDispositivosAdicionaisProps {
  estado: EstadoAdicionaisForm;
  /** Linhas de serviço da OS (para avisar quantas estão ligadas ao aparelho removido). */
  servicos: readonly { linha_os?: CamposNovosLinhaServico }[];
  imeiDispositivo1: string;
  onSalvarAparelho: (aparelho: DispositivoAdicionalForm) => void;
  onRemoverAparelho: (id: string) => void;
  onTentarCarregarDeNovo: () => void;
}

/**
 * "Outros aparelhos desta OS" — etapa Dispositivo do assistente, abaixo do
 * aparelho 1. Só é montada para quem vê os adicionais
 * (useDispositivosAdicionaisOSVisivel). Nada aqui grava no banco: tudo vai ao
 * salvar a OS.
 */
export function SecaoDispositivosAdicionais({
  estado,
  servicos,
  imeiDispositivo1,
  onSalvarAparelho,
  onRemoverAparelho,
  onTentarCarregarDeNovo,
}: SecaoDispositivosAdicionaisProps) {
  const [editando, setEditando] = useState<{ aparelho: DispositivoAdicionalForm; indice: number } | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  const travada = secaoAdicionaisTravada(estado);
  const avisosImei = travada ? [] : avisosImeiRepetido(imeiDispositivo1, estado.dispositivos);
  const indiceRemovendo = removendoId ? estado.dispositivos.findIndex((d) => d.id === removendoId) : -1;
  const textosRemover = indiceRemovendo >= 0
    ? textosRemoverAparelho(estado.dispositivos[indiceRemovendo], indiceRemovendo, contarServicosLigados(servicos, removendoId!))
    : null;

  const novo = () => {
    if (!podeAdicionarAparelho(estado)) return;
    setEditando({ aparelho: novoDispositivoAdicionalForm(crypto.randomUUID()), indice: estado.dispositivos.length });
  };

  return (
    <div className="mt-6 pt-5 border-t" data-secao-dispositivos-adicionais>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5" />
            Outros aparelhos desta OS
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use quando o cliente deixar mais de um aparelho na mesma OS. Status, garantia e pagamento continuam valendo para a OS inteira.
          </p>
        </div>
      </div>

      {estado.carga === "carregando" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando outros aparelhos...
        </p>
      )}

      {estado.carga === "erro" && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Não foi possível carregar os outros aparelhos.
          </span>
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onTentarCarregarDeNovo}>
            Tentar de novo
          </Button>
        </div>
      )}

      {!travada && estado.dispositivos.length > 0 && (
        <div className="space-y-2 mb-3">
          {estado.dispositivos.map((d, i) => (
            <div key={d.id} className="flex items-center gap-2 p-3 border rounded-xl bg-muted/30" data-cartao-dispositivo-adicional>
              <p className="flex-1 min-w-0 text-sm font-medium truncate">{rotuloCartaoAdicional(d, i)}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                aria-label={`Editar ${tituloDispositivo(numeroAdicional(i))}`}
                onClick={() => setEditando({ aparelho: d, indice: i })}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-destructive hover:text-destructive shrink-0"
                aria-label={`Remover ${tituloDispositivo(numeroAdicional(i))}`}
                onClick={() => setRemovendoId(d.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {avisosImei.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
          {avisosImei.map((a) => <p key={a}>⚠️ {a}</p>)}
        </div>
      )}

      {!travada && (
        <div className="flex items-center gap-3 flex-wrap">
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={novo} disabled={!podeAdicionarAparelho(estado)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Novo dispositivo
          </Button>
          {!podeAdicionarAparelho(estado) && (
            <span className="text-xs text-muted-foreground">Máximo de {MAX_DISPOSITIVOS_ADICIONAIS} aparelhos adicionais por OS.</span>
          )}
        </div>
      )}

      <EditorDispositivoAdicional
        aparelho={editando?.aparelho ?? null}
        titulo={editando ? tituloDispositivo(numeroAdicional(editando.indice)) : ""}
        onCancelar={() => setEditando(null)}
        onSalvar={(aparelho) => {
          onSalvarAparelho(aparelho);
          setEditando(null);
        }}
      />

      <AlertDialog open={!!textosRemover} onOpenChange={(aberto) => { if (!aberto) setRemovendoId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover aparelho</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{textosRemover?.titulo}</p>
                {textosRemover?.aviso && <p className="font-medium text-amber-700 dark:text-amber-400">{textosRemover.aviso}</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removendoId) onRemoverAparelho(removendoId);
                setRemovendoId(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X, Merge } from "lucide-react";
import {
  useCatalogoDispositivosCustom,
  NivelCatalogoCustom,
} from "@/hooks/useCatalogoDispositivosCustom";
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
import { MesclarCatalogoCustomDialog } from "./MesclarCatalogoCustomDialog";

interface GerenciadorCatalogoCustomNivelProps {
  nivel: NivelCatalogoCustom;
  /** Nomes já existentes no catálogo FIXO neste escopo — só pra alertar sobre duplicata óbvia, não bloqueia. */
  nomesFixos: string[];
  escopo?: { tipoValor?: string; marcaNome?: string };
  placeholder: string;
}

export function GerenciadorCatalogoCustomNivel({ nivel, nomesFixos, escopo, placeholder }: GerenciadorCatalogoCustomNivelProps) {
  const {
    registros,
    loading,
    criar,
    atualizar,
    excluir,
    verificarUso,
    detectarGruposSimilares,
    mesclarRegistros,
  } = useCatalogoDispositivosCustom();

  const [novoNome, setNovoNome] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [mesclarAberto, setMesclarAberto] = useState(false);

  const registrosDoEscopo = useMemo(
    () =>
      registros.filter((r) => {
        if (r.nivel !== nivel) return false;
        if (nivel !== "tipo" && r.tipo_valor !== escopo?.tipoValor) return false;
        if ((nivel === "modelo" || nivel === "cor") && r.marca_nome !== escopo?.marcaNome) return false;
        return true;
      }),
    [registros, nivel, escopo?.tipoValor, escopo?.marcaNome],
  );

  const gruposDuplicados = useMemo(
    () => detectarGruposSimilares(nivel, escopo),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- escopo é recriado a cada render; comparamos só os campos primitivos.
    [detectarGruposSimilares, nivel, escopo?.tipoValor, escopo?.marcaNome],
  );

  const jaExisteFixo = (nome: string) => nomesFixos.some((f) => f.toLowerCase() === nome.trim().toLowerCase());

  const handleCriar = async () => {
    if (!novoNome.trim()) return;
    await criar(nivel, novoNome.trim(), escopo);
    setNovoNome("");
  };

  const handleAtualizar = async () => {
    if (!editandoId || !editandoNome.trim()) return;
    await atualizar(editandoId, editandoNome.trim());
    setEditandoId(null);
    setEditandoNome("");
  };

  const handleExcluir = async () => {
    if (!excluindoId) return;
    await excluir(excluindoId);
    setExcluindoId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 flex-1">
          <Input
            placeholder={placeholder}
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCriar()}
          />
          <Button onClick={handleCriar} disabled={!novoNome.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>
      {novoNome.trim() && jaExisteFixo(novoNome) && (
        <p className="text-xs text-muted-foreground">
          Já existe uma opção com esse nome no catálogo padrão — cadastrar mesmo assim vai criar uma duplicata.
        </p>
      )}

      {gruposDuplicados.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setMesclarAberto(true)}>
          <Merge className="h-4 w-4 mr-1.5" />
          Mesclar duplicados ({gruposDuplicados.length})
        </Button>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : registrosDoEscopo.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum registro personalizado cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {registrosDoEscopo.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
              {editandoId === r.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editandoNome}
                    onChange={(e) => setEditandoNome(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAtualizar()}
                    className="h-8"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleAtualizar}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => { setEditandoId(null); setEditandoNome(""); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium truncate">{r.nome}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => { setEditandoId(r.id); setEditandoNome(r.nome); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setExcluindoId(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!excluindoId} onOpenChange={(open) => !open && setExcluindoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Se o registro estiver vinculado a ordens de serviço ou tiver
              registros filhos cadastrados sob ele, a exclusão será bloqueada — use "Mesclar duplicados" pra
              transferir os vínculos, ou remova os filhos antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MesclarCatalogoCustomDialog
        open={mesclarAberto}
        onOpenChange={setMesclarAberto}
        grupos={gruposDuplicados}
        verificarUso={verificarUso}
        onConfirm={async (merges) => {
          for (const m of merges) {
            await mesclarRegistros(nivel, m.sobreviventeId, m.duplicadosIds, escopo ?? {});
          }
        }}
      />
    </div>
  );
}

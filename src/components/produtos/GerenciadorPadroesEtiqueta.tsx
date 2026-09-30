import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  PADRAO_AVULSO_INICIAL,
  PadraoEtiqueta,
  SUGESTOES_PIMACO,
  calcularLayoutFolha,
} from '@/lib/etiquetas/etiquetasProduto';
import { usePadroesEtiqueta } from '@/hooks/usePadroesEtiqueta';
import { CamposPadraoEtiqueta, MiniaturaFolha, ResumoLayoutFolha } from './CamposPadraoEtiqueta';

const cmTexto = (mm: number) => Number((mm / 10).toFixed(2)).toString().replace('.', ',');

function descricaoPadrao(p: PadraoEtiqueta): string {
  const linhas = p.linhas === null ? 'linhas automáticas' : `${p.linhas} linhas`;
  return `Folha ${cmTexto(p.larguraFolhaMm)}cm · etiqueta ${cmTexto(p.larguraMm)}×${cmTexto(p.alturaMm)}cm · ${p.colunas} ${p.colunas === 1 ? 'coluna' : 'colunas'} · ${linhas}`;
}

/**
 * "Meus padrões de etiqueta" (aba Etiquetas das Configurações de Produtos):
 * cria, edita e exclui as folhas medidas pelo usuário. Mesma fonte de dados
 * (usePadroesEtiqueta) do seletor de folha A4 em Gerar Etiquetas.
 */
export const GerenciadorPadroesEtiqueta = () => {
  const { padroes, carregando, salvando, salvarPadrao, excluirPadrao } = usePadroesEtiqueta();
  // null = lista; preenchido = formulário (novo ou edição).
  const [editando, setEditando] = useState<PadraoEtiqueta | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);

  const ehNovo = editando !== null && !padroes.some((p) => p.id === editando.id);
  const erroLayout = editando ? calcularLayoutFolha(editando).erro : null;
  const nomeValido = !!editando?.nome.trim();

  const salvar = async () => {
    if (!editando || !nomeValido || erroLayout) return;
    if (await salvarPadrao({ ...editando, nome: editando.nome.trim() })) setEditando(null);
  };

  const excluir = async (id: string) => {
    if (await excluirPadrao(id)) setConfirmandoExclusao(null);
  };

  if (editando) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">{ehNovo ? 'Novo padrão de etiqueta' : 'Editar padrão de etiqueta'}</h3>
          <p className="text-xs text-muted-foreground">
            Meça sua folha com uma régua. As margens e o espaço entre as colunas são calculados sozinhos.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="padrao-nome" className="text-xs">Nome do padrão</Label>
          <Input
            id="padrao-nome"
            value={editando.nome}
            maxLength={60}
            placeholder="Ex: Etiqueta pequena de peça"
            onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
            className="h-9"
            autoFocus
          />
        </div>

        {ehNovo && (
          <div className="space-y-1">
            <Label className="text-xs">Começar a partir de (opcional)</Label>
            <Select
              value=""
              onValueChange={(id) => {
                const s = SUGESTOES_PIMACO.find((m) => m.id === id);
                if (s) setEditando({ ...s, id: editando.id, nome: editando.nome });
              }}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Preencher com uma folha Pimaco…" /></SelectTrigger>
              <SelectContent>
                {SUGESTOES_PIMACO.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Só preenche as medidas — confira com a régua na sua folha.</p>
          </div>
        )}

        <CamposPadraoEtiqueta
          idPrefixo="padrao"
          padrao={editando}
          onChange={(parcial) => setEditando({ ...editando, ...parcial })}
        />
        <ResumoLayoutFolha padrao={editando} />

        <div className="flex items-end gap-3">
          <MiniaturaFolha
            padrao={editando}
            vazias={0}
            ocupadas={editando.linhas === null ? editando.colunas * 3 : editando.colunas * editando.linhas}
            larguraPx={110}
          />
          <span className="text-[11px] text-muted-foreground">Folha em escala</span>
        </div>

        <div className="flex gap-2 border-t pt-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditando(null)} disabled={salvando}>
            Voltar
          </Button>
          <Button size="sm" className="flex-1" onClick={salvar} disabled={salvando || !nomeValido || !!erroLayout}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar padrão
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Folhas de etiqueta medidas por você, salvas para a loja toda. Aparecem em "Gerar Etiquetas" no formato Folha A4.
      </p>
      <Button size="sm" className="w-full" onClick={() => setEditando({ ...PADRAO_AVULSO_INICIAL, id: crypto.randomUUID(), nome: '' })}>
        <Plus className="w-4 h-4 mr-1" />
        Novo padrão
      </Button>

      <div className="border-t pt-3 space-y-2 max-h-72 overflow-y-auto">
        {carregando ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : padroes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum padrão salvo ainda.
          </p>
        ) : (
          padroes.map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.nome}</p>
                <p className="text-[11px] text-muted-foreground">{descricaoPadrao(p)}</p>
              </div>
              {confirmandoExclusao === p.id ? (
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setConfirmandoExclusao(null)} disabled={salvando}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" size="sm" className="h-7 px-2" onClick={() => excluir(p.id)} disabled={salvando}>
                    {salvando && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                    Excluir
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => setEditando(p)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Excluir" onClick={() => setConfirmandoExclusao(p.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

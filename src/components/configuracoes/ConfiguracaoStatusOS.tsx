import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, GripVertical, Lock, Eye, EyeOff } from "lucide-react";
import { useOSStatusConfig, OSStatusConfig } from "@/hooks/useOSStatusConfig";

export function ConfiguracaoStatusOS() {
  const { statusList, loading, criarStatus, atualizarStatusConfig, excluirStatus } = useOSStatusConfig();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<OSStatusConfig | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    cor: '#3b82f6',
    gera_conta: false,
    tipo_conta: 'receber',
    pedir_data_vencimento: false,
  });

  const abrirNovo = () => {
    setEditando(null);
    setFormData({ nome: '', cor: '#3b82f6', gera_conta: false, tipo_conta: 'receber', pedir_data_vencimento: false });
    setDialogAberto(true);
  };

  const abrirEditar = (status: OSStatusConfig) => {
    setEditando(status);
    setFormData({
      nome: status.nome,
      cor: status.cor,
      gera_conta: status.gera_conta,
      tipo_conta: status.tipo_conta,
      pedir_data_vencimento: status.pedir_data_vencimento,
    });
    setDialogAberto(true);
  };

  const handleSalvar = async () => {
    if (!formData.nome.trim()) return;

    if (editando) {
      await atualizarStatusConfig(editando.id, formData);
    } else {
      await criarStatus(formData);
    }
    setDialogAberto(false);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Status de Ordem de Serviço</CardTitle>
        <Button size="sm" onClick={abrirNovo} className="gap-1">
          <Plus className="h-4 w-4" />
          Novo Status
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {statusList.map((status) => (
          <div
            key={status.id}
            className={`flex items-center gap-3 p-3 border rounded-lg ${!status.ativo ? 'opacity-50' : ''}`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <div
              className="w-4 h-4 rounded-full shrink-0"
              style={{ backgroundColor: status.cor }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{status.nome}</span>
                {status.is_sistema && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Lock className="h-2.5 w-2.5" />
                    Sistema
                  </Badge>
                )}
                {!status.ativo && (
                  <Badge variant="secondary" className="text-[10px]">
                    Oculto
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 mt-1 flex-wrap">
                {status.gera_conta && (
                  <Badge variant="secondary" className="text-[10px]">
                    Gera conta a {status.tipo_conta}
                  </Badge>
                )}
                {status.pedir_data_vencimento && (
                  <Badge variant="secondary" className="text-[10px]">
                    Pede data de vencimento
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={status.ativo ? 'Ocultar status' : 'Mostrar status'}
                onClick={() => atualizarStatusConfig(status.id, { ativo: !status.ativo })}
              >
                {status.ativo ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEditar(status)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {!status.is_sistema && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir status</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir o status "{status.nome}"?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => excluirStatus(status.id)}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        ))}

        {/* Dialog de criar/editar */}
        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editando ? 'Editar Status' : 'Novo Status'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Status</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Entregue sem receber"
                  disabled={editando?.is_sistema}
                />
              </div>

              <div className="space-y-2">
                <Label>Cor do Indicador</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.cor}
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border"
                  />
                  <Input
                    value={formData.cor}
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    className="flex-1"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Gerar lançamento financeiro</Label>
                  <p className="text-xs text-muted-foreground">Cria conta a receber ao selecionar este status</p>
                </div>
                <Switch
                  checked={formData.gera_conta}
                  onCheckedChange={(checked) => setFormData({ ...formData, gera_conta: checked })}
                />
              </div>

              {formData.gera_conta && (
                <div className="flex items-center justify-between pl-4 border-l-2">
                  <div className="space-y-0.5">
                    <Label>Pedir data de vencimento</Label>
                    <p className="text-xs text-muted-foreground">Exibe popup para escolher data ou "sem prazo"</p>
                  </div>
                  <Switch
                    checked={formData.pedir_data_vencimento}
                    onCheckedChange={(checked) => setFormData({ ...formData, pedir_data_vencimento: checked })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogAberto(false)}>Cancelar</Button>
              <Button onClick={handleSalvar} disabled={!formData.nome.trim()}>
                {editando ? 'Salvar' : 'Criar Status'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

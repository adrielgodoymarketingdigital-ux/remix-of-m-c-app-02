import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, GripVertical, Lock, Eye, EyeOff, Info } from "lucide-react";
import { useOSStatusConfig, OSStatusConfig } from "@/hooks/useOSStatusConfig";

const DESCRICAO_STATUS: Record<string, string> = {
  aguardando_aprovacao: "OS recém-criada, aguardando o cliente aprovar o orçamento.",
  em_andamento: "Serviço em execução. Cria automaticamente uma conta a receber no financeiro.",
  finalizado: "Técnico concluiu o serviço. Aparece nos relatórios de faturamento.",
  aguardando_retirada: "Serviço pronto, aguardando o cliente retirar. Também cria conta a receber.",
  entregue: "Dispositivo entregue ao cliente. Marca a conta como recebida no financeiro e registra a data de saída.",
  cancelada: "OS cancelada. Apenas visual — não gera nem remove lançamentos financeiros.",
  garantia: "Dispositivo retornou para garantia. Apenas visual.",
  estornado: "Reverte o lançamento financeiro e devolve as peças usadas ao estoque.",
};

export function ConfiguracaoStatusOS() {
  const { statusList, loading, criarStatus, atualizarStatusConfig, excluirStatus } = useOSStatusConfig();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<OSStatusConfig | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    cor: '#3b82f6',
  });

  const abrirNovo = () => {
    setEditando(null);
    setFormData({ nome: '', cor: '#3b82f6' });
    setDialogAberto(true);
  };

  const abrirEditar = (status: OSStatusConfig) => {
    setEditando(status);
    setFormData({
      nome: status.nome,
      cor: status.cor,
    });
    setDialogAberto(true);
  };

  const handleSalvar = async () => {
    if (!formData.nome.trim()) return;

    if (editando) {
      await atualizarStatusConfig(editando.id, { nome: formData.nome, cor: formData.cor });
    } else {
      await criarStatus({ nome: formData.nome, cor: formData.cor, gera_conta: false, tipo_conta: 'receber', pedir_data_vencimento: false });
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
      <CardContent className="space-y-3">
        {/* Aviso geral */}
        <div className="rounded-md border border-blue-500/30 bg-blue-500/8 px-3 py-2.5 flex gap-2.5 text-xs text-blue-600 dark:text-blue-400">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">Como funcionam os status</p>
            <p className="text-muted-foreground">Os status marcados com <span className="font-medium">Sistema</span> possuem comportamentos automáticos (financeiro, estoque, notificações). Você pode renomear e mudar a cor deles à vontade — o comportamento não muda.</p>
            <p className="text-muted-foreground">Status novos criados por você são <span className="font-medium">apenas visuais</span>: aparecem no Kanban e na lista, mas não disparam nenhuma ação automática no sistema.</p>
          </div>
        </div>

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
              {status.is_sistema && DESCRICAO_STATUS[status.slug] && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{DESCRICAO_STATUS[status.slug]}</p>
              )}
              {!status.is_sistema && (
                <p className="text-[11px] text-muted-foreground mt-0.5">Status visual — sem ações automáticas.</p>
              )}
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
              {editando?.is_sistema && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  Este é um status do sistema. Você pode renomear e mudar a cor, mas o comportamento (financeiro, notificações) permanece o mesmo.
                </div>
              )}
              <div className="space-y-2">
                <Label>Nome do Status</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Faturado"
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

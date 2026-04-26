import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useDispositivos } from "@/hooks/useDispositivos";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

interface DispositivoExcluido {
  id: string;
  marca: string;
  modelo: string;
  tipo: string;
  cor?: string;
  condicao: string;
  preco?: number;
  custo?: number;
  quantidade: number;
  deleted_at: string;
}

export function SecaoDispositivosExcluidos() {
  const [dispositivos, setDispositivos] = useState<DispositivoExcluido[]>([]);
  const [loading, setLoading] = useState(true);
  const { lojaUserId, podeSincronizarDispositivos, isFuncionario } = useFuncionarioPermissoes();
  const { restaurarDispositivo, excluirPermanentemente } = useDispositivos();

  const carregarExcluidos = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const userId = (isFuncionario && podeSincronizarDispositivos && lojaUserId) ? lojaUserId : user.id;

      const { data, error } = await supabase
        .from("dispositivos")
        .select("id, marca, modelo, tipo, cor, condicao, preco, custo, quantidade, deleted_at")
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      setDispositivos((data || []) as DispositivoExcluido[]);
    } catch (error) {
      console.error("Erro ao carregar dispositivos excluídos:", error);
    } finally {
      setLoading(false);
    }
  }, [lojaUserId, podeSincronizarDispositivos, isFuncionario]);

  useEffect(() => {
    carregarExcluidos();
  }, [carregarExcluidos]);

  const handleRestaurar = async (id: string) => {
    await restaurarDispositivo(id);
    await carregarExcluidos();
  };

  const handleExcluirPermanente = async (id: string) => {
    await excluirPermanentemente(id);
    await carregarExcluidos();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (dispositivos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhum dispositivo na lixeira</p>
        <p className="text-sm">Dispositivos excluídos aparecerão aqui</p>
      </div>
    );
  }

  const condicaoLabel: Record<string, string> = {
    novo: "Novo",
    semi_novo: "Semi-novo",
    usado: "Usado",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <AlertTriangle className="h-4 w-4" />
        <span>{dispositivos.length} dispositivo(s) na lixeira</span>
      </div>

      {dispositivos.map((d) => (
        <div
          key={d.id}
          className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
        >
          <div className="flex-1">
            <div className="font-medium">{d.marca} {d.modelo}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline">{d.tipo}</Badge>
              {d.cor && <Badge variant="secondary">{d.cor}</Badge>}
              <Badge variant="secondary">{condicaoLabel[d.condicao] || d.condicao}</Badge>
              <span className="text-sm text-muted-foreground">
                Qtd: {d.quantidade}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              {d.preco != null && <span>Preço: {formatCurrency(d.preco)}</span>}
              <span>
                Excluído em: {format(new Date(d.deleted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRestaurar(d.id)}
              className="gap-1"
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1">
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O dispositivo <strong>{d.marca} {d.modelo}</strong> será removido permanentemente do sistema.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleExcluirPermanente(d.id)}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Excluir Permanentemente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
    </div>
  );
}

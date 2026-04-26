import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Edit, Power, Trash2, Mail, Clock } from "lucide-react";
import type { Funcionario } from "@/types/funcionario";
import { MODULOS_LABELS } from "@/types/funcionario";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TabelaFuncionariosProps {
  funcionarios: Funcionario[];
  onEditar: (funcionario: Funcionario) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  onExcluir: (id: string) => void;
  onReenviarConvite: (id: string) => void;
}

const CARGO_COLORS: Record<string, string> = {
  "Vendedor": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  "Técnico": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  "Estoque": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
};

export function TabelaFuncionarios({
  funcionarios, onEditar, onToggleAtivo, onExcluir, onReenviarConvite,
}: TabelaFuncionariosProps) {
  const [funcionarioExcluir, setFuncionarioExcluir] = useState<Funcionario | null>(null);

  const getModulosAtivos = (funcionario: Funcionario): string[] => {
    const modulos: string[] = [];
    Object.entries(funcionario.permissoes.modulos).forEach(([key, value]) => {
      if (value && key !== "suporte" && key !== "novidades") {
        modulos.push(MODULOS_LABELS[key as keyof typeof MODULOS_LABELS]);
      }
    });
    return modulos;
  };

  const getStatusConvite = (funcionario: Funcionario): "pendente" | "aceito" | "expirado" => {
    if (funcionario.convite_aceito_em) return "aceito";
    if (funcionario.convite_expira_em) {
      const expiraEm = new Date(funcionario.convite_expira_em);
      if (expiraEm < new Date()) return "expirado";
    }
    return "pendente";
  };

  const ESCOPO_LABELS: Record<string, string> = {
    vendas_produtos: "Produtos/Peças",
    vendas_dispositivos: "Dispositivos",
    vendas_todos: "Todas Vendas",
    servicos_os: "Serviços (OS)",
    tudo: "Tudo",
  };

  const formatComissao = (f: Funcionario) => {
    if (!f.comissao_tipo || !f.comissao_valor) return "—";
    const valor = f.comissao_tipo === "porcentagem" ? `${f.comissao_valor}%` : `R$ ${Number(f.comissao_valor).toFixed(2)}`;
    const escopo = f.comissao_escopo ? ESCOPO_LABELS[f.comissao_escopo] || f.comissao_escopo : "";
    return escopo ? `${valor} (${escopo})` : valor;
  };

  if (funcionarios.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhum funcionário cadastrado ainda.</p>
        <p className="text-sm mt-1">Clique em "Novo Funcionário" para adicionar.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Comissão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Acessos</TableHead>
              <TableHead className="hidden md:table-cell">Cadastro</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {funcionarios.map((funcionario) => {
              const statusConvite = getStatusConvite(funcionario);
              const modulosAtivos = getModulosAtivos(funcionario);
              const cargoColor = funcionario.cargo ? (CARGO_COLORS[funcionario.cargo] || "bg-muted text-muted-foreground") : "";
              
              return (
                <TableRow key={funcionario.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{funcionario.nome}</p>
                      <p className="text-sm text-muted-foreground">{funcionario.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {funcionario.cargo ? (
                      <Badge variant="outline" className={cargoColor}>
                        {funcionario.cargo}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{formatComissao(funcionario)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={funcionario.ativo ? "default" : "secondary"}>
                        {funcionario.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      {statusConvite === "pendente" && (
                        <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-600 dark:border-amber-400">
                          <Clock className="h-3 w-3 mr-1" />
                          Convite pendente
                        </Badge>
                      )}
                      {statusConvite === "expirado" && (
                        <Badge variant="outline" className="text-destructive border-destructive">
                          Convite expirado
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1 max-w-[300px]">
                      {modulosAtivos.length > 0 ? (
                        modulosAtivos.slice(0, 3).map((modulo) => (
                          <Badge key={modulo} variant="outline" className="text-xs">{modulo}</Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Apenas básico</span>
                      )}
                      {modulosAtivos.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{modulosAtivos.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {format(new Date(funcionario.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditar(funcionario)}>
                          <Edit className="h-4 w-4 mr-2" />Editar
                        </DropdownMenuItem>
                        {(statusConvite === "pendente" || statusConvite === "expirado") && (
                          <DropdownMenuItem onClick={() => onReenviarConvite(funcionario.id)}>
                            <Mail className="h-4 w-4 mr-2" />Reenviar convite
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onToggleAtivo(funcionario.id, !funcionario.ativo)}>
                          <Power className="h-4 w-4 mr-2" />{funcionario.ativo ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setFuncionarioExcluir(funcionario)} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!funcionarioExcluir} onOpenChange={() => setFuncionarioExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{funcionarioExcluir?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (funcionarioExcluir) { onExcluir(funcionarioExcluir.id); setFuncionarioExcluir(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

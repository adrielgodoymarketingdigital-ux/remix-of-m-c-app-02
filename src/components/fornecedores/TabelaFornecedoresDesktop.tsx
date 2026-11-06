import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Pencil, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Fornecedor } from "@/types/fornecedor";
import { avatarFornecedor } from "./avatarFornecedor";
import {
  OrdemNomeFornecedor,
  ordenarFornecedoresPorNome,
  proximaOrdemNome,
} from "./ordenacaoFornecedores";

interface TabelaFornecedoresDesktopProps {
  fornecedores: Fornecedor[];
  onEditar: (fornecedor: Fornecedor) => void;
  onExcluir: (id: string) => void;
  /** Abre a ficha de contas do fornecedor. Sem a prop, o botão "Visualizar" não aparece. */
  onVisualizar?: (fornecedor: Fornecedor) => void;
  /** Mostra o esqueleto de carregamento dentro do cartão da lista. */
  carregando?: boolean;
  /** Há busca ou filtro ativo: a lista vazia vira "Nenhum fornecedor encontrado". */
  filtroAtivo?: boolean;
}

const ROTULO_ORDEM: Record<OrdemNomeFornecedor, string> = {
  padrao: "Ordenar por nome em ordem crescente",
  asc: "Ordenar por nome em ordem decrescente",
  desc: "Voltar à ordem padrão",
};

const ARIA_SORT: Record<OrdemNomeFornecedor, "none" | "ascending" | "descending"> = {
  padrao: "none",
  asc: "ascending",
  desc: "descending",
};

/** Tabela de fornecedores só do computador (≥1024px). Abaixo disso a página usa TabelaFornecedores. */
export function TabelaFornecedoresDesktop({
  fornecedores,
  onEditar,
  onExcluir,
  onVisualizar,
  carregando = false,
  filtroAtivo = false,
}: TabelaFornecedoresDesktopProps) {
  const [ordem, setOrdem] = useState<OrdemNomeFornecedor>("padrao");
  const lista = useMemo(() => ordenarFornecedoresPorNome(fornecedores, ordem), [fornecedores, ordem]);
  const IconeOrdem = ordem === "asc" ? ArrowUp : ordem === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold">Lista de Fornecedores</h2>
      </div>

      {carregando ? (
        <div className="space-y-3 p-5" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/5" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted-foreground">
            {filtroAtivo ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
          </p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead aria-sort={ARIA_SORT[ordem]} className="pl-5">
                  <button
                    type="button"
                    onClick={() => setOrdem(proximaOrdemNome)}
                    aria-label={ROTULO_ORDEM[ordem]}
                    className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Nome
                    <IconeOrdem
                      className={cn("h-3.5 w-3.5", ordem === "padrao" && "opacity-50")}
                      aria-hidden="true"
                    />
                  </button>
                </TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((fornecedor) => {
                const avatar = avatarFornecedor(fornecedor.id, fornecedor.nome);
                const documento = fornecedor.cnpj || fornecedor.cpf || "-";
                const cidade =
                  fornecedor.cidade && fornecedor.estado
                    ? `${fornecedor.cidade}/${fornecedor.estado}`
                    : fornecedor.cidade || fornecedor.estado || "-";
                return (
                  <TableRow key={fornecedor.id}>
                    <TableCell className="pl-5">
                      <div className="flex min-w-[220px] max-w-[320px] items-center gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                            avatar.classes,
                          )}
                          aria-hidden="true"
                        >
                          {avatar.iniciais}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium" title={fornecedor.nome}>
                            {fornecedor.nome}
                          </p>
                          {fornecedor.nome_fantasia && (
                            <p
                              className="truncate text-xs text-muted-foreground"
                              title={fornecedor.nome_fantasia}
                            >
                              {fornecedor.nome_fantasia}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {fornecedor.tipo === "juridica" ? "PJ" : "PF"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      <span className={cn(documento === "-" && "text-muted-foreground")}>{documento}</span>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[240px] text-sm">
                        {fornecedor.telefone && <p className="truncate">{fornecedor.telefone}</p>}
                        {fornecedor.celular && <p className="truncate">{fornecedor.celular}</p>}
                        {fornecedor.email && (
                          <p className="truncate text-muted-foreground" title={fornecedor.email}>
                            {fornecedor.email}
                          </p>
                        )}
                        {!fornecedor.telefone && !fornecedor.celular && !fornecedor.email && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p
                        className={cn("max-w-[200px] truncate", cidade === "-" && "text-muted-foreground")}
                        title={cidade === "-" ? undefined : cidade}
                      >
                        {cidade}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1.5 whitespace-nowrap border-transparent font-medium",
                          fornecedor.ativo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            fornecedor.ativo ? "bg-success" : "bg-muted-foreground",
                          )}
                          aria-hidden="true"
                        />
                        {fornecedor.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onVisualizar && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onVisualizar(fornecedor)}
                            title="Visualizar contas"
                            aria-label={`Visualizar contas de "${fornecedor.nome}"`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEditar(fornecedor)}
                          title="Editar"
                          aria-label={`Editar o fornecedor "${fornecedor.nome}"`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              title="Excluir"
                              aria-label={`Excluir o fornecedor "${fornecedor.nome}"`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o fornecedor "{fornecedor.nome}"?
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onExcluir(fornecedor.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="border-t px-5 py-3 text-sm text-muted-foreground">
            {lista.length} fornecedor(es)
          </div>
        </>
      )}
    </Card>
  );
}

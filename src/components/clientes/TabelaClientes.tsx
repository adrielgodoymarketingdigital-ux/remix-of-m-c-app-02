import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
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
import { Pencil, Trash2, Eye, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Cliente } from "@/types/cliente";
import { formatCPF, formatPhone } from "@/lib/formatters";
import { useIsMobile } from "@/hooks/use-mobile";
import { isAniversarioHoje, isAniversarioEsteMes, formatarDiaAniversario } from "@/hooks/useAniversariantes";

const POR_PAGINA = 50;

interface TabelaClientesProps {
  clientes: Cliente[];
  onEditar: (cliente: Cliente) => void;
  onExcluir: (id: string) => void;
  onExcluirEmMassa?: (ids: string[]) => Promise<void>;
  onVerHistorico: (cliente: Cliente) => void;
}

export function TabelaClientes({
  clientes,
  onEditar,
  onExcluir,
  onExcluirEmMassa,
  onVerHistorico,
}: TabelaClientesProps) {
  const isMobile = useIsMobile();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmandoMassa, setConfirmandoMassa] = useState(false);
  const [pagina, setPagina] = useState(1);

  // Volta para página 1 quando a lista de clientes muda (busca ou filtro)
  useEffect(() => { setPagina(1); }, [clientes]);

  const totalPaginas = Math.max(1, Math.ceil(clientes.length / POR_PAGINA));
  const clientesPagina = clientes.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const Paginacao = () => (
    <div className="flex items-center justify-between px-1 py-2 text-sm text-muted-foreground">
      <span>{clientes.length} cliente{clientes.length !== 1 ? "s" : ""} · página {pagina} de {totalPaginas}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const toggleSelecionado = (id: string) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    const idsPagina = clientesPagina.map(c => c.id);
    const todosDaPaginaSelecionados = idsPagina.every(id => selecionados.has(id));
    setSelecionados(prev => {
      const next = new Set(prev);
      if (todosDaPaginaSelecionados) {
        idsPagina.forEach(id => next.delete(id));
      } else {
        idsPagina.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const limparSelecao = () => setSelecionados(new Set());

  const handleExcluirMassa = async () => {
    if (onExcluirEmMassa) {
      await onExcluirEmMassa(Array.from(selecionados));
    }
    setSelecionados(new Set());
    setConfirmandoMassa(false);
  };

  const idsPagina = clientesPagina.map(c => c.id);
  const todosSelecionados = idsPagina.length > 0 && idsPagina.every(id => selecionados.has(id));
  const algunsSelecionados = idsPagina.some(id => selecionados.has(id)) && !todosSelecionados;

  if (clientes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum cliente cadastrado
      </div>
    );
  }

  // Barra flutuante de ações em massa
  const BarraSelecao = () => (
    selecionados.size > 0 ? (
      <div className="flex items-center justify-between bg-primary text-primary-foreground rounded-lg px-4 py-2 mb-3 gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            {selecionados.size} {selecionados.size === 1 ? "selecionado" : "selecionados"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={limparSelecao}
            className="text-primary-foreground hover:text-primary-foreground hover:bg-primary/80 h-7 px-2"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        </div>
        <AlertDialog open={confirmandoMassa} onOpenChange={setConfirmandoMassa}>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              className="bg-white text-destructive hover:bg-white/90"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir {selecionados.size}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className={isMobile ? "mx-4 max-w-[calc(100%-2rem)]" : ""}>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir clientes selecionados</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir {selecionados.size} {selecionados.size === 1 ? "cliente" : "clientes"}? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className={isMobile ? "flex-col gap-2" : ""}>
              <AlertDialogCancel className={isMobile ? "w-full" : ""}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleExcluirMassa}
                className={`bg-destructive text-destructive-foreground hover:bg-destructive/90${isMobile ? " w-full" : ""}`}
              >
                Excluir {selecionados.size} {selecionados.size === 1 ? "cliente" : "clientes"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    ) : null
  );

  // Mobile: Card-based layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        <BarraSelecao />
        <Paginacao />
        {clientesPagina.map((cliente) => (
          <Card key={cliente.id} className={`p-4 transition-colors ${selecionados.has(cliente.id) ? "border-primary bg-primary/5" : ""}`}>
            <div className="flex items-start gap-3 mb-2">
              <Checkbox
                checked={selecionados.has(cliente.id)}
                onCheckedChange={() => toggleSelecionado(cliente.id)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{cliente.nome}</p>
                  {isAniversarioHoje(cliente.data_nascimento) && (
                    <span className="inline-flex items-center text-amber-500" title="Aniversário hoje!">
                      🎂
                    </span>
                  )}
                  {isAniversarioEsteMes(cliente.data_nascimento) && !isAniversarioHoje(cliente.data_nascimento) && (
                    <span className="text-xs text-muted-foreground" title="Aniversário este mês">
                      🎈 {formatarDiaAniversario(cliente.data_nascimento)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{formatPhone(cliente.telefone)}</p>
              </div>
            </div>

            <div className="text-sm space-y-1 mb-3 pl-7">
              {cliente.cpf && <p className="text-muted-foreground">CPF: {formatCPF(cliente.cpf)}</p>}
              {cliente.endereco && (
                <p className="text-muted-foreground truncate">{cliente.endereco}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onVerHistorico(cliente)}
                className="h-9"
              >
                <Eye className="h-4 w-4 mr-1" />
                Histórico
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditar(cliente)}
                className="h-9"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="mx-4 max-w-[calc(100%-2rem)]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir o cliente "{cliente.nome}"?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onExcluir(cliente.id)}
                      className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        ))}
        <Paginacao />
      </div>
    );
  }

  // Desktop: Table layout
  return (
    <div className="space-y-2">
      <BarraSelecao />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={todosSelecionados ? true : algunsSelecionados ? "indeterminate" : false}
                  onCheckedChange={toggleTodos}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientesPagina.map((cliente) => (
              <TableRow
                key={cliente.id}
                className={selecionados.has(cliente.id) ? "bg-primary/5" : ""}
              >
                <TableCell>
                  <Checkbox
                    checked={selecionados.has(cliente.id)}
                    onCheckedChange={() => toggleSelecionado(cliente.id)}
                    aria-label={`Selecionar ${cliente.nome}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {cliente.nome}
                    {isAniversarioHoje(cliente.data_nascimento) && (
                      <span className="inline-flex items-center text-amber-500" title="Aniversário hoje!">
                        🎂
                      </span>
                    )}
                    {isAniversarioEsteMes(cliente.data_nascimento) && !isAniversarioHoje(cliente.data_nascimento) && (
                      <span className="text-xs text-muted-foreground" title="Aniversário este mês">
                        🎈 {formatarDiaAniversario(cliente.data_nascimento)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{formatCPF(cliente.cpf)}</TableCell>
                <TableCell>{formatPhone(cliente.telefone)}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {cliente.endereco || "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onVerHistorico(cliente)}
                      title="Ver histórico"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditar(cliente)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o cliente "{cliente.nome}"?
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onExcluir(cliente.id)}
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
            ))}
          </TableBody>
        </Table>
      </div>
      <Paginacao />
    </div>
  );
}

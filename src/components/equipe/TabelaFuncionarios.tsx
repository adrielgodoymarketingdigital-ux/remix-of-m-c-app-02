import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Edit, Pencil, Power, Trash2, Mail, Clock, Search, SlidersHorizontal, ChevronLeft, ChevronRight, Users } from "lucide-react";
import type { Funcionario } from "@/types/funcionario";
import { MODULOS_LABELS } from "@/types/funcionario";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsDesktop, useIsMobileOrTablet } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface TabelaFuncionariosProps {
  funcionarios: Funcionario[];
  onEditar: (funcionario: Funcionario) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  onExcluir: (id: string) => void;
  onReenviarConvite: (id: string) => void;
  /**
   * Título e contador do painel. Só no computador: vão à esquerda, na mesma linha da busca e dos
   * filtros, e continuam aparecendo com a lista vazia. Sem a prop, nada muda.
   */
  cabecalho?: ReactNode;
}

type FiltroStatus = "todos" | "ativo" | "inativo";

const ITENS_POR_PAGINA_OPCOES = [10, 25, 50] as const;

const CARGO_COLORS: Record<string, string> = {
  "Vendedor": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  "Técnico": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  "Estoque": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
};

// Coluna "Ações" fixa à direita no computador: com a tabela rolando na horizontal, o lápis e o "…"
// continuam à vista. Fundo opaco (card + a mesma camada do hover/cabeçalho) para nada vazar por baixo.
const COLUNA_FIXA = "sticky right-0 z-10 shadow-[-8px_0_8px_-8px_hsl(var(--foreground)/0.15)]";
const FUNDO_CABECALHO_FIXO = "[background:linear-gradient(hsl(var(--muted)/0.5),hsl(var(--muted)/0.5)),hsl(var(--card))]";
const FUNDO_CELULA_FIXA =
  "bg-card group-hover:[background:linear-gradient(hsl(var(--muted)/0.5),hsl(var(--muted)/0.5)),hsl(var(--card))]";

export function TabelaFuncionarios({
  funcionarios, onEditar, onToggleAtivo, onExcluir, onReenviarConvite, cabecalho,
}: TabelaFuncionariosProps) {
  const [funcionarioExcluir, setFuncionarioExcluir] = useState<Funcionario | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState<number>(10);
  const isMobileOrTablet = useIsMobileOrTablet();
  const isDesktop = useIsDesktop();
  // Visual novo só no computador e só para quem passa o cabeçalho (hoje, a tela Equipe).
  const visualDesktop = isDesktop && cabecalho !== undefined;

  const funcionariosFiltrados = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    return funcionarios.filter((f) => {
      const matchBusca =
        !buscaLower ||
        f.nome.toLowerCase().includes(buscaLower) ||
        f.email.toLowerCase().includes(buscaLower);
      const matchStatus =
        filtroStatus === "todos" ||
        (filtroStatus === "ativo" && f.ativo) ||
        (filtroStatus === "inativo" && !f.ativo);
      return matchBusca && matchStatus;
    });
  }, [funcionarios, busca, filtroStatus]);

  // Volta para página 1 quando busca, filtro ou a lista original mudam
  useEffect(() => { setPagina(1); }, [busca, filtroStatus, funcionarios]);

  const totalPaginas = Math.max(1, Math.ceil(funcionariosFiltrados.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * itensPorPagina;
  // Paginação é exclusiva da versão desktop (busca/filtros/rodapé usam
  // `hidden lg:flex`). Em mobile a tabela sempre mostra a lista completa,
  // preservando o comportamento anterior a esta mudança.
  const linhasExibidas = isMobileOrTablet
    ? funcionarios
    : funcionariosFiltrados.slice(inicio, inicio + itensPorPagina);

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

  // Menu "…" de cada linha. `rotulo` só é passado no computador; no celular o botão fica igual a antes.
  const renderMenuAcoes = (
    funcionario: Funcionario,
    ehDono: boolean,
    statusConvite: "pendente" | "aceito" | "expirado",
    rotulo?: string,
  ) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={rotulo}><MoreHorizontal className="h-4 w-4" /></Button>
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
        {/* O dono liga/desliga pelo interruptor do topo da tela. */}
        {!ehDono && (
          <>
            <DropdownMenuItem onClick={() => onToggleAtivo(funcionario.id, !funcionario.ativo)}>
              <Power className="h-4 w-4 mr-2" />{funcionario.ativo ? "Desativar" : "Ativar"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setFuncionarioExcluir(funcionario)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const inicialDoNome = (nome: string) => nome.trim().charAt(0).toLocaleUpperCase("pt-BR") || "?";

  const estadoVazioDesktop = (titulo: string, dica: string) => (
    <div className="flex flex-col items-center rounded-lg border border-dashed py-12 text-center text-muted-foreground">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Users className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="font-medium text-foreground">{titulo}</p>
      <p className="text-sm mt-1">{dica}</p>
    </div>
  );

  if (funcionarios.length === 0 && !visualDesktop) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhum funcionário cadastrado ainda.</p>
        <p className="text-sm mt-1">Clique em "Novo Funcionário" para adicionar.</p>
      </div>
    );
  }

  const buscaEFiltros = (
    <>
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar funcionário..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 space-y-2">
          <p className="text-sm font-medium">Status</p>
          <Select value={filtroStatus} onValueChange={(v: FiltroStatus) => setFiltroStatus(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </PopoverContent>
      </Popover>
    </>
  );

  const tabelaDesktop = (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-11 px-3 first:pl-4">Funcionário</TableHead>
            <TableHead className="h-11 px-3">Cargo</TableHead>
            <TableHead className="h-11 px-3">Comissão</TableHead>
            <TableHead className="h-11 px-3">Status</TableHead>
            <TableHead className="h-11 px-3">Acessos</TableHead>
            <TableHead className="h-11 px-3">Cadastro</TableHead>
            <TableHead className={cn("h-11 px-3 pr-4 text-right", COLUNA_FIXA, FUNDO_CABECALHO_FIXO)}>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhasExibidas.map((funcionario) => {
            // Mesmas regras da versão do celular: dono sem convite, sem ativar/desativar e sem excluir.
            const ehDono = funcionario.eh_dono === true;
            const statusConvite = ehDono ? "aceito" : getStatusConvite(funcionario);
            const modulosAtivos = getModulosAtivos(funcionario);
            const cargoColor = funcionario.cargo ? (CARGO_COLORS[funcionario.cargo] || "bg-muted text-muted-foreground") : "";

            return (
              <TableRow key={funcionario.id} className="group">
                <TableCell className="py-3 pl-4 pr-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-base font-semibold text-primary"
                    >
                      {inicialDoNome(funcionario.nome)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="max-w-[200px] truncate" title={funcionario.nome}>{funcionario.nome}</span>
                        {ehDono && <Badge variant="secondary" className="shrink-0 text-xs">Você (dono)</Badge>}
                      </div>
                      <p className="max-w-[220px] truncate text-sm text-muted-foreground" title={funcionario.email}>
                        {funcionario.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3">
                  {funcionario.cargo ? (
                    <Badge variant="outline" className={cn("whitespace-nowrap border-transparent px-3 py-1 font-medium", cargoColor)}>
                      {funcionario.cargo}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-3">
                  {/* Pode quebrar em duas linhas para a tabela caber sem rolar. */}
                  <span className="block max-w-[150px] text-sm font-medium">{formatComissao(funcionario)}</span>
                </TableCell>
                <TableCell className="px-3 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant={funcionario.ativo ? "default" : "secondary"} className="px-3 py-1">
                      {funcionario.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    {statusConvite === "pendente" && (
                      <Badge variant="outline" className="whitespace-nowrap text-amber-600 dark:text-amber-400 border-amber-600 dark:border-amber-400">
                        <Clock className="h-3 w-3 mr-1" />
                        Convite pendente
                      </Badge>
                    )}
                    {statusConvite === "expirado" && (
                      <Badge variant="outline" className="whitespace-nowrap text-destructive border-destructive">
                        Convite expirado
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3">
                  <div className="flex max-w-[230px] flex-wrap gap-1.5">
                    {ehDono ? (
                      <span className="text-sm text-muted-foreground">Acesso total (dono)</span>
                    ) : modulosAtivos.length > 0 ? (
                      modulosAtivos.slice(0, 3).map((modulo) => (
                        <Badge key={modulo} variant="outline" className="whitespace-nowrap px-2.5 py-1 text-xs font-medium">{modulo}</Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Apenas básico</span>
                    )}
                    {modulosAtivos.length > 3 && (
                      <Badge variant="outline" className="px-2.5 py-1 text-xs font-medium">+{modulosAtivos.length - 3}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-3 text-sm text-muted-foreground">
                  {format(new Date(funcionario.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell className={cn("py-3 pl-3 pr-4", COLUNA_FIXA, FUNDO_CELULA_FIXA)}>
                  <div className="flex items-center justify-end gap-1">
                    {/* Mesmo Editar do menu "…" (que também aparece para o dono). */}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${funcionario.nome}`}
                      title="Editar"
                      onClick={() => onEditar(funcionario)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {renderMenuAcoes(funcionario, ehDono, statusConvite, `Mais ações de ${funcionario.nome}`)}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <>
      {visualDesktop ? (
        <div className="flex items-end justify-between gap-4 mb-4">
          <div className="min-w-0">{cabecalho}</div>
          <div className="flex shrink-0 items-center gap-2">
            {buscaEFiltros}
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex lg:items-center lg:justify-end gap-2 mb-4">
          {buscaEFiltros}
        </div>
      )}

      {funcionarios.length === 0 ? (
        estadoVazioDesktop("Nenhum funcionário cadastrado ainda.", 'Clique em "Novo Funcionário" para adicionar.')
      ) : funcionariosFiltrados.length === 0 ? (
        visualDesktop ? (
          estadoVazioDesktop("Nenhum funcionário encontrado.", "Tente ajustar a busca ou os filtros.")
        ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhum funcionário encontrado.</p>
          <p className="text-sm mt-1">Tente ajustar a busca ou os filtros.</p>
        </div>
        )
      ) : visualDesktop ? (
        tabelaDesktop
      ) : (
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
            {linhasExibidas.map((funcionario) => {
              // Linha do próprio dono: sem login, sem convite e sem excluir (apagaria o histórico das OS).
              const ehDono = funcionario.eh_dono === true;
              const statusConvite = ehDono ? "aceito" : getStatusConvite(funcionario);
              const modulosAtivos = getModulosAtivos(funcionario);
              const cargoColor = funcionario.cargo ? (CARGO_COLORS[funcionario.cargo] || "bg-muted text-muted-foreground") : "";
              
              return (
                <TableRow key={funcionario.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {funcionario.nome}
                        {ehDono && <Badge variant="secondary" className="text-xs">Você (dono)</Badge>}
                      </p>
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
                      {ehDono ? (
                        <span className="text-sm text-muted-foreground">Acesso total (dono)</span>
                      ) : modulosAtivos.length > 0 ? (
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
                    {renderMenuAcoes(funcionario, ehDono, statusConvite)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      )}

      {funcionariosFiltrados.length > 0 && (
        <div
          className={
            visualDesktop
              ? "mt-4 flex items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground"
              : "hidden lg:flex lg:items-center lg:justify-between gap-3 pt-4 text-sm text-muted-foreground"
          }
        >
          <div className="flex items-center gap-2">
            <span>Mostrando</span>
            <Select
              value={String(itensPorPagina)}
              onValueChange={(v) => setItensPorPagina(Number(v))}
            >
              <SelectTrigger className={visualDesktop ? "h-9 w-[76px]" : "h-8 w-[70px]"} aria-label={visualDesktop ? "Itens por página" : undefined}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITENS_POR_PAGINA_OPCOES.map((opcao) => (
                  <SelectItem key={opcao} value={String(opcao)}>{opcao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>por página</span>
          </div>

          {/* No computador o contador fica junto dos botões (ml-auto vence o justify-between). */}
          <span className={visualDesktop ? "ml-auto" : undefined}>
            {inicio + 1}-{Math.min(inicio + itensPorPagina, funcionariosFiltrados.length)} de {funcionariosFiltrados.length}
          </span>

          <div className={visualDesktop ? "flex items-center gap-1.5" : "flex items-center gap-1"}>
            <Button
              variant="outline"
              size="icon"
              className={visualDesktop ? "h-9 w-9" : "h-8 w-8"}
              aria-label={visualDesktop ? "Página anterior" : undefined}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span
              className={
                visualDesktop
                  ? "flex items-center justify-center h-9 min-w-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold"
                  : "flex items-center justify-center h-8 min-w-8 px-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
              }
              aria-current={visualDesktop ? "page" : undefined}
            >
              {paginaAtual}
            </span>
            <Button
              variant="outline"
              size="icon"
              className={visualDesktop ? "h-9 w-9" : "h-8 w-8"}
              aria-label={visualDesktop ? "Próxima página" : undefined}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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

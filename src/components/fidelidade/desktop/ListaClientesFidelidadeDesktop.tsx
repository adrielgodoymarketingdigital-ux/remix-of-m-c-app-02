import { Gift, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClienteFidelidade, FidelidadeNivel } from "@/types/fidelidade";
import { ChipNivel } from "./ChipNivel";
import { estiloChipNivel } from "./corNivel";
import { estadoVazioFidelidade, filtrarClientesFidelidade, TODOS_OS_NIVEIS } from "./filtroClientes";
import { formatarDataFidelidade, formatarMoedaFidelidade } from "./formatacao";

interface ListaClientesFidelidadeDesktopProps {
  clientes: ClienteFidelidade[];
  niveis: FidelidadeNivel[];
  isLoading: boolean;
  busca: string;
  onBuscaChange: (valor: string) => void;
  /** Já passado por nivelFiltroEfetivo. */
  nivelId: string;
  onNivelChange: (valor: string) => void;
  onResgatar: (cliente: ClienteFidelidade) => void;
}

const COLUNAS = ["Cliente", "Nível", "Pontos", "Compras", "Gasto total", "Ações"] as const;
const COLUNAS_DIREITA = new Set<string>(["Pontos", "Compras", "Gasto total", "Ações"]);

function CabecalhoTabela() {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        {COLUNAS.map(coluna => (
          <TableHead
            key={coluna}
            className={
              "h-11 whitespace-nowrap bg-muted/40 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground" +
              (COLUNAS_DIREITA.has(coluna) ? " text-right" : "")
            }
          >
            {coluna}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function LinhasCarregando() {
  return (
    <Table aria-busy="true" className="min-w-0">
      <CabecalhoTabela />
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i} className="hover:bg-transparent">
            <TableCell className="w-full min-w-[170px] max-w-0 px-3 py-3">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="mt-2 h-3 w-32" />
            </TableCell>
            <TableCell className="px-3"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
            <TableCell className="px-3"><Skeleton className="ml-auto h-5 w-16" /></TableCell>
            <TableCell className="px-3">
              <Skeleton className="ml-auto h-4 w-8" />
              <Skeleton className="ml-auto mt-2 h-3 w-24" />
            </TableCell>
            <TableCell className="px-3"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
            <TableCell className="px-3"><Skeleton className="ml-auto h-9 w-36" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EstadoVazio({ tipo }: { tipo: "sem-resultado" | "sem-clientes" }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
        {tipo === "sem-resultado" ? (
          <Search className="h-9 w-9" aria-hidden="true" />
        ) : (
          <Gift className="h-9 w-9" aria-hidden="true" />
        )}
      </div>
      {tipo === "sem-resultado" ? (
        <p className="mt-5 text-lg font-semibold">Nenhum cliente encontrado para a busca</p>
      ) : (
        <>
          <p className="mt-5 text-lg font-semibold">Nenhum cliente no programa ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Os clientes aparecerão aqui conforme acumulam pontos.</p>
        </>
      )}
    </div>
  );
}

/**
 * Busca, filtro de nível e tabela de clientes da Fidelidade no computador.
 * Mesmas informações e mesma ação (Resgatar Pontos) dos cartões do celular.
 */
export function ListaClientesFidelidadeDesktop({
  clientes,
  niveis,
  isLoading,
  busca,
  onBuscaChange,
  nivelId,
  onNivelChange,
  onResgatar,
}: ListaClientesFidelidadeDesktopProps) {
  const clientesFiltrados = filtrarClientesFidelidade(clientes, busca, nivelId);
  const mostrarTabela = isLoading || clientesFiltrados.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label="Buscar cliente"
            className="h-11 rounded-xl bg-card pl-11 shadow-sm"
            placeholder="Buscar cliente..."
            value={busca}
            onChange={e => onBuscaChange(e.target.value)}
          />
        </div>
        <Select value={nivelId} onValueChange={onNivelChange}>
          <SelectTrigger aria-label="Filtrar por nível" className="h-11 w-60 shrink-0 rounded-xl bg-card shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS_OS_NIVEIS}>Todos os níveis</SelectItem>
            {niveis.map(n => (
              <SelectItem key={n.id} value={n.id}>
                {/* Na lista só a bolinha: o fundo translúcido pareceria item destacado. */}
                <span className="flex min-w-0 items-center gap-2" title={n.nome}>
                  {estiloChipNivel(n.cor).temCor && (
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full ring-1 ring-foreground/25" style={estiloChipNivel(n.cor).ponto} />
                  )}
                  <span className="truncate">{n.nome}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {mostrarTabela ? (
          <>
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold leading-6">Clientes no Programa</h2>
              <p className="text-sm leading-5 text-muted-foreground">Acompanhe pontos, níveis e clientes cadastrados.</p>
            </div>
            {isLoading ? (
              <LinhasCarregando />
            ) : (
              // min-w-0 no lugar do min-w-max padrão: a tabela ocupa a largura do cartão e só rola
              // por dentro quando as colunas de números não cabem.
              <Table className="min-w-0">
                <CabecalhoTabela />
                <TableBody>
                  {clientesFiltrados.map(c => (
                    <TableRow key={c.cliente_id}>
                      {/* w-full + max-w-0: a coluna Cliente fica com o espaço que sobra e corta o texto
                          (com title); as colunas de números nunca são cortadas. */}
                      <TableCell className="w-full min-w-[170px] max-w-0 px-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold leading-5" title={c.nome}>{c.nome}</p>
                          {(c.celular || c.email) && (
                            <p
                              className="truncate text-xs leading-4 text-muted-foreground"
                              title={[c.celular, c.email].filter(Boolean).join(" · ")}
                            >
                              {c.celular && <span className="tabular-nums">{c.celular}</span>}
                              {c.celular && c.email && " · "}
                              {c.email}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-3">
                        {c.nivel ? (
                          <ChipNivel cor={c.nivel.cor} className="max-w-[150px]" title={c.nivel.nome}>{c.nivel.nome}</ChipNivel>
                        ) : (
                          <ChipNivel cor={null}>Sem nível</ChipNivel>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 text-right">
                        <span className="text-base font-bold tabular-nums text-primary">{c.total_pontos.toLocaleString("pt-BR")}</span>
                        <span className="ml-1 text-xs text-muted-foreground">pts</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 text-right">
                        <p className="font-semibold leading-5 tabular-nums">{c.total_vendas + c.total_os}</p>
                        <p className="text-xs leading-4 text-muted-foreground">
                          última compra <span className="tabular-nums">{formatarDataFidelidade(c.ultima_compra)}</span>
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 text-right tabular-nums">
                        {formatarMoedaFidelidade(c.valor_total_gasto)}
                      </TableCell>
                      <TableCell className="px-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          disabled={c.total_pontos <= 0}
                          onClick={() => onResgatar(c)}
                        >
                          <Gift className="w-4 h-4 mr-2" />
                          Resgatar Pontos
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        ) : (
          <EstadoVazio tipo={estadoVazioFidelidade(clientes.length, busca, nivelId)} />
        )}
      </section>
    </div>
  );
}

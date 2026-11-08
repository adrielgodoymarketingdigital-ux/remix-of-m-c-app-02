/**
 * Qual loja cada pessoa ENXERGA nas telas (filtro de leitura). Função pura.
 *
 * Usada só por useIdentidadeLeitura (Vendas, Dashboard, OS, Contas, Relatórios).
 * Saída no formato que os hooks já usam (useIdentidade):
 * - { empresaId: X, isFilial: true }  → só a loja X (registros sem loja NÃO entram)
 * - { empresaId: X, isFilial: false } → matriz X + registros sem loja
 * - { empresaId: null, isFilial: false } → sem contexto de loja: cada hook mantém
 *   o comportamento de antes (dono sem multiempresa, ou matriz desconhecida)
 *
 * Regras (decididas pelo dono):
 * - Dono na matriz: matriz + sem loja.             Dono com filial escolhida: só a filial.
 * - Gerente: só a filial dele.
 * - Funcionário de filial: só a loja dele (antes caía em "matriz + sem loja").
 * - Funcionário da matriz (empresa_id nulo): matriz + sem loja (antes ficava sem
 *   filtro em vários hooks e via todas as lojas). Matriz desconhecida (ex.: RLS
 *   não deixa ler) → sem contexto, o mesmo de antes — nunca tela vazia.
 */
import type { PapelGravacao } from "./resolverLojaGravacao.ts";

export interface EntradaFiltroLeitura {
  papel: PapelGravacao;
  gerenteEmpresaId?: string | null;
  funcionarioEmpresaId?: string | null;
  isProprietario?: boolean;
  empresaAtiva?: string | null;
  /** Matriz do dono (para o dono: EmpresaContext.matrizId; para o funcionário: lida à parte). */
  matrizId?: string | null;
}

export interface FiltroLeitura {
  empresaId: string | null;
  isFilial: boolean;
}

export type ModoFiltroLeitura = "so_loja" | "matriz_e_sem_loja" | "sem_contexto";

const preenchido = (v: string | null | undefined): v is string => typeof v === "string" && v.length > 0;

export function decidirFiltroLeitura(e: EntradaFiltroLeitura): FiltroLeitura {
  switch (e.papel) {
    case "gerente":
      // Igual a antes: sempre filial (sem vínculo de loja = sem filtro).
      return { empresaId: preenchido(e.gerenteEmpresaId) ? e.gerenteEmpresaId : null, isFilial: true };
    case "funcionario":
      if (preenchido(e.funcionarioEmpresaId)) return { empresaId: e.funcionarioEmpresaId, isFilial: true };
      if (preenchido(e.matrizId)) return { empresaId: e.matrizId, isFilial: false };
      return { empresaId: null, isFilial: false };
    case "dono":
      if (e.isProprietario !== true) return { empresaId: null, isFilial: false };
      if (preenchido(e.empresaAtiva)) return { empresaId: e.empresaAtiva, isFilial: true };
      return { empresaId: preenchido(e.matrizId) ? e.matrizId : null, isFilial: false };
  }
}

/**
 * Regra de ANTES da F3 — a mesma do useIdentidade, que continua inalterado e é
 * usado por todas as telas fora do escopo da F3 (e pelo Extrato). Aqui serve de
 * referência nos testes para provar que dono e gerente veem o mesmo de antes.
 */
export function decidirFiltroLeituraAnterior(e: Omit<EntradaFiltroLeitura, "matrizId"> & { matrizId?: string | null }): FiltroLeitura {
  switch (e.papel) {
    case "gerente":
      return { empresaId: e.gerenteEmpresaId ?? null, isFilial: true };
    case "funcionario":
      return { empresaId: e.funcionarioEmpresaId || null, isFilial: false };
    case "dono":
      if (e.isProprietario !== true) return { empresaId: null, isFilial: false };
      return { empresaId: e.empresaAtiva ?? e.matrizId ?? null, isFilial: e.empresaAtiva != null };
  }
}

/** true quando, para decidir, falta ler a matriz do dono (só funcionário sem loja). */
export function filtroLeituraPrecisaDaMatriz(e: Omit<EntradaFiltroLeitura, "matrizId">): boolean {
  return e.papel === "funcionario" && !preenchido(e.funcionarioEmpresaId);
}

export function modoFiltroLeitura(f: FiltroLeitura): ModoFiltroLeitura {
  if (!preenchido(f.empresaId)) return "sem_contexto";
  return f.isFilial ? "so_loja" : "matriz_e_sem_loja";
}

/** true quando o registro com esse empresa_id aparece com esse filtro (mesma regra das consultas). */
export function registroVisivel(empresaIdRegistro: string | null | undefined, f: FiltroLeitura): boolean {
  switch (modoFiltroLeitura(f)) {
    case "sem_contexto":
      return true;
    case "so_loja":
      return empresaIdRegistro === f.empresaId;
    case "matriz_e_sem_loja":
      return !preenchido(empresaIdRegistro) || empresaIdRegistro === f.empresaId;
  }
}

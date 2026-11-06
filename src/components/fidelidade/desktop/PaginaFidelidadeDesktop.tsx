import { useState } from "react";
import type { ClienteFidelidade, FidelidadeNivel } from "@/types/fidelidade";
import { CabecalhoFidelidadeDesktop } from "./CabecalhoFidelidadeDesktop";
import { IndicadoresFidelidadeDesktop, type ContagemNivel } from "./IndicadoresFidelidadeDesktop";
import { ListaClientesFidelidadeDesktop } from "./ListaClientesFidelidadeDesktop";
import { nivelFiltroEfetivo, TODOS_OS_NIVEIS } from "./filtroClientes";

export type { ContagemNivel };

export interface PaginaFidelidadeDesktopProps {
  clientes: ClienteFidelidade[];
  niveis: FidelidadeNivel[];
  isLoading: boolean;
  busca: string;
  onBuscaChange: (valor: string) => void;
  totalPontosDistribuidos: number;
  contagemNiveis: ContagemNivel[];
  onAbrirConfiguracoes: () => void;
  onResgatar: (cliente: ClienteFidelidade) => void;
}

/**
 * Tela de Fidelidade no computador (>= 1024px). Recebe o mesmo estado e os mesmos
 * handlers da página; não consulta nada nem calcula pontos/níveis. O único estado
 * próprio é o filtro por nível (local, por nivel.id).
 */
export function PaginaFidelidadeDesktop({
  clientes,
  niveis,
  isLoading,
  busca,
  onBuscaChange,
  totalPontosDistribuidos,
  contagemNiveis,
  onAbrirConfiguracoes,
  onResgatar,
}: PaginaFidelidadeDesktopProps) {
  const [nivelEscolhido, setNivelEscolhido] = useState<string>(TODOS_OS_NIVEIS);
  const nivelId = nivelFiltroEfetivo(nivelEscolhido, niveis);

  return (
    <main className="min-w-0 flex-1 p-6">
      <div className="space-y-6">
        <CabecalhoFidelidadeDesktop onAbrirConfiguracoes={onAbrirConfiguracoes} />

        <IndicadoresFidelidadeDesktop
          isLoading={isLoading}
          totalClientes={clientes.length}
          totalPontosDistribuidos={totalPontosDistribuidos}
          contagemNiveis={contagemNiveis}
        />

        <ListaClientesFidelidadeDesktop
          clientes={clientes}
          niveis={niveis}
          isLoading={isLoading}
          busca={busca}
          onBuscaChange={onBuscaChange}
          nivelId={nivelId}
          onNivelChange={setNivelEscolhido}
          onResgatar={onResgatar}
        />
      </div>
    </main>
  );
}

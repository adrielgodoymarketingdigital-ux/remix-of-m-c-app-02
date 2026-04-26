import { useMemo } from "react";
import { Cliente } from "@/types/cliente";

export interface ClienteAniversariante {
  id: string;
  nome: string;
  telefone?: string;
  data_nascimento: string;
  dia_aniversario: number;
  idade: number;
  aniversario_hoje: boolean;
}

export function useAniversariantes(clientes: Cliente[]) {
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const diaAtual = hoje.getDate();

  const aniversariantes = useMemo(() => {
    return clientes
      .filter((cliente) => {
        if (!cliente.data_nascimento) return false;
        const dataNasc = new Date(cliente.data_nascimento + "T00:00:00");
        return dataNasc.getMonth() === mesAtual;
      })
      .map((cliente) => {
        const dataNasc = new Date(cliente.data_nascimento + "T00:00:00");
        const diaAniversario = dataNasc.getDate();
        const anoNascimento = dataNasc.getFullYear();
        const anoAtual = hoje.getFullYear();
        
        // Calcular idade corretamente
        let idade = anoAtual - anoNascimento;
        if (
          mesAtual < dataNasc.getMonth() ||
          (mesAtual === dataNasc.getMonth() && diaAtual < diaAniversario)
        ) {
          idade--;
        }

        return {
          id: cliente.id,
          nome: cliente.nome,
          telefone: cliente.telefone,
          data_nascimento: cliente.data_nascimento!,
          dia_aniversario: diaAniversario,
          idade,
          aniversario_hoje: diaAniversario === diaAtual,
        } as ClienteAniversariante;
      })
      .sort((a, b) => {
        // Aniversariantes de hoje primeiro
        if (a.aniversario_hoje && !b.aniversario_hoje) return -1;
        if (!a.aniversario_hoje && b.aniversario_hoje) return 1;
        // Depois ordenar por dia do mês
        return a.dia_aniversario - b.dia_aniversario;
      });
  }, [clientes, mesAtual, diaAtual]);

  const aniversariantesHoje = useMemo(() => {
    return aniversariantes.filter((a) => a.aniversario_hoje);
  }, [aniversariantes]);

  const totalMes = aniversariantes.length;

  return {
    aniversariantes,
    aniversariantesHoje,
    totalMes,
    mesAtual,
  };
}

// Utilitários para uso em outros componentes
export function isAniversarioHoje(dataNascimento?: string): boolean {
  if (!dataNascimento) return false;
  const hoje = new Date();
  const dataNasc = new Date(dataNascimento + "T00:00:00");
  return (
    dataNasc.getDate() === hoje.getDate() &&
    dataNasc.getMonth() === hoje.getMonth()
  );
}

export function isAniversarioEsteMes(dataNascimento?: string): boolean {
  if (!dataNascimento) return false;
  const hoje = new Date();
  const dataNasc = new Date(dataNascimento + "T00:00:00");
  return dataNasc.getMonth() === hoje.getMonth();
}

export function formatarDiaAniversario(dataNascimento?: string): string {
  if (!dataNascimento) return "";
  const dataNasc = new Date(dataNascimento + "T00:00:00");
  return `${dataNasc.getDate().toString().padStart(2, "0")}/${(dataNasc.getMonth() + 1).toString().padStart(2, "0")}`;
}

export function calcularIdade(dataNascimento?: string): number {
  if (!dataNascimento) return 0;
  const hoje = new Date();
  const dataNasc = new Date(dataNascimento + "T00:00:00");
  let idade = hoje.getFullYear() - dataNasc.getFullYear();
  if (
    hoje.getMonth() < dataNasc.getMonth() ||
    (hoje.getMonth() === dataNasc.getMonth() && hoje.getDate() < dataNasc.getDate())
  ) {
    idade--;
  }
  return idade;
}

export function getNomeMes(mes: number): string {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return meses[mes] || "";
}

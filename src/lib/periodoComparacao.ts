/**
 * Período do mês anterior usado na variação "vs. mês anterior" do Dashboard.
 * Mês em andamento: só os mesmos dias do mês anterior (dia 2 compara com 1–2 do
 * mês passado), senão um mês parcial sairia sempre perdendo do mês inteiro.
 * Mês já fechado: o mês anterior inteiro. Sem o "dia 31" que o mês anterior não
 * tem: 31/03 compara até 28/02.
 */
export const periodoComparacaoMesAnterior = (inicioMes: Date, hoje: Date = new Date()) => {
  const ano = inicioMes.getFullYear();
  const mes = inicioMes.getMonth();
  const ultimoDiaAnterior = new Date(ano, mes, 0).getDate();
  const mesEmAndamento = hoje.getFullYear() === ano && hoje.getMonth() === mes;
  const dia = mesEmAndamento ? Math.min(hoje.getDate(), ultimoDiaAnterior) : ultimoDiaAnterior;
  return {
    inicio: new Date(ano, mes - 1, 1, 0, 0, 0, 0),
    fim: new Date(ano, mes - 1, dia, 23, 59, 59, 999),
    mesEmAndamento,
  };
};

/** Quantos dias de calendário o período cobre, com início e fim inclusive. */
export const contarDiasDoPeriodo = (inicio: Date, fim: Date): number => {
  const diaInicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()).getTime();
  const diaFim = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()).getTime();
  return Math.round((diaFim - diaInicio) / (1000 * 60 * 60 * 24)) + 1;
};

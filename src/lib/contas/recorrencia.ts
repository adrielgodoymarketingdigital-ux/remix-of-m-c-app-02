/**
 * Próxima data de uma conta recorrente (mensal), direto do texto "YYYY-MM-DD".
 *
 * Antes era `new Date(conta.data)`: o texto vira meia-noite UTC, que no Brasil
 * ainda é o dia anterior, e a próxima conta nascia 1 dia antes (20/11 → 19/12),
 * recuando um dia por mês. Aqui não há Date nem fuso no caminho.
 *
 * Mês sem o dia (31 → fevereiro): usa o último dia do mês, em vez de pular
 * para o mês seguinte (31/01 virava 03/03).
 *
 * diaAnterior: onde o código antigo teria gerado a mesma conta (1 dia antes),
 * para a checagem de "já existe a próxima" não duplicar contas antigas.
 */
export function proximaDataRecorrente(data: string): { data: string; diaAnterior: string; ano: number; mes: number } {
  const [ano, mes, dia] = String(data).slice(0, 10).split("-").map(Number);
  const proxAno = mes === 12 ? ano + 1 : ano;
  const proxMes = mes === 12 ? 1 : mes + 1;
  const ultimoDia = new Date(Date.UTC(proxAno, proxMes, 0)).getUTCDate();
  const p2 = (n: number) => String(n).padStart(2, "0");
  const diaProx = Math.min(dia, ultimoDia);
  const anterior = new Date(Date.UTC(proxAno, proxMes - 1, diaProx - 1));
  return {
    data: `${proxAno}-${p2(proxMes)}-${p2(diaProx)}`,
    diaAnterior: `${anterior.getUTCFullYear()}-${p2(anterior.getUTCMonth() + 1)}-${p2(anterior.getUTCDate())}`,
    ano: proxAno,
    mes: proxMes,
  };
}

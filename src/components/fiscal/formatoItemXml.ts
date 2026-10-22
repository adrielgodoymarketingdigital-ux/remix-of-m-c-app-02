import { formatCurrency } from '@/lib/formatters';

/** Formatação dos valores da NF-e na tela (os valores chegam como string decimal ou centavos). */
export const dinheiro = (v: string) => (v ? formatCurrency(Number(v)) : '—');
export const dinheiroCentavos = (c: number | null | undefined) => (c === null || c === undefined ? '—' : formatCurrency(c / 100));
export const quantidade = (v: string) => (v ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 }) : '—');

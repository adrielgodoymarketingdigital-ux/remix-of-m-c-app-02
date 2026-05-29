import { format } from "date-fns";

export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

function parseDate(date: string | Date): Date {
  if (typeof date === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // Pure date — parse as local midnight to avoid timezone shift
      return new Date(`${date}T00:00:00`);
    }
    // Timestamp — new Date() applies local timezone correctly for display
    return new Date(date);
  }
  return new Date(date);
}

// Extracts YYYY-MM-DD from any date string, applying local timezone for timestamps
export const extrairDataLocal = (date: string | Date): string => {
  if (typeof date === "string") {
    // Pure date (YYYY-MM-DD) — use as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    // Timestamp — convert to local date to avoid UTC offset shifting the day
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = date as Date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Returns today's date as YYYY-MM-DD using local timezone (not UTC)
export const dataHoje = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const formatDate = (date: string | Date): string => {
  return format(parseDate(date), "dd/MM/yyyy");
};

export const formatDateTime = (date: string | Date): string => {
  return format(parseDate(date), "dd/MM/yyyy HH:mm");
};

// Exibe data+hora se for timestamp, ou só data se for DATE pura (YYYY-MM-DD)
export const formatDataVenda = (date: string | Date): string => {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return format(parseDate(date), "dd/MM/yyyy");
  }
  return format(new Date(date), "dd/MM/yyyy HH:mm");
};

export const formatTime = (date: string | Date): string => {
  return format(parseDate(date), "HH:mm");
};

export const formatPhone = (phone: string | null): string => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

export const formatCPF = (cpf: string | null): string => {
  if (!cpf) return "";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  }
  return cpf;
};

interface EnderecoLoja {
  endereco?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

export const formatarEndereco = (loja: EnderecoLoja): string => {
  if (loja.endereco?.trim()) return loja.endereco.trim();
  const partes: string[] = [];
  if (loja.logradouro) partes.push(loja.logradouro);
  if (loja.numero) partes.push(`nº ${loja.numero}`);
  if (loja.complemento) partes.push(loja.complemento);
  if (loja.bairro) partes.push(`- ${loja.bairro}`);
  if (loja.cidade && loja.estado) partes.push(`- ${loja.cidade}/${loja.estado}`);
  else if (loja.cidade) partes.push(`- ${loja.cidade}`);
  if (loja.cep) partes.push(`- CEP: ${loja.cep}`);
  return partes.join(" ");
};

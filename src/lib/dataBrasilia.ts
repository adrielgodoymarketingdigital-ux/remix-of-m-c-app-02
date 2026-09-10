/**
 * Utilitários de fuso horário de Brasília pro client (browser).
 *
 * Espelha supabase/functions/_shared/tz.ts (mesmo algoritmo, mesma razão de
 * existir) — lá o motivo é o runtime Deno rodar sempre em UTC; aqui o motivo
 * é não confiar no fuso configurado no SO/navegador do usuário (pode estar
 * errado, ou o usuário pode estar acessando de fora do Brasil) para decidir
 * o que é "hoje"/"ontem" numa tela financeira — a loja opera em horário de
 * Brasília independente de onde o navegador está configurado.
 *
 * Use `dataBrasiliaISO()` sempre que precisar da data "de calendário" (YYYY-MM-DD)
 * de Brasília pra filtros de período (Hoje/Ontem/7 dias/Mês atual). NÃO use
 * `new Date().toISOString().split("T")[0]` direto — isso converte pra UTC
 * antes de fatiar e erra o dia entre 21h e meia-noite (horário de Brasília).
 */

const TZ_BRASIL = "America/Sao_Paulo";

const _fmtBrasilia = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ_BRASIL,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Converte um instante para um Date "de parede" de Brasília: os getters
 * (`getFullYear` / `getMonth` / `getDate` / `getHours` ...) passam a devolver
 * o horário local de São Paulo, independente do fuso do navegador.
 */
export function toBrasilia(instant: Date): Date {
  const parts = _fmtBrasilia.formatToParts(instant);
  const p: Record<string, number> = {};
  for (const { type, value } of parts) {
    if (type !== "literal") p[type] = Number(value);
  }
  // Alguns runtimes devolvem "24" para a hora à meia-noite; normalizar para 0.
  const hour = p.hour === 24 ? 0 : p.hour;
  return new Date(Date.UTC(p.year, p.month - 1, p.day, hour, p.minute, p.second));
}

/** Agora, como Date "de parede" de Brasília. Ver `toBrasilia`. */
export function nowBrasilia(): Date {
  return toBrasilia(new Date());
}

/** Data "de calendário" de Brasília como string YYYY-MM-DD — segura pra filtros de período (Hoje/Ontem/etc). */
export function dataBrasiliaISO(instant: Date = new Date()): string {
  return toBrasilia(instant).toISOString().split("T")[0];
}

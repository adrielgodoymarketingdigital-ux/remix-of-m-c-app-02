/**
 * Utilitários de fuso horário para as Edge Functions.
 *
 * O runtime das Supabase Edge Functions (Deno) roda SEMPRE em UTC. Isso faz
 * `new Date().getMonth()` / `.getDate()` "virarem" para o próximo dia/mês às
 * 21:00 horário de Brasília — America/Sao_Paulo, offset fixo −03:00 o ano todo
 * desde o fim do horário de verão brasileiro em 2019.
 *
 * Use `nowBrasilia()` sempre que precisar do ANO / MÊS / DIA "de calendário"
 * do Brasil (ex.: "qual é o mês atual?"). NÃO use o valor absoluto do Date
 * retornado (`getTime()` / `toISOString()`) como instante real — ele está
 * deslocado de propósito. Para comparações do tipo "isso já expirou agora?"
 * continue usando `new Date()`.
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
 * (`getFullYear` / `getMonth` / `getDate` / `getHours` ...) — que no runtime
 * UTC das Edge Functions equivalem aos getters UTC — passam a devolver o
 * horário local de São Paulo.
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

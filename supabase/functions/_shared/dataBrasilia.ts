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

/**
 * Início e fim de um dia de calendário de Brasília (00:00:00.000 e
 * 23:59:59.999 locais), como timestamps UTC precisos e explícitos —
 * prontos pra usar em `.gte()/.lte()` contra colunas `timestamptz`.
 *
 * Existe porque mandar a string de data pura (ou uma string "YYYY-MM-
 * DDTHH:mm:ss" sem sufixo de fuso) direto pro Postgres faz ele interpretar
 * o horário na timezone da SESSÃO do banco — UTC no Supabase, não Brasília
 * — e qualquer evento entre 21h e meia-noite (horário de Brasília) cai no
 * dia UTC seguinte, errando o filtro por até 3h (bug confirmado em
 * useRelatoriosVendas.ts e nas seções de Financeiro — ver DIVIDA-TECNICA.md
 * pro que ainda não foi migrado pra este helper).
 *
 * `dataYYYYMMDD` é a data de calendário de Brasília desejada (normalmente
 * vinda de `dataBrasiliaISO()`/`FiltroPeriodoAvancado`). O deslocamento
 * Brasília↔UTC é recalculado a cada chamada via `toBrasilia` (mesmo
 * mecanismo do resto deste arquivo) em vez de fixar "-03:00" — continua
 * correto mesmo se a regra de fuso do Brasil mudar no futuro.
 */
export function limitesDiaBrasilia(dataYYYYMMDD: string): { inicioISO: string; fimISO: string } {
  const [year, month, day] = dataYYYYMMDD.split("-").map(Number);

  // Palpite: meia-noite UTC do dia informado. Descobre quanto esse instante
  // "desliza" quando reinterpretado em Brasília — esse deslocamento é o
  // mesmo (em Brasília, hoje, sempre 3h) usado pra corrigir início e fim.
  const palpiteUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const palpiteEmBrasilia = toBrasilia(new Date(palpiteUTC)).getTime();
  const deslocamentoMs = palpiteUTC - palpiteEmBrasilia;

  const inicioISO = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) + deslocamentoMs).toISOString();
  const fimISO = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) + deslocamentoMs).toISOString();

  return { inicioISO, fimISO };
}

/**
 * Data e hora "de parede" de Brasília de um instante, para preencher
 * <input type="date"> e <input type="time"> sem depender do fuso do navegador.
 */
export function partesDataHoraBrasilia(instante: Date | string): { data: string; hora: string } {
  const b = toBrasilia(new Date(instante));
  const iso = b.toISOString(); // campos UTC de `b` = horário de Brasília
  return { data: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

/**
 * Inverso de `partesDataHoraBrasilia`: data (YYYY-MM-DD) + hora (HH:mm) de
 * Brasília → instante ISO UTC exato, pronto para gravar em timestamptz.
 * Mesmo deslocamento de `limitesDiaBrasilia` (recalculado para o dia).
 */
export function instanteBrasiliaISO(dataYYYYMMDD: string, horaHHmm: string): string {
  const [h, m] = horaHHmm.split(":").map(Number);
  const inicioDia = new Date(limitesDiaBrasilia(dataYYYYMMDD).inicioISO).getTime();
  return new Date(inicioDia + ((h || 0) * 60 + (m || 0)) * 60_000).toISOString();
}

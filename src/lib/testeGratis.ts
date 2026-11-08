/**
 * Teste grátis do cadastro (plano free com assinaturas.free_trial_ends_at).
 * Sem React, sem alias e sem navegador: testado com Deno em
 * scripts/testes-teste-gratis/.
 *
 * O FIM do teste vem SEMPRE do banco (free_trial_ends_at). Quem grava esse
 * prazo é a função criar_assinatura_basica_gratuita(); mudar a constante
 * abaixo NÃO muda o banco. Ela serve só para o app mostrar ou calcular o
 * prazo prometido (textos, simulações e testes).
 */
export const PRAZO_TESTE_CADASTRO_DIAS = 14;

/** Acima disso o contador mostra dias ("13 dias e 4h"); até isso, o relógio HH:MM:SS. */
export const LIMITE_HORAS_CONTADOR_EM_DIAS = 48;

const MS_SEGUNDO = 1000;
const MS_MINUTO = 60 * MS_SEGUNDO;
const MS_HORA = 60 * MS_MINUTO;
const MS_DIA = 24 * MS_HORA;

export type TempoRestanteTeste =
  /** Data ausente ou inválida: não mostrar contador. */
  | { tipo: "invalido" }
  /** Chegou a zero ou já passou. */
  | { tipo: "expirado" }
  /** Mais de 48 h: dias inteiros + horas inteiras que sobram (0 a 23). */
  | { tipo: "dias"; dias: number; horas: number }
  /** Até 48 h: relógio (horas podem chegar a 48). */
  | { tipo: "relogio"; horas: number; minutos: number; segundos: number };

/**
 * Quanto falta para o fim do teste. A conta é pela diferença em milissegundos
 * entre dois instantes, então o fuso do aparelho não muda o resultado.
 * Arredonda sempre para baixo (nunca promete tempo a mais).
 */
export function calcularTempoRestanteTeste(
  fim: string | null | undefined,
  agoraMs: number,
): TempoRestanteTeste {
  if (!fim) return { tipo: "invalido" };
  const fimMs = new Date(fim).getTime();
  if (!Number.isFinite(fimMs)) return { tipo: "invalido" };

  const diff = fimMs - agoraMs;
  if (diff <= 0) return { tipo: "expirado" };

  if (diff > LIMITE_HORAS_CONTADOR_EM_DIAS * MS_HORA) {
    return {
      tipo: "dias",
      dias: Math.floor(diff / MS_DIA),
      horas: Math.floor((diff % MS_DIA) / MS_HORA),
    };
  }

  return {
    tipo: "relogio",
    horas: Math.floor(diff / MS_HORA),
    minutos: Math.floor((diff % MS_HORA) / MS_MINUTO),
    segundos: Math.floor((diff % MS_MINUTO) / MS_SEGUNDO),
  };
}

const FORMATO_DIA_MES_BRASILIA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});

/**
 * Selo do painel de usuários do admin: "Em teste até DD/MM" (dia e mês em
 * Brasília) para conta free com free_trial_ends_at no futuro. Qualquer outro
 * caso devolve null e o painel mostra o plano como sempre.
 */
export function rotuloTesteGratisAdmin(
  planoTipo: string | null | undefined,
  freeTrialEndsAt: string | null | undefined,
  agoraMs: number,
): string | null {
  if (planoTipo !== "free" || !freeTrialEndsAt) return null;
  const fimMs = new Date(freeTrialEndsAt).getTime();
  if (!Number.isFinite(fimMs) || fimMs <= agoraMs) return null;
  return `Em teste até ${FORMATO_DIA_MES_BRASILIA.format(fimMs)}`;
}

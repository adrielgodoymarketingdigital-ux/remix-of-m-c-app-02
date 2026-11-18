/**
 * Diferença entre o relógio do aparelho e o do servidor (lógica pura).
 * A leitura do banco é injetada: ver relogioServidor.ts.
 *
 * Sem hora do servidor (função ausente, erro, sem internet ou demora), o
 * relógio do aparelho é usado, como sempre foi. Nada aqui lança erro.
 */

export const VALIDADE_AMOSTRA_MS = 5 * 60_000;
export const TEMPO_LIMITE_LEITURA_MS = 3_000;
/** Acima disto o usuário é avisado de que o relógio do aparelho está errado. */
export const LIMITE_AVISO_RELOGIO_MS = 3 * 60_000;

/**
 * Quanto somar ao relógio do aparelho para chegar ao do servidor. Considera
 * que o servidor respondeu no meio da requisição. null = resposta inválida.
 */
export function calcularOffsetMs(amostra: {
  enviadoEmMs: number;
  recebidoEmMs: number;
  horaServidor: unknown;
}): number | null {
  if (typeof amostra.horaServidor !== "string") return null;
  const servidorMs = Date.parse(amostra.horaServidor);
  if (!Number.isFinite(servidorMs)) return null;
  return Math.round(servidorMs - (amostra.enviadoEmMs + amostra.recebidoEmMs) / 2);
}

export interface DivergenciaRelogio {
  direcao: "atrasado" | "adiantado";
  horas: number;
  minutos: number;
}

/** Diferença a avisar. null = dentro do limite ou hora do servidor indisponível. */
export function divergenciaRelogio(offsetMs: number | null): DivergenciaRelogio | null {
  if (offsetMs === null || Math.abs(offsetMs) <= LIMITE_AVISO_RELOGIO_MS) return null;
  const totalMinutos = Math.round(Math.abs(offsetMs) / 60_000);
  return {
    direcao: offsetMs > 0 ? "atrasado" : "adiantado",
    horas: Math.floor(totalMinutos / 60),
    minutos: totalMinutos % 60,
  };
}

/** Amostra ainda vale? Relógio que voltou no tempo invalida a amostra. */
const aindaValida = (feitaEmMs: number | null, agoraMs: number): boolean => {
  if (feitaEmMs === null) return false;
  const idade = agoraMs - feitaEmMs;
  return idade >= 0 && idade < VALIDADE_AMOSTRA_MS;
};

export interface DependenciasRelogio {
  /** Devolve a hora do servidor. Pode rejeitar: vira fallback. */
  lerHoraServidor: () => Promise<unknown>;
  /** Relógio do aparelho. */
  agoraMs?: () => number;
  tempoLimiteMs?: number;
}

export function criarRelogioServidor(deps: DependenciasRelogio) {
  const agoraAparelho = deps.agoraMs ?? (() => Date.now());
  const tempoLimiteMs = deps.tempoLimiteMs ?? TEMPO_LIMITE_LEITURA_MS;

  let offsetMs: number | null = null;
  let amostraEmMs: number | null = null;
  let tentativaEmMs: number | null = null;
  let emAndamento: Promise<void> | null = null;
  const ouvintes = new Set<() => void>();

  const lerComTempoLimite = async (): Promise<unknown> => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const limite = new Promise<undefined>((resolve) => {
      temporizador = setTimeout(() => resolve(undefined), tempoLimiteMs);
    });
    try {
      return await Promise.race([deps.lerHoraServidor(), limite]);
    } catch {
      return undefined;
    } finally {
      clearTimeout(temporizador);
    }
  };

  const atualizar = async (): Promise<void> => {
    const enviadoEmMs = agoraAparelho();
    const horaServidor = await lerComTempoLimite();
    const recebidoEmMs = agoraAparelho();
    const novo = calcularOffsetMs({ enviadoEmMs, recebidoEmMs, horaServidor });
    const anterior = offsetMs;

    tentativaEmMs = recebidoEmMs;
    if (novo !== null) {
      offsetMs = novo;
      amostraEmMs = recebidoEmMs;
    } else if (!aindaValida(amostraEmMs, recebidoEmMs)) {
      offsetMs = null;
      amostraEmMs = null;
    }
    if (offsetMs !== anterior) ouvintes.forEach((avisar) => avisar());
  };

  return {
    /** Atualiza a diferença se o cache venceu (ou sempre, com forcar). Nunca rejeita. */
    sincronizar(opcoes: { forcar?: boolean } = {}): Promise<void> {
      if (emAndamento) return emAndamento;
      if (!opcoes.forcar && aindaValida(tentativaEmMs, agoraAparelho())) return Promise.resolve();
      emAndamento = atualizar().finally(() => {
        emAndamento = null;
      });
      return emAndamento;
    },
    /** Hora do servidor, ou a do aparelho quando ela não pôde ser lida. */
    agoraMs: (): number => agoraAparelho() + (offsetMs ?? 0),
    agoraISO: (): string => new Date(agoraAparelho() + (offsetMs ?? 0)).toISOString(),
    /** null = hora do servidor indisponível. */
    offsetMs: (): number | null => offsetMs,
    /** Avisa quando a diferença mudar. Devolve a função que cancela. */
    assinar(ouvinte: () => void): () => void {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    /** Volta ao estado inicial (usado nos testes). */
    reiniciar(): void {
      offsetMs = null;
      amostraEmMs = null;
      tentativaEmMs = null;
      emAndamento = null;
    },
  };
}

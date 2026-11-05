// Lógica do CompleteRegistration de quem acabou de se cadastrar em /auth, onde a
// página é trocada logo depois do signUp. Sem imports: os testes rodam direto no
// node (scripts/funil-eventos/testes-registro.mjs).

/** Tempo mínimo em /auth depois do cadastro: o mesmo que o redirecionamento já esperava. */
export const ESPERA_MINIMA_MS = 500;
/** Teto da espera pela confirmação do envio; depois disso a página sai de qualquer jeito. */
export const ESPERA_MAXIMA_MS = 800;

export interface EnvioRegistro {
  gerarEventId: () => string;
  dispararPixel: (eventId: string) => void;
  /** As duas funções abaixo precisam usar requisição que sobrevive à troca de página. */
  enviarCapi: (eventId: string) => Promise<unknown>;
  marcarRastreado: () => Promise<unknown>;
  aoFalhar?: (etapa: "pixel" | "capi" | "marcar", erro: unknown) => void;
}

/**
 * Dispara Pixel, CAPI e a marcação na mesma passada, com o mesmo event_id, e
 * resolve quando as requisições terminarem. Nunca rejeita: rastreamento não pode
 * atrapalhar o cadastro.
 */
export async function enviarRegistroNovo(envio: EnvioRegistro): Promise<void> {
  const eventId = envio.gerarEventId();

  try {
    envio.dispararPixel(eventId);
  } catch (erro) {
    envio.aoFalhar?.("pixel", erro);
  }

  const chamar = (etapa: "capi" | "marcar", acao: () => Promise<unknown>) => {
    try {
      return acao().catch((erro) => envio.aoFalhar?.(etapa, erro));
    } catch (erro) {
      envio.aoFalhar?.(etapa, erro);
      return Promise.resolve();
    }
  };

  await Promise.all([
    chamar("capi", () => envio.enviarCapi(eventId)),
    chamar("marcar", envio.marcarRastreado),
  ]);
}

/**
 * Resolve quando o envio terminar, respeitando o mínimo de `minimoMs`, ou em
 * `maximoMs`, o que vier primeiro. Nunca rejeita.
 */
export function aguardarEnvioAntesDeSair(
  envio: Promise<unknown>,
  minimoMs: number = ESPERA_MINIMA_MS,
  maximoMs: number = ESPERA_MAXIMA_MS,
): Promise<void> {
  return new Promise((resolve) => {
    const limite = setTimeout(resolve, maximoMs);
    const minimo = new Promise((ok) => setTimeout(ok, minimoMs));
    Promise.all([envio.catch(() => undefined), minimo]).then(() => {
      clearTimeout(limite);
      resolve();
    });
  });
}

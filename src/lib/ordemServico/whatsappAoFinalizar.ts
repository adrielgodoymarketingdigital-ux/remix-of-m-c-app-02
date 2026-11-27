// Decide se, depois de mudar o status de UMA OS na tela, o app abre o diálogo
// de WhatsApp para avisar o cliente. O app nunca envia sozinho: o diálogo só
// prepara a mensagem e o usuário toca em enviar.

export const STATUS_FINALIZADO = "finalizado";

export interface EntradaWhatsAppAoFinalizar {
  /** Slug do status escolhido pelo usuário. */
  novoStatus: string;
  /** Slug que a OS tinha antes da mudança (null/undefined = desconhecido). */
  statusAnterior: string | null | undefined;
  /** Mudança em lote (várias OS de uma vez) nunca abre o diálogo. */
  emLote: boolean;
  /** A atualização do status deu certo (a OS está gravada com o novo status). */
  mudou: boolean;
}

export function deveOferecerWhatsAppAoFinalizar({
  novoStatus,
  statusAnterior,
  emLote,
  mudou,
}: EntradaWhatsAppAoFinalizar): boolean {
  return (
    novoStatus === STATUS_FINALIZADO &&
    statusAnterior !== STATUS_FINALIZADO &&
    !emLote &&
    mudou
  );
}

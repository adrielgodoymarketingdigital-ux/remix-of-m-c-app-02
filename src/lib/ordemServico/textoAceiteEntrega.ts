// Texto do aceite que o cliente assina ao receber o aparelho ("Confirmar Entrega").
// Só exibição: não é gravado no banco.
// Mesma regra do termo impresso (termo-garantia-utils: tempoGarantia || 0):
// null, undefined, 0, NaN ou negativo = sem garantia.

const INICIO = "Declaro ter recebido o dispositivo nas condições descritas acima";

export function textoAceiteEntrega(tempoGarantiaDias: number | null | undefined): string {
  const dias = typeof tempoGarantiaDias === "number" && Number.isFinite(tempoGarantiaDias)
    ? tempoGarantiaDias
    : 0;

  if (dias <= 0) {
    return `${INICIO} e estou ciente de que este serviço não possui garantia.`;
  }

  return `${INICIO} e estou ciente do termo de garantia de ${dias} dias para o serviço executado.`;
}

// Erro com código do Recibo Legal. compra/dispositivo não encontrados viram a mensagem
// de cada tela (regrasReciboLegal.ts); termo_nao_atualizado é traduzido pela chave
// reciboLegal.erros.termo_nao_atualizado do namespace "comum".
export type CodigoErroReciboLegal =
  | "compra_nao_encontrada"
  | "dispositivo_nao_encontrado"
  | "termo_nao_atualizado";

export class ErroReciboLegal extends Error {
  readonly codigo: CodigoErroReciboLegal;
  readonly campos: string[];
  constructor(codigo: CodigoErroReciboLegal, campos: string[] = []) {
    super(campos.length ? `${codigo}: ${campos.join(", ")}` : codigo);
    this.name = "ErroReciboLegal";
    this.codigo = codigo;
    this.campos = campos;
  }
}

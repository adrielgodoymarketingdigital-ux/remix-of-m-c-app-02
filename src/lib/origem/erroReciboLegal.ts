// Erro com código do Recibo Legal: a tela traduz pelo código (chave
// reciboLegal.erros.<codigo> do namespace "comum").
export type CodigoErroReciboLegal =
  | "compra_nao_encontrada"
  | "dispositivo_nao_encontrado"
  | "dispositivo_incompleto"
  | "sem_vendedor"
  | "loja_incompleta"
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

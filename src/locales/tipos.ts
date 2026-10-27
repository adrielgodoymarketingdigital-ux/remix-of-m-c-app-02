/**
 * Forma de uma tradução: EXATAMENTE as chaves do pt-BR (que é a fonte). Chave
 * que falta, chave a mais ou digitada errado é erro de tipo. Lista de textos
 * (ex.: as frases do dia) tem de ter o mesmo tamanho da do pt-BR.
 */
export type Traducao<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends readonly string[]
      ? { readonly [I in keyof T[K]]: string }
      : Traducao<T[K]>;
};

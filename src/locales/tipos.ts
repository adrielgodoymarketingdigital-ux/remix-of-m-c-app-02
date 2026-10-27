/**
 * Forma de uma tradução: as MESMAS chaves do pt-BR (que é a fonte), todas
 * opcionais — chave que falta cai no pt-BR (fallbackLng). Chave a mais ou
 * digitada errado é erro de tipo.
 */
export type Traducao<T> = { [K in keyof T]?: T[K] extends string ? string : Traducao<T[K]> };

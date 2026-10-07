/**
 * Modo com que a tela "Gerar Etiquetas" abre. O último modo usado fica só no
 * navegador (localStorage), e sem nada salvo é "Térmica avulsa" — por isso uma
 * loja com padrão de folha (configuracoes_loja.etiquetas_padroes) via a tela
 * abrir na térmica em outro aparelho/navegador e imprimia uma etiqueta por vez.
 * Regra: loja com padrão salvo abre em Folha/Grade; a escolha feita à mão nesta
 * sessão do navegador vale e não é trocada. Sem dependências (testado com Deno).
 */

export type FormatoImpressaoEtiqueta = "termica" | "a4";

export const AVISO_TERMICA_COM_PADRAO_FOLHA =
  "Sua loja usa etiqueta em folha (várias por linha). A Térmica avulsa imprime uma etiqueta por vez.";

export interface DecisaoModoInicial {
  formato: FormatoImpressaoEtiqueta;
  /** Padrão salvo a usar; null = manter o padrão que já está na configuração. */
  padraoId: string | null;
}

export function escolherModoInicial(p: {
  /** Modo e padrão lembrados neste navegador (ou os de fábrica). */
  formatoLembrado: FormatoImpressaoEtiqueta;
  padraoLembradoId: string;
  /** Ids dos padrões salvos da loja, na ordem da lista. */
  padroesLoja: string[];
  /** O usuário clicou em Térmica/Folha nesta sessão do navegador. */
  escolhaManualNaSessao: boolean;
}): DecisaoModoInicial {
  if (p.escolhaManualNaSessao || p.padroesLoja.length === 0) return { formato: p.formatoLembrado, padraoId: null };
  const padraoId = p.padroesLoja.includes(p.padraoLembradoId) ? p.padraoLembradoId : p.padroesLoja[0];
  return { formato: "a4", padraoId };
}

/** Aviso ao escolher Térmica avulsa numa loja com padrão de folha. */
export function avisoModoEtiqueta(formato: FormatoImpressaoEtiqueta, quantidadePadroesLoja: number): string | null {
  return formato === "termica" && quantidadePadroesLoja > 0 ? AVISO_TERMICA_COM_PADRAO_FOLHA : null;
}

const CHAVE_SESSAO = "etiquetas_formato_escolhido_na_sessao";

/** Lembra (só nesta sessão do navegador) que o modo foi escolhido à mão. */
export function marcarEscolhaManualNaSessao(armazenamento: Pick<Storage, "setItem"> | null | undefined): void {
  try {
    armazenamento?.setItem(CHAVE_SESSAO, "1");
  } catch {
    // storage indisponível: a escolha vale enquanto a tela estiver aberta
  }
}

export function houveEscolhaManualNaSessao(armazenamento: Pick<Storage, "getItem"> | null | undefined): boolean {
  try {
    return armazenamento?.getItem(CHAVE_SESSAO) === "1";
  } catch {
    return false;
  }
}

// configuracoes_loja.layout_os_config é um JSON só, compartilhado por várias
// telas: layout de impressão da OS, etiqueta (etiqueta_config) e técnico
// obrigatório (tecnico_obrigatorio_os). Cada tela edita só as chaves dela, então
// a gravação é sempre uma mescla sobre o valor mais recente lido do banco —
// nunca a substituição do JSON inteiro.

type Chaves = Record<string, unknown>;

function comoObjeto(valor: unknown): Chaves {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? (valor as Chaves) : {};
}

/** Mantém tudo que já estava gravado e aplica por cima só o que a tela editou. */
export function mesclarLayoutOS<T extends object>(atual: unknown, editado: T): Chaves & T {
  return { ...comoObjeto(atual), ...editado };
}

export interface LinhaLayoutOS {
  id: string;
  layout_os_config: unknown;
}

/**
 * Linha da matriz (empresa_id null) a partir do resultado da consulta. Lança
 * erro quando não dá para saber com certeza qual é a linha, para quem grava
 * nunca partir de um JSON vazio nem atingir mais de uma linha.
 */
export function linhaMatrizUnica(
  linhas: LinhaLayoutOS[] | null | undefined,
  erro?: unknown,
): LinhaLayoutOS {
  if (erro || !Array.isArray(linhas)) {
    throw new Error("Não foi possível ler a configuração da loja. Nada foi alterado — tente novamente.");
  }
  if (linhas.length === 0) {
    throw new Error("Configuração da loja não encontrada. Nada foi alterado.");
  }
  if (linhas.length > 1) {
    throw new Error("Há mais de uma configuração principal para esta loja. Nada foi alterado — fale com o suporte.");
  }
  return linhas[0];
}

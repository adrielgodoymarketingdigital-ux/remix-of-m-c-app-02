/**
 * Técnicos ADICIONAIS da OS (fase F2, só tela + gravação). Regras puras, sem
 * banco: quem pode ser escolhido, normalização da lista, quando gravar e a
 * tradução dos erros TA001..TA008 da função salvar_tecnicos_os.
 *
 * O principal continua em ordens_servico.funcionario_id; os adicionais moram
 * em os_tecnicos_adicionais (até 4). Comissão NÃO muda: é só os_tecnicos.
 */

/** Máximo de técnicos adicionais por OS (o banco recusa o 5º com TA005). */
export const MAX_TECNICOS_ADICIONAIS = 4;

/** O pedaço de loja_funcionarios que a tela usa (inclui a linha "dono como funcionário"). */
export interface FuncionarioTecnico {
  id: string;
  nome: string;
  cargo?: string | null;
  ativo: boolean;
}

/** Tira vazios, repetidos (fica o primeiro) e o principal. Não corta no máximo: quem grava confere. */
export function normalizarAdicionais(
  lista: readonly (string | null | undefined)[],
  principal: string | null,
): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const bruto of lista) {
    const id = (bruto ?? "").trim();
    if (!id || id === principal || vistos.has(id)) continue;
    vistos.add(id);
    saida.push(id);
  }
  return saida;
}

/** Ainda cabe mais um adicional? */
export function podeAdicionarMais(lista: readonly string[]): boolean {
  return lista.length < MAX_TECNICOS_ADICIONAIS;
}

/**
 * Quem aparece em "Adicionar técnico": ativos da loja, menos o principal e os
 * já escolhidos. O dono-como-funcionário entra (é uma linha ativa como as outras).
 * Desativado nunca entra: o que já estava na OS continua só na lista, para remover.
 */
export function funcionariosElegiveis<F extends FuncionarioTecnico>(
  funcionarios: readonly F[],
  principal: string | null,
  escolhidos: readonly string[],
): F[] {
  return funcionarios.filter((f) => f.ativo && f.id !== principal && !escolhidos.includes(f.id));
}

/** Adiciona `id` se a regra deixar (principal escolhido, elegível e abaixo do máximo); senão devolve a mesma lista. */
export function adicionarTecnico(
  lista: readonly string[],
  id: string,
  principal: string | null,
  funcionarios: readonly FuncionarioTecnico[],
): string[] {
  if (!principal || !podeAdicionarMais(lista)) return [...lista];
  if (!funcionariosElegiveis(funcionarios, principal, lista).some((f) => f.id === id)) return [...lista];
  return [...lista, id];
}

export function removerTecnico(lista: readonly string[], id: string): string[] {
  return lista.filter((x) => x !== id);
}

/** Trocar o principal por alguém que estava nos adicionais tira essa pessoa dos adicionais. */
export function adicionaisAposTrocarPrincipal(lista: readonly string[], novoPrincipal: string | null): string[] {
  return novoPrincipal ? lista.filter((x) => x !== novoPrincipal) : [...lista];
}

export interface ItemTecnicoAdicional {
  id: string;
  rotulo: string;
  desativado: boolean;
}

/** Linhas da lista na tela. Desativado ganha "(desativado)"; id que sumiu da loja vira "Técnico removido". */
export function itensTecnicosAdicionais(
  lista: readonly string[],
  funcionarios: readonly FuncionarioTecnico[],
): ItemTecnicoAdicional[] {
  return lista.map((id) => {
    const f = funcionarios.find((x) => x.id === id);
    if (!f) return { id, rotulo: "Técnico removido", desativado: true };
    const base = f.cargo ? `${f.nome} (${f.cargo})` : f.nome;
    return { id, rotulo: f.ativo ? base : `${base} (desativado)`, desativado: !f.ativo };
  });
}

/** Mesmo conjunto (ordem não importa). */
export function mesmosAdicionais(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

/** Validação da etapa: adicional sem principal não pode ser salvo. null = ok. */
export function validarTecnicosAdicionais(principal: string | null, adicionais: readonly string[]): string | null {
  if (!principal && adicionais.length > 0) {
    return "Escolha o técnico principal ou remova os técnicos adicionais.";
  }
  if (adicionais.length > MAX_TECNICOS_ADICIONAIS) {
    return `No máximo ${MAX_TECNICOS_ADICIONAIS} técnicos adicionais.`;
  }
  return null;
}

// ---------------- gravação ----------------

/** O que a tela manda para a gravação. Ausente = quem não vê o bloco: nada é lido nem gravado. */
export interface EntradaTecnicosAdicionais {
  /** Lista atual na tela. */
  adicionais: string[];
  /** Edição: o que veio do banco ao abrir (null = OS nova). */
  originais: string[] | null;
  /** Edição: funcionario_id da OS ao abrir. */
  principalOriginal: string | null;
}

export type PlanoTecnicosAdicionais =
  | { acao: "nada" }
  | { acao: "rpc"; principal: string; adicionais: string[] }
  /** OS sem principal que tinha adicionais no banco: a função exige principal, então apaga direto. */
  | { acao: "limpar" };

/**
 * Decide a escrita depois que a OS foi salva. Principal = o que foi gravado
 * em ordens_servico.funcionario_id nesta gravação.
 * - criação: só chama se há principal e algum adicional (lista vazia = nada a gravar);
 * - edição: só chama se a lista ou o principal mudaram (sem escrita à toa);
 * - sem principal: nunca chama a função; se a OS tinha adicionais, limpa.
 */
export function planejarGravacaoTecnicosAdicionais(
  entrada: EntradaTecnicosAdicionais | undefined,
  principal: string | null,
): PlanoTecnicosAdicionais {
  if (!entrada) return { acao: "nada" };
  const adicionais = normalizarAdicionais(entrada.adicionais, principal);
  const originais = entrada.originais;
  if (!principal) {
    return originais && originais.length > 0 ? { acao: "limpar" } : { acao: "nada" };
  }
  if (originais === null) {
    return adicionais.length > 0 ? { acao: "rpc", principal, adicionais } : { acao: "nada" };
  }
  const mudou = !mesmosAdicionais(adicionais, originais) || principal !== entrada.principalOriginal;
  return mudou ? { acao: "rpc", principal, adicionais } : { acao: "nada" };
}

// ---------------- erros ----------------

const MENSAGENS_ERRO: Record<string, string> = {
  TA001: "A OS não foi encontrada ou você não tem permissão para editá-la.",
  TA002: "Escolha o técnico principal antes de adicionar técnicos adicionais.",
  TA003: "O técnico principal não pode estar também entre os técnicos adicionais.",
  TA004: "Um dos técnicos escolhidos não é funcionário ativo desta loja.",
  TA005: `A OS pode ter no máximo ${MAX_TECNICOS_ADICIONAIS} técnicos adicionais.`,
  TA006: "A lista de técnicos adicionais tem um item vazio ou repetido.",
  TA007: "O técnico principal escolhido está desativado.",
  TA008: "Os técnicos adicionais não pertencem ao dono desta OS.",
};

/** Erro da função salvar_tecnicos_os (ou do apagar direto) em português. */
export function mensagemErroTecnicosAdicionais(erro: { code?: string | null; message?: string | null } | null | undefined): string {
  const codigo = erro?.code ?? "";
  return MENSAGENS_ERRO[codigo] ?? "Erro inesperado ao gravar os técnicos adicionais.";
}

/** Texto do toast quando a OS salvou e os adicionais não (mesmo padrão de AVISO_FALHA_TECNICOS_OS). */
export function avisoFalhaTecnicosAdicionais(erro: { code?: string | null; message?: string | null } | null | undefined): string {
  return `A OS foi salva, mas os técnicos adicionais não foram gravados: ${mensagemErroTecnicosAdicionais(erro)} Abra a OS e salve de novo.`;
}

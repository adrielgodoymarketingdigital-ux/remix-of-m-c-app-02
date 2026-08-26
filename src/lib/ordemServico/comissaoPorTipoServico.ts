export interface ComissaoConfig {
  tipo_servico_id: string;
  comissao_tipo: string;
  comissao_valor: number;
}

export interface TipoServicoResumo {
  id: string;
  nome: string;
}

export interface CandidatoAmbiguo {
  nome: string;
  comissaoTipo: string;
  comissaoValor: number;
}

export interface ResultadoMatchServico {
  config: ComissaoConfig | undefined;
  ambiguo: boolean;
  candidatosAmbiguos?: CandidatoAmbiguo[];
}

/**
 * Palavras-chave de família de aparelho associadas à marca real da OS, para
 * desambiguar quando o nome do item bate com mais de um Tipo de Serviço
 * configurado (ex: técnico com "TROCA DE TAMPA IPHONE" e "TROCA DE TAMPA DE
 * ANDROID" ao mesmo tempo). Apple é a única marca com ecossistema próprio;
 * qualquer outra marca conhecida (Samsung, Motorola, Xiaomi, LG, etc.) cai
 * na família Android — aceita tanto o termo genérico "android" quanto o
 * nome da própria marca no Tipo de Serviço cadastrado.
 */
export function palavrasChaveDaMarca(dispositivoMarca?: string | null): string[] {
  const marca = (dispositivoMarca || "").trim().toLowerCase();
  if (!marca) return [];
  if (marca === "apple") return ["iphone", "apple", "ios", "ipad"];
  return ["android", marca];
}

/**
 * Acha, entre os tipos de serviço com comissão configurada para o
 * funcionário, o que "bate" com o nome do serviço informado (comparação
 * case-insensitive, com trim).
 *
 * O match é bidirecional (item contém tipo OU tipo contém item) porque, na
 * prática, a relação de "quem é mais detalhado" varia: às vezes o nome do
 * serviço lançado na OS é mais longo (ex: "FRONTAL IPHONE 13 PRO MAX
 * _*O.CHINA*_ (TROCA DE CI)" contém o tipo curto "TROCA DE FRONTAL"), mas
 * às vezes é o Tipo de Serviço cadastrado para a comissão que é mais
 * específico que o item digitado na OS (ex: item "TROCA DE TAMPA" vs. tipo
 * "TROCA DE TAMPA IPHONE") — só checar "item contém tipo" faz esse segundo
 * caso falhar silenciosamente (comissão 0 para o item, sem aviso).
 *
 * Quando MAIS DE UM tipo bate (ex: variantes de comissão por marca do
 * mesmo reparo genérico), a ordem de desempate é:
 *   1. Igualdade exata de nome (sinal mais forte, não depende de marca).
 *   2. Marca real do aparelho da OS (dispositivoMarca), via
 *      palavrasChaveDaMarca — NUNCA por tamanho de string, porque "mais
 *      longo" não tem relação nenhuma com qual aparelho é da OS.
 *   3. Se nem isso resolver (marca vazia, ou ainda ambíguo mesmo com a
 *      marca), retorna ambiguo=true em vez de aplicar um percentual no
 *      chute — quem chama decide o que fazer (hoje: comissão 0 + sinalizar
 *      para revisão manual).
 *
 * Usado tanto no momento de salvar a OS (handleSubmitOrdemServico.ts)
 * quanto para reconstituir, na exibição do Perfil de Desempenho, por que a
 * comissão de um item ficou de fora da soma.
 */
export function encontrarComissaoPorNomeServico(
  nomeServico: string,
  tiposComComissao: TipoServicoResumo[],
  comissaoPorTipoServicoId: Map<string, ComissaoConfig>,
  dispositivoMarca?: string | null,
): ResultadoMatchServico {
  const nomeServicoNormalizado = nomeServico.trim().toLowerCase();
  const candidatos = tiposComComissao.filter(t => {
    const nomeTipoNormalizado = t.nome.trim().toLowerCase();
    return nomeTipoNormalizado.length > 0
      && (nomeServicoNormalizado.includes(nomeTipoNormalizado)
        || nomeTipoNormalizado.includes(nomeServicoNormalizado));
  });

  if (candidatos.length === 0) {
    return { config: undefined, ambiguo: false };
  }
  if (candidatos.length === 1) {
    return { config: comissaoPorTipoServicoId.get(candidatos[0].id), ambiguo: false };
  }

  // Mais de um tipo bate. Igualdade exata de nome vence qualquer coisa —
  // reduz o conjunto de candidatos aos exatos quando existir pelo menos um.
  let pool = candidatos;
  const exatos = candidatos.filter(t => t.nome.trim().toLowerCase() === nomeServicoNormalizado);
  if (exatos.length > 0) {
    if (exatos.length === 1) {
      return { config: comissaoPorTipoServicoId.get(exatos[0].id), ambiguo: false };
    }
    pool = exatos;
  }

  // Ainda ambíguo: tenta desambiguar pela marca real do aparelho da OS.
  const palavrasChave = palavrasChaveDaMarca(dispositivoMarca);
  if (palavrasChave.length > 0) {
    const compativeisComMarca = pool.filter(t => {
      const nomeTipoNormalizado = t.nome.trim().toLowerCase();
      return palavrasChave.some(p => nomeTipoNormalizado.includes(p));
    });
    if (compativeisComMarca.length === 1) {
      return { config: comissaoPorTipoServicoId.get(compativeisComMarca[0].id), ambiguo: false };
    }
  }

  // Nem match exato nem a marca resolveram: não adivinha por tamanho de
  // nome. Sinaliza como ambíguo para quem chama decidir (nunca aplicar %
  // no chute).
  return {
    config: undefined,
    ambiguo: true,
    candidatosAmbiguos: pool.map(t => {
      const config = comissaoPorTipoServicoId.get(t.id);
      return {
        nome: t.nome,
        comissaoTipo: config?.comissao_tipo || "porcentagem",
        comissaoValor: config?.comissao_valor || 0,
      };
    }),
  };
}

/**
 * Explica em texto curto, para exibição na interface, por que um item não
 * entrou na soma da comissão — mesma frase tanto no aviso ao salvar a OS
 * quanto no indicador do Perfil de Desempenho, para não haver duas
 * redações diferentes do mesmo motivo.
 */
export function formatarMotivoComissao(
  nomeItem: string,
  resultado: Pick<ResultadoMatchServico, "ambiguo" | "candidatosAmbiguos">,
): string {
  if (resultado.ambiguo) {
    const opcoes = (resultado.candidatosAmbiguos || [])
      .map(c => `${c.nome} (${c.comissaoTipo === "porcentagem" ? `${c.comissaoValor}%` : `R$ ${c.comissaoValor.toFixed(2)}`})`)
      .join(" vs. ");
    return `"${nomeItem}" — ambíguo entre ${opcoes}: o nome do serviço e a marca do aparelho não foram suficientes para decidir qual usar.`;
  }
  return `"${nomeItem}" — nenhum tipo de serviço configurado corresponde a este item.`;
}

export interface ComissaoConfig {
  tipo_servico_id: string;
  comissao_tipo: string;
  comissao_valor: number;
}

/**
 * Sobre o que a comissão do Técnico incide:
 * - "faturamento": preço de venda do serviço (comportamento padrão histórico).
 * - "lucro": preço de venda menos o custo do serviço (venda − custo).
 * Configurado por funcionário em loja_funcionarios.comissao_calculo.
 */
export type ComissaoCalculo = "faturamento" | "lucro";

export interface ComissaoItemInput {
  preco: number;
  /** custo do item; quando vier peca_valor lançado na OS, usar ele */
  custo?: number | null;
  /** flag explícita respondida no banner "custo R$ 0,00 está correto?" */
  custoConfirmado?: boolean;
}

export interface ComissaoItemCalculo {
  /** comissão do item (0 quando não pôde ser aplicada) */
  valor: number;
  /** true quando um percentual/valor > 0 foi efetivamente aplicado */
  aplicada: boolean;
  /**
   * true só no modo "lucro": o custo do item é R$ 0,00 e ainda não foi
   * confirmado — o item fica pendente e contribui R$ 0,00 à soma, do mesmo
   * jeito seguro dos itens sem config / ambíguos.
   */
  custoNaoConfirmado: boolean;
  /** base sobre a qual o percentual incidiu (faturamento ou lucro) */
  base: number;
}

/**
 * Um custo de item conta como "confirmado" quando o usuário respondeu
 * explicitamente ao banner (custoConfirmado === true) OU quando já existe um
 * custo real lançado (> 0) — nesse segundo caso não faz sentido pedir
 * confirmação de novo para um dado que já tem valor. O banner de confirmação
 * só aparece quando o custo é EXATAMENTE 0 e ninguém respondeu ainda.
 */
export function custoConfirmadoDoItem(
  custo?: number | null,
  custoConfirmado?: boolean,
): boolean {
  return custoConfirmado === true || (Number(custo) || 0) > 0;
}

/**
 * Comissão de UM item de serviço, isoladamente. Nunca soma o lucro/faturamento
 * de vários itens para aplicar um único percentual: cada chamada usa o
 * (preço − custo) OU o preço do próprio item e o seu próprio percentual
 * configurado — quem chama soma os resultados item a item.
 *
 * calculo === "faturamento": base = preço de venda.
 * calculo === "lucro": base = preço − custo, mas só quando o custo está
 *   confirmado (ver custoConfirmadoDoItem). Se não estiver, devolve
 *   custoNaoConfirmado=true e valor 0 — o item precisa de confirmação de
 *   custo antes de entrar na soma.
 *
 * Para comissão em valor fixo (comissao_tipo !== "porcentagem") o valor
 * independe da base: continua sendo o valor fixo configurado, igual ao
 * comportamento atual.
 */
export function calcularComissaoDoItem(
  item: ComissaoItemInput,
  config: Pick<ComissaoConfig, "comissao_tipo" | "comissao_valor">,
  calculo: ComissaoCalculo,
): ComissaoItemCalculo {
  const preco = Number(item.preco) || 0;
  const custo = Number(item.custo) || 0;
  const valorConfig = Number(config.comissao_valor) || 0;

  if (valorConfig <= 0) {
    return { valor: 0, aplicada: false, custoNaoConfirmado: false, base: 0 };
  }

  if (config.comissao_tipo !== "porcentagem") {
    // Valor fixo por serviço: não depende de faturamento nem de lucro.
    return { valor: valorConfig, aplicada: true, custoNaoConfirmado: false, base: preco };
  }

  if (calculo === "lucro" && !custoConfirmadoDoItem(item.custo, item.custoConfirmado)) {
    return { valor: 0, aplicada: false, custoNaoConfirmado: true, base: 0 };
  }

  const base = calculo === "lucro" ? Math.max(0, preco - custo) : preco;
  return { valor: base * (valorConfig / 100), aplicada: true, custoNaoConfirmado: false, base };
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
 *
 * A marca de família Apple é reconhecida mesmo quando a loja grava no campo
 * `dispositivo_marca` algo diferente de "apple" — na prática é comuníssimo o
 * cadastro vir como "iPhone", "iphone 13", "iPad", "iOS". Qualquer um desses
 * termos (por contains) marca a OS como família Apple.
 */
export function palavrasChaveDaMarca(dispositivoMarca?: string | null): string[] {
  const marca = (dispositivoMarca || "").trim().toLowerCase();
  if (!marca) return [];
  const ehApple = ["apple", "iphone", "ipad", "ipod", "ios"].some(t => marca.includes(t));
  if (ehApple) return ["iphone", "apple", "ios", "ipad"];
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
 *   3. Se todos os candidatos restantes resultam na MESMA comissão (mesmo
 *      comissao_tipo e mesmo comissao_valor), aplica esse valor: qual
 *      duplicado "ganhou" é irrelevante quando o resultado é idêntico
 *      (ex.: tipos "TROCA DE FRONTAL", "troca de frontal" e "FRONTAL" todos
 *      a 3% — cadastro duplicado do mesmo reparo).
 *   4. Se nem isso resolver (marca vazia, ou ainda ambíguo com valores
 *      diferentes), retorna ambiguo=true em vez de aplicar um percentual no
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
    // A marca estreitou o conjunto (mas não a 1): segue o desempate só com
    // os candidatos compatíveis com a marca.
    if (compativeisComMarca.length > 1) {
      pool = compativeisComMarca;
    }
  }

  // Desempate por valor idêntico: se TODOS os candidatos restantes têm a
  // mesma comissão (tipo + valor), o resultado independe de qual escolher —
  // aplica em vez de marcar ambíguo. Cobre o cadastro duplicado do mesmo
  // reparo com nomes ligeiramente diferentes.
  const configsPool = pool
    .map(t => comissaoPorTipoServicoId.get(t.id))
    .filter((c): c is ComissaoConfig => !!c);
  if (configsPool.length === pool.length && configsPool.length > 0) {
    const ref = configsPool[0];
    const todasIguais = configsPool.every(
      c => c.comissao_tipo === ref.comissao_tipo
        && Number(c.comissao_valor) === Number(ref.comissao_valor),
    );
    if (todasIguais) {
      return { config: ref, ambiguo: false };
    }
  }

  // Nem match exato, nem a marca, nem valor idêntico resolveram: não
  // adivinha por tamanho de nome. Sinaliza como ambíguo para quem chama
  // decidir (nunca aplicar % no chute).
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
 * Resultado de `resolverComissaoDoServico`: além do que
 * `encontrarComissaoPorNomeServico` já devolve, sinaliza se a decisão veio do
 * VÍNCULO DIRETO (`servicos.tipo_servico_id`) e, nesse caminho, se o
 * funcionário não tem % configurada para o Tipo vinculado.
 */
export interface ResultadoResolucaoComissao extends ResultadoMatchServico {
  /** true quando o Tipo saiu de `servicos.tipo_servico_id`, não do nome */
  viaVinculoDireto: boolean;
  /**
   * Só no caminho de vínculo direto: o serviço ESTÁ vinculado a um Tipo, mas o
   * funcionário não tem linha em `comissoes_tipo_servico` para esse Tipo (ou o
   * valor é 0). Comissão do item = R$ 0,00 INTENCIONAL — não é "revise", é o
   * dono tendo vinculado sem configurar o percentual daquele técnico.
   */
  vinculoSemConfig: boolean;
}

/**
 * Resolve a comissão de UM item de serviço priorizando o VÍNCULO DIRETO
 * (`servicos.tipo_servico_id`) sobre a correspondência por nome.
 *
 * - `tipoServicoIdVinculado` presente → usa esse Tipo DIRETO: sem match de
 *   nome, sem desempate por marca, sem ambiguidade. Se o funcionário tem
 *   config com valor > 0 para o Tipo, devolve ela; senão devolve
 *   `config: undefined` + `vinculoSemConfig: true` (comissão 0 intencional).
 * - `tipoServicoIdVinculado` ausente (serviço manual, serviço sem vínculo, ou
 *   dado legado) → delega a `encontrarComissaoPorNomeServico` (fluxo histórico
 *   Fase 1 B+c1+c2: match bidirecional + exato + marca + valor idêntico).
 *
 * O vínculo SEMPRE vence o nome quando existir — mesmo que o nome bateria com
 * um Tipo diferente.
 */
export function resolverComissaoDoServico(
  nomeServico: string,
  tipoServicoIdVinculado: string | null | undefined,
  tiposComComissao: TipoServicoResumo[],
  comissaoPorTipoServicoId: Map<string, ComissaoConfig>,
  dispositivoMarca?: string | null,
): ResultadoResolucaoComissao {
  if (tipoServicoIdVinculado) {
    const config = comissaoPorTipoServicoId.get(tipoServicoIdVinculado);
    if (config && Number(config.comissao_valor) > 0) {
      return { config, ambiguo: false, viaVinculoDireto: true, vinculoSemConfig: false };
    }
    return { config: undefined, ambiguo: false, viaVinculoDireto: true, vinculoSemConfig: true };
  }
  const r = encontrarComissaoPorNomeServico(
    nomeServico, tiposComComissao, comissaoPorTipoServicoId, dispositivoMarca,
  );
  return { ...r, viaVinculoDireto: false, vinculoSemConfig: false };
}

/**
 * Normaliza um nome para comparação: minúsculas, sem espaços nas pontas e com
 * sequências de espaços internas colapsadas em um só. Base tanto da sugestão
 * automática de Tipo (assistente de vinculação em massa) quanto do
 * agrupamento de Tipos "iguais/parecidos" da ferramenta de mesclagem.
 */
export function normalizarNomeParaComparacao(nome: string): string {
  return (nome || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export interface SugestaoTipoPorNome {
  /** id do Tipo sugerido, ou null quando não há candidato ou é ambíguo */
  tipoId: string | null;
  /** true quando MAIS DE UM Tipo casa e o nome exato não desempata */
  ambiguo: boolean;
  candidatos: TipoServicoResumo[];
}

/**
 * Versão "nível loja" (sem funcionário, sem marca de aparelho) da mesma regra
 * de casamento de nome de `encontrarComissaoPorNomeServico`, para o assistente
 * de vinculação em massa sugerir `servicos.tipo_servico_id`:
 *
 *   1. match bidirecional case-insensitive (item contém tipo OU tipo contém item)
 *   2. 0 candidatos → { tipoId: null }
 *   3. 1 candidato → sugere ele
 *   4. >1 candidato → se exatamente 1 tem nome idêntico, sugere esse; senão
 *      ambiguo=true e NÃO sugere nada (fica para revisão manual).
 *
 * Nunca desempata por tamanho de string.
 */
export function sugerirTipoServicoPorNome(
  nomeServico: string,
  tipos: TipoServicoResumo[],
): SugestaoTipoPorNome {
  const alvo = normalizarNomeParaComparacao(nomeServico);
  if (!alvo) return { tipoId: null, ambiguo: false, candidatos: [] };

  const candidatos = tipos.filter(t => {
    const n = normalizarNomeParaComparacao(t.nome);
    return n.length > 0 && (alvo.includes(n) || n.includes(alvo));
  });

  if (candidatos.length === 0) return { tipoId: null, ambiguo: false, candidatos: [] };
  if (candidatos.length === 1) return { tipoId: candidatos[0].id, ambiguo: false, candidatos };

  const exatos = candidatos.filter(t => normalizarNomeParaComparacao(t.nome) === alvo);
  if (exatos.length === 1) return { tipoId: exatos[0].id, ambiguo: false, candidatos };

  return { tipoId: null, ambiguo: true, candidatos };
}

/**
 * Explica em texto curto, para exibição na interface, por que um item não
 * entrou na soma da comissão — mesma frase tanto no aviso ao salvar a OS
 * quanto no indicador do Perfil de Desempenho, para não haver duas
 * redações diferentes do mesmo motivo.
 */
export function formatarMotivoComissao(
  nomeItem: string,
  resultado: Pick<ResultadoMatchServico, "ambiguo" | "candidatosAmbiguos"> & {
    /** modo "lucro": custo do item é R$ 0,00 e ainda não foi confirmado */
    custoNaoConfirmado?: boolean;
    /**
     * A comissão FOI aplicada, mas via fallback do Tipo de Serviço escolhido
     * no formulário da OS (Etapa 4) porque o nome do serviço não casou
     * sozinho com nenhum Tipo cadastrado. Aviso brando — não bloqueia nada.
     */
    fallbackTipoFormulario?: boolean;
    /**
     * O serviço está VINCULADO a um Tipo (`servicos.tipo_servico_id`), mas o
     * técnico não tem % configurada para esse Tipo. Comissão R$ 0,00
     * intencional — aviso brando, não "revise".
     */
    vinculoSemConfig?: boolean;
  },
): string {
  if (resultado.vinculoSemConfig) {
    return `"${nomeItem}" — vinculado a um Tipo de Serviço, mas sem percentual configurado para este técnico; comissão R$ 0,00 (ajuste em Equipe se quiser pagar por este tipo).`;
  }
  if (resultado.fallbackTipoFormulario) {
    return `"${nomeItem}" — comissão aplicada pelo Tipo de Serviço selecionado no formulário; renomeie o serviço no catálogo para casar automaticamente e dispensar essa seleção.`;
  }
  if (resultado.custoNaoConfirmado) {
    return `"${nomeItem}" — custo não confirmado: não é possível calcular a comissão sobre lucro deste item até confirmar o custo.`;
  }
  if (resultado.ambiguo) {
    const opcoes = (resultado.candidatosAmbiguos || [])
      .map(c => `${c.nome} (${c.comissaoTipo === "porcentagem" ? `${c.comissaoValor}%` : `R$ ${c.comissaoValor.toFixed(2)}`})`)
      .join(" vs. ");
    return `"${nomeItem}" — ambíguo entre ${opcoes}: o nome do serviço e a marca do aparelho não foram suficientes para decidir qual usar.`;
  }
  return `"${nomeItem}" — nenhum tipo de serviço configurado corresponde a este item.`;
}

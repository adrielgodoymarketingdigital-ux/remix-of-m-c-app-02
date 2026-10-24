/**
 * "Começar do zero" — regras da tela (sem dependências; testado com Deno em
 * scripts/testes-comecar-do-zero/). O banco é quem decide e apaga
 * (zerar_meus_dados_previa / zerar_meus_dados_executar); aqui só o que a tela
 * mostra: categorias e textos, a inclusão automática (a MESMA da prévia),
 * nomes amigáveis das contagens, mensagens dos erros e quando o botão final libera.
 */

export type Categoria = "vendas" | "os" | "clientes" | "financeiro" | "estoque" | "orcamentos";
export type Escolha = Categoria | "tudo";

/** Ordem do banco (c_ordem da prévia). */
export const ORDEM_CATEGORIAS: readonly Categoria[] = ["vendas", "os", "clientes", "financeiro", "estoque", "orcamentos"];

export interface InfoCategoria {
  id: Escolha;
  titulo: string;
  apaga: string;
  fica: string;
  aviso?: string;
}

export const CATEGORIAS: readonly InfoCategoria[] = [
  {
    id: "vendas",
    titulo: "Vendas",
    apaga: "Todas as vendas (inclusive parceladas e canceladas), trocas, vendas e serviços avulsos e pedidos.",
    fica: "O estoque não volta: o que foi vendido continua baixado. As contas a receber dessas vendas continuam no Financeiro.",
  },
  {
    id: "os",
    titulo: "Ordens de serviço",
    apaga: "Todas as ordens de serviço (inclusive as da lixeira), com técnicos, histórico e links de acompanhamento.",
    fica: "As peças usadas não voltam para o estoque. As contas e os pontos de fidelidade gerados pelas OS continuam.",
  },
  {
    id: "clientes",
    titulo: "Clientes e contatos",
    apaga: "Todos os clientes, com pontos de fidelidade, links de acompanhamento e remessas corporativas.",
    fica: "As contas do Financeiro continuam, mas sem o nome do cliente.",
    aviso: "Apagar os clientes também apaga as ordens de serviço, as vendas e os orçamentos deles.",
  },
  {
    id: "financeiro",
    titulo: "Financeiro",
    apaga: "Contas a pagar e a receber com os pagamentos, caixas com as movimentações e lançamentos manuais do extrato.",
    fica: "As vendas e as entradas de estoque continuam, mas sem a ligação com essas contas e caixas.",
  },
  {
    id: "estoque",
    titulo: "Estoque",
    apaga: "Produtos, peças, aparelhos, compras de aparelhos, fornecedores, notas XML importadas e listas de compras.",
    fica: "Os serviços cadastrados continuam, mas sem a peça ligada a eles.",
    aviso: "Apagar o estoque também apaga as vendas.",
  },
  {
    id: "orcamentos",
    titulo: "Orçamentos",
    apaga: "Todos os orçamentos.",
    fica: "Nada mais é afetado.",
  },
  {
    id: "tudo",
    titulo: "Tudo",
    apaga: "Todos os itens acima, mais as notificações e as localizações de OS. A conta fica como nova e os Primeiros Passos voltam a aparecer.",
    fica: "Login, senha, plano, dados e logo da loja, configurações, funcionários e integrações.",
  },
];

export const TITULO_CATEGORIA: Record<Escolha, string> = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.titulo])) as Record<Escolha, string>;

export interface Inclusao {
  categoria: Categoria;
  por_causa_de: Categoria;
  motivo: string;
}

/** Mesmas regras da prévia: clientes inclui os, vendas e orçamentos; estoque inclui vendas; tudo = todas. */
export function expandirEscolha(escolhidas: readonly Escolha[]): { efetivas: Categoria[]; tudo: boolean; incluidas: Inclusao[] } {
  const tudo = escolhidas.includes("tudo");
  if (tudo) return { efetivas: [...ORDEM_CATEGORIAS], tudo, incluidas: [] };
  const ef = new Set<Categoria>(escolhidas.filter((e): e is Categoria => e !== "tudo"));
  const incluidas: Inclusao[] = [];
  const incluir = (categoria: Categoria, por_causa_de: Categoria, motivo: string) => {
    if (!ef.has(categoria)) {
      ef.add(categoria);
      incluidas.push({ categoria, por_causa_de, motivo });
    }
  };
  if (ef.has("clientes")) {
    incluir("os", "clientes", "As ordens de serviço ficariam sem cliente.");
    incluir("vendas", "clientes", "As vendas ficariam sem cliente.");
    incluir("orcamentos", "clientes", "Os orçamentos ficariam sem cliente.");
  }
  if (ef.has("estoque")) incluir("vendas", "estoque", "As vendas ficariam sem o produto ou aparelho vendido.");
  return { efetivas: ORDEM_CATEGORIAS.filter((c) => ef.has(c)), tudo, incluidas };
}

/** Lista que vai para o banco (p_categorias): o que a pessoa marcou, na ordem do banco. */
export function categoriasParaEnviar(escolhidas: readonly Escolha[]): Escolha[] {
  if (escolhidas.includes("tudo")) return ["tudo"];
  return ORDEM_CATEGORIAS.filter((c) => escolhidas.includes(c));
}

// ---------------- contagens em português ----------------

type Rotulo = readonly [singular: string, plural: string];

/** Nomes das tabelas da prévia (campo `tabelas`) e do resumo final (campo `apagados`). */
export const ROTULOS_TABELA: Record<string, Rotulo> = {
  ordens_servico: ["ordem de serviço", "ordens de serviço"],
  os_tecnicos: ["registro de técnico da OS", "registros de técnicos das OS"],
  os_dispositivos_adicionais: ["aparelho adicional de OS", "aparelhos adicionais de OS"],
  os_tracking_links: ["link de acompanhamento de OS", "links de acompanhamento de OS"],
  os_audit_log: ["registro do histórico das OS", "registros do histórico das OS"],
  os_localizacoes: ["localização de OS", "localizações de OS"],
  clientes: ["cliente", "clientes"],
  cliente_tracking_links: ["link de acompanhamento de cliente", "links de acompanhamento de clientes"],
  clientes_audit_log: ["registro do histórico de clientes", "registros do histórico de clientes"],
  fidelidade_pontos: ["lançamento de pontos de fidelidade", "lançamentos de pontos de fidelidade"],
  fidelidade_resgates: ["resgate de fidelidade", "resgates de fidelidade"],
  remessas_corporativas: ["remessa corporativa", "remessas corporativas"],
  remessa_itens: ["item de remessa", "itens de remessa"],
  vendas: ["linha de venda", "linhas de vendas"],
  vendas_avulsas: ["venda avulsa", "vendas avulsas"],
  servicos_avulsos: ["serviço avulso", "serviços avulsos"],
  vendas_trocas: ["troca na venda", "trocas nas vendas"],
  vendas_cupons: ["cupom usado em venda", "cupons usados em vendas"],
  vendas_alteracoes: ["alteração de venda", "alterações de vendas"],
  trocas_garantia: ["troca de garantia", "trocas de garantia"],
  pedidos: ["pedido", "pedidos"],
  contas: ["conta a pagar ou receber", "contas a pagar ou receber"],
  pagamentos_contas: ["pagamento de conta", "pagamentos de contas"],
  caixas: ["caixa", "caixas"],
  caixa_movimentacoes: ["movimentação de caixa", "movimentações de caixa"],
  extrato_lancamentos_manuais: ["lançamento manual do extrato", "lançamentos manuais do extrato"],
  produtos: ["produto", "produtos"],
  pecas: ["peça", "peças"],
  dispositivos: ["aparelho", "aparelhos"],
  dispositivo_imeis: ["IMEI de aparelho", "IMEIs de aparelhos"],
  compras_dispositivos: ["compra de aparelho", "compras de aparelhos"],
  origem_pessoas: ["pessoa de quem a loja comprou aparelho", "pessoas de quem a loja comprou aparelhos"],
  fornecedores: ["fornecedor", "fornecedores"],
  entradas_estoque: ["entrada de estoque", "entradas de estoque"],
  compras_xml_importadas: ["nota XML importada", "notas XML importadas"],
  compras_xml_itens: ["item de nota XML", "itens de notas XML"],
  compras_xml_mapeamento: ["ligação de item de nota XML", "ligações de itens de notas XML"],
  listas_compras: ["lista de compras", "listas de compras"],
  lista_compras: ["item de lista de compras", "itens de listas de compras"],
  orcamentos: ["orçamento", "orçamentos"],
  notifications: ["notificação", "notificações"],
};

/** Itens do `resumo` da prévia (números que o lojista reconhece), por categoria. */
export const ROTULOS_RESUMO: Record<Categoria, Record<string, Rotulo>> = {
  vendas: { vendas: ["venda", "vendas"], vendas_avulsas: ["venda ou serviço avulso", "vendas e serviços avulsos"], pedidos: ["pedido", "pedidos"], trocas_garantia: ["troca de garantia", "trocas de garantia"] },
  os: { ordens_servico: ["ordem de serviço", "ordens de serviço"], na_lixeira: ["delas na lixeira", "delas na lixeira"] },
  clientes: { clientes: ["cliente", "clientes"], pontos_fidelidade: ["lançamento de pontos de fidelidade", "lançamentos de pontos de fidelidade"], remessas: ["remessa corporativa", "remessas corporativas"] },
  financeiro: { contas: ["conta a pagar ou receber", "contas a pagar ou receber"], caixas: ["caixa", "caixas"], lancamentos_extrato: ["lançamento manual do extrato", "lançamentos manuais do extrato"] },
  estoque: { produtos: ["produto", "produtos"], pecas: ["peça", "peças"], aparelhos: ["aparelho", "aparelhos"], compras_aparelhos: ["compra de aparelho", "compras de aparelhos"], fornecedores: ["fornecedor", "fornecedores"], notas_xml: ["nota XML importada", "notas XML importadas"] },
  orcamentos: { orcamentos: ["orçamento", "orçamentos"] },
};

/** "1 cliente", "342 clientes", "1.204 ordens de serviço". */
export function contagemAmigavel(n: number, [singular, plural]: Rotulo): string {
  return n === 1 ? `1 ${singular}` : `${n.toLocaleString("pt-BR")} ${plural}`;
}

const rotuloOuNome = (tabela: string): Rotulo => ROTULOS_TABELA[tabela] ?? [tabela.replace(/_/g, " "), tabela.replace(/_/g, " ")];

/** Linhas do resumo de uma categoria da prévia, só o que tem quantidade. */
export function linhasResumo(categoria: Categoria, resumo: Record<string, number> | undefined): string[] {
  if (!resumo) return [];
  const rotulos = ROTULOS_RESUMO[categoria];
  return Object.entries(rotulos)
    .filter(([chave]) => (resumo[chave] ?? 0) > 0)
    .map(([chave, rotulo]) => contagemAmigavel(resumo[chave], rotulo));
}

/** Detalhe por tabela (prévia `tabelas` ou execução `apagados`), maiores primeiro, só o que tem quantidade. */
export function linhasPorTabela(tabelas: Record<string, number> | undefined): string[] {
  return Object.entries(tabelas ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t, n]) => contagemAmigavel(n, rotuloOuNome(t)));
}

export const ROTULOS_COTA: Record<string, Rotulo> = {
  os: ["ordem de serviço", "ordens de serviço"],
  dispositivo: ["aparelho", "aparelhos"],
  produto: ["produto", "produtos"],
  peca: ["peça", "peças"],
  servico_avulso: ["serviço avulso", "serviços avulsos"],
};

// ---------------- numeração ----------------

export interface Contadores {
  os?: { volta_para_1: boolean; proximo: number };
  venda?: { volta_para_1: boolean; proximo: number };
}

/**
 * Como a numeração fica (regra da etapa 1): vendas apagadas → a próxima venda é a nº 1;
 * OS apagadas → a próxima OS é a nº 1 só se não sobrar conta do Financeiro citando número
 * de OS (senão continua de onde parou, para não repetir número). Sem OS/vendas: não muda.
 */
export function textosNumeracao(efetivas: readonly Categoria[], contadores: Contadores | undefined): string[] {
  const textos: string[] = [];
  if (efetivas.includes("os") && contadores?.os) {
    textos.push(contadores.os.volta_para_1
      ? "A próxima ordem de serviço volta a ser a nº 1."
      : `A numeração das ordens de serviço continua: a próxima será a nº ${contadores.os.proximo}, porque ainda há contas do Financeiro citando números de OS.`);
  }
  if (efetivas.includes("vendas") && contadores?.venda) {
    textos.push(contadores.venda.volta_para_1 ? "A próxima venda volta a ser a nº 1." : `A numeração das vendas continua: a próxima será a nº ${contadores.venda.proximo}.`);
  }
  if (!efetivas.includes("os") && !efetivas.includes("vendas")) textos.push("A numeração das ordens de serviço e das vendas não muda.");
  return textos;
}

// ---------------- erros ----------------

export interface MensagemErro {
  titulo: string;
  texto: string;
  /** Precisa refazer a revisão (passo 2) antes de tentar de novo. */
  refazerRevisao?: boolean;
}

const NADA = "Nada foi apagado.";

/** Erro do banco, da rede ou da senha → mensagem em português simples. Sempre deixa claro que nada foi apagado. */
export function mensagemErro(erro: unknown): MensagemErro {
  const e = (erro ?? {}) as { code?: string; message?: string; status?: number; name?: string };
  const msg = typeof e.message === "string" ? e.message : "";
  switch (e.code) {
    case "ZD000":
      return { titulo: "Você não está conectado", texto: `Entre na sua conta de novo e tente outra vez. ${NADA}` };
    case "ZD001":
      return { titulo: "Não é possível usar este recurso", texto: `${msg || "Sua conta não pode usar este recurso."} ${NADA}` };
    case "ZD002":
      return { titulo: "Palavra de confirmação errada", texto: `Digite APAGAR, em letras maiúsculas, para confirmar. ${NADA}` };
    case "ZD003":
      return { titulo: "Confirme sua senha", texto: `Por segurança, digite sua senha de novo antes de apagar. ${NADA}` };
    case "ZD004":
      return { titulo: "Aguarde alguns minutos", texto: `Você acabou de apagar dados. Só é possível fazer de novo depois de 10 minutos. ${NADA}` };
    case "ZD005":
      return { titulo: "Os números mudaram", texto: `Alguém mexeu nos dados depois da revisão. Revise de novo antes de apagar. ${NADA}`, refazerRevisao: true };
    case "ZD006":
      return { titulo: "A conferência final não bateu", texto: `Por segurança, a operação foi desfeita. ${NADA} Tente de novo; se repetir, fale com o suporte.` };
    case "ZD007":
      return { titulo: "Escolha inválida", texto: `Volte e escolha pelo menos um item para apagar. ${NADA}`, refazerRevisao: true };
    case "57014":
      return { titulo: "Demorou demais", texto: `A operação passou do tempo limite e foi desfeita. ${NADA} Tente de novo em alguns minutos.` };
    case "55P03":
      return { titulo: "Já existe uma operação em andamento", texto: `Espere a outra terminar e tente de novo. ${NADA}` };
    case "invalid_credentials":
      return { titulo: "Senha incorreta", texto: `Confira a senha da sua conta e tente de novo. ${NADA}` };
  }
  if (e.name === "AuthApiError" || /invalid login credentials/i.test(msg)) {
    return { titulo: "Senha incorreta", texto: `Confira a senha da sua conta e tente de novo. ${NADA}` };
  }
  return { titulo: "Não foi possível concluir", texto: `Verifique sua internet e tente de novo. ${NADA}` };
}

// ---------------- botão final ----------------

export const PALAVRA_CONFIRMACAO = "APAGAR";

/** "Apagar definitivamente" só libera com revisão válida, senha preenchida e APAGAR exato, e fora de uma execução. */
export function podeConfirmar(estado: { revisaoValida: boolean; senha: string; palavra: string; executando: boolean }): boolean {
  return estado.revisaoValida && estado.senha.length > 0 && estado.palavra === PALAVRA_CONFIRMACAO && !estado.executando;
}

// ---------------- quem vê ----------------

export const MARCA_COMECAR_DO_ZERO = "comecar_do_zero";

/** Marca de conta de teste na própria assinatura: só `true` liga (ausente, false ou "true" não). */
export function temMarcaComecarDoZero(modulosExtras: unknown): boolean {
  if (!modulosExtras || typeof modulosExtras !== "object" || Array.isArray(modulosExtras)) return false;
  return (modulosExtras as Record<string, unknown>)[MARCA_COMECAR_DO_ZERO] === true;
}

// Lógica de conversão produto↔peça e de grupo de variações — extraída de
// useProdutos.ts pra ser testável fora do React (mesmo padrão de
// src/lib/comissao/comissaoOsDoSnapshot.ts e
// src/lib/ordemServico/comissaoPorTipoServico.ts): funções puras/com
// injeção de dependência, SEM imports com alias @/, importáveis direto por
// um script Node (ver scripts/testar-conversao-produtos-pecas/).
//
// useProdutos.ts continua sendo a fonte que a UI chama — os useCallback lá
// só resolvem userId/empresaId (via sessão/useIdentidade) e disparam
// toast+carregarTodos em cima do resultado estruturado que estas funções
// devolvem. Nenhuma regra de negócio deve viver duplicada nos dois lugares.
//
// `SupabaseClient` aqui é só pra tipagem/DX — em runtime, qualquer objeto
// com o mesmo formato de `.from(tabela).select/eq/in/insert/update/delete()`
// serve (é assim que o script de teste usa um adaptador que fala com o
// Postgres via `supabase db query --linked` em vez do client HTTP real).
import type { SupabaseClient } from '@supabase/supabase-js';

export type TipoItem = 'produto' | 'peca';

export interface ItemParaConverter {
  id: string;
  tipo: TipoItem;
}

export interface ResultadoPreflightConversao {
  bloqueios: Map<string, string>;
  avisos: Map<string, string>;
}

const contarPorCampo = (linhas: Record<string, string | null>[] | null, campo: string) => {
  const mapa = new Map<string, number>();
  (linhas || []).forEach((l) => {
    const v = l[campo];
    if (v) mapa.set(v, (mapa.get(v) || 0) + 1);
  });
  return mapa;
};

/**
 * Pré-flight da conversão produto↔peça: descobre QUAIS itens não podem ser
 * convertidos e POR QUÊ, antes de tentar qualquer insert/delete — nunca
 * deixa o usuário descobrir por um erro genérico do Postgres (violação de FK
 * "crua"). Roda em lote (uma query por condição, não uma por item).
 *
 * Decisão de design pra "item é raiz de um grupo de variações com filhos":
 * BLOQUEIA em vez de promover automaticamente um filho a nova raiz.
 * Promover exigiria o sistema escolher sozinho qual filho vira raiz (mais
 * antigo? primeiro da lista?) — uma decisão de negócio tomada em silêncio,
 * sem o dono da loja ter pedido. Bloquear é mais simples e mais seguro: o
 * dono usa a seção "Variações deste item" (DialogCadastroProduto) pra
 * desvincular (removerDoGrupo) as variações que quiser antes de converter a
 * raiz, ou converte as variações uma a uma primeiro. Nenhum órfão silencioso.
 */
export async function verificarBloqueiosConversao(
  supabase: SupabaseClient,
  itens: ItemParaConverter[],
  _userId: string,
): Promise<ResultadoPreflightConversao> {
  const bloqueios = new Map<string, string>();
  const avisos = new Map<string, string>();

  const idsProduto = itens.filter((i) => i.tipo === 'produto').map((i) => i.id);
  const idsPeca = itens.filter((i) => i.tipo === 'peca').map((i) => i.id);

  if (idsProduto.length > 0) {
    // vendas.produto_id: ON DELETE sem cláusula → RESTRICT (bloqueio real).
    // trocas_garantia.produto_novo_id/produto_devolvido_id: idem.
    // produtos.produto_pai_id (auto-referência, ON DELETE SET NULL): não é
    // RESTRICT, mas deletar a raiz orfanaria as filhas em silêncio — tratado
    // como bloqueio de propósito (ver comentário acima da função).
    const [{ data: vendas }, { data: trocasNovo }, { data: trocasDevolvido }, { data: filhos }] = await Promise.all([
      supabase.from('vendas').select('produto_id').in('produto_id', idsProduto),
      supabase.from('trocas_garantia').select('produto_novo_id').in('produto_novo_id', idsProduto),
      supabase.from('trocas_garantia').select('produto_devolvido_id').in('produto_devolvido_id', idsProduto),
      supabase.from('produtos').select('produto_pai_id').in('produto_pai_id', idsProduto),
    ]);

    const vendasPorId = contarPorCampo(vendas as any, 'produto_id');
    const trocasPorId = contarPorCampo(trocasNovo as any, 'produto_novo_id');
    contarPorCampo(trocasDevolvido as any, 'produto_devolvido_id').forEach((qtd, id) => trocasPorId.set(id, (trocasPorId.get(id) || 0) + qtd));
    const filhosPorId = contarPorCampo(filhos as any, 'produto_pai_id');

    for (const id of idsProduto) {
      const qtdVendas = vendasPorId.get(id) || 0;
      const qtdTrocas = trocasPorId.get(id) || 0;
      const qtdFilhos = filhosPorId.get(id) || 0;
      if (qtdVendas > 0) {
        bloqueios.set(id, `Já foi vendido ${qtdVendas} ${qtdVendas === 1 ? 'vez' : 'vezes'} e não pode ser convertido.`);
      } else if (qtdTrocas > 0) {
        bloqueios.set(id, `Está vinculado a ${qtdTrocas} ${qtdTrocas === 1 ? 'troca de garantia' : 'trocas de garantia'} e não pode ser convertido.`);
      } else if (qtdFilhos > 0) {
        bloqueios.set(id, `É a raiz de um grupo com ${qtdFilhos} ${qtdFilhos === 1 ? 'variação' : 'variações'}. Desvincule as variações antes de converter.`);
      }
    }
  }

  if (idsPeca.length > 0) {
    // servicos.peca_id: ON DELETE sem cláusula → RESTRICT (bloqueio real).
    // vendas.peca_id: ON DELETE SET NULL — NÃO bloqueia (delete funciona),
    // mas silenciosamente desvincula a venda histórica; vira aviso, não bloqueio.
    // pecas.peca_pai_id (auto-referência, SEM ON DELETE → RESTRICT): bloqueio
    // real também — o delete falharia de qualquer forma.
    const [{ data: vendas }, { data: servicos }, { data: filhos }] = await Promise.all([
      supabase.from('vendas').select('peca_id').in('peca_id', idsPeca),
      supabase.from('servicos').select('peca_id').in('peca_id', idsPeca),
      supabase.from('pecas').select('peca_pai_id').in('peca_pai_id', idsPeca),
    ]);

    const vendasPorId = contarPorCampo(vendas as any, 'peca_id');
    const servicosPorId = contarPorCampo(servicos as any, 'peca_id');
    const filhosPorId = contarPorCampo(filhos as any, 'peca_pai_id');

    for (const id of idsPeca) {
      const qtdServicos = servicosPorId.get(id) || 0;
      const qtdFilhos = filhosPorId.get(id) || 0;
      const qtdVendas = vendasPorId.get(id) || 0;
      if (qtdServicos > 0) {
        bloqueios.set(id, `Está vinculada a ${qtdServicos} ${qtdServicos === 1 ? 'serviço cadastrado' : 'serviços cadastrados'} e não pode ser convertida.`);
      } else if (qtdFilhos > 0) {
        bloqueios.set(id, `É a raiz de um grupo com ${qtdFilhos} ${qtdFilhos === 1 ? 'variação' : 'variações'}. Desvincule as variações antes de converter.`);
      } else if (qtdVendas > 0) {
        avisos.set(id, `Foi vendida ${qtdVendas} ${qtdVendas === 1 ? 'vez' : 'vezes'}; a${qtdVendas === 1 ? '' : 's'} venda${qtdVendas === 1 ? '' : 's'} vai perder o vínculo direto com o item (o valor da venda em si não muda).`);
      }
    }
  }

  return { bloqueios, avisos };
}

export interface ResultadoConversaoTipo {
  ok: boolean;
  jaEstavamCertos: boolean;
  totalSolicitado: number;
  convertidos: string[];
  idsQueEramVariacao: string[];
  bloqueios: Map<string, string>;
  avisos: Map<string, string>;
  erro?: string;
}

/**
 * Núcleo de alterarTipoEmMassa (useProdutos.ts) — mesma lógica exata, sem
 * toast/carregarTodos (isso fica só no wrapper do hook). Recebe userId já
 * resolvido (o hook resolve via sessão/useIdentidade; o script de teste passa
 * o id da conta de teste direto).
 */
export async function executarConversaoTipo(
  supabase: SupabaseClient,
  itensParaAlterar: ItemParaConverter[],
  novoTipo: TipoItem,
  userId: string,
  empresaId: string | null,
): Promise<ResultadoConversaoTipo> {
  const itensParaMover = itensParaAlterar.filter((i) => i.tipo !== novoTipo);
  if (itensParaMover.length === 0) {
    return { ok: true, jaEstavamCertos: true, totalSolicitado: itensParaAlterar.length, convertidos: [], idsQueEramVariacao: [], bloqueios: new Map(), avisos: new Map() };
  }

  const itensUnicos = Array.from(new Map(itensParaMover.map((item) => [item.id, item])).values());

  const { bloqueios, avisos } = await verificarBloqueiosConversao(supabase, itensUnicos, userId);
  const itensLiberados = itensUnicos.filter((i) => !bloqueios.has(i.id));

  if (itensLiberados.length === 0) {
    return { ok: false, jaEstavamCertos: false, totalSolicitado: itensUnicos.length, convertidos: [], idsQueEramVariacao: [], bloqueios, avisos };
  }

  const tabelaOrigem = novoTipo === 'produto' ? 'pecas' : 'produtos';
  const tabelaDestino = novoTipo === 'produto' ? 'produtos' : 'pecas';
  const colunaPaiOrigem = novoTipo === 'produto' ? 'peca_pai_id' : 'produto_pai_id';
  const colunaPaiDestino = novoTipo === 'produto' ? 'produto_pai_id' : 'peca_pai_id';
  const ids = itensLiberados.map((i) => i.id);

  const { data: itensOriginais, error: erroSelect } = await supabase
    .from(tabelaOrigem)
    .select('*')
    .in('id', ids)
    .eq('user_id', userId);

  if (erroSelect) return { ok: false, jaEstavamCertos: false, totalSolicitado: itensUnicos.length, convertidos: [], idsQueEramVariacao: [], bloqueios, avisos, erro: erroSelect.message };
  if (!itensOriginais || itensOriginais.length === 0) {
    return { ok: false, jaEstavamCertos: false, totalSolicitado: itensUnicos.length, convertidos: [], idsQueEramVariacao: [], bloqueios, avisos, erro: 'Nenhum item encontrado para alterar.' };
  }
  if (itensOriginais.length !== ids.length) {
    return { ok: false, jaEstavamCertos: false, totalSolicitado: itensUnicos.length, convertidos: [], idsQueEramVariacao: [], bloqueios, avisos, erro: 'Nem todos os itens liberados puderam ser encontrados para a alteração.' };
  }

  // Itens que eram variação (tinham pai) e saem do grupo como consequência
  // estrutural: produto_pai_id só aponta pra produtos, peca_pai_id só pra
  // pecas — depois de mudar de tabela não há como continuar apontando pro
  // grupo original (a raiz continua na tabela de origem). O rótulo
  // (variacao_label) é preservado como texto solto; só o vínculo (pai_id) é
  // zerado.
  const idsQueEramVariacao = (itensOriginais as any[]).filter((item) => item[colunaPaiOrigem]).map((item) => item.id as string);

  const novosItens = (itensOriginais as any[]).map((item) => ({
    id: item.id,
    nome: item.nome,
    quantidade: item.quantidade || 0,
    custo: item.custo || 0,
    preco: item.preco || 0,
    preco_atacado: item.preco_atacado ?? null,
    user_id: userId,
    empresa_id: item.empresa_id ?? empresaId ?? null,
    created_at: item.created_at,
    codigo_barras: item.codigo_barras || null,
    fotos: item.fotos || [],
    fornecedor_id: item.fornecedor_id || null,
    categoria_id: item.categoria_id || null,
    exibir_no_catalogo: item.exibir_no_catalogo ?? true,
    variacao_label: item.variacao_label || null,
    [colunaPaiDestino]: null,
    ...(novoTipo === 'produto'
      ? {
          sku: item.sku || null,
          lucro: Number(item.preco || 0) - Number(item.custo || 0),
        }
      : {}),
  }));

  const { error: erroInsert } = await supabase.from(tabelaDestino).insert(novosItens as any);
  if (erroInsert) return { ok: false, jaEstavamCertos: false, totalSolicitado: itensUnicos.length, convertidos: [], idsQueEramVariacao: [], bloqueios, avisos, erro: erroInsert.message };

  const { error: erroDelete } = await supabase.from(tabelaOrigem).delete().in('id', ids).eq('user_id', userId);

  if (erroDelete) {
    const { error: erroRollback } = await supabase.from(tabelaDestino).delete().in('id', ids).eq('user_id', userId);
    if (erroRollback) {
      console.error('Erro ao desfazer conversão após falha:', erroRollback);
    }
    return {
      ok: false, jaEstavamCertos: false, totalSolicitado: itensUnicos.length, convertidos: [], idsQueEramVariacao: [], bloqueios, avisos,
      erro: 'Não foi possível concluir a alteração de tipo. Verifique se os itens possuem vínculos com outras operações antes de tentar novamente.',
    };
  }

  return { ok: true, jaEstavamCertos: false, totalSolicitado: itensUnicos.length, convertidos: ids, idsQueEramVariacao, bloqueios, avisos };
}

export interface ResultadoOperacaoSimples {
  ok: boolean;
  erro?: string;
}

/** Núcleo de renomearVariacao (useProdutos.ts). */
export async function renomearVariacao(
  supabase: SupabaseClient,
  id: string,
  tipo: TipoItem,
  novoLabel: string,
  userId: string,
): Promise<ResultadoOperacaoSimples> {
  const tabela = tipo === 'produto' ? 'produtos' : 'pecas';
  const { error } = await supabase
    .from(tabela)
    .update({ variacao_label: novoLabel.trim() || null } as any)
    .eq('id', id)
    .eq('user_id', userId);
  return error ? { ok: false, erro: error.message } : { ok: true };
}

export interface NovaVariacaoGrupo {
  nome: string;
  label: string;
  quantidade: number;
  custo: number;
  preco: number;
  preco_atacado: number | null;
  codigo_barras?: string;
  categoria_id?: string | null;
  fornecedor_id?: string | null;
}

/** Núcleo de adicionarVariacaoAoGrupo (useProdutos.ts). */
export async function adicionarVariacaoAoGrupo(
  supabase: SupabaseClient,
  grupoRootId: string,
  tipo: TipoItem,
  dados: NovaVariacaoGrupo,
  userId: string,
  empresaId: string | null,
): Promise<ResultadoOperacaoSimples & { id?: string }> {
  const tabela = tipo === 'produto' ? 'produtos' : 'pecas';
  const colunaPai = tipo === 'produto' ? 'produto_pai_id' : 'peca_pai_id';

  const { data, error } = await supabase
    .from(tabela)
    .insert({
      nome: dados.nome,
      variacao_label: dados.label.trim() || null,
      [colunaPai]: grupoRootId,
      quantidade: dados.quantidade,
      custo: dados.custo,
      preco: dados.preco,
      preco_atacado: dados.preco_atacado ?? null,
      codigo_barras: dados.codigo_barras || null,
      categoria_id: dados.categoria_id || null,
      fornecedor_id: dados.fornecedor_id || null,
      user_id: userId,
      empresa_id: empresaId ?? null,
      fotos: [],
    } as any)
    .select('id')
    .single();

  return error ? { ok: false, erro: error.message } : { ok: true, id: (data as any)?.id };
}

/** Núcleo de removerDoGrupo (useProdutos.ts) — desvincula (vira item avulso), não exclui. */
export async function removerDoGrupo(
  supabase: SupabaseClient,
  id: string,
  tipo: TipoItem,
  userId: string,
): Promise<ResultadoOperacaoSimples> {
  const tabela = tipo === 'produto' ? 'produtos' : 'pecas';
  const colunaPai = tipo === 'produto' ? 'produto_pai_id' : 'peca_pai_id';
  const { error } = await supabase
    .from(tabela)
    .update({ [colunaPai]: null, variacao_label: null } as any)
    .eq('id', id)
    .eq('user_id', userId);
  return error ? { ok: false, erro: error.message } : { ok: true };
}

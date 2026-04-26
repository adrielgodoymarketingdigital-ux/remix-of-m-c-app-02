import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ItemEstoque, Produto, Peca, FormularioProduto } from '@/types/produto';
import { useFuncionarioPermissoes } from './useFuncionarioPermissoes';
import { useAssinatura } from './useAssinatura';

export const useProdutos = () => {
  const [items, setItems] = useState<ItemEstoque[]>([]);
  const [loading, setLoading] = useState(false);
  const { lojaUserId, podeSincronizarProdutos, isFuncionario } = useFuncionarioPermissoes();
  const { podeCadastrarProduto, limites } = useAssinatura();

  const carregarTodos = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      // Usar ID do dono se funcionário tem permissão de sincronizar produtos
      const userId = (isFuncionario && podeSincronizarProdutos && lojaUserId) ? lojaUserId : user.id;

      const [
        { data: produtos, error: erroProdutos },
        { data: pecas, error: erroPecas },
        { data: fornecedoresData },
        { data: categoriasData }
      ] = await Promise.all([
        supabase.from('produtos').select('*').eq('user_id', userId).order('nome'),
        supabase.from('pecas').select('*').eq('user_id', userId).order('nome'),
        supabase.from('fornecedores').select('id, nome').eq('user_id', userId),
        supabase.from('categorias_produtos').select('id, nome, cor').eq('user_id', userId)
      ]);

      if (erroProdutos) throw erroProdutos;
      if (erroPecas) throw erroPecas;

      const fornecedoresMap = new Map((fornecedoresData || []).map(f => [f.id, f.nome]));
      const categoriasMap = new Map((categoriasData as any[] || []).map((c: any) => [c.id, { nome: c.nome, cor: c.cor }]));

      const produtosComTipo: Produto[] = (produtos || []).map(p => ({ 
        ...p, 
        tipo: 'produto' as const,
        custo: Number(p.custo || 0),
        preco: Number(p.preco || 0),
        lucro: Number(p.lucro || 0),
        quantidade: p.quantidade || 0,
        codigo_barras: (p as any).codigo_barras || undefined,
        fotos: Array.isArray((p as any).fotos) ? (p as any).fotos : [],
        fornecedor_id: (p as any).fornecedor_id || null,
        fornecedor_nome: (p as any).fornecedor_id ? fornecedoresMap.get((p as any).fornecedor_id) || null : null,
        categoria_id: (p as any).categoria_id || null,
        categoria_nome: (p as any).categoria_id ? categoriasMap.get((p as any).categoria_id)?.nome || null : null,
        categoria_cor: (p as any).categoria_id ? categoriasMap.get((p as any).categoria_id)?.cor || null : null,
      }));
      
      const pecasComTipo: Peca[] = (pecas || []).map(p => ({ 
        ...p, 
        tipo: 'peca' as const,
        custo: Number(p.custo || 0),
        preco: Number(p.preco || 0),
        quantidade: p.quantidade || 0,
        codigo_barras: (p as any).codigo_barras || undefined,
        fotos: Array.isArray((p as any).fotos) ? (p as any).fotos : [],
        fornecedor_id: (p as any).fornecedor_id || null,
        fornecedor_nome: (p as any).fornecedor_id ? fornecedoresMap.get((p as any).fornecedor_id) || null : null,
        categoria_id: (p as any).categoria_id || null,
        categoria_nome: (p as any).categoria_id ? categoriasMap.get((p as any).categoria_id)?.nome || null : null,
        categoria_cor: (p as any).categoria_id ? categoriasMap.get((p as any).categoria_id)?.cor || null : null,
      }));

      const todosItems = [...produtosComTipo, ...pecasComTipo].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
      );

      setItems(todosItems);
    } catch (error: any) {
      console.error('Erro ao carregar itens:', error);
      if (!error?.message?.includes("Auth") && !error?.message?.includes("JWT") && !error?.message?.includes("refresh_token")) {
        toast.error('Erro ao carregar itens', {
          description: error.message
        });
      }
    } finally {
      setLoading(false);
    }
  }, [lojaUserId, podeSincronizarProdutos, isFuncionario]);

  const criar = useCallback(async (dados: FormularioProduto) => {
    try {
      // Verificar limite do plano antes de criar
      const verificacao = await podeCadastrarProduto();
      if (!verificacao.permitido) {
        toast.error('Limite de produtos atingido', {
          description: limites.produtos_mes === -1 
            ? 'Não foi possível verificar o limite.'
            : `Seu plano permite até ${limites.produtos_mes} produtos/peças por mês. Você já cadastrou ${verificacao.usados}. Faça upgrade para adicionar mais!`
        });
        return false;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Usar ID do dono se funcionário tem permissão
      const userId = (isFuncionario && podeSincronizarProdutos && lojaUserId) ? lojaUserId : user.id;

      if (dados.tipo === 'produto') {
        const { error } = await supabase.from('produtos').insert({
          nome: dados.nome,
          sku: dados.codigo || null,
          codigo_barras: dados.codigo_barras || null,
          quantidade: dados.quantidade,
          custo: dados.custo,
          preco: dados.preco,
          user_id: userId,
          fotos: dados.fotos || [],
          fornecedor_id: dados.fornecedor_id || null,
          categoria_id: dados.categoria_id || null,
        } as any);

        if (error) throw error;
        toast.success('Produto cadastrado com sucesso!');
      } else {
        const { error } = await supabase.from('pecas').insert({
          nome: dados.nome,
          quantidade: dados.quantidade,
          custo: dados.custo,
          preco: dados.preco,
          user_id: userId,
          codigo_barras: dados.codigo_barras || null,
          fotos: dados.fotos || [],
          fornecedor_id: dados.fornecedor_id || null,
          categoria_id: dados.categoria_id || null,
        } as any);

        if (error) throw error;

        // Marcar passo do onboarding (assistência) como concluído
        const { error: onboardingError } = await supabase.rpc('update_onboarding_step', {
          _user_id: user.id,
          _step: 'peca_cadastrada',
        });

        // Fallback: se o RPC falhar por alguma razão, atualiza diretamente o registro
        if (onboardingError) {
          console.error('[Onboarding] Falha ao marcar peca_cadastrada via RPC:', onboardingError);
          const now = new Date().toISOString();
          const { error: fallbackError } = await supabase
            .from('user_onboarding')
            .update({
              step_peca_cadastrada: true,
              step_peca_cadastrada_at: now,
              updated_at: now,
            } as any)
            .eq('user_id', user.id);

          if (fallbackError) {
            console.error('[Onboarding] Falha no fallback de peca_cadastrada:', fallbackError);
          }
        }

        toast.success('Peça cadastrada com sucesso!');
      }

      await carregarTodos();
      return true;
    } catch (error: any) {
      toast.error('Erro ao cadastrar', {
        description: error.message,
      });
      return false;
    }
  }, [carregarTodos, lojaUserId, podeSincronizarProdutos, isFuncionario, podeCadastrarProduto, limites.produtos_mes]);

  const atualizar = useCallback(async (id: string, dados: FormularioProduto) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Usar ID do dono se funcionário tem permissão
      const userId = (isFuncionario && podeSincronizarProdutos && lojaUserId) ? lojaUserId : user.id;

      if (dados.tipo === 'produto') {
        const { error } = await supabase.from('produtos').update({
          nome: dados.nome,
          sku: dados.codigo || null,
          codigo_barras: dados.codigo_barras || null,
          quantidade: dados.quantidade,
          custo: dados.custo,
          preco: dados.preco,
          fotos: dados.fotos || [],
          fornecedor_id: dados.fornecedor_id || null,
          categoria_id: dados.categoria_id || null,
        } as any).eq('id', id).eq('user_id', userId);

        if (error) throw error;
        toast.success('Produto atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('pecas').update({
          nome: dados.nome,
          quantidade: dados.quantidade,
          custo: dados.custo,
          preco: dados.preco,
          codigo_barras: dados.codigo_barras || null,
          fotos: dados.fotos || [],
          fornecedor_id: dados.fornecedor_id || null,
          categoria_id: dados.categoria_id || null,
        } as any).eq('id', id).eq('user_id', userId);

        if (error) throw error;
        toast.success('Peça atualizada com sucesso!');
      }

      await carregarTodos();
      return true;
    } catch (error: any) {
      toast.error('Erro ao atualizar', {
        description: error.message
      });
      return false;
    }
  }, [carregarTodos, lojaUserId, podeSincronizarProdutos, isFuncionario]);

  const excluir = useCallback(async (id: string, tipo: 'produto' | 'peca') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Usar ID do dono se funcionário tem permissão
      const userId = (isFuncionario && podeSincronizarProdutos && lojaUserId) ? lojaUserId : user.id;

      // Verificar se o item tem vendas ou serviços associados antes de excluir
      if (tipo === 'produto') {
        const { data: vendasAssociadas, error: erroVendas } = await supabase
          .from('vendas')
          .select('id')
          .eq('produto_id', id)
          .limit(1);

        if (erroVendas) throw erroVendas;

        if (vendasAssociadas && vendasAssociadas.length > 0) {
          toast.error('Não é possível excluir este produto', {
            description: 'Este produto possui vendas registradas. Remova as vendas primeiro ou mantenha o produto no sistema.'
          });
          return false;
        }
      }

      if (tipo === 'peca') {
        const [{ data: vendasPeca }, { data: servicosPeca }] = await Promise.all([
          supabase.from('vendas').select('id').eq('peca_id', id).limit(1),
          supabase.from('servicos').select('id').eq('peca_id', id).limit(1),
        ]);

        if ((vendasPeca && vendasPeca.length > 0) || (servicosPeca && servicosPeca.length > 0)) {
          toast.error('Não é possível excluir esta peça', {
            description: 'Esta peça possui vendas ou serviços vinculados. Remova os vínculos primeiro ou mantenha a peça no sistema.'
          });
          return false;
        }
      }

      const tabela = tipo === 'produto' ? 'produtos' : 'pecas';
      const { error } = await supabase
        .from(tabela)
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        // Tratar erro de FK de forma amigável caso a verificação acima não pegue
        if (error.message.includes('foreign key constraint')) {
          toast.error('Não é possível excluir', {
            description: 'Este item está vinculado a outros registros no sistema.'
          });
          return false;
        }
        throw error;
      }
      
      toast.success(`${tipo === 'produto' ? 'Produto' : 'Peça'} excluído com sucesso!`);
      await carregarTodos();
      return true;
    } catch (error: any) {
      toast.error('Erro ao excluir', {
        description: error.message
      });
      return false;
    }
  }, [carregarTodos, lojaUserId, podeSincronizarProdutos, isFuncionario]);

  const excluirEmMassa = useCallback(async (itens: { id: string; tipo: 'produto' | 'peca' }[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const userId = (isFuncionario && podeSincronizarProdutos && lojaUserId) ? lojaUserId : user.id;
      const CHUNK_SIZE = 80;

      const chunkArray = <T,>(arr: T[], size: number) => {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      const itensValidos = itens.filter(
        (item): item is { id: string; tipo: 'produto' | 'peca' } =>
          Boolean(item?.id) && (item.tipo === 'produto' || item.tipo === 'peca')
      );

      if (itensValidos.length === 0) {
        return { excluidos: 0, erros: 0 };
      }

      const produtoIds = [...new Set(itensValidos.filter(i => i.tipo === 'produto').map(i => i.id))];
      const pecaIds = [...new Set(itensValidos.filter(i => i.tipo === 'peca').map(i => i.id))];

      let erros = 0;
      let excluidos = 0;

      // Verificar vendas associadas aos produtos em lotes (evita Bad Request por query muito longa)
      if (produtoIds.length > 0) {
        const idsComVendas = new Set<string>();

        for (const idsChunk of chunkArray(produtoIds, CHUNK_SIZE)) {
          const { data: vendasAssociadas, error } = await supabase
            .from('vendas')
            .select('produto_id')
            .eq('user_id', userId)
            .in('produto_id', idsChunk);

          if (error) throw error;
          (vendasAssociadas || []).forEach(v => {
            if (v.produto_id) idsComVendas.add(v.produto_id);
          });
        }

        const produtosSemVendas = produtoIds.filter(id => !idsComVendas.has(id));
        erros += produtoIds.length - produtosSemVendas.length;

        for (const idsChunk of chunkArray(produtosSemVendas, CHUNK_SIZE)) {
          const { error } = await supabase
            .from('produtos')
            .delete()
            .in('id', idsChunk)
            .eq('user_id', userId);

          if (error) throw error;
          excluidos += idsChunk.length;
        }
      }

      // Verificar vínculos das peças em lotes (vendas + serviços)
      if (pecaIds.length > 0) {
        const pecaIdsComVinculos = new Set<string>();

        for (const idsChunk of chunkArray(pecaIds, CHUNK_SIZE)) {
          const [{ data: vendasPecas, error: vendasError }, { data: servicosPecas, error: servicosError }] = await Promise.all([
            supabase
              .from('vendas')
              .select('peca_id')
              .eq('user_id', userId)
              .in('peca_id', idsChunk),
            supabase
              .from('servicos')
              .select('peca_id')
              .eq('user_id', userId)
              .in('peca_id', idsChunk),
          ]);

          if (vendasError) throw vendasError;
          if (servicosError) throw servicosError;

          (vendasPecas || []).forEach(v => {
            if (v.peca_id) pecaIdsComVinculos.add(v.peca_id);
          });
          (servicosPecas || []).forEach((s: any) => {
            if (s.peca_id) pecaIdsComVinculos.add(s.peca_id);
          });
        }

        const pecasSemVinculos = pecaIds.filter(id => !pecaIdsComVinculos.has(id));
        erros += pecaIds.length - pecasSemVinculos.length;

        for (const idsChunk of chunkArray(pecasSemVinculos, CHUNK_SIZE)) {
          const { error } = await supabase
            .from('pecas')
            .delete()
            .in('id', idsChunk)
            .eq('user_id', userId);

          if (error) {
            if (error.message.includes('foreign key') || error.message.includes('violates')) {
              erros += idsChunk.length;
              continue;
            }
            throw error;
          }

          excluidos += idsChunk.length;
        }
      }

      if (excluidos > 0) {
        toast.success(`${excluidos} ${excluidos === 1 ? 'item excluído' : 'itens excluídos'} com sucesso!`);
      }
      if (erros > 0) {
        toast.error(`${erros} ${erros === 1 ? 'item não pôde' : 'itens não puderam'} ser excluído(s)`, {
          description: 'Alguns itens possuem vendas ou registros vinculados.'
        });
      }

      await carregarTodos();
      return { excluidos, erros };
    } catch (error: any) {
      const description = error?.message === 'Bad Request'
        ? 'Falha de requisição na exclusão em massa. O sistema agora processa em lotes menores; tente novamente.'
        : error?.message;

      toast.error('Erro ao excluir em massa', { description });
      return { excluidos: 0, erros: itens.length };
    }
  }, [carregarTodos, lojaUserId, podeSincronizarProdutos, isFuncionario]);

  const categorizarEmMassa = useCallback(async (itensParaCategorizar: { id: string; tipo: 'produto' | 'peca' }[], categoriaId: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const userId = (isFuncionario && podeSincronizarProdutos && lojaUserId) ? lojaUserId : user.id;

      const produtoIds = itensParaCategorizar.filter(i => i.tipo === 'produto').map(i => i.id);
      const pecaIds = itensParaCategorizar.filter(i => i.tipo === 'peca').map(i => i.id);

      const promises: Promise<any>[] = [];

      if (produtoIds.length > 0) {
        promises.push((
          supabase
            .from('produtos')
            .update({ categoria_id: categoriaId } as any)
            .in('id', produtoIds)
            .eq('user_id', userId)
        ) as any);
      }

      if (pecaIds.length > 0) {
        promises.push((
          supabase
            .from('pecas')
            .update({ categoria_id: categoriaId } as any)
            .in('id', pecaIds)
            .eq('user_id', userId)
        ) as any);
      }

      const results = await Promise.all(promises);
      for (const result of results) {
        if (result.error) throw result.error;
      }

      const total = produtoIds.length + pecaIds.length;
      toast.success(`Categoria ${categoriaId ? 'aplicada' : 'removida'} de ${total} ${total === 1 ? 'item' : 'itens'}!`);
      await carregarTodos();
      return true;
    } catch (error: any) {
      toast.error('Erro ao categorizar itens', { description: error.message });
      return false;
    }
  }, [carregarTodos, lojaUserId, podeSincronizarProdutos, isFuncionario]);

  const importarEmLote = useCallback(async (itens: FormularioProduto[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Usar ID do dono se funcionário tem permissão
      const userId = (isFuncionario && podeSincronizarProdutos && lojaUserId) ? lojaUserId : user.id;

      const produtos = itens.filter(i => i.tipo === 'produto');
      const pecas = itens.filter(i => i.tipo === 'peca');
      
      let produtosInseridos = 0;
      let pecasInseridas = 0;

      if (produtos.length > 0) {
        const { error } = await supabase.from('produtos').insert(
          produtos.map(p => ({
            nome: p.nome,
            sku: p.codigo || null,
            codigo_barras: p.codigo_barras || null,
            quantidade: p.quantidade,
            custo: p.custo,
            preco: p.preco,
            user_id: userId,
            fotos: p.fotos || [],
          }))
        );
        if (error) throw error;
        produtosInseridos = produtos.length;
      }

      if (pecas.length > 0) {
        const { error } = await supabase.from('pecas').insert(
          pecas.map(p => ({
            nome: p.nome,
            quantidade: p.quantidade,
            custo: p.custo,
            preco: p.preco,
            user_id: userId,
            codigo_barras: p.codigo_barras || null,
            fotos: p.fotos || [],
          }))
        );
        if (error) throw error;
        pecasInseridas = pecas.length;
      }

      toast.success('Importação concluída!', {
        description: `${produtosInseridos} produto(s) e ${pecasInseridas} peça(s) importados.`
      });
      
      await carregarTodos();
      return { produtosInseridos, pecasInseridas, erros: 0 };
    } catch (error: any) {
      toast.error('Erro na importação', { description: error.message });
      return { produtosInseridos: 0, pecasInseridas: 0, erros: itens.length };
    }
  }, [carregarTodos, lojaUserId, podeSincronizarProdutos, isFuncionario]);

  const alterarTipoEmMassa = useCallback(async (itensParaAlterar: { id: string; tipo: 'produto' | 'peca' }[], novoTipo: 'produto' | 'peca') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const userId = (isFuncionario && podeSincronizarProdutos && lojaUserId) ? lojaUserId : user.id;

      // Separar itens que precisam mudar de tipo dos que já são do tipo correto
      const itensParaMover = itensParaAlterar.filter(i => i.tipo !== novoTipo);
      if (itensParaMover.length === 0) {
        toast.info('Todos os itens selecionados já são do tipo desejado.');
        return true;
      }

      const itensUnicos = Array.from(new Map(itensParaMover.map((item) => [item.id, item])).values());

      const tabelaOrigem = novoTipo === 'produto' ? 'pecas' : 'produtos';
      const tabelaDestino = novoTipo === 'produto' ? 'produtos' : 'pecas';
      const ids = itensUnicos.map(i => i.id);

      // Buscar dados dos itens na tabela de origem
      const { data: itensOriginais, error: erroSelect } = await supabase
        .from(tabelaOrigem)
        .select('*')
        .in('id', ids)
        .eq('user_id', userId);

      if (erroSelect) throw erroSelect;
      if (!itensOriginais || itensOriginais.length === 0) {
        toast.error('Nenhum item encontrado para alterar.');
        return false;
      }

      if (itensOriginais.length !== ids.length) {
        throw new Error('Nem todos os itens selecionados puderam ser encontrados para a alteração.');
      }

      // Inserir na tabela de destino preservando o mesmo ID para não quebrar seleções já salvas no catálogo
      const novosItens = itensOriginais.map((item: any) => ({
        id: item.id,
        nome: item.nome,
        quantidade: item.quantidade || 0,
        custo: item.custo || 0,
        preco: item.preco || 0,
        user_id: userId,
        created_at: item.created_at,
        codigo_barras: item.codigo_barras || null,
        fotos: item.fotos || [],
        fornecedor_id: item.fornecedor_id || null,
        categoria_id: item.categoria_id || null,
        ...(novoTipo === 'produto'
          ? {
              sku: item.sku || null,
              lucro: Number(item.preco || 0) - Number(item.custo || 0),
            }
          : {}),
      }));

      const { error: erroInsert } = await supabase
        .from(tabelaDestino)
        .insert(novosItens as any);

      if (erroInsert) throw erroInsert;

      // Excluir da tabela de origem; se falhar, remove a cópia para evitar duplicidade silenciosa
      const { error: erroDelete } = await supabase
        .from(tabelaOrigem)
        .delete()
        .in('id', ids)
        .eq('user_id', userId);

      if (erroDelete) {
        const { error: erroRollback } = await supabase
          .from(tabelaDestino)
          .delete()
          .in('id', ids)
          .eq('user_id', userId);

        if (erroRollback) {
          console.error('Erro ao desfazer conversão após falha:', erroRollback);
        }

        throw new Error('Não foi possível concluir a alteração de tipo. Verifique se os itens possuem vínculos com outras operações antes de tentar novamente.');
      }

      toast.success(`${itensOriginais.length} ${itensOriginais.length === 1 ? 'item alterado' : 'itens alterados'} para ${novoTipo === 'produto' ? 'Produto' : 'Peça'}!`);

      await carregarTodos();
      return true;
    } catch (error: any) {
      toast.error('Erro ao alterar tipo', { description: error.message });
      return false;
    }
  }, [carregarTodos, lojaUserId, podeSincronizarProdutos, isFuncionario]);

  const reporEstoque = useCallback(async (id: string, tipo: 'produto' | 'peca', quantidadeAdicional: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const userId = (isFuncionario && podeSincronizarProdutos && lojaUserId) ? lojaUserId : user.id;
      const tabela = tipo === 'produto' ? 'produtos' : 'pecas';

      const { data: atual, error: erroSelect } = await supabase
        .from(tabela)
        .select('quantidade')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (erroSelect) throw erroSelect;

      const novaQuantidade = (atual?.quantidade || 0) + quantidadeAdicional;

      const { error: erroUpdate } = await supabase
        .from(tabela)
        .update({ quantidade: novaQuantidade } as any)
        .eq('id', id)
        .eq('user_id', userId);

      if (erroUpdate) throw erroUpdate;

      toast.success(`Estoque atualizado! +${quantidadeAdicional} unidades adicionadas.`);
      await carregarTodos();
      return true;
    } catch (error: any) {
      toast.error('Erro ao repor estoque', { description: error.message });
      return false;
    }
  }, [carregarTodos, lojaUserId, podeSincronizarProdutos, isFuncionario]);

  return {
    items,
    loading,
    carregarTodos,
    criar,
    atualizar,
    excluir,
    excluirEmMassa,
    categorizarEmMassa,
    alterarTipoEmMassa,
    importarEmLote,
    reporEstoque,
  };
};

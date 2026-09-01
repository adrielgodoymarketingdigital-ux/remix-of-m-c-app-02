import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ContadoresReais,
  DefinicaoItemChecklist,
  getItensChecklist,
  TipoNegocioPP,
} from "@/lib/primeirosPassos";

const VETERANO_LIMITE = 3;

interface OnboardingRow {
  tipo_negocio: string | null;
  onboarding_dismissed: boolean | null;
}

export interface ItemChecklistResolvido extends DefinicaoItemChecklist {
  concluido: boolean;
}

export interface PrimeirosPassosState {
  loading: boolean;
  /** true = tem sessão, não é funcionário, não é veterano — candidato a ver o card */
  elegivel: boolean;
  tipoNegocio: TipoNegocioPP | null;
  dispensado: boolean;
  itens: ItemChecklistResolvido[];
  progressoPct: number;
  concluido: boolean;
  /** O card (pergunta ou checklist) deve aparecer agora? */
  cardVisivel: boolean;
  /** Deve aparecer o botão discreto "Primeiros passos" para reabrir? */
  reabrirVisivel: boolean;
  escolherTipo: (tipo: TipoNegocioPP) => Promise<void>;
  dispensar: () => Promise<void>;
  reabrir: () => Promise<void>;
  /** Cria uma OS real (is_teste=false) que NÃO conta na cota do plano. */
  criarOsSimples: (dados: DadosOsSimples) => Promise<void>;
}

export interface DadosOsSimples {
  clienteNome: string;
  clienteTelefone?: string;
  dispositivoTipo: string;
  dispositivoMarca: string;
  dispositivoModelo: string;
  defeito: string;
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Fonte única do card "Primeiros Passos" do Dashboard e da supressão do
 * auto-start do tutorial. Não bloqueia nada — é só estado de UI.
 *
 * - `tipo_negocio` e `onboarding_dismissed` vêm de `user_onboarding` (tabela
 *   já existente; a linha é criada aqui se não existir).
 * - Cada item do checklist é derivado DIRETO das tabelas de produção
 *   (`ordens_servico`, `produtos`/`pecas`, `dispositivos`, `vendas`) — nunca
 *   de dado fake. Recalcula no mount e ao focar a aba.
 */
export function usePrimeirosPassos(): PrimeirosPassosState {
  const queryClient = useQueryClient();

  // 1. Sessão + funcionário (funcionário não faz onboarding do dono)
  const ctx = useQuery({
    queryKey: ["primeiros-passos", "ctx"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const userId = await getUserId();
      if (!userId) return { userId: null as string | null, isFuncionario: false };
      const { data } = await supabase
        .from("loja_funcionarios")
        .select("id")
        .eq("funcionario_user_id", userId)
        .eq("ativo", true)
        .maybeSingle();
      return { userId, isFuncionario: !!data };
    },
  });

  const userId = ctx.data?.userId ?? null;
  const isFuncionario = ctx.data?.isFuncionario ?? false;
  const habilitado = !!userId && !isFuncionario;

  // 2. Linha de user_onboarding (cria se não existir)
  const onb = useQuery({
    queryKey: ["primeiros-passos", "onboarding", userId],
    enabled: habilitado,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<OnboardingRow> => {
      const { data, error } = await supabase
        .from("user_onboarding")
        .select("tipo_negocio, onboarding_dismissed")
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as OnboardingRow;
      // Sem linha ainda — cria (mesmo comportamento do useOnboarding legado)
      await supabase
        .from("user_onboarding")
        .insert({ user_id: userId as string } as never);
      return { tipo_negocio: null, onboarding_dismissed: false };
    },
  });

  // 3. Contadores reais (uma ida ao banco, 6 counts em paralelo)
  const contadores = useQuery({
    queryKey: ["primeiros-passos", "contadores", userId],
    enabled: habilitado,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 10 * 1000,
    queryFn: async (): Promise<ContadoresReais & { totalOsReal: number; totalVendas: number }> => {
      const uid = userId as string;

      const [osReal, prod, peca, disp, vProd, vDisp] = await Promise.all([
        supabase.from("ordens_servico").select("id", { count: "exact", head: true })
          .eq("user_id", uid).eq("is_teste", false).is("deleted_at", null),
        supabase.from("produtos").select("id", { count: "exact", head: true })
          .eq("user_id", uid).is("deleted_at", null),
        supabase.from("pecas").select("id", { count: "exact", head: true })
          .eq("user_id", uid).is("deleted_at", null),
        supabase.from("dispositivos").select("id", { count: "exact", head: true })
          .eq("user_id", uid).is("deleted_at", null),
        supabase.from("vendas").select("id", { count: "exact", head: true })
          .eq("user_id", uid).eq("tipo", "produto").is("deleted_at", null).neq("cancelada", true),
        supabase.from("vendas").select("id", { count: "exact", head: true })
          .eq("user_id", uid).eq("tipo", "dispositivo").is("deleted_at", null).neq("cancelada", true),
      ]);

      const n = (r: { count: number | null }) => r.count ?? 0;
      const totalOsReal = n(osReal);
      const totalVendas = n(vProd) + n(vDisp);
      return {
        temOsReal: totalOsReal > 0,
        temProdutoOuPeca: n(prod) > 0 || n(peca) > 0,
        temDispositivo: n(disp) > 0,
        temVendaProduto: n(vProd) > 0,
        temVendaDispositivo: n(vDisp) > 0,
        temVendaQualquer: totalVendas > 0,
        totalOsReal,
        totalVendas,
      };
    },
  });

  const loading =
    ctx.isLoading ||
    (habilitado && (onb.isLoading || contadores.isLoading));

  const tipoNegocio = ((): TipoNegocioPP | null => {
    const t = onb.data?.tipo_negocio;
    return t === "assistencia" || t === "produtos" || t === "dispositivos" || t === "tudo"
      ? t
      : null;
  })();

  const dispensado = !!onb.data?.onboarding_dismissed;

  // Veterano: já usa o sistema de verdade — não incomodar com o card.
  const veterano =
    (contadores.data?.totalOsReal ?? 0) >= VETERANO_LIMITE ||
    (contadores.data?.totalVendas ?? 0) >= VETERANO_LIMITE;

  const elegivel = habilitado && !veterano;

  const itens: ItemChecklistResolvido[] = useMemo(() => {
    if (!tipoNegocio || !contadores.data) return [];
    return getItensChecklist(tipoNegocio).map((def) => ({
      ...def,
      concluido: !!contadores.data[def.concluidoQuando],
    }));
  }, [tipoNegocio, contadores.data]);

  const concluido = itens.length > 0 && itens.every((i) => i.concluido);
  const progressoPct = itens.length
    ? Math.round((itens.filter((i) => i.concluido).length / itens.length) * 100)
    : 0;

  // Card aparece enquanto: elegível, não dispensado, e (ainda não escolheu
  // perfil OU o checklist não terminou).
  const cardVisivel = elegivel && !loading && !dispensado && (!tipoNegocio || !concluido);
  // Botão discreto de reabrir: elegível, dispensou, e ainda há o que fazer
  // (inclusive se dispensou a própria pergunta de perfil).
  const reabrirVisivel = elegivel && !loading && dispensado && !concluido;

  const patchOnboarding = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!userId) return;
      await supabase
        .from("user_onboarding")
        .upsert(
          { user_id: userId, updated_at: new Date().toISOString(), ...patch } as never,
          { onConflict: "user_id" },
        );
      await queryClient.invalidateQueries({
        queryKey: ["primeiros-passos", "onboarding", userId],
      });
    },
    [userId, queryClient],
  );

  const escolherTipo = useCallback(
    async (tipo: TipoNegocioPP) => {
      await patchOnboarding({ tipo_negocio: tipo });
      // mesmo evento de analytics já usado pelo fluxo legado
      try {
        await supabase.rpc("track_user_event", {
          _event_type: "onboarding_tipo_negocio_selected",
          _event_data: { tipo, origem: "card_primeiros_passos" },
        } as never);
      } catch {
        /* analytics não deve travar a UI */
      }
    },
    [patchOnboarding],
  );

  const dispensar = useCallback(
    () => patchOnboarding({ onboarding_dismissed: true, onboarding_dismissed_at: new Date().toISOString() }),
    [patchOnboarding],
  );

  const reabrir = useCallback(
    () => patchOnboarding({ onboarding_dismissed: false, onboarding_dismissed_at: null }),
    [patchOnboarding],
  );

  const criarOsSimples = useCallback(
    async (dados: DadosOsSimples) => {
      if (!userId) throw new Error("Sessão não encontrada");

      const { data: cliente, error: errCliente } = await supabase
        .from("clientes")
        .insert({
          user_id: userId,
          nome: dados.clienteNome.trim(),
          telefone: dados.clienteTelefone?.trim() || null,
        } as never)
        .select("id")
        .single();
      if (errCliente) throw errCliente;

      const { error: errOs } = await supabase.from("ordens_servico").insert({
        user_id: userId,
        cliente_id: (cliente as { id: string }).id,
        numero_os: "", // trigger assign_os_number_on_insert preenche
        dispositivo_tipo: dados.dispositivoTipo,
        dispositivo_marca: dados.dispositivoMarca.trim(),
        dispositivo_modelo: dados.dispositivoModelo.trim() || dados.dispositivoMarca.trim(),
        defeito_relatado: dados.defeito.trim(),
        status: "pendente",
        total: 0,
        is_teste: false, // OS de verdade — aparece nas listas normalmente
        nao_conta_limite: true, // ...mas não entra na cota mensal do plano
      } as never);
      if (errOs) throw errOs;

      await queryClient.invalidateQueries({
        queryKey: ["primeiros-passos", "contadores", userId],
      });
    },
    [userId, queryClient],
  );

  return {
    loading,
    elegivel,
    tipoNegocio,
    dispensado,
    itens,
    progressoPct,
    concluido,
    cardVisivel,
    reabrirVisivel,
    escolherTipo,
    dispensar,
    reabrir,
    criarOsSimples,
  };
}

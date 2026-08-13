import { supabase } from "@/integrations/supabase/client";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { AvariasOS } from "@/types/ordem-servico";
import { encryptSenhaDesbloqueio, encryptValue } from "@/lib/password-encryption";
import { formatCurrency, dataHoje } from "@/lib/formatters";
import { resolverIdentidadeOS } from "@/lib/ordemServico/resolverIdentidadeOS";
import { criarOuAtualizarCliente } from "@/lib/ordemServico/criarOuAtualizarCliente";
import { gerarNumeroOSComRetry } from "@/lib/ordemServico/gerarNumeroOSComRetry";
import { criarContaAReceberOS } from "@/lib/ordemServico/criarContaAReceberOS";
import { TaxaCartao } from "@/hooks/useTaxasCartao";
import { FormData, TecnicoOS } from "./tipos";

interface TipoServicoResumo {
  id: string;
  nome: string;
}

interface SalvarOrdemServicoParams {
  formData: FormData;
  ordem: OrdemServico | null;
  tecnicoId: string | null;
  tecnicosOS: TecnicoOS[];
  tipoServicoId: string | null;
  clienteSelecionadoId: string | null;
  bandeiraSelecionada: string;
  taxasAtivas: TaxaCartao[];
  tiposServico: TipoServicoResumo[];
  funcionarioId: string | null;
  tecnicoObrigatorioOS: boolean;
  isProprietario: boolean;
  empresaAtivaCtx: string | null;
  temAcessoModulo: (modulo: string) => boolean;
  calcularTaxa: (
    taxa: TaxaCartao,
    formaPagamento: string,
    numeroParcelas?: number,
    valorTotal?: number
  ) => { percentual: number; valor: number };
  toast: (opts: { title: string; description?: string; variant?: "destructive" }) => void;
  trackOSCriada: (numeroOS: string, temCliente: boolean, temDispositivo: boolean) => void;
  dispararConfetti: (tipo: string) => void;
  dispatchEvent: (evento: string, payload: Record<string, unknown>) => void;
  navigate: (path: string) => void;
  onSuccess: () => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * Calcula a comissão do Técnico Principal somando, serviço a serviço, a
 * comissão configurada para o tipo de serviço cujo nome está CONTIDO no
 * nome do item em formData.servicos (comparação case-insensitive, com
 * trim). Isso substitui o cálculo antigo que aplicava uma única % (a do
 * tipoServicoId selecionado na Etapa 4) sobre o TOTAL da OS — errado quando
 * a OS tem múltiplos serviços com comissões diferentes entre si.
 *
 * Usa "contém" em vez de igualdade exata porque, na prática, o nome do
 * serviço lançado na OS costuma incluir modelo/peça/detalhes (ex: "FRONTAL
 * IPHONE 13 PRO MAX _*O.CHINA*_ (TROCA DE CI)"), enquanto o Tipo de Serviço
 * configurado é um nome curto e genérico (ex: "TROCA DE FRONTAL"). Quando
 * mais de um tipo configurado bate, usa o nome mais longo (mais
 * específico) para reduzir falsos positivos.
 *
 * Serviços cujo nome não bate com nenhum tipo de serviço configurado para
 * o funcionário não entram na soma (comissão null para aquele item).
 */
async function calcularComissaoPorServico(
  funcId: string,
  servicos: FormData["servicos"],
): Promise<number | null> {
  if (servicos.length === 0) return null;

  const { data: tiposServicoTodos } = await supabase
    .from("tipos_servico")
    .select("id, nome");

  const { data: comissoesFuncionario } = await supabase
    .from("comissoes_tipo_servico")
    .select("tipo_servico_id, comissao_tipo, comissao_valor")
    .eq("funcionario_id", funcId);

  const comissaoPorTipoServicoId = new Map(
    (comissoesFuncionario || []).map(c => [c.tipo_servico_id, c])
  );

  const tiposComComissao = (tiposServicoTodos || []).filter(
    t => comissaoPorTipoServicoId.has(t.id)
  );

  let comissaoTotal = 0;
  let algumEncontrado = false;

  for (const servico of servicos) {
    const nomeServicoNormalizado = servico.nome.trim().toLowerCase();
    const candidatos = tiposComComissao.filter(t => {
      const nomeTipoNormalizado = t.nome.trim().toLowerCase();
      return nomeTipoNormalizado.length > 0
        && nomeServicoNormalizado.includes(nomeTipoNormalizado);
    });
    // Entre os tipos cujo nome bate, prioriza o mais específico (mais longo).
    const tipoEncontrado = candidatos.sort((a, b) => b.nome.length - a.nome.length)[0];
    const config = tipoEncontrado ? comissaoPorTipoServicoId.get(tipoEncontrado.id) : undefined;

    if (config && config.comissao_valor > 0) {
      algumEncontrado = true;
      comissaoTotal += config.comissao_tipo === "porcentagem"
        ? servico.preco * (config.comissao_valor / 100)
        : config.comissao_valor;
    }
  }

  return algumEncontrado ? comissaoTotal : null;
}

/**
 * Salva técnicos da OS com snapshot de comissão individual. A comissão de
 * cada técnico é calculada sobre o preço do serviço específico vinculado a
 * ele (servico_id), não sobre o total da OS — importante quando a OS tem
 * múltiplos serviços com preços/comissões diferentes.
 */
async function salvarTecnicosOS(
  osId: string,
  tecnicos: TecnicoOS[],
  servicosOS: FormData["servicos"],
  totalOS: number,
  tipoServicoId: string | null
) {
  if (tecnicos.length === 0) {
    // Limpar técnicos existentes se lista vazia
    await supabase.from("os_tecnicos").delete().eq("os_id", osId);
    return;
  }

  // Remover técnicos antigos
  await supabase.from("os_tecnicos").delete().eq("os_id", osId);

  // Calcular comissão para cada técnico
  const tsId = tipoServicoId || null;
  const tecnicosParaInserir = [];

  for (const tec of tecnicos) {
    let comissaoTipo: string | null = null;
    let comissaoValor: number | null = null;
    let comissaoCalculada: number | null = null;

    // Serviço vinculado a este técnico (preço próprio); se não houver
    // vínculo (dados antigos ou não informado), cai no total da OS.
    const servicoVinculado = tec.servico_id
      ? servicosOS.find(s => s.id === tec.servico_id)
      : undefined;
    const baseCalculo = servicoVinculado ? servicoVinculado.preco : totalOS;

    if (tsId) {
      const { data: comissaoConfig } = await supabase
        .from("comissoes_tipo_servico")
        .select("comissao_tipo, comissao_valor")
        .eq("funcionario_id", tec.funcionario_id)
        .eq("tipo_servico_id", tsId)
        .maybeSingle();

      if (comissaoConfig && comissaoConfig.comissao_valor > 0) {
        comissaoTipo = comissaoConfig.comissao_tipo;
        comissaoValor = comissaoConfig.comissao_valor;
        if (comissaoConfig.comissao_tipo === "porcentagem") {
          comissaoCalculada = (baseCalculo > 0 ? baseCalculo : 0) * (comissaoConfig.comissao_valor / 100);
        } else {
          comissaoCalculada = comissaoConfig.comissao_valor;
        }
      }
    }

    tecnicosParaInserir.push({
      os_id: osId,
      funcionario_id: tec.funcionario_id,
      descricao_servico: tec.descricao_servico || null,
      servico_id: servicoVinculado ? servicoVinculado.id : null,
      servico_nome_snapshot: servicoVinculado ? servicoVinculado.nome : null,
      preco_servico_snapshot: servicoVinculado ? servicoVinculado.preco : null,
      comissao_tipo_snapshot: comissaoTipo,
      comissao_valor_snapshot: comissaoValor,
      comissao_calculada_snapshot: comissaoCalculada,
    });
  }

  await supabase.from("os_tecnicos").insert(tecnicosParaInserir);
}

/**
 * Cria ou atualiza uma Ordem de Serviço — extraída do handleSubmit original
 * de DialogOrdemServico.tsx (linhas 554-1128) sem mudança semântica.
 * Toca as tabelas: clientes, ordens_servico, os_tecnicos,
 * comissoes_tipo_servico (leitura), contas, produtos, pecas, vendas,
 * user_onboarding.
 */
export async function salvarOrdemServico(params: SalvarOrdemServicoParams): Promise<void> {
  const {
    formData,
    ordem,
    tecnicoId,
    tecnicosOS,
    tipoServicoId,
    clienteSelecionadoId,
    bandeiraSelecionada,
    taxasAtivas,
    tiposServico,
    funcionarioId,
    tecnicoObrigatorioOS,
    isProprietario,
    empresaAtivaCtx,
    temAcessoModulo,
    calcularTaxa,
    toast,
    trackOSCriada,
    dispararConfetti,
    dispatchEvent,
    navigate,
    onSuccess,
    onOpenChange,
  } = params;

  // Validar técnico obrigatório antes de qualquer operação
  if (tecnicoObrigatorioOS && !tecnicoId && !funcionarioId) {
    toast({
      title: "Técnico obrigatório",
      description: "Selecione um técnico responsável antes de salvar a OS.",
      variant: "destructive",
    });
    throw new Error("TECNICO_OBRIGATORIO");
  }

  try {
    // Obter usuário autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { effectiveUserId, empresaId } = await resolverIdentidadeOS(
      user.id,
      isProprietario,
      empresaAtivaCtx
    );

    // Usar cliente existente selecionado ou criar/atualizar
    const clienteId = await criarOuAtualizarCliente(
      effectiveUserId,
      {
        nome: formData.clienteNome,
        telefone: formData.clienteTelefone,
        cpf: formData.clienteCPF,
        endereco: formData.clienteEndereco,
        dataNascimento: formData.clienteDataNascimento,
      },
      clienteSelecionadoId,
      ordem?.cliente_id
    );

    // Preparar dados de avarias com senha criptografada, serviços realizados, produtos e assinatura
    const ordemAvarias = (ordem?.avarias as AvariasOS) || {};
    const avariasData: AvariasOS = {
      senha_desbloqueio: encryptSenhaDesbloqueio(formData.senhaDesbloqueio),
      checklist: formData.checklist,
      avarias_visuais: formData.avarias,
      servicos_realizados: formData.servicos.map(s => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pecaValor = (s as any).peca_valor;
        const custo = pecaValor !== undefined ? Number(pecaValor) : Number(s.custo || 0);
        const preco = Number(s.preco || 0);
        return {
          id: s.id,
          nome: s.nome,
          preco,
          custo,
          lucro: preco - custo,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          peca_id: (s as any).peca_id || undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          peca_nome: (s as any).peca_nome || undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          peca_fornecedor_id: (s as any).peca_fornecedor_id || undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          peca_fornecedor_nome: (s as any).peca_fornecedor_nome || undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          peca_status_pagamento: (s as any).peca_status_pagamento || undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          peca_data_pagamento: (s as any).peca_data_pagamento || undefined,
          peca_valor: pecaValor !== undefined ? pecaValor : undefined,
        };
      }),
      produtos_utilizados: formData.produtos.map(p => ({
        id: p.id,
        nome: p.nome,
        tipo: p.tipo,
        quantidade: p.quantidade,
        preco_unitario: p.preco_unitario,
        custo_unitario: p.custo_unitario,
        preco_total: p.preco_total,
        preco_cadastro: p.preco_cadastro,
        preco_editado: p.preco_editado,
      })),
      custos_adicionais: formData.custosAdicionais,
      assinaturas: {
        ...ordemAvarias.assinaturas,
        cliente_entrada: formData.assinaturaEntrada || undefined,
        data_assinatura_entrada: formData.assinaturaEntrada
          ? (ordemAvarias.assinaturas?.data_assinatura_entrada || new Date().toISOString())
          : undefined,
        tipo_assinatura_entrada: formData.tipoAssinaturaEntrada,
        cliente_saida: formData.assinaturaSaida || ordemAvarias.assinaturas?.cliente_saida || undefined,
        data_assinatura_saida: formData.assinaturaSaida
          ? new Date().toISOString()
          : ordemAvarias.assinaturas?.data_assinatura_saida,
        tipo_assinatura_saida: formData.tipoAssinaturaSaida,
      },
      fotos_dispositivo: formData.fotosDispositivo,
      observacoes_internas: formData.observacoesInternas || undefined,
      mostrar_obs_internas_impressao: formData.mostrarObsInternasImpressao,
      dispositivo_sistema: formData.dispositivoSistema || undefined,
      dispositivo_fabricante: formData.dispositivoFabricante || undefined,
      dispositivo_subtipo: formData.dispositivoSubtipo || undefined,
    };

    // Calcular total dos serviços + produtos + custos repassados - desconto
    const totalServicos = formData.servicos.reduce((sum, s) => sum + s.preco, 0);
    const totalProdutos = formData.produtos.reduce((sum, p) => sum + p.preco_total, 0);
    const totalCustosRepassados = formData.custosAdicionais
      .filter(c => c.repassar_cliente)
      .reduce((sum, c) => sum + c.valor, 0);
    const subtotal = totalServicos + totalProdutos + totalCustosRepassados;
    const total = Math.max(0, subtotal - formData.desconto);

    // Adicionar dados de pagamento ao avarias
    if (subtotal > 0 || formData.formaPagamento || formData.desconto > 0) {
      avariasData.dados_pagamento = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forma: (formData.formaPagamento as any) || undefined,
        parcelas: formData.numeroParcelas,
        desconto: formData.desconto,
        subtotal,
        total,
        entrada: formData.mostrarEntrada ? formData.valorEntrada : 0,
        forma_pagamento_entrada: formData.mostrarEntrada && formData.valorEntrada > 0 ? formData.formaPagamentoEntrada : undefined,
        saldo: formData.mostrarEntrada ? Math.max(0, total - formData.valorEntrada) : total,
        data_vencimento_prazo: formData.formaPagamento === 'a_prazo'
          ? (formData.semDataDefinida ? 'sem_prazo' : (formData.dataVencimentoPrazo ? formData.dataVencimentoPrazo.toISOString().split('T')[0] : undefined))
          : undefined,
      };
    } else {
      avariasData.dados_pagamento = undefined;
    }

    // Pegar o primeiro serviço para salvar no campo servico_id (para relatórios)
    // Ignorar serviços manuais (ID não é UUID válido)
    const primeiroServicoCatalogo = formData.servicos.find(s => !s.id.startsWith('manual_'));
    const primeiroServicoId = primeiroServicoCatalogo?.id || null;
    const primeiroServico = formData.servicos.length > 0 ? formData.servicos[0] : null;

    // === SNAPSHOT DA COMISSÃO ===
    let comissaoTipoSnapshot: string | null = null;
    let comissaoValorSnapshot: number | null = null;
    let comissaoCalculadaSnapshot: number | null = null;
    let tipoServicoNomeSnapshot: string | null = null;

    const funcId = tecnicoId || funcionarioId || null;
    const tsId = tipoServicoId || null;

    if (tsId) {
      const tipoEncontrado = tiposServico.find(t => t.id === tsId);
      tipoServicoNomeSnapshot = tipoEncontrado?.nome || null;
    }

    if (funcId && formData.servicos.length > 1) {
      // Múltiplos serviços na OS: cada um pode ter uma comissão configurada
      // diferente — soma a comissão de cada serviço sobre o preço dele,
      // em vez de aplicar uma única % (a do Tipo de Serviço da Etapa 4)
      // sobre o total da OS inteira.
      comissaoCalculadaSnapshot = await calcularComissaoPorServico(funcId, formData.servicos);
    } else if (funcId && tsId) {
      // Buscar comissão configurada para essa combinação
      const { data: comissaoConfig } = await supabase
        .from("comissoes_tipo_servico")
        .select("comissao_tipo, comissao_valor")
        .eq("funcionario_id", funcId)
        .eq("tipo_servico_id", tsId)
        .maybeSingle();

      if (comissaoConfig && comissaoConfig.comissao_valor > 0) {
        comissaoTipoSnapshot = comissaoConfig.comissao_tipo;
        comissaoValorSnapshot = comissaoConfig.comissao_valor;
        if (comissaoConfig.comissao_tipo === "porcentagem") {
          comissaoCalculadaSnapshot = (total > 0 ? total : 0) * (comissaoConfig.comissao_valor / 100);
        } else {
          comissaoCalculadaSnapshot = comissaoConfig.comissao_valor;
        }
      }
    }

    if (ordem) {
      // Atualizar ordem existente
      const { error } = await supabase
        .from("ordens_servico")
        .update({
          cliente_id: clienteId!,
          dispositivo_tipo: formData.dispositivoTipo,
          dispositivo_marca: formData.dispositivoMarca,
          dispositivo_modelo: formData.dispositivoModelo,
          dispositivo_cor: formData.dispositivoCor,
          dispositivo_numero_serie: formData.dispositivoNumeroSerie,
          dispositivo_imei: formData.dispositivoIMEI,
          localizacao_fisica: formData.localizacaoFisica || null,
          defeito_relatado: formData.defeitoRelatado,
          senha_desbloqueio: encryptValue(formData.senhaDesbloqueio.valor),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          avarias: avariasData as any,
          total: total > 0 ? total : null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          forma_pagamento: (formData.formaPagamento as any) || null,
          servico_id: primeiroServicoId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          servico_fornecedor_id: (primeiroServico as any)?.fornecedor_id || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          servico_status_pagamento: (primeiroServico as any)?.status_pagamento || 'pago',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          servico_data_pagamento: (primeiroServico as any)?.data_pagamento || null,
          tempo_garantia: formData.tempoGarantia,
          funcionario_id: tecnicoId || null,
          tipo_servico_id: tipoServicoId || null,
          comissao_tipo_snapshot: comissaoTipoSnapshot,
          comissao_valor_snapshot: comissaoValorSnapshot,
          comissao_calculada_snapshot: comissaoCalculadaSnapshot,
          tipo_servico_nome_snapshot: tipoServicoNomeSnapshot,
          created_at: formData.dataEntrada.toISOString(),
          data_saida: formData.status === "entregue"
            ? (formData.dataSaida ? formData.dataSaida.toISOString() : new Date().toISOString())
            : null,
          origem_cliente: formData.origemCliente || null,
          tipo_midia: formData.tipoMidia || null,
        })
        .eq("id", ordem.id)
        .eq("user_id", effectiveUserId);

      if (error) throw error;

      // === SALVAR TÉCNICOS DA OS ===
      await salvarTecnicosOS(ordem.id, tecnicosOS, formData.servicos, total, tipoServicoId);

      // === ATUALIZAR OU CRIAR CONTA A RECEBER AO EDITAR OS ===
      if (ordem.numero_os) {
        if (total > 0) {
          const temEntrada = formData.mostrarEntrada && formData.valorEntrada > 0;
          const entradaPaga = temEntrada ? formData.valorEntrada : 0;
          const saldoRestante = Math.max(0, total - entradaPaga);
          const dadosPag = avariasData.dados_pagamento;

          const isSemPrazo = dadosPag?.data_vencimento_prazo === 'sem_prazo';
          const dataVencConta = isSemPrazo ? null : (dadosPag?.data_vencimento_prazo || null);

          const descricaoConta = temEntrada
            ? `OS ${ordem.numero_os} - ${formData.defeitoRelatado} (Entrada paga: R$ ${entradaPaga.toFixed(2)})${isSemPrazo ? ' (Sem prazo)' : ''}`
            : `Ordem de Serviço ${ordem.numero_os} - ${formData.defeitoRelatado}${isSemPrazo ? ' (Sem prazo)' : ''}`;

          // Verificar se já existe conta para esta OS
          const { data: contaExistente } = await supabase
            .from("contas")
            .select("id")
            .eq("user_id", effectiveUserId)
            .eq("os_numero", ordem.numero_os)
            .eq("tipo", "receber")
            .maybeSingle();

          if (contaExistente) {
            // Se a OS já está entregue/garantia e a forma de pagamento não é mais "a prazo",
            // a conta deve refletir como recebida (evita ficar presa em "pendente" após editar o pagamento)
            const jaEntregueOuGarantia = formData.status === "entregue" || formData.status === "garantia";
            const deveMarcarRecebido = jaEntregueOuGarantia && formData.formaPagamento !== "a_prazo";
            const dataRecebimentoConta = dataHoje();

            // Atualizar conta existente com novos valores
            await supabase.from("contas").update({
              valor: saldoRestante > 0 ? saldoRestante : total,
              valor_pago: entradaPaga > 0 ? entradaPaga : null,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              forma_pagamento: entradaPaga > 0 ? (formData.formaPagamentoEntrada as any) : null,
              descricao: descricaoConta,
              nome: `OS ${ordem.numero_os} - ${formData.clienteNome}`,
              data_vencimento: dataVencConta,
              ...(deveMarcarRecebido
                ? { status: "recebido", data: dataRecebimentoConta, data_pagamento: dataRecebimentoConta }
                : {}),
            }).eq("id", contaExistente.id);
          } else {
            // Criar nova conta
            await supabase.from("contas").insert({
              nome: `OS ${ordem.numero_os} - ${formData.clienteNome}`,
              tipo: "receber",
              valor: saldoRestante > 0 ? saldoRestante : total,
              data: dataVencConta || dataHoje(),
              data_vencimento: dataVencConta,
              valor_pago: entradaPaga > 0 ? entradaPaga : null,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              forma_pagamento: entradaPaga > 0 ? (formData.formaPagamentoEntrada as any) : null,
              os_numero: ordem.numero_os,
              status: "pendente",
              recorrente: false,
              categoria: "Serviços",
              descricao: descricaoConta,
              user_id: effectiveUserId,
            });
          }
        } else {
          // Total zerou (serviços removidos) → remover conta vinculada e limpar entrada
          const { data: contaExistente } = await supabase
            .from("contas")
            .select("id")
            .eq("user_id", effectiveUserId)
            .eq("os_numero", ordem.numero_os)
            .eq("tipo", "receber")
            .maybeSingle();

          if (contaExistente) {
            await supabase.from("contas").delete().eq("id", contaExistente.id);
          }
        }
      }

      // === CRIAR/ATUALIZAR CONTAS A PAGAR PARA PEÇAS NA EDIÇÃO ===
      if (ordem.numero_os) {
        for (const servico of formData.servicos) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const s = servico as any;
          const pecaValor = s.peca_valor ?? s.custo ?? 0;
          if (s.peca_status_pagamento === 'a_pagar' && pecaValor > 0) {
            const pecaNome = s.peca_nome || s.nome;
            const fornecedorNome = s.peca_fornecedor_nome ? ` - ${s.peca_fornecedor_nome}` : '';
            const nomeConta = `Peça: ${pecaNome}${fornecedorNome} (OS ${ordem.numero_os})`;

            // Verificar se já existe conta para esta peça nesta OS
            const { data: contaPecaExistente } = await supabase
              .from("contas")
              .select("id")
              .eq("user_id", effectiveUserId)
              .eq("os_numero", ordem.numero_os)
              .eq("tipo", "pagar")
              .ilike("nome", `%Peça:%${pecaNome}%`)
              .maybeSingle();

            if (contaPecaExistente) {
              await supabase.from("contas").update({
                nome: nomeConta,
                valor: Number(pecaValor),
                data: s.peca_data_pagamento || dataHoje(),
                fornecedor_id: s.peca_fornecedor_id || null,
                descricao: `Peça "${pecaNome}" utilizada no serviço "${s.nome}" - OS ${ordem.numero_os}`,
              }).eq("id", contaPecaExistente.id);
            } else {
              await supabase.from("contas").insert({
                nome: nomeConta,
                tipo: "pagar",
                valor: Number(pecaValor),
                data: s.peca_data_pagamento || dataHoje(),
                status: "pendente",
                recorrente: false,
                categoria: "Fornecedores",
                descricao: `Peça "${pecaNome}" utilizada no serviço "${s.nome}" - OS ${ordem.numero_os}`,
                fornecedor_id: s.peca_fornecedor_id || null,
                os_numero: ordem.numero_os,
                user_id: effectiveUserId,
              });
            }
          }
        }
      }

      toast({
        title: "Ordem atualizada",
        description: "A ordem de serviço foi atualizada com sucesso.",
      });
      window.dispatchEvent(new Event("os-salva"));
    } else {
      // Criar nova ordem
      const numeroOS = await gerarNumeroOSComRetry(effectiveUserId, (numero) =>
        supabase.from("ordens_servico").insert([{
          numero_os: numero,
          cliente_id: clienteId!,
          user_id: effectiveUserId,
          dispositivo_tipo: formData.dispositivoTipo,
          dispositivo_marca: formData.dispositivoMarca,
          dispositivo_modelo: formData.dispositivoModelo,
          dispositivo_cor: formData.dispositivoCor,
          dispositivo_numero_serie: formData.dispositivoNumeroSerie,
          dispositivo_imei: formData.dispositivoIMEI,
          localizacao_fisica: formData.localizacaoFisica || null,
          defeito_relatado: formData.defeitoRelatado,
          senha_desbloqueio: encryptValue(formData.senhaDesbloqueio.valor),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          avarias: avariasData as any,
          total: total > 0 ? total : null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          forma_pagamento: (formData.formaPagamento as any) || null,
          servico_id: primeiroServicoId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          servico_fornecedor_id: (primeiroServico as any)?.fornecedor_id || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          servico_status_pagamento: (primeiroServico as any)?.status_pagamento || 'pago',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          servico_data_pagamento: (primeiroServico as any)?.data_pagamento || null,
          tempo_garantia: formData.tempoGarantia,
          funcionario_id: tecnicoId || funcionarioId || null,
          tipo_servico_id: tipoServicoId || null,
          comissao_tipo_snapshot: comissaoTipoSnapshot,
          comissao_valor_snapshot: comissaoValorSnapshot,
          comissao_calculada_snapshot: comissaoCalculadaSnapshot,
          tipo_servico_nome_snapshot: tipoServicoNomeSnapshot,
          status: formData.status || "aguardando_aprovacao",
          created_at: formData.dataEntrada.toISOString(),
          data_saida: formData.status === "entregue"
            ? (formData.dataSaida ? formData.dataSaida.toISOString() : new Date().toISOString())
            : null,
          empresa_id: empresaId,
          origem_cliente: formData.origemCliente || null,
          tipo_midia: formData.tipoMidia || null,
        }])
      );

      // === SALVAR TÉCNICOS DA OS (INSERT) ===
      // Buscar o ID da OS recém-criada
      const { data: osCriada } = await supabase
        .from("ordens_servico")
        .select("id")
        .eq("numero_os", numeroOS)
        .eq("user_id", effectiveUserId)
        .maybeSingle();

      if (osCriada) {
        await salvarTecnicosOS(osCriada.id, tecnicosOS, formData.servicos, total, tipoServicoId);
      }

      // === BAIXA NO ESTOQUE E REGISTRO DE VENDAS PARA PRODUTOS/PEÇAS ===
      if (formData.produtos.length > 0) {
        for (const produto of formData.produtos) {
          // 1. Atualizar estoque na tabela correspondente
          if (produto.tipo === 'produto') {
            const { error: estoqueError } = await supabase
              .from('produtos')
              .update({
                quantidade: (produto.estoque_disponivel || 0) - produto.quantidade,
              })
              .eq('id', produto.id)
              .eq('user_id', effectiveUserId);

            if (estoqueError) {
              console.error('Erro ao atualizar estoque de produto:', estoqueError);
            }
          } else if (produto.tipo === 'peca') {
            const { error: estoqueError } = await supabase
              .from('pecas')
              .update({
                quantidade: (produto.estoque_disponivel || 0) - produto.quantidade,
              })
              .eq('id', produto.id)
              .eq('user_id', effectiveUserId);

            if (estoqueError) {
              console.error('Erro ao atualizar estoque de peça:', estoqueError);
            }
          }

          // 2. Registrar na tabela de vendas para contabilização no faturamento
          // Peças são tratadas como produtos no banco (tipo_produto só aceita 'produto' ou 'dispositivo')
          const { error: vendaError } = await supabase
            .from('vendas')
            .insert({
              tipo: 'produto' as const,
              produto_id: produto.tipo === 'produto' ? produto.id : null,
              quantidade: produto.quantidade,
              total: produto.preco_total,
              custo_unitario: produto.custo_unitario,
              forma_pagamento: 'pix' as const, // Default para OS
              user_id: effectiveUserId,
              cliente_id: clienteId,
              recebido: false, // Será recebido quando a OS for finalizada
              observacoes: `Peça/Produto utilizado na OS ${numeroOS}`,
            });

          if (vendaError) {
            console.error('Erro ao registrar venda de produto:', vendaError);
          }
        }
      }

      // === CRIAR CONTA A RECEBER PARA TODA OS COM VALOR ===
      if (total > 0) {
        const dadosPag = avariasData.dados_pagamento;
        const temEntrada = formData.mostrarEntrada && formData.valorEntrada > 0;
        const entradaPaga = temEntrada ? formData.valorEntrada : 0;

        await criarContaAReceberOS({
          numeroOS,
          clienteNome: formData.clienteNome,
          defeitoRelatado: formData.defeitoRelatado,
          total,
          entradaPaga,
          formaPagamentoEntrada: temEntrada ? formData.formaPagamentoEntrada : undefined,
          dataVencimentoPrazo: dadosPag?.data_vencimento_prazo,
          effectiveUserId,
        });
      }

      // === CRIAR CONTAS A PAGAR PARA PEÇAS COM STATUS "A PAGAR" ===
      for (const servico of formData.servicos) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = servico as any;
        const pecaValor = s.peca_valor ?? s.custo ?? 0;
        if (s.peca_status_pagamento === 'a_pagar' && pecaValor > 0) {
          const pecaNome = s.peca_nome || s.nome;
          const fornecedorNome = s.peca_fornecedor_nome ? ` - ${s.peca_fornecedor_nome}` : '';
          await supabase.from("contas").insert({
            nome: `Peça: ${pecaNome}${fornecedorNome} (OS ${numeroOS})`,
            tipo: "pagar",
            valor: Number(pecaValor),
            data: s.peca_data_pagamento || dataHoje(),
            status: "pendente",
            recorrente: false,
            categoria: "Fornecedores",
            descricao: `Peça "${pecaNome}" utilizada no serviço "${s.nome}" - OS ${numeroOS}`,
            fornecedor_id: s.peca_fornecedor_id || null,
            os_numero: numeroOS,
            user_id: effectiveUserId,
          });
        }
      }

      // === REGISTRAR TAXA DE CARTÃO NO FINANCEIRO ===
      if (bandeiraSelecionada && bandeiraSelecionada !== "nenhuma" && total > 0) {
        const taxaSel = taxasAtivas.find(t => t.id === bandeiraSelecionada);
        console.log("[OS] Taxa cartão - bandeira:", bandeiraSelecionada, "taxaSel:", taxaSel, "formaPagamento:", formData.formaPagamento);
        if (taxaSel) {
          const { percentual, valor: valorTaxa } = calcularTaxa(taxaSel, formData.formaPagamento, formData.numeroParcelas, total);
          console.log("[OS] Taxa cartão - percentual:", percentual, "valorTaxa:", valorTaxa, "total:", total);
          if (valorTaxa > 0) {
            const { error: taxaError } = await supabase.from("contas").insert({
              nome: `Taxa Cartão ${taxaSel.bandeira} - OS ${numeroOS}`,
              tipo: "pagar" as const,
              valor: valorTaxa,
              data: dataHoje(),
              status: "pago" as const,
              recorrente: false,
              categoria: "Taxa de Cartão",
              descricao: `Taxa ${percentual}% da bandeira ${taxaSel.bandeira} sobre OS ${numeroOS} (${formatCurrency(total)})`,
              os_numero: numeroOS,
              user_id: effectiveUserId,
            });
            if (taxaError) {
              console.error("[OS] Erro ao registrar taxa de cartão:", taxaError);
            } else {
              console.log("[OS] Taxa de cartão registrada com sucesso:", valorTaxa);
            }
          }
        }
      }

      // Tracking de evento e atualização do onboarding
      trackOSCriada(numeroOS, !!clienteId, !!formData.dispositivoModelo);

      // Verificar se precisa navegar para próximo passo
      const { data: onboardingData } = await supabase
        .from('user_onboarding')
        .select('step_lucro_visualizado')
        .eq('user_id', user.id)
        .maybeSingle();

      // Atualizar progresso do onboarding
      await supabase.rpc('update_onboarding_step', {
        _user_id: user.id,
        _step: 'os_criada'
      });

      // Disparar confetti de celebração
      dispararConfetti('celebracao');

      toast({
        title: "Ordem criada",
        description: `Ordem de serviço ${numeroOS} criada com sucesso.`,
      });

      window.dispatchEvent(new Event("os-salva"));

      // Disparar evento de notificação automática
      dispatchEvent("SERVICE_ORDER_CREATED", {
        numero_os: numeroOS,
        clienteNome: formData.clienteNome,
      });

      // Navegar para próximo passo se ainda não visualizou lucro e tem acesso ao módulo
      if (!onboardingData?.step_lucro_visualizado && temAcessoModulo('financeiro')) {
        setTimeout(() => navigate('/financeiro'), 1000);
      }
    }

    onSuccess();
    onOpenChange(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error?.message === "TECNICO_OBRIGATORIO") return;

    console.error("Erro ao salvar ordem:", error);

    let mensagemErro = "Não foi possível salvar a ordem de serviço.";

    if (error?.code === "23505") {
      mensagemErro = "Número da ordem de serviço já existe. Tentando novamente...";
    } else if (error?.message?.includes("JWT")) {
      mensagemErro = "Sua sessão expirou. Por favor, faça login novamente.";
    } else if (error?.message) {
      mensagemErro = error.message;
    }

    toast({
      title: "Erro ao salvar ordem",
      description: mensagemErro,
      variant: "destructive",
    });
  }
}

/**
 * Grava a entrada da troca DEPOIS que as linhas da venda foram gravadas:
 * pessoa (origem_pessoas) → aparelho (dispositivos, origem_tipo 'troca_pdv',
 * custo = valor da entrada) → compra (compras_dispositivos) → vínculo
 * dispositivos.compra_id → vendas_trocas (uma por grupo_venda).
 *
 * Retomável: `progresso` guarda o id de cada etapa concluída; tentar de novo
 * pula o que já foi gravado (não duplica pessoa/aparelho/compra) e a última
 * etapa é um upsert no UNIQUE(grupo_venda). Nunca lança: devolve a etapa que
 * falhou para o PDV mostrar o alerta com "Tentar novamente".
 */
import { supabase } from "@/integrations/supabase/client";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";
import { camposDevolucao, type DadosEntradaTroca, type FormaDevolucao } from "./trocaPDV";

export interface ContextoEntradaTroca {
  /** Dono da loja (= vendas.user_id). */
  userId: string;
  empresaId: string | null;
  grupoVenda: string;
  /** Caixa aberto no momento da venda (vendas_trocas.caixa_id). */
  caixaId?: string | null;
  /** Diferença devolvida ao cliente quando a entrada passa do total (Fase 2). */
  devolucao?: { valor: number; forma: FormaDevolucao } | null;
}

export interface ProgressoEntradaTroca {
  pessoaId?: string;
  dispositivoId?: string;
  compraId?: string;
  vinculado?: boolean;
  trocaRegistrada?: boolean;
}

export type EtapaEntradaTroca = "pessoa" | "aparelho" | "compra" | "vinculo" | "troca";

// Os dois lados têm etapa/mensagem: sem strictNullChecks o `ok` não estreita a união.
export type ResultadoEntradaTroca =
  | { ok: true; etapa?: undefined; mensagem?: undefined }
  | { ok: false; etapa: EtapaEntradaTroca; mensagem: string };

const mensagemDe = (erro: unknown): string =>
  erro instanceof Error ? erro.message : typeof erro === "object" && erro && "message" in erro ? String((erro as { message: unknown }).message) : String(erro);

export async function registrarEntradaTroca(
  dados: DadosEntradaTroca,
  ctx: ContextoEntradaTroca,
  progresso: ProgressoEntradaTroca,
): Promise<ResultadoEntradaTroca> {
  let etapa: EtapaEntradaTroca = "pessoa";
  try {
    if (!progresso.pessoaId) {
      const { data, error } = await supabase
        .from("origem_pessoas")
        .insert({
          user_id: ctx.userId,
          tipo: "fisica",
          nome: dados.vendedor.nome,
          cpf_cnpj: dados.vendedor.cpf,
          telefone: dados.vendedor.telefone,
          ativo: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      progresso.pessoaId = data.id;
    }

    etapa = "aparelho";
    if (!progresso.dispositivoId) {
      const a = dados.aparelho;
      const { data, error } = await supabase
        .from("dispositivos")
        .insert({
          user_id: ctx.userId,
          empresa_id: ctx.empresaId,
          tipo: "celular",
          marca: a.marca,
          modelo: a.modelo,
          imei: a.imei,
          numero_serie: a.numeroSerie,
          cor: a.cor,
          capacidade_gb: a.capacidadeGb,
          condicao: a.condicao,
          custo: dados.valorEntrada,
          preco: dados.valorVenda,
          quantidade: 1,
          vendido: false,
          garantia: false,
          origem_tipo: "troca_pdv",
        })
        .select("id")
        .single();
      if (error) throw error;
      progresso.dispositivoId = data.id;
    }

    etapa = "compra";
    if (!progresso.compraId) {
      const { data, error } = await supabase
        .from("compras_dispositivos")
        .insert({
          user_id: ctx.userId,
          empresa_id: ctx.empresaId,
          pessoa_id: progresso.pessoaId,
          dispositivo_id: progresso.dispositivoId,
          data_compra: dataBrasiliaISO(),
          valor_pago: dados.valorEntrada,
          // CHECK da tabela não aceita 'troca'; a troca é identificada por vendas_trocas.compra_id.
          forma_pagamento: "dinheiro",
          condicao_aparelho: dados.aparelho.condicao,
          checklist: dados.aparelho.checklistEntrada,
          observacoes: dados.observacoes,
        })
        .select("id")
        .single();
      if (error) throw error;
      progresso.compraId = data.id;
    }

    etapa = "vinculo";
    if (!progresso.vinculado) {
      const { error } = await supabase
        .from("dispositivos")
        .update({ compra_id: progresso.compraId })
        .eq("id", progresso.dispositivoId!);
      if (error) throw error;
      progresso.vinculado = true;
    }

    etapa = "troca";
    if (!progresso.trocaRegistrada) {
      const { error } = await supabase
        .from("vendas_trocas")
        .upsert(
          {
            user_id: ctx.userId,
            empresa_id: ctx.empresaId,
            grupo_venda: ctx.grupoVenda,
            dispositivo_entrada_id: progresso.dispositivoId,
            compra_id: progresso.compraId,
            valor_entrada: dados.valorEntrada,
            caixa_id: ctx.caixaId ?? null,
            ...camposDevolucao(ctx.devolucao),
          },
          { onConflict: "grupo_venda", ignoreDuplicates: true },
        );
      if (error) throw error;
      progresso.trocaRegistrada = true;
    }

    return { ok: true };
  } catch (erro) {
    return { ok: false, etapa, mensagem: mensagemDe(erro) };
  }
}

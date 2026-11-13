/**
 * Quem pode gravar a personalização do recibo de venda, o que gravar e como
 * conferir o resultado. Puro (sem React nem Supabase): testado com Deno em
 * scripts/testes-recibo-venda-novo/reciboVendaConfigGravacao.test.ts.
 *
 * Regras (decisão do Adriel, 2026-11-13):
 *  - só o DONO edita; funcionário e gerente de filial só veem a prévia;
 *  - grava SEMPRE na linha de configuracoes_loja que está carregada (pelo id),
 *    e só se ela for da loja escolhida: filial sem linha própria (lendo a da
 *    matriz como reserva) não salva, orienta configurar na matriz;
 *  - config igual ao padrão grava NULL (quem nunca mexeu continua NULL);
 *  - a gravação só deu certo se afetou exatamente 1 linha.
 */

import {
  ehReciboVendaConfigPadrao,
  normalizarReciboVendaConfig,
  type ReciboVendaConfig,
} from "./reciboVendaConfig.ts";

// ── Permissão ───────────────────────────────────────────────────────────────

export type PapelConfigRecibo = "dono" | "funcionario" | "gerente";

export interface ContextoPermissaoConfigRecibo {
  /** Papel do usuário logado; null/undefined = ainda carregando. */
  papel: PapelConfigRecibo | null | undefined;
  /** Carregando a identidade ou a configuração. */
  carregando?: boolean;
  /** Loja escolhida para configurar (null = matriz / conta principal). */
  empresaIdSelecionada: string | null | undefined;
  /** Linha de configuracoes_loja que a tela carregou (pode ser a da matriz como reserva). */
  linha: { id?: string | null; empresa_id?: string | null } | null | undefined;
}

export type MotivoPermissaoConfigRecibo =
  | "ok"
  | "carregando"
  | "funcionario"
  | "gerente"
  | "papel_desconhecido"
  | "sem_configuracao"
  | "filial_sem_linha_propria"
  | "linha_de_outra_loja";

export interface PermissaoConfigRecibo {
  podeEditar: boolean;
  motivo: MotivoPermissaoConfigRecibo;
  /** Texto para o aviso da tela ("" quando pode editar). */
  mensagem: string;
}

export const MENSAGENS_PERMISSAO_CONFIG_RECIBO: Readonly<Record<MotivoPermissaoConfigRecibo, string>> = {
  ok: "",
  carregando: "Carregando…",
  funcionario: "O recibo é configurado pelo proprietário da loja. Você pode ver a prévia, mas não alterar.",
  gerente: "O recibo é configurado pelo proprietário da loja. Você pode ver a prévia, mas não alterar.",
  papel_desconhecido: "O recibo é configurado pelo proprietário da loja. Você pode ver a prévia, mas não alterar.",
  sem_configuracao: "Preencha os dados da loja em Configurações antes de personalizar o recibo.",
  filial_sem_linha_propria:
    "Esta filial usa os dados da matriz. Para personalizar o recibo, selecione a matriz e configure por lá.",
  linha_de_outra_loja: "Não foi possível confirmar a loja desta configuração. Recarregue a página e tente de novo.",
};

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

const negar = (motivo: MotivoPermissaoConfigRecibo): PermissaoConfigRecibo => ({
  podeEditar: false,
  motivo,
  mensagem: MENSAGENS_PERMISSAO_CONFIG_RECIBO[motivo],
});

/** Quem pode salvar. Na dúvida, nega (a prévia continua disponível para todos). */
export function decidirPermissaoConfigRecibo(ctx: ContextoPermissaoConfigRecibo): PermissaoConfigRecibo {
  if (ctx.carregando || ctx.papel === null || ctx.papel === undefined) return negar("carregando");
  if (ctx.papel === "funcionario") return negar("funcionario");
  if (ctx.papel === "gerente") return negar("gerente");
  if (ctx.papel !== "dono") return negar("papel_desconhecido");

  if (!ctx.linha || !texto(ctx.linha.id)) return negar("sem_configuracao");

  const lojaEscolhida = texto(ctx.empresaIdSelecionada);
  const lojaDaLinha = texto(ctx.linha.empresa_id);
  if (lojaEscolhida !== lojaDaLinha) {
    // Filial escolhida, mas a linha carregada é a da matriz (reserva de leitura).
    return negar(lojaEscolhida ? "filial_sem_linha_propria" : "linha_de_outra_loja");
  }
  return { podeEditar: true, motivo: "ok", mensagem: "" };
}

// ── O que gravar ────────────────────────────────────────────────────────────

/** Mesmo limite do CHECK da coluna (octet_length(recibo_venda_config::text)). */
export const LIMITE_BYTES_RECIBO_VENDA_CONFIG = 16384;

/**
 * Tamanho que o Postgres vai medir. O texto do jsonb põe um espaço depois de
 * cada ":" e de cada "," (JSON.stringify não põe), então soma 2 bytes por
 * chave: dá um valor igual ou maior que o real, nunca menor.
 */
export function bytesReciboVendaConfig(cfg: ReciboVendaConfig): number {
  const json = JSON.stringify(cfg);
  const chaves = 1 + Object.keys(cfg).length + Object.keys(cfg.mostrar).length + Object.keys(cfg.textos).length;
  return new TextEncoder().encode(json).length + 2 * chaves;
}

export type PreparoGravacaoReciboVendaConfig =
  | { ok: true; valor: ReciboVendaConfig | null }
  | { ok: false; erro: string };

/**
 * Rascunho da tela (qualquer coisa) → valor a gravar na coluna:
 * normalizado; null quando igual ao padrão; erro se passar do limite do banco.
 */
export function prepararGravacaoReciboVendaConfig(rascunho: unknown): PreparoGravacaoReciboVendaConfig {
  const cfg = normalizarReciboVendaConfig(rascunho);
  if (ehReciboVendaConfigPadrao(cfg)) return { ok: true, valor: null };
  if (bytesReciboVendaConfig(cfg) > LIMITE_BYTES_RECIBO_VENDA_CONFIG) {
    return { ok: false, erro: "Os textos do recibo ficaram grandes demais. Encurte as observações ou a política de troca." };
  }
  return { ok: true, valor: cfg };
}

// ── Conferência do resultado ────────────────────────────────────────────────

export type ResultadoGravacaoReciboVendaConfig = { ok: true } | { ok: false; erro: string };

/** Só exatamente 1 linha é sucesso. 0 = nada foi salvo (ex.: sem permissão no banco). */
export function interpretarResultadoGravacao(linhasAfetadas: unknown): ResultadoGravacaoReciboVendaConfig {
  if (linhasAfetadas === 1) return { ok: true };
  if (linhasAfetadas === 0 || linhasAfetadas === null || linhasAfetadas === undefined) {
    return {
      ok: false,
      erro: "Nada foi salvo: a configuração desta loja não foi encontrada ou você não tem permissão para alterá-la.",
    };
  }
  return { ok: false, erro: "A gravação não confere (mais de uma configuração afetada). Recarregue a página e tente de novo." };
}

/** Erro devolvido pelo Supabase → texto para o aviso vermelho. */
export function mensagemErroGravacaoReciboVendaConfig(erro: { code?: string | null; message?: string | null } | null | undefined): string {
  const code = erro?.code ?? "";
  const msg = erro?.message ?? "";
  // Coluna ainda não existe (migration não aplicada): PostgREST PGRST204 / Postgres 42703.
  if (code === "PGRST204" || code === "42703" || (/recibo_venda_config/.test(msg) && /column|coluna/i.test(msg))) {
    return "A personalização do recibo ainda não está disponível nesta conta. Tente de novo mais tarde.";
  }
  if (code === "23514") {
    return "Os textos do recibo ficaram grandes demais. Encurte as observações ou a política de troca.";
  }
  return "Não foi possível salvar a configuração do recibo. Verifique a conexão e tente de novo.";
}

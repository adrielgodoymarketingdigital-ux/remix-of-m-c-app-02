import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Núcleo (sem alias/rede) da baixa da conta a receber de uma OS na ENTREGA.
 * A fachada com o cliente real é quitarContaReceberDaOS.ts; os testes passam
 * um cliente falso (scripts/testes-os-recebimento-duplicado/).
 *
 * Bug que isto corrige: a entrega procurava só a conta 'pendente' da OS. Se o
 * lojista já tinha recebido em Contas > A receber, a busca não achava nada e
 * a entrega INSERIA uma 2ª conta "recebido" — o Extrato contava a OS duas
 * vezes e todo .maybeSingle() por os_numero passava a devolver null.
 *
 * Regras:
 * - lê TODAS as contas tipo='receber' da OS (user_id + os_numero; numero_os é
 *   único por user_id em ordens_servico), sem filtro de status;
 * - sem nenhuma por os_numero → procura conta antiga SEM os_numero com nome
 *   exatamente "OS <n> -…" (antes era ILIKE '%OS n%', que casava a OS 12 com
 *   a OS 123);
 * - alguma quitada ('recebido', ou 'pago' legado) → não faz nada;
 * - senão, a pendente MAIS ANTIGA: no modelo antigo grava status direto; no
 *   modelo novo (usa_historico_pagamentos) registra o pagamento do saldo em
 *   pagamentos_contas, como o marcarComoPaga de Contas, e o trigger
 *   sync_conta_from_pagamentos fecha o status;
 * - nenhuma conta → insere como antes.
 */

export type ClienteBancoLike = Pick<SupabaseClient, "from">;

export interface ContaReceberOSLinha {
  id: string;
  status: string | null;
  valor: number | string | null;
  valor_pago: number | string | null;
  usa_historico_pagamentos: boolean | null;
  created_at: string | null;
  user_id: string;
  empresa_id: string | null;
  os_numero: string | null;
  nome?: string | null;
}

export const COLUNAS_CONTA_OS =
  "id, status, valor, valor_pago, usa_historico_pagamentos, created_at, user_id, empresa_id, os_numero, nome";

/** 'pago' em conta a receber é legado — mesmo significado de 'recebido'. */
export const isContaOSQuitada = (c: { status: string | null }): boolean =>
  c.status === "recebido" || c.status === "pago";

const toNumber = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const porCriacao = (a: ContaReceberOSLinhaMinima, b: ContaReceberOSLinhaMinima): number => {
  const ca = a.created_at ?? "";
  const cb = b.created_at ?? "";
  if (ca !== cb) return ca < cb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

type ContaReceberOSLinhaMinima = { id: string; status: string | null; created_at?: string | null };

/**
 * Conta "da OS" quando há mais de uma (dados já duplicados): a quitada mais
 * antiga; sem quitada, a mais antiga. null = nenhuma.
 */
export function escolherContaDaOS<T extends ContaReceberOSLinhaMinima>(contas: readonly T[]): T | null {
  if (contas.length === 0) return null;
  const ordenadas = [...contas].sort(porCriacao);
  return ordenadas.find(isContaOSQuitada) ?? ordenadas[0];
}

/**
 * os_numero → status da conta, preferindo a quitada quando a OS tem mais de
 * uma (antes: a última linha lida vencia, em ordem indefinida).
 */
export function mapaStatusContaPorOS(
  linhas: ReadonlyArray<{ os_numero: string | null; status: string | null }>,
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const l of linhas) {
    if (!l.os_numero || !l.status) continue;
    const atual = mapa.get(l.os_numero);
    if (atual === undefined || (!isContaOSQuitada({ status: atual }) && isContaOSQuitada(l))) {
      mapa.set(l.os_numero, l.status);
    }
  }
  return mapa;
}

/** Padrão ILIKE do nome antigo "OS <n> - Cliente" (com % e _ escapados). */
export function padraoNomeContaOS(numeroOS: string): string {
  const escapado = numeroOS.replace(/[\\%_]/g, (c) => `\\${c}`);
  return `OS ${escapado} -%`;
}

/** Conferência local do padrão (o ILIKE já filtrou; isto é defesa extra). */
export function nomeEhDaOS(nome: string | null | undefined, numeroOS: string): boolean {
  return (nome ?? "").toLowerCase().startsWith(`os ${numeroOS} -`.toLowerCase());
}

export type ModoQuitacaoOS = "quitar" | "manter_pendente";

export type PlanoQuitacaoOS =
  | { acao: "nada"; motivo: "ja_quitada"; contaId: string }
  | { acao: "quitar_direto"; contaId: string }
  | { acao: "registrar_pagamento"; contaId: string; valor: number }
  | { acao: "atualizar_pendente"; contaId: string }
  | { acao: "inserir" };

/**
 * Decide o que fazer. `porNumero` = contas com os_numero da OS; `porNome` =
 * contas antigas sem os_numero (só é consultada quando `porNumero` vem vazia).
 */
export function planejarQuitacaoContaOS(
  porNumero: readonly ContaReceberOSLinha[],
  porNome: readonly ContaReceberOSLinha[],
  numeroOS: string,
  modo: ModoQuitacaoOS,
): PlanoQuitacaoOS {
  const candidatas =
    porNumero.length > 0
      ? porNumero
      : porNome.filter((c) => !c.os_numero && nomeEhDaOS(c.nome, numeroOS));

  const ordenadas = [...candidatas].sort(porCriacao);
  const quitada = ordenadas.find(isContaOSQuitada);
  if (quitada) return { acao: "nada", motivo: "ja_quitada", contaId: quitada.id };

  const pendente = ordenadas.find((c) => c.status === "pendente");
  if (!pendente) return { acao: "inserir" };

  if (modo === "manter_pendente") return { acao: "atualizar_pendente", contaId: pendente.id };

  if (pendente.usa_historico_pagamentos) {
    // Mesmo saldo do marcarComoPaga de Contas: valor - valor_pago.
    const saldo = Math.round(Math.max(toNumber(pendente.valor) - toNumber(pendente.valor_pago), 0) * 100) / 100;
    if (saldo <= 0.005) return { acao: "nada", motivo: "ja_quitada", contaId: pendente.id };
    return { acao: "registrar_pagamento", contaId: pendente.id, valor: saldo };
  }
  return { acao: "quitar_direto", contaId: pendente.id };
}

export interface ParametrosQuitacaoOS {
  userId: string;
  numeroOS: string;
  modo: ModoQuitacaoOS;
  /** YYYY-MM-DD — data do recebimento na entrega. */
  dataRecebimento: string;
  /** Forma do pagamento registrado em pagamentos_contas (modelo novo). */
  formaPagamento?: string | null;
  /**
   * Campos extras gravados na conta pendente encontrada. Em "quitar" vão junto
   * do status (modelo antigo) ou num UPDATE à parte (modelo novo, sem
   * status/data_pagamento — esses o trigger define). Em "manter_pendente" é o
   * UPDATE inteiro, igual ao de antes.
   */
  camposConta?: Record<string, unknown>;
  /** INSERT usado quando a OS não tem conta nenhuma (igual ao de antes). */
  novaConta: Record<string, unknown>;
}

export type ResultadoQuitacaoOS =
  | { status: "ja_quitada"; contaId: string }
  | { status: "quitada"; contaId: string }
  | { status: "pagamento_registrado"; contaId: string; quitou: boolean }
  | { status: "pendente_atualizada"; contaId: string }
  | { status: "inserida" }
  | { status: "erro"; etapa: string; mensagem: string };

const mensagemDe = (e: unknown): string =>
  e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);

export async function quitarContaReceberDaOSCore(
  cliente: ClienteBancoLike,
  p: ParametrosQuitacaoOS,
): Promise<ResultadoQuitacaoOS> {
  const { data: porNumeroData, error: erroNumero } = await cliente
    .from("contas")
    .select(COLUNAS_CONTA_OS)
    .eq("user_id", p.userId)
    .eq("os_numero", p.numeroOS)
    .eq("tipo", "receber");
  if (erroNumero) return { status: "erro", etapa: "ler_contas", mensagem: mensagemDe(erroNumero) };
  const porNumero = (porNumeroData ?? []) as ContaReceberOSLinha[];

  let porNome: ContaReceberOSLinha[] = [];
  if (porNumero.length === 0) {
    const { data: porNomeData, error: erroNome } = await cliente
      .from("contas")
      .select(COLUNAS_CONTA_OS)
      .eq("user_id", p.userId)
      .eq("tipo", "receber")
      .is("os_numero", null)
      .ilike("nome", padraoNomeContaOS(p.numeroOS));
    if (erroNome) return { status: "erro", etapa: "ler_contas_por_nome", mensagem: mensagemDe(erroNome) };
    porNome = (porNomeData ?? []) as ContaReceberOSLinha[];
  }

  const plano = planejarQuitacaoContaOS(porNumero, porNome, p.numeroOS, p.modo);
  const extras = p.camposConta ?? {};

  switch (plano.acao) {
    case "nada":
      return { status: "ja_quitada", contaId: plano.contaId };

    case "quitar_direto": {
      const { error } = await cliente
        .from("contas")
        .update({ ...extras, status: "recebido", data_pagamento: p.dataRecebimento })
        .eq("id", plano.contaId);
      if (error) return { status: "erro", etapa: "quitar", mensagem: mensagemDe(error) };
      return { status: "quitada", contaId: plano.contaId };
    }

    case "registrar_pagamento": {
      const conta = [...porNumero, ...porNome].find((c) => c.id === plano.contaId);
      const { error } = await cliente.from("pagamentos_contas").insert({
        conta_id: plano.contaId,
        user_id: conta?.user_id ?? p.userId,
        empresa_id: conta?.empresa_id ?? null,
        valor: plano.valor,
        data_pagamento: p.dataRecebimento,
        forma_pagamento: p.formaPagamento || null,
        observacao: "Quitação",
      });
      if (error) return { status: "erro", etapa: "registrar_pagamento", mensagem: mensagemDe(error) };

      // status/valor_pago/data_pagamento são do trigger: não sobrescrever.
      const { status: _s, data_pagamento: _d, valor_pago: _v, ...extrasSemStatus } = extras;
      if (Object.keys(extrasSemStatus).length > 0) {
        const { error: erroExtras } = await cliente.from("contas").update(extrasSemStatus).eq("id", plano.contaId);
        if (erroExtras) return { status: "erro", etapa: "campos_conta", mensagem: mensagemDe(erroExtras) };
      }

      const { data: depois } = await cliente.from("contas").select("status").eq("id", plano.contaId);
      const statusDepois = ((depois ?? []) as Array<{ status: string | null }>)[0]?.status ?? null;
      return { status: "pagamento_registrado", contaId: plano.contaId, quitou: isContaOSQuitada({ status: statusDepois }) };
    }

    case "atualizar_pendente": {
      const { error } = await cliente.from("contas").update(extras).eq("id", plano.contaId);
      if (error) return { status: "erro", etapa: "atualizar_pendente", mensagem: mensagemDe(error) };
      return { status: "pendente_atualizada", contaId: plano.contaId };
    }

    case "inserir": {
      const { error } = await cliente.from("contas").insert(p.novaConta);
      if (error) return { status: "erro", etapa: "inserir", mensagem: mensagemDe(error) };
      return { status: "inserida" };
    }
  }
}

/**
 * Status da conta da OS para leituras pontuais (ajuste de caixa fechado,
 * edição da OS): a quitada mais antiga, senão a mais antiga. Nunca
 * .maybeSingle() — com contas duplicadas ele devolvia null.
 */
export async function lerContaDaOSCore(
  cliente: ClienteBancoLike,
  userId: string,
  numeroOS: string,
): Promise<{ id: string; status: string | null } | null> {
  const { data, error } = await cliente
    .from("contas")
    .select("id, status, created_at")
    .eq("user_id", userId)
    .eq("os_numero", numeroOS)
    .eq("tipo", "receber");
  if (error) return null;
  const escolhida = escolherContaDaOS((data ?? []) as Array<{ id: string; status: string | null; created_at: string | null }>);
  return escolhida ? { id: escolhida.id, status: escolhida.status } : null;
}

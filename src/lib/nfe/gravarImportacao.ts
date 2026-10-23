/**
 * Importar XML de compra — ETAPA 4: tudo o que a tela precisa para gravar,
 * sem rede. Monta o payload da RPC importar_nfe_compra, decide se o botão
 * "Confirmar importação" pode ser liberado, confere o limite do plano e
 * traduz os erros da RPC e do upload para mensagens em português.
 *
 * Contrato do payload (fonte da verdade): comentários antes da função em
 * supabase/migrations/20261024120000_xml_compra_etapa3_importacao.sql.
 * Dinheiro e quantidades em inteiros (centavos); nunca user_id no payload.
 *
 * Sem React nem imports "@/": testado com Deno em scripts/testes-xml-compra/.
 */
import { decimalParaCentavos, gtinValido, type ItemNfe, type ResultadoLeituraNfe } from "./lerXmlNfe.ts";
import type { DadosTributaveisItem } from "./dadosTributaveisNfe.ts";
import { lerDecimalUsuario, type LinhaPlano, type ResumoImportacao } from "./planoImportacao.ts";
import type { TipoCadastro } from "./sugestaoVinculo.ts";

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

export interface NotaPayload {
  chave: string;
  numero: string;
  serie: string;
  modelo: string;
  tp_amb: string;
  /** Só dígitos (CNPJ, ou CPF de produtor rural). */
  emitente_cnpj: string;
  emitente_nome: string;
  /** dhEmi exatamente como veio no XML, com o fuso (ex.: 2026-10-15T10:30:00-03:00). */
  data_emissao: string;
  valor_total_centavos: number;
}

export interface ItemPayload {
  n_item: number;
  c_prod: string;
  descricao: string;
  tipo_destino: TipoCadastro;
  acao: "vinculado" | "novo";
  /** Só vinculado. */
  item_id?: string;
  quantidade: number;
  fator: number;
  custo_unitario_centavos: number;
  /** Só vinculado (no novo a RPC sempre grava o custo da nota). */
  atualizar_custo_medio?: boolean;
  /** Só novo. */
  novo_nome?: string;
  novo_codigo_barras?: string;
  novo_preco_centavos?: number;
}

export interface PayloadImportacao {
  /** null = matriz; id da filial quando a tela está numa filial. */
  empresa_id: string | null;
  nota: NotaPayload;
  itens: ItemPayload[];
}

export interface ContextoEmpresa {
  /** empresaId de useIdentidade (na matriz pode ser o id da linha "matriz"). */
  empresaId: string | null;
  isFilial: boolean;
}

/** Fator digitado ("12", "1,5") como número (até 4 casas, igual à RPC). */
function fatorNumero(texto: string): number {
  const e = lerDecimalUsuario(texto || "1", 4);
  if (!e || e.valor === 0n) return 1;
  const s = e.valor.toString().padStart(e.casas + 1, "0");
  return Number(e.casas ? `${s.slice(0, -e.casas)}.${s.slice(-e.casas)}` : s);
}

/** GTIN para o cadastro novo: só 8 a 14 dígitos com dígito verificador válido. */
export function codigoBarrasParaNovo(item: Pick<ItemNfe, "ean">, trib?: Pick<DadosTributaveisItem, "eanTrib"> | null): string | null {
  for (const c of [item.ean, trib?.eanTrib]) {
    if (c && /^\d{8,14}$/.test(c) && gtinValido(c)) return c;
  }
  return null;
}

/**
 * Payload da RPC a partir do plano da tela. Só entram linhas "importar"
 * (fora: ignorados, aparelhos/IMEI e itens com erro), em ordem de nItem —
 * a mesma em que a previsão acumulada do custo médio foi feita.
 * Lança erro se a nota não estiver pronta (a tela nunca chama nesse caso).
 */
export function montarPayloadImportacao(
  resultado: ResultadoLeituraNfe,
  linhas: LinhaPlano[],
  dadosTributaveis: Map<number, DadosTributaveisItem>,
  contexto: ContextoEmpresa,
): PayloadImportacao {
  const nota = resultado.nota;
  if (!resultado.ok || !nota) throw new Error("Nota inválida: não dá para montar a importação.");
  const valorTotal = decimalParaCentavos(nota.totais.vNF);
  if (valorTotal === null) throw new Error("Valor total da nota inválido.");

  const itensPorN = new Map(resultado.itens.map((i) => [i.nItem, i]));
  const itens: ItemPayload[] = [];
  for (const l of [...linhas].sort((a, b) => a.nItem - b.nItem)) {
    if (l.situacao !== "importar") continue;
    const item = itensPorN.get(l.nItem);
    if (!item || item.imeisSugeridos.length > 0) continue;
    const quantidade = l.quantidade.inteira;
    const custo = l.custoUnitarioCentavos;
    if (quantidade === null || custo === null || !Number.isSafeInteger(quantidade) || !Number.isSafeInteger(custo)) {
      throw new Error(`Item ${l.nItem}: quantidade ou custo sem valor inteiro.`);
    }
    const base = {
      n_item: item.nItem,
      c_prod: item.cProd,
      descricao: item.xProd,
      quantidade,
      fator: fatorNumero(l.decisao.fator),
      custo_unitario_centavos: custo,
    };
    if (l.decisao.acao === "vincular") {
      const v = l.decisao.vinculo;
      if (!v) throw new Error(`Item ${l.nItem}: sem produto vinculado.`);
      itens.push({ ...base, tipo_destino: v.tipo, acao: "vinculado", item_id: v.id, atualizar_custo_medio: l.atualizaCustoMedio });
    } else {
      const novo: ItemPayload = { ...base, tipo_destino: l.decisao.tipoNovo, acao: "novo", novo_nome: item.xProd };
      const ean = codigoBarrasParaNovo(item, dadosTributaveis.get(item.nItem));
      if (ean) novo.novo_codigo_barras = ean;
      if (l.precoVendaCentavos !== null) novo.novo_preco_centavos = l.precoVendaCentavos;
      itens.push(novo);
    }
  }

  return {
    empresa_id: contexto.isFilial ? contexto.empresaId : null,
    nota: {
      chave: nota.chave,
      numero: nota.numero,
      serie: nota.serie,
      modelo: nota.modelo,
      tp_amb: nota.tpAmb,
      emitente_cnpj: (nota.emitente.cnpj ?? nota.emitente.cpf ?? "").replace(/\D/g, ""),
      emitente_nome: nota.emitente.nome,
      data_emissao: nota.dataEmissao,
      valor_total_centavos: valorTotal,
    },
    itens,
  };
}

/** Caminho do XML original no bucket notas-compra-xml: <user_id do dono>/<chave>.xml. */
export const caminhoXmlCompra = (userIdDono: string, chave: string) => `${userIdDono}/${chave}.xml`;

// ---------------------------------------------------------------------------
// Limite do plano
// ---------------------------------------------------------------------------

/** Retorno de useAssinatura.podeCadastrarProduto (produtos + peças do mês). */
export interface VerificacaoLimitePlano {
  permitido: boolean;
  usados: number;
  /** -1 = ilimitado. */
  limite: number;
}

/** null = cabe no plano; texto = motivo do bloqueio. */
export function conferirLimitePlano(novos: number, v: VerificacaoLimitePlano): string | null {
  if (novos <= 0 || v.limite === -1) return null;
  if (v.usados + novos <= v.limite) return null;
  const restam = Math.max(0, v.limite - v.usados);
  return `Seu plano permite cadastrar até ${v.limite} produtos/peças por mês e já foram cadastrados ${v.usados}. ` +
    `Esta nota criaria ${novos} ${novos === 1 ? "cadastro novo" : "cadastros novos"}` +
    (restam > 0 ? `, mas só ${restam === 1 ? "cabe mais 1" : `cabem mais ${restam}`}.` : ".") +
    " Vincule itens a produtos existentes, ignore alguns ou faça upgrade do plano.";
}

// ---------------------------------------------------------------------------
// Liberação do botão
// ---------------------------------------------------------------------------

export interface EstadoConfirmacao {
  /** Regra de visibilidade da importação (hoje: só admin). */
  podeImportar: boolean;
  resumo: ResumoImportacao;
  notaOk: boolean;
  /** Consulta "nota já importada": ainda carregando / falhou. */
  verificandoNota: boolean;
  falhaVerificacaoNota: boolean;
  /** Limite do plano: ainda carregando; texto do bloqueio (conferirLimitePlano). */
  verificandoLimite: boolean;
  bloqueioLimite: string | null;
}

/** Motivos que mantêm o botão desabilitado (vazio = pode confirmar). */
export function motivosBloqueio(e: EstadoConfirmacao): string[] {
  const m: string[] = [];
  if (!e.podeImportar) m.push("Importação disponível só para administradores.");
  if (!e.notaOk || e.resumo.notaInvalida) {
    m.push("Nota não pode ser importada.");
    return m;
  }
  if (e.verificandoNota) m.push("Verificando se a nota já foi importada…");
  if (e.falhaVerificacaoNota) m.push("Não foi possível verificar se a nota já foi importada.");
  if (e.resumo.pendencias.length > 0) m.push("Resolva as pendências acima.");
  else if (e.resumo.aImportar === 0) m.push("Nenhum item marcado para importar.");
  if (e.verificandoLimite) m.push("Conferindo o limite do plano…");
  if (e.bloqueioLimite) m.push(e.bloqueioLimite);
  return m;
}

// ---------------------------------------------------------------------------
// Erros e retorno
// ---------------------------------------------------------------------------

export type TipoErroImportacao = "sem_acesso" | "ja_importada" | "invalido" | "generico";

export interface ErroImportacao {
  tipo: TipoErroImportacao;
  mensagem: string;
}

// deno-lint-ignore no-control-regex
// eslint-disable-next-line no-control-regex
const limparMensagem = (m: string) => m.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 300);

export const MENSAGEM_ERRO_GENERICO =
  "Não foi possível importar a nota agora. Confira em Produtos se o estoque mudou antes de tentar de novo (a mesma nota nunca entra duas vezes).";

/** Erro do supabase.rpc (PostgrestError ou falha de rede) → mensagem para a tela. Nunca inclui o payload. */
export function interpretarErroImportacao(erro: { code?: string | null; message?: string | null } | null | undefined): ErroImportacao {
  const code = erro?.code ?? "";
  const msg = limparMensagem(erro?.message ?? "");
  if (code === "23505") {
    return { tipo: "ja_importada", mensagem: /já foi importada/.test(msg) ? msg : "Esta nota já foi importada nesta loja." };
  }
  if (code === "42501") {
    const doItem = /^Item \d+: /.test(msg) ? ` ${msg}.` : "";
    return { tipo: "sem_acesso", mensagem: `Você não tem permissão para importar esta nota nesta loja.${doItem}` };
  }
  if (code === "22023") {
    return { tipo: "invalido", mensagem: msg ? `Dados inválidos: ${msg}.` : "Dados da importação inválidos." };
  }
  return { tipo: "generico", mensagem: MENSAGEM_ERRO_GENERICO };
}

/** Upload com upsert:false de um objeto que já existe (mesma nota enviada antes): conta como sucesso. */
export function erroUploadEhObjetoExistente(erro: { message?: string; status?: number; statusCode?: string | number } | null | undefined): boolean {
  if (!erro) return false;
  return String(erro.statusCode ?? "") === "409" || erro.status === 409 || /already exists|duplicate/i.test(erro.message ?? "");
}

export interface RetornoImportacao {
  importacaoId: string;
  itens: number;
  vinculados: number;
  novos: number;
  unidades: number;
  custoTotalCentavos: number;
  xmlAnexado: boolean;
}

/** jsonb devolvido pela RPC → objeto tipado; null se vier algo inesperado. */
export function lerRetornoImportacao(dados: unknown): RetornoImportacao | null {
  if (!dados || typeof dados !== "object") return null;
  const d = dados as Record<string, unknown>;
  const n = (k: string) => (typeof d[k] === "number" && Number.isFinite(d[k]) ? (d[k] as number) : null);
  const valores = [n("itens"), n("vinculados"), n("novos"), n("unidades"), n("custo_total_centavos")];
  if (typeof d.importacao_id !== "string" || valores.some((v) => v === null)) return null;
  const [itens, vinculados, novos, unidades, custo] = valores as number[];
  return { importacaoId: d.importacao_id, itens, vinculados, novos, unidades, custoTotalCentavos: custo, xmlAnexado: d.xml_anexado === true };
}

/** Pendência da nota já importada: data do SELECT (ISO) ou mensagem 23505 da RPC. */
export function textoJaImportada(origem: { criadaEm: string } | { mensagemRpc: string }): string {
  if ("criadaEm" in origem) return `Esta nota já foi importada em ${formatarDataHoraBrasilia(origem.criadaEm)}.`;
  const data = /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/.exec(origem.mensagemRpc)?.[1];
  return data ? `Esta nota já foi importada em ${data}.` : "Esta nota já foi importada nesta loja.";
}

/** timestamptz ISO → "dd/mm/aaaa hh:mm" no horário de Brasília. */
export function formatarDataHoraBrasilia(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

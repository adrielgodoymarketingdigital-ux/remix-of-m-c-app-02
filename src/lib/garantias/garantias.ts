/**
 * "Minhas garantias" — regras puras (sem React, sem Supabase), testadas em
 * scripts/testes-minhas-garantias/.
 *
 *  - garantiasParaExibir: lista da tela; loja que NUNCA teve linha em
 *    garantias_loja vê as garantias padrão VIRTUAIS (nada gravado no banco).
 *  - planoGravacao: o que gravar para cada ação da tela. Enquanto a lista é
 *    virtual, a 1ª ação grava as 4 padrão de uma vez (com a ação aplicada),
 *    num único INSERT; o índice único (origem, origem_ref) impede duplicar.
 *  - validarGarantia: os mesmos limites dos CHECKs da tabela.
 *  - prazosDivergentes: prazo escrito à mão no texto diferente do campo Prazo.
 */
import { textoPadraoGarantia } from "./textoPadrao.ts";

export const NOME_MAX = 80;
export const MESES_MAX = 120;
export const TEXTO_MAX_BYTES = 20000;

export type OrigemGarantia = "manual" | "padrao" | "tipos_garantia" | "modelo" | "termo_global";

/** Linha de public.garantias_loja. */
export interface GarantiaLoja {
  id: string;
  user_id: string;
  empresa_id: string | null;
  nome: string;
  meses: number;
  texto: string;
  ativo: boolean;
  ordem: number;
  revisar: boolean;
  origem: OrigemGarantia;
  origem_ref: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at: string | null;
}

/** Linha a inserir (o banco preenche id e datas). */
export interface NovaGarantia {
  user_id: string;
  empresa_id: string | null;
  nome: string;
  meses: number;
  texto: string;
  ativo: boolean;
  ordem: number;
  revisar: boolean;
  origem: OrigemGarantia;
  origem_ref: string | null;
  deleted_at?: string | null;
}

/** Item como a tela mostra. `chave` = id real, ou "padrao:N" quando virtual. */
export interface GarantiaExibida {
  chave: string;
  id: string | null;
  virtual: boolean;
  nome: string;
  meses: number;
  texto: string;
  ativo: boolean;
  ordem: number;
  revisar: boolean;
  origem: OrigemGarantia;
}

export interface DadosGarantia {
  nome: string;
  meses: number;
  texto: string;
  ativo?: boolean;
}

export interface DonoGarantias {
  user_id: string;
  empresa_id: string | null;
}

// ── Padrões virtuais ────────────────────────────────────────────────────────

const PADROES: ReadonlyArray<{ meses: number; nome: string; ordem: number }> = [
  { meses: 0, nome: "Sem garantia", ordem: 0 },
  { meses: 3, nome: "Garantia 3 meses", ordem: 10 },
  { meses: 6, nome: "Garantia 6 meses", ordem: 20 },
  { meses: 12, nome: "Garantia 12 meses", ordem: 30 },
];

export const chavePadrao = (meses: number) => `padrao:${meses}`;

/** As 4 garantias padrão (Sem garantia, 3, 6 e 12 meses) com o texto padrão. */
export function garantiasPadraoVirtuais(): GarantiaExibida[] {
  return PADROES.map((p) => ({
    chave: chavePadrao(p.meses),
    id: null,
    virtual: true,
    nome: p.nome,
    meses: p.meses,
    texto: textoPadraoGarantia(p.meses),
    ativo: true,
    ordem: p.ordem,
    revisar: false,
    origem: "padrao" as const,
  }));
}

function ordenar(a: { ordem: number; nome: string; chave: string }, b: { ordem: number; nome: string; chave: string }): number {
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  const n = a.nome.localeCompare(b.nome, "pt-BR");
  if (n !== 0) return n;
  return a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0;
}

/**
 * Lista da tela. Sem NENHUMA linha (nem apagada) → as 4 padrão virtuais.
 * Com linhas → só as não apagadas (pode ficar vazia se o dono apagou todas:
 * os padrões não "voltam sozinhos").
 */
export function garantiasParaExibir(linhas: readonly GarantiaLoja[]): { lista: GarantiaExibida[]; virtual: boolean } {
  if (linhas.length === 0) return { lista: garantiasPadraoVirtuais(), virtual: true };
  const lista = linhas
    .filter((l) => !l.deleted_at)
    .map((l) => ({
      chave: l.id,
      id: l.id,
      virtual: false,
      nome: l.nome,
      meses: l.meses,
      texto: l.texto,
      ativo: l.ativo,
      ordem: l.ordem,
      revisar: l.revisar,
      origem: l.origem,
    }))
    .sort(ordenar);
  return { lista, virtual: false };
}

// ── Validação (mesmos limites dos CHECKs) ───────────────────────────────────

export interface ErrosGarantia {
  nome?: string;
  meses?: string;
  texto?: string;
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

export function validarGarantia(d: DadosGarantia): { ok: true; valor: Required<DadosGarantia> } | { ok: false; erros: ErrosGarantia } {
  const erros: ErrosGarantia = {};
  const nome = (d.nome ?? "").trim();
  if (!nome) erros.nome = "Dê um nome para a garantia.";
  else if ([...nome].length > NOME_MAX) erros.nome = `Use no máximo ${NOME_MAX} caracteres.`;
  if (!Number.isInteger(d.meses) || d.meses < 0 || d.meses > MESES_MAX) {
    erros.meses = `Prazo entre 0 (sem garantia) e ${MESES_MAX} meses.`;
  }
  const texto = d.texto ?? "";
  if (!texto.trim()) erros.texto = "Escreva o texto do termo.";
  else if (bytes(texto) > TEXTO_MAX_BYTES) erros.texto = "Texto grande demais (limite de 20 mil caracteres).";
  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valor: { nome, meses: d.meses, texto, ativo: d.ativo ?? true } };
}

// ── Prazo escrito à mão no texto ─────────────────────────────────────────────

export interface PrazoNoTexto {
  trecho: string;
  meses: number;
}

const NUMEROS_EXTENSO: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, "três": 3, seis: 6, doze: 12 };

/**
 * Prazos fixos no texto ("6 meses", "6 (seis) meses", "1 ano", "dois anos")
 * diferentes do prazo da garantia. Ignora dias (o "90 dias" do CDC é legal,
 * não o prazo contratual) e o próprio {{garantia_meses}}.
 */
export function prazosDivergentes(texto: string, meses: number): PrazoNoTexto[] {
  const achados: PrazoNoTexto[] = [];
  const re = /\b(\d{1,3}|um|uma|dois|duas|tr[eê]s|seis|doze)\s*(?:\([^)\n]{1,30}\)\s*)?(m[eê]s(?:es)?|anos?)\b/gi;
  for (const m of texto.matchAll(re)) {
    const bruto = m[1].toLowerCase();
    const n = /^\d+$/.test(bruto) ? Number(bruto) : NUMEROS_EXTENSO[bruto];
    if (!n) continue;
    const emMeses = m[2].toLowerCase().startsWith("ano") ? n * 12 : n;
    if (emMeses !== meses) achados.push({ trecho: m[0], meses: emMeses });
  }
  return achados;
}

// ── Plano de gravação ────────────────────────────────────────────────────────

export type AcaoGarantia =
  | { tipo: "criar"; dados: DadosGarantia }
  | { tipo: "editar"; chave: string; dados: DadosGarantia }
  | { tipo: "duplicar"; chave: string }
  | { tipo: "ativar"; chave: string; ativo: boolean }
  | { tipo: "excluir"; chave: string; agora: string };

export interface PlanoGravacao {
  inserir: NovaGarantia[];
  atualizar: { id: string; campos: Partial<Pick<GarantiaLoja, "nome" | "meses" | "texto" | "ativo" | "revisar" | "deleted_at">> }[];
}

function nomeDaCopia(nome: string, existentes: readonly string[]): string {
  const usados = new Set(existentes.map((n) => n.trim().toLowerCase()));
  for (let i = 1; i < 1000; i++) {
    const sufixo = i === 1 ? " (cópia)" : ` (cópia ${i})`;
    const base = [...nome.trim()].slice(0, NOME_MAX - [...sufixo].length).join("").trimEnd();
    const candidato = base + sufixo;
    if (!usados.has(candidato.toLowerCase())) return candidato;
  }
  return [...`${nome} (cópia)`].slice(0, NOME_MAX).join("");
}

const proximaOrdem = (lista: readonly { ordem: number }[]) =>
  lista.length === 0 ? 10 : Math.max(...lista.map((g) => g.ordem)) + 10;

function exigirValida(d: DadosGarantia): Required<DadosGarantia> {
  const v = validarGarantia(d);
  if ("erros" in v) throw new Error(`Garantia inválida: ${Object.values(v.erros).join(" ")}`);
  return v.valor;
}

/**
 * O que gravar para uma ação. `linhas` = TODAS as linhas da loja (inclusive
 * apagadas), como o hook leu. Lança erro se a chave não existe ou os dados
 * são inválidos (a tela valida antes; aqui é a última barreira).
 */
export function planoGravacao(linhas: readonly GarantiaLoja[], acao: AcaoGarantia, dono: DonoGarantias): PlanoGravacao {
  const { lista, virtual } = garantiasParaExibir(linhas);

  if (virtual) {
    // Grava as 4 padrão já com a ação aplicada (um INSERT só).
    const base: NovaGarantia[] = lista.map((g) => ({
      user_id: dono.user_id,
      empresa_id: dono.empresa_id,
      nome: g.nome,
      meses: g.meses,
      texto: g.texto,
      ativo: g.ativo,
      ordem: g.ordem,
      revisar: false,
      origem: "padrao",
      origem_ref: g.chave,
      deleted_at: null,
    }));
    const alvo = (chave: string) => {
      const i = base.findIndex((b) => b.origem_ref === chave);
      if (i < 0) throw new Error(`Garantia não encontrada: ${chave}`);
      return i;
    };
    switch (acao.tipo) {
      case "criar": {
        const v = exigirValida(acao.dados);
        base.push({ ...dono, ...v, ordem: proximaOrdem(base), revisar: false, origem: "manual", origem_ref: null, deleted_at: null });
        break;
      }
      case "editar": {
        const v = exigirValida(acao.dados);
        const i = alvo(acao.chave);
        base[i] = { ...base[i], ...v };
        break;
      }
      case "duplicar": {
        const o = base[alvo(acao.chave)];
        base.push({ ...o, nome: nomeDaCopia(o.nome, base.map((b) => b.nome)), ordem: proximaOrdem(base), origem: "manual", origem_ref: null });
        break;
      }
      case "ativar":
        base[alvo(acao.chave)].ativo = acao.ativo;
        break;
      case "excluir":
        base[alvo(acao.chave)].deleted_at = acao.agora;
        break;
    }
    return { inserir: base, atualizar: [] };
  }

  const achar = (chave: string) => {
    const g = lista.find((x) => x.chave === chave);
    if (!g || !g.id) throw new Error(`Garantia não encontrada: ${chave}`);
    return g as GarantiaExibida & { id: string };
  };
  switch (acao.tipo) {
    case "criar": {
      const v = exigirValida(acao.dados);
      return {
        inserir: [{ ...dono, ...v, ordem: proximaOrdem(lista), revisar: false, origem: "manual", origem_ref: null }],
        atualizar: [],
      };
    }
    case "editar": {
      const g = achar(acao.chave);
      const v = exigirValida(acao.dados);
      // Salvar pela tela = revisado.
      return { inserir: [], atualizar: [{ id: g.id, campos: { ...v, revisar: false } }] };
    }
    case "duplicar": {
      const g = achar(acao.chave);
      return {
        inserir: [{
          ...dono,
          nome: nomeDaCopia(g.nome, lista.map((x) => x.nome)),
          meses: g.meses,
          texto: g.texto,
          ativo: g.ativo,
          ordem: proximaOrdem(lista),
          revisar: false,
          origem: "manual",
          origem_ref: null,
        }],
        atualizar: [],
      };
    }
    case "ativar":
      return { inserir: [], atualizar: [{ id: achar(acao.chave).id, campos: { ativo: acao.ativo } }] };
    case "excluir":
      return { inserir: [], atualizar: [{ id: achar(acao.chave).id, campos: { deleted_at: acao.agora } }] };
  }
}

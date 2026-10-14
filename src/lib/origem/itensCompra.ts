/**
 * Regras puras de compra com vários dispositivos (Origem de Dispositivos): o
 * "+" que copia uma unidade, a trava de IMEI/série repetido dentro da mesma
 * compra, o total e a lista de aparelhos da compra no "Visualizar". Sem
 * dependências (testado com Deno em scripts/testes-compra-multi-dispositivo/).
 *
 * Modelo: uma linha em compras_dispositivos (valor_pago = total, dispositivo_id
 * = aparelho principal) e cada aparelho com dispositivos.compra_id apontando
 * para ela.
 */

/** Campos do aparelho usados pelo "+" (subconjunto de Dispositivo/FormularioDispositivo). */
export interface DadosUnidade {
  tipo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  cor?: string | null;
  capacidade_gb?: number | null;
  subtipo_computador?: string | null;
  condicao?: "novo" | "semi_novo" | "usado" | null;
  garantia?: boolean | null;
  tempo_garantia?: number | null;
  custo?: number | null;
  preco?: number | null;
  fornecedor_id?: string | null;
  imei?: string | null;
  imei2?: string | null;
  numero_serie?: string | null;
  codigo_barras?: string | null;
  saude_bateria?: number | null;
  fotos?: string[] | null;
  foto_url?: string | null;
}

/** O que o "+" copia: dados do modelo e valores. */
export interface UnidadeCopiada {
  tipo: string;
  marca: string;
  modelo: string;
  cor?: string;
  capacidade_gb?: number;
  subtipo_computador?: string;
  condicao: "novo" | "semi_novo" | "usado";
  garantia: boolean;
  tempo_garantia?: number;
  custo?: number;
  preco?: number;
  fornecedor_id?: string | null;
}

/**
 * Nova unidade a partir da do lado: copia modelo, marca, cor, capacidade,
 * condição, garantia, custo, preço e fornecedor; não leva o que é da unidade
 * física (IMEI, IMEI 2, nº de série, código de barras, saúde da bateria,
 * fotos e checklist), que fica em branco para preencher.
 */
export function copiarParaNovaUnidade(d: DadosUnidade): UnidadeCopiada {
  return {
    tipo: d.tipo ?? "",
    marca: d.marca ?? "",
    modelo: d.modelo ?? "",
    cor: d.cor ?? undefined,
    capacidade_gb: d.capacidade_gb ?? undefined,
    subtipo_computador: d.subtipo_computador ?? undefined,
    condicao: d.condicao ?? "novo",
    garantia: !!d.garantia,
    tempo_garantia: d.tempo_garantia ?? undefined,
    custo: d.custo ?? undefined,
    preco: d.preco ?? undefined,
    fornecedor_id: d.fornecedor_id ?? null,
  };
}

// ── IMEI / série repetido dentro da compra ─────────────────────────────────

/** Sem espaços, pontos, traços e barras, em maiúsculas ("35 123-456" = "35123456"). */
export function normalizarIdentificador(valor: string | null | undefined): string {
  return (valor ?? "").replace(/[\s.\-/]/g, "").toUpperCase();
}

export interface UnidadeIdentificada {
  id?: string | null;
  rotulo?: string | null;
  imei?: string | null;
  imei2?: string | null;
  numero_serie?: string | null;
}

const CAMPOS_IDENTIFICADORES = [
  { campo: "imei", nome: "IMEI" },
  { campo: "imei2", nome: "IMEI" },
  { campo: "numero_serie", nome: "Nº de série" },
] as const;

/** IMEI 1 e 2 são comparados entre si (o IMEI 2 de um não pode ser o IMEI 1 de outro). */
function identificadores(u: UnidadeIdentificada): { nome: string; grupo: "imei" | "serie"; valor: string; original: string }[] {
  const lista: { nome: string; grupo: "imei" | "serie"; valor: string; original: string }[] = [];
  for (const { campo, nome } of CAMPOS_IDENTIFICADORES) {
    const original = (u[campo] ?? "").trim();
    const valor = normalizarIdentificador(original);
    if (valor) lista.push({ nome, grupo: campo === "numero_serie" ? "serie" : "imei", valor, original });
  }
  return lista;
}

function mensagemDuplicado(nome: string, valor: string, rotuloOutro: string | null | undefined): string {
  const outro = rotuloOutro?.trim() ? ` (${rotuloOutro.trim()})` : "";
  return `${nome} ${valor} repetido nesta compra: já está em outro dispositivo da lista${outro}. Cada unidade precisa de ${nome} próprio.`;
}

/**
 * Mensagem se a `nova` unidade repete IMEI/série de alguma `existente` da
 * compra (ou se o IMEI 1 e o IMEI 2 dela são iguais); null se está tudo certo.
 * Campos vazios não contam. Unidade com o mesmo `id` é ignorada.
 */
export function duplicadoNaCompra(nova: UnidadeIdentificada, existentes: UnidadeIdentificada[]): string | null {
  const daNova = identificadores(nova);
  const imeisNova = daNova.filter((i) => i.grupo === "imei");
  if (imeisNova.length === 2 && imeisNova[0].valor === imeisNova[1].valor) {
    return `IMEI ${imeisNova[0].original} informado duas vezes (IMEI 1 e IMEI 2) no mesmo dispositivo.`;
  }
  for (const outra of existentes) {
    if (nova.id && outra.id && nova.id === outra.id) continue;
    const daOutra = identificadores(outra);
    for (const i of daNova) {
      if (daOutra.some((o) => o.grupo === i.grupo && o.valor === i.valor)) {
        return mensagemDuplicado(i.nome, i.original, outra.rotulo);
      }
    }
  }
  return null;
}

/** Primeira repetição de IMEI/série entre as unidades da compra (conferência final ao salvar). */
export function primeiroDuplicadoNaLista(unidades: UnidadeIdentificada[]): string | null {
  for (let i = 0; i < unidades.length; i++) {
    const msg = duplicadoNaCompra(unidades[i], unidades.slice(0, i));
    if (msg) return msg;
  }
  return null;
}

// ── Total e lista da compra ────────────────────────────────────────────────

/** Quantidade de aparelhos e soma dos custos (custo vazio conta 0), arredondada em centavos. */
export function totalDaCompra(unidades: { custo?: number | null }[]): { quantidade: number; somaCustos: number } {
  const soma = unidades.reduce((acc, u) => acc + (Number(u.custo) || 0), 0);
  return { quantidade: unidades.length, somaCustos: Math.round(soma * 100) / 100 };
}

/**
 * Aparelhos da compra no "Visualizar": o principal (compras_dispositivos.dispositivo_id)
 * primeiro, depois os que têm compra_id = compra, por data de cadastro, sem repetir.
 * Compra antiga cujo vínculo compra_id não gravou continua mostrando o principal.
 */
export function ordenarDispositivosDaCompra<T extends { id: string; created_at?: string | null }>(
  lista: T[],
  principalId: string | null | undefined,
): T[] {
  const vistos = new Set<string>();
  const unicos = lista.filter((d) => (vistos.has(d.id) ? false : (vistos.add(d.id), true)));
  return unicos.sort((a, b) => {
    if (a.id === principalId) return -1;
    if (b.id === principalId) return 1;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
}

export type StatusDispositivoCompra = "em_estoque" | "vendido" | "excluido";

export function statusDispositivoCompra(d: { vendido?: boolean | null; deleted_at?: string | null }): StatusDispositivoCompra {
  if (d.deleted_at) return "excluido";
  if (d.vendido) return "vendido";
  return "em_estoque";
}

/** Ids que recebem dispositivos.compra_id: o principal e os adicionais, sem vazios nem repetidos. */
export function idsDispositivosDaCompra(principalId: string | null | undefined, adicionais: string[] | null | undefined): string[] {
  return [...new Set([principalId, ...(adicionais ?? [])].filter((id): id is string => !!id))];
}

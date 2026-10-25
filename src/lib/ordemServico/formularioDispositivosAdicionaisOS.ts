import type { CamposNovosLinhaServico } from "./linhaServicoOS.ts";
import {
  adicionalParaFormulario,
  type DispositivoAdicionalForm,
  type EntradaGravacaoAdicionais,
  MAX_DISPOSITIVOS_ADICIONAIS,
} from "./gravacaoDispositivosAdicionaisOS.ts";
import {
  type DispositivoAdicionalOS,
  imeiOuSerie,
  marcaModelo,
  numeroAdicional,
  tituloDispositivo,
} from "./dispositivosAdicionaisOS.ts";

/**
 * Estado dos dispositivos adicionais DENTRO do assistente da OS (etapa 5b).
 * Módulo puro, testado com Deno em scripts/testes-os-multi/.
 *
 * - "carregando"/"erro": a seção fica travada (sem adicionar, editar nem
 *   remover) e NADA é enviado para gravar — assim um erro de leitura nunca
 *   apaga nem duplica aparelho que já existe no banco.
 * - Removidos: só o que o usuário removeu na tela. Aparelho que veio do banco
 *   vai para `removidos` (delete ao salvar); aparelho criado agora e nunca
 *   gravado só vai se tiver fotos (para apagá-las do storage depois de salvar).
 */
export type CargaAdicionais = "carregando" | "ok" | "erro";

export interface RemovidoForm {
  id: string;
  fotos_dispositivo: string[];
  /** "iPhone 12" — para o aviso se a remoção falhar. */
  rotulo: string;
}

export interface EstadoAdicionaisForm {
  carga: CargaAdicionais;
  dispositivos: DispositivoAdicionalForm[];
  removidos: RemovidoForm[];
  /** Ids que vieram do banco ao abrir a OS (ou já gravados nesta sessão). */
  idsGravados: string[];
}

const VAZIO: EstadoAdicionaisForm = { carga: "ok", dispositivos: [], removidos: [], idsGravados: [] };

/** OS nova: nada a carregar. */
export const estadoAdicionaisNovaOS = (): EstadoAdicionaisForm => ({ ...VAZIO });
export const estadoAdicionaisCarregando = (): EstadoAdicionaisForm => ({ ...VAZIO, carga: "carregando" });
export const estadoAdicionaisErro = (): EstadoAdicionaisForm => ({ ...VAZIO, carga: "erro" });

/** Já é o estado de OS nova (nada carregado, nada mudado)? */
export const estadoAdicionaisVazio = (e: EstadoAdicionaisForm): boolean =>
  e.carga === "ok" && e.dispositivos.length === 0 && e.removidos.length === 0 && e.idsGravados.length === 0;

/** Aparelhos lidos do banco → estado do formulário (senha já em claro). */
export function estadoAdicionaisCarregados(lidos: readonly DispositivoAdicionalOS[]): EstadoAdicionaisForm {
  const dispositivos = lidos.map(adicionalParaFormulario);
  return { carga: "ok", dispositivos, removidos: [], idsGravados: dispositivos.map((d) => d.id) };
}

/**
 * Leitura que RELATA o erro (a de telas de leitura, consultarSemFalhar,
 * devolve lista vazia — aqui isso faria a seção parecer vazia e o usuário
 * cadastrar de novo um aparelho que já existe).
 */
export async function consultarRelatandoErro<T>(
  consulta: () => PromiseLike<{ data: unknown; error: unknown }>,
  ler: (dados: unknown) => T,
): Promise<{ ok: true; dados: T } | { ok: false }> {
  try {
    const { data, error } = await consulta();
    return error ? { ok: false } : { ok: true, dados: ler(data) };
  } catch {
    return { ok: false };
  }
}

export const secaoAdicionaisTravada = (estado: Pick<EstadoAdicionaisForm, "carga">): boolean => estado.carga !== "ok";

export const podeAdicionarAparelho = (estado: EstadoAdicionaisForm): boolean =>
  !secaoAdicionaisTravada(estado) && estado.dispositivos.length < MAX_DISPOSITIVOS_ADICIONAIS;

/** Inclui (id novo) ou substitui (mesmo id, mesma posição) o aparelho. */
export function salvarAparelhoNoEstado(estado: EstadoAdicionaisForm, d: DispositivoAdicionalForm): EstadoAdicionaisForm {
  const existe = estado.dispositivos.some((x) => x.id === d.id);
  return {
    ...estado,
    dispositivos: existe ? estado.dispositivos.map((x) => (x.id === d.id ? d : x)) : [...estado.dispositivos, d],
  };
}

/** Quantas linhas de serviço estão ligadas ao aparelho. */
export function contarServicosLigados(servicos: readonly { linha_os?: CamposNovosLinhaServico }[], id: string): number {
  return servicos.filter((s) => s.linha_os?.dispositivo_ref === id).length;
}

/**
 * Liga a linha de serviço a um aparelho (ref) ou volta para a OS/aparelho
 * principal (null). Só mexe em dispositivo_ref: linha sem linha_os ganha
 * linha_os só com ele; linha_os que fica vazia vira undefined. Sem mudança, o
 * MESMO objeto.
 */
export function definirDispositivoRefLinha<T extends { linha_os?: CamposNovosLinhaServico }>(linha: T, ref: string | null): T {
  const atual = linha.linha_os?.dispositivo_ref ?? null;
  if (atual === ref) return linha;
  const { dispositivo_ref: _ref, ...resto } = linha.linha_os ?? {};
  const linhaOs: CamposNovosLinhaServico = ref ? { ...resto, dispositivo_ref: ref } : resto;
  return { ...linha, linha_os: Object.keys(linhaOs).length > 0 ? linhaOs : undefined };
}

/**
 * Remove o aparelho da tela e devolve as linhas de serviço com as ligações a
 * ele desfeitas (voltam para "OS / aparelho principal"). Não apaga nada: as
 * fotos só saem do storage depois de a OS ser salva (gravação da 5a).
 */
export function removerAparelhoDoEstado<T extends { linha_os?: CamposNovosLinhaServico }>(
  estado: EstadoAdicionaisForm,
  id: string,
  servicos: readonly T[],
): { estado: EstadoAdicionaisForm; servicos: T[]; servicosDesligados: number } {
  const alvo = estado.dispositivos.find((d) => d.id === id);
  if (!alvo) return { estado, servicos: [...servicos], servicosDesligados: 0 };
  const gravado = estado.idsGravados.includes(id);
  const removido: RemovidoForm = {
    id,
    fotos_dispositivo: alvo.fotos_dispositivo,
    rotulo: alvo.dispositivo_modelo || alvo.dispositivo_marca || alvo.dispositivo_tipo,
  };
  const entraEmRemovidos = (gravado || alvo.fotos_dispositivo.length > 0) && !estado.removidos.some((r) => r.id === id);
  return {
    estado: {
      ...estado,
      dispositivos: estado.dispositivos.filter((d) => d.id !== id),
      removidos: entraEmRemovidos ? [...estado.removidos, removido] : estado.removidos,
    },
    servicos: servicos.map((s) => (s.linha_os?.dispositivo_ref === id ? definirDispositivoRefLinha(s, null) : s)),
    servicosDesligados: contarServicosLigados(servicos, id),
  };
}

/**
 * O que o assistente passa para salvarOrdemServico. undefined (não toca na
 * tabela nem nas ligações de serviço) quando o usuário não vê os adicionais ou
 * quando a lista não carregou. A ordem é a posição na lista (a gravação
 * renumera 2, 3, ...).
 */
export function entradaGravacaoParaSalvar(visivel: boolean, estado: EstadoAdicionaisForm): EntradaGravacaoAdicionais | undefined {
  if (!visivel || estado.carga !== "ok") return undefined;
  return {
    dispositivos: estado.dispositivos,
    removidos: estado.removidos.map(({ id, fotos_dispositivo, rotulo }) => ({ id, fotos_dispositivo, rotulo })),
  };
}

/** Depois de gravar com sucesso: tudo o que está na tela passa a existir no banco. */
export function estadoAposGravacao(estado: EstadoAdicionaisForm): EstadoAdicionaisForm {
  return { ...estado, removidos: [], idsGravados: estado.dispositivos.map((d) => d.id) };
}

// ---------------------------------------------------------------------------
// Etapas 4 (defeito/observações) e 5 (checklist/avarias) com um bloco por
// aparelho (etapa 6 da OS com vários dispositivos). Os blocos editam o MESMO
// estadoAdicionais que o diálogo do aparelho — não há cópia para sincronizar.

/** O que os blocos das etapas 4 e 5 podem mudar no aparelho (tipo, marca e modelo só no diálogo). */
export type CamposAparelhoNasEtapas = Partial<
  Pick<
    DispositivoAdicionalForm,
    | "defeito_relatado"
    | "observacoes"
    | "checklist"
    | "avarias_visuais"
    | "dispositivo_sistema"
    | "dispositivo_fabricante"
    | "dispositivo_subtipo"
  >
>;

/**
 * Muda campos de UM aparelho. Devolve o MESMO estado (sem render a mais)
 * quando nada muda: seção travada, id que não existe mais (aparelho removido)
 * ou valores iguais aos atuais. Os demais aparelhos continuam os mesmos objetos.
 */
export function alterarAparelhoNoEstado(
  estado: EstadoAdicionaisForm,
  id: string,
  parcial: CamposAparelhoNasEtapas,
): EstadoAdicionaisForm {
  if (secaoAdicionaisTravada(estado)) return estado;
  const atual = estado.dispositivos.find((d) => d.id === id);
  if (!atual) return estado;
  const mudancas = (Object.keys(parcial) as (keyof CamposAparelhoNasEtapas)[]).filter(
    (k) => parcial[k] !== undefined && !Object.is(parcial[k], atual[k]),
  );
  if (mudancas.length === 0) return estado;
  const novo: DispositivoAdicionalForm = { ...atual };
  for (const k of mudancas) Object.assign(novo, { [k]: parcial[k] });
  return { ...estado, dispositivos: estado.dispositivos.map((d) => (d.id === id ? novo : d)) };
}

/** "Dispositivo 2 — Apple iPhone 12"; sem marca/modelo usa o tipo; sem nada, só "Dispositivo 2". */
export function tituloBlocoDispositivo(
  numero: number,
  d: { dispositivo_tipo?: string | null; dispositivo_marca?: string | null; dispositivo_modelo?: string | null },
): string {
  const nome = marcaModelo({ dispositivo_marca: d.dispositivo_marca?.trim(), dispositivo_modelo: d.dispositivo_modelo?.trim() }) ||
    d.dispositivo_tipo?.trim() || "";
  return nome ? `${tituloDispositivo(numero)} — ${nome}` : tituloDispositivo(numero);
}

/**
 * O que as etapas 4 e 5 mostram dos adicionais. "nenhuma" = a etapa fica
 * idêntica à de quem não vê os adicionais (sem estado, ou carregado e sem
 * aparelhos). "carregando"/"erro" = aviso, sem blocos.
 */
export type ExibicaoAparelhosNasEtapas = "nenhuma" | "carregando" | "erro" | "blocos";

export function exibicaoAparelhosNasEtapas(estado: EstadoAdicionaisForm | undefined): ExibicaoAparelhosNasEtapas {
  if (!estado) return "nenhuma";
  if (estado.carga === "carregando") return "carregando";
  if (estado.carga === "erro") return "erro";
  return estado.dispositivos.length > 0 ? "blocos" : "nenhuma";
}

/** Prefixo dos ids dos campos do bloco (ids únicos com vários aparelhos na mesma página). */
export const prefixoIdAparelho = (id: string): string => `adicional-${id}-`;

/** Troca de tipo no aparelho: zera o que depende do tipo (como no aparelho 1). */
export function aoMudarTipoAdicional(d: DispositivoAdicionalForm, tipo: string): DispositivoAdicionalForm {
  return {
    ...d,
    dispositivo_tipo: tipo,
    dispositivo_marca: "",
    dispositivo_modelo: "",
    dispositivo_cor: "",
    dispositivo_sistema: "",
    dispositivo_fabricante: "",
    dispositivo_subtipo: "",
    checklist: { entrada: {}, saida: {} },
    avarias_visuais: [],
  };
}

/** Troca de marca: zera modelo e cor (como no aparelho 1). */
export const aoMudarMarcaAdicional = (d: DispositivoAdicionalForm, marca: string): DispositivoAdicionalForm => ({
  ...d,
  dispositivo_marca: marca,
  dispositivo_modelo: "",
  dispositivo_cor: "",
});

/** "Dispositivo 2 — Apple iPhone 12 · IMEI 3567…" (sem IMEI/série, só o nome). */
export function rotuloCartaoAdicional(d: DispositivoAdicionalForm, indice: number): string {
  const nome = marcaModelo(d) || d.dispositivo_tipo;
  const imei = imeiOuSerie({
    dispositivo_imei: d.dispositivo_imei.trim() || null,
    dispositivo_numero_serie: d.dispositivo_numero_serie.trim() || null,
  });
  const ident = imei ? ` · ${d.dispositivo_imei.trim() ? "IMEI" : "Série"} ${imei}` : "";
  return `${tituloDispositivo(numeroAdicional(indice))} — ${nome}${ident}`;
}

/** Opções do seletor "Aparelho" de cada linha de serviço. */
export const VALOR_APARELHO_PRINCIPAL = "principal";
export function opcoesAparelhoServico(dispositivos: readonly DispositivoAdicionalForm[]): { valor: string; rotulo: string }[] {
  return [
    { valor: VALOR_APARELHO_PRINCIPAL, rotulo: "OS / principal" },
    ...dispositivos.map((d, i) => {
      const nome = d.dispositivo_modelo || d.dispositivo_marca;
      const titulo = tituloDispositivo(numeroAdicional(i));
      return { valor: d.id, rotulo: nome ? `${titulo} (${nome})` : titulo };
    }),
  ];
}

/** Valor do seletor para a linha: o aparelho ligado, se ainda existe; senão o principal. */
export function valorAparelhoDaLinha(
  linha: { linha_os?: CamposNovosLinhaServico },
  dispositivos: readonly { id: string }[],
): string {
  const ref = linha.linha_os?.dispositivo_ref;
  return ref && dispositivos.some((d) => d.id === ref) ? ref : VALOR_APARELHO_PRINCIPAL;
}

/** Textos da confirmação de remover. */
export function textosRemoverAparelho(
  d: DispositivoAdicionalForm,
  indice: number,
  servicosLigados: number,
): { titulo: string; aviso: string | null } {
  const nome = d.dispositivo_modelo || d.dispositivo_marca;
  const titulo = `Remover o ${tituloDispositivo(numeroAdicional(indice))}${nome ? ` (${nome})` : ""}? As fotos e o checklist dele serão apagados ao salvar a OS.`;
  const aviso = servicosLigados > 0
    ? `${servicosLigados} ${servicosLigados === 1 ? "serviço está ligado" : "serviços estão ligados"} a este aparelho e ${servicosLigados === 1 ? "voltará" : "voltarão"} para OS / aparelho principal.`
    : null;
  return { titulo, aviso };
}

/** "o Dispositivo 2 será perdido" / "os Dispositivos 2 a 4 serão perdidos". */
export function textoAparelhosPerdidos(quantidade: number): string {
  if (quantidade <= 1) return "o Dispositivo 2 será perdido";
  return `os Dispositivos 2 a ${numeroAdicional(quantidade - 1)} serão perdidos`;
}


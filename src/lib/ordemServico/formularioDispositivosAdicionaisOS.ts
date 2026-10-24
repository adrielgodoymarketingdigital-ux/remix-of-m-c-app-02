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


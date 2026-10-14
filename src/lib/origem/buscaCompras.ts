/**
 * Busca da lista de compras (Origem de Dispositivos), feita em memória sobre a
 * lista carregada (o hook traz todas as compras do usuário/empresa, sem página).
 * Procura nos dados da compra (pessoa, CPF/CNPJ, fornecedor, data) e em TODOS os
 * aparelhos ligados a ela (dispositivos.compra_id), não só no principal. Sem
 * dependências (testado com Deno em scripts/testes-compra-multi-dispositivo/).
 */
import { normalizarIdentificador } from "./itensCompra.ts";

export interface AparelhoBuscavel {
  id?: string | null;
  marca?: string | null;
  modelo?: string | null;
  imei?: string | null;
  imei2?: string | null;
  numero_serie?: string | null;
}

export interface CompraBuscavel {
  dispositivo_id?: string | null;
  origem_pessoas?: { nome?: string | null; cpf_cnpj?: string | null } | null;
  fornecedores?: { nome?: string | null } | null;
  /** Aparelho principal (join por compras_dispositivos.dispositivo_id). */
  dispositivos?: AparelhoBuscavel | null;
  /** Todos os aparelhos com compra_id = compra (o principal costuma estar aqui também). */
  aparelhos?: AparelhoBuscavel[] | null;
}

export type CampoEncontrado = "IMEI" | "IMEI 2" | "Série" | null;

/** Aparelho secundário da compra que bateu com a busca (para mostrar na linha). */
export interface AparelhoEncontrado {
  id: string | null;
  rotulo: string;
  campo: CampoEncontrado;
  valor: string | null;
}

export type ResultadoBuscaCompra =
  | { encontrou: false }
  | { encontrou: true; aparelhoSecundario: AparelhoEncontrado | null };

function texto(valor: string | null | undefined): string {
  return (valor ?? "").toLowerCase();
}

/** Campo do aparelho que bateu: modelo/marca (texto) ou IMEI/IMEI 2/série (normalizado, parcial). */
function aparelhoBate(a: AparelhoBuscavel, termo: string, termoId: string): { bateu: boolean; campo: CampoEncontrado; valor: string | null } {
  const ids: [CampoEncontrado, string | null | undefined][] = [["IMEI", a.imei], ["IMEI 2", a.imei2], ["Série", a.numero_serie]];
  if (termoId) {
    for (const [campo, valor] of ids) {
      if (valor && normalizarIdentificador(valor).includes(termoId)) return { bateu: true, campo, valor };
    }
  }
  const nome = `${texto(a.marca)} ${texto(a.modelo)}`;
  if (texto(a.marca).includes(termo) || texto(a.modelo).includes(termo) || nome.includes(termo)) {
    return { bateu: true, campo: null, valor: null };
  }
  return { bateu: false, campo: null, valor: null };
}

/**
 * A compra aparece na busca se `termo` está nos dados dela ou em qualquer aparelho
 * ligado. Texto: sem diferença de maiúsculas. IMEI/série: ignora espaços, pontos,
 * traços e barras e aceita parte (ex.: os últimos dígitos). Se só um aparelho que
 * não é o principal bateu, ele vem em `aparelhoSecundario`. Termo vazio = tudo.
 */
export function buscarNaCompra(compra: CompraBuscavel, termoBruto: string, dataFormatada = ""): ResultadoBuscaCompra {
  const termo = termoBruto.trim().toLowerCase();
  if (!termo) return { encontrou: true, aparelhoSecundario: null };
  const termoId = normalizarIdentificador(termo);

  const daCompra = [
    compra.origem_pessoas?.nome,
    compra.origem_pessoas?.cpf_cnpj,
    compra.fornecedores?.nome,
    dataFormatada,
  ];
  if (daCompra.some((v) => texto(v).includes(termo))) return { encontrou: true, aparelhoSecundario: null };

  const principalId = compra.dispositivo_id ?? compra.dispositivos?.id ?? null;
  const principal = compra.dispositivos ?? compra.aparelhos?.find((a) => a.id && a.id === principalId) ?? null;
  if (principal && aparelhoBate(principal, termo, termoId).bateu) return { encontrou: true, aparelhoSecundario: null };

  for (const a of compra.aparelhos ?? []) {
    if (principalId && a.id === principalId) continue;
    const r = aparelhoBate(a, termo, termoId);
    if (r.bateu) {
      return {
        encontrou: true,
        aparelhoSecundario: {
          id: a.id ?? null,
          rotulo: [a.marca, a.modelo].filter(Boolean).join(" ") || "Dispositivo",
          campo: r.campo,
          valor: r.valor,
        },
      };
    }
  }
  return { encontrou: false };
}

/** "Encontrado: Apple iPhone 15 · IMEI …1234" (só os 4 últimos caracteres do identificador). */
export function descreverAparelhoEncontrado(a: AparelhoEncontrado): string {
  const ident = a.campo && a.valor ? ` · ${a.campo} …${a.valor.trim().slice(-4)}` : "";
  return `Encontrado: ${a.rotulo}${ident}`;
}

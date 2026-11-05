/**
 * Consulta de IMEI no Celular Seguro (Ministério da Justiça): o site não aceita
 * IMEI pela URL, então o fluxo é validar, copiar e abrir o site em nova aba. O
 * IMEI só vai para a área de transferência, nunca para um servidor nosso.
 *
 * Sem React nem imports "@/": testado com Deno em scripts/testes-consulta-imei/.
 */
import { luhnValido } from "../nfe/lerXmlNfe.ts";

/** Formulário público da consulta (sem login gov.br; pede também o CPF de quem consulta). */
export const URL_CELULAR_SEGURO = "https://consulta-celularseguro.mj.gov.br/";

export const AVISO_CPF_CELULAR_SEGURO = "O site também pede o CPF de quem consulta.";

export const MENSAGEM_IMEI_COPIADO = `IMEI copiado. Cole no campo de consulta do Celular Seguro. ${AVISO_CPF_CELULAR_SEGURO}`;

export type ResultadoValidacaoImei =
  | { valido: true; imei: string }
  | { valido: false; erro: string };

/** Aceita espaços e hífens de digitação ("35-209900-176148-1") e devolve só os dígitos. */
export function validarImei(valor: string | null | undefined): ResultadoValidacaoImei {
  const imei = (valor ?? "").replace(/[\s-]/g, "");
  if (!imei) return { valido: false, erro: "Informe o IMEI do aparelho para consultar." };
  if (!/^\d{15}$/.test(imei)) return { valido: false, erro: "O IMEI precisa ter 15 números." };
  if (!luhnValido(imei)) return { valido: false, erro: "IMEI inválido: confira os números digitados." };
  return { valido: true, imei };
}

export interface AmbienteCopia {
  /** navigator.clipboard.writeText, quando existir (só em contexto seguro). */
  escreverNaAreaDeTransferencia?: (texto: string) => Promise<void>;
  /** Cópia antiga por select/execCommand. */
  copiarPorSelecao: (texto: string) => boolean;
}

/** Tenta a API moderna e cai na cópia por seleção. Nunca rejeita. */
export async function copiarTexto(texto: string, ambiente: AmbienteCopia): Promise<boolean> {
  if (ambiente.escreverNaAreaDeTransferencia) {
    try {
      await ambiente.escreverNaAreaDeTransferencia(texto);
      return true;
    } catch {
      // Sem permissão ou documento sem foco: tenta a cópia por seleção.
    }
  }
  try {
    return ambiente.copiarPorSelecao(texto);
  } catch {
    return false;
  }
}

export type ResultadoConsultaImei =
  | { ok: false; erro: string }
  | { ok: true; imei: string; copiado: boolean };

/**
 * A cópia começa e a aba abre na mesma pilha do clique: esperar a cópia antes de
 * abrir faria o Safari tratar a nova aba como pop-up e bloquear.
 */
export async function consultarImeiNoCelularSeguro(
  valor: string | null | undefined,
  ambiente: AmbienteCopia & { abrirSite: (url: string) => void },
): Promise<ResultadoConsultaImei> {
  const validacao = validarImei(valor);
  if (validacao.valido === false) return { ok: false, erro: validacao.erro };

  const copia = copiarTexto(validacao.imei, ambiente);
  ambiente.abrirSite(URL_CELULAR_SEGURO);
  return { ok: true, imei: validacao.imei, copiado: await copia };
}

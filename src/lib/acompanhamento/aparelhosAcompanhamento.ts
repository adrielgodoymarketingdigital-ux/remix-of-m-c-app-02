/**
 * Aparelhos ADICIONAIS da OS nos links de acompanhamento (/acompanhar/:token e
 * /acompanhar-cliente/:token). Módulo puro (sem React, navegador nem banco),
 * testado com Deno em scripts/testes-acompanhamento-aparelhos/.
 *
 * Vêm da coluna "dispositivos_adicionais" (jsonb) das RPCs get_os_tracking e
 * get_cliente_tracking: só tipo, marca, modelo e defeito relatado de cada
 * extra da própria OS, na ordem do aparelho. O aparelho 1 continua nas colunas
 * dispositivo_* da OS, como sempre. Regra de ouro: sem extras (lista vazia ou
 * campo ausente, antes da migration), a página sai IDÊNTICA à de antes.
 *
 * Numeração pela posição (o 1º extra é o "Aparelho 2"), como no resto do app.
 */
export interface AparelhoAcompanhamento {
  dispositivo_tipo: string | null;
  dispositivo_marca: string | null;
  dispositivo_modelo: string | null;
  defeito_relatado: string | null;
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/**
 * Coluna "dispositivos_adicionais" das RPCs. Antes da migration a coluna não
 * existe (undefined): vira lista vazia, sem erro. Só os 4 campos conhecidos
 * são lidos — qualquer outra chave na resposta é ignorada.
 */
export function aparelhosDoAcompanhamento(valor: unknown): AparelhoAcompanhamento[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((v): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v))
    .map((v) => ({
      dispositivo_tipo: texto(v.dispositivo_tipo),
      dispositivo_marca: texto(v.dispositivo_marca),
      dispositivo_modelo: texto(v.dispositivo_modelo),
      defeito_relatado: texto(v.defeito_relatado),
    }))
    .filter((a) => a.dispositivo_tipo || a.dispositivo_marca || a.dispositivo_modelo);
}

/** "Aparelho 2" — `numero` é a posição na OS (1 = o da própria OS). */
export const tituloAparelho = (numero: number): string => `Aparelho ${numero}`;

/** "Apple iPhone 12"; sem marca e modelo, o tipo ("Celular"); "" se nada. */
export function nomeAparelho(a: {
  dispositivo_tipo?: string | null;
  dispositivo_marca?: string | null;
  dispositivo_modelo?: string | null;
}): string {
  const marcaModelo = `${a.dispositivo_marca || ""} ${a.dispositivo_modelo || ""}`.trim();
  return marcaModelo || (a.dispositivo_tipo ?? "").trim();
}

/**
 * Lista completa para a tela: aparelho 1 (colunas da OS) + extras, já com o
 * defeito escondido quando a loja desligou "mostrar defeito". Vazia quando a OS
 * não tem extras — aí a tela usa o layout de sempre, de 1 aparelho.
 */
export function listaAparelhosOS(
  os: {
    dispositivo_marca: string | null;
    dispositivo_modelo: string | null;
    defeito_relatado: string | null;
    dispositivos_adicionais?: AparelhoAcompanhamento[];
  },
  mostrarDefeito: boolean,
): { titulo: string; nome: string; defeito: string | null }[] {
  const extras = os.dispositivos_adicionais ?? [];
  if (extras.length === 0) return [];
  const primeiro = { dispositivo_marca: os.dispositivo_marca, dispositivo_modelo: os.dispositivo_modelo, defeito_relatado: os.defeito_relatado };
  return [primeiro, ...extras].map((a, i) => ({
    titulo: tituloAparelho(i + 1),
    nome: nomeAparelho(a) || "—",
    defeito: mostrarDefeito ? texto(a.defeito_relatado) : null,
  }));
}

/** Nomes dos extras para o resumo da lista do cliente e a planilha ("" fora). */
export const nomesExtras = (extras: AparelhoAcompanhamento[] | undefined): string[] =>
  (extras ?? []).map(nomeAparelho).filter(Boolean);

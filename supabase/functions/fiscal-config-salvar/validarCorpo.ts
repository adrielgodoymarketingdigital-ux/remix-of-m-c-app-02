// Validação do corpo de fiscal-config-salvar: pura (sem rede nem banco), testada
// em validarCorpo.test.ts. Aceita SÓ a lista fixa de campos; qualquer outro
// (user_id, empresa_id, ambiente, ativo, spedy_company_id...) faz a chamada
// inteira ser recusada — o user_id vem do token e ambiente/ativo são forçados
// pelo servidor.

export const CAMPOS_PERMITIDOS = [
  "regime_tributario",
  "cnae",
  "codigo_ibge_municipio",
  "serie_nfse",
  "serie_nfe",
  "serie_nfce",
] as const;

export type CampoPermitido = typeof CAMPOS_PERMITIDOS[number];
export type DadosConfigFiscal = Partial<Record<CampoPermitido, string | null>>;

export const REGIMES = ["mei", "simples_nacional", "lucro_presumido", "lucro_real"] as const;

export type ResultadoValidacao = { ok: true; dados: DadosConfigFiscal } | { ok: false; erro: string };

const ROTULOS: Record<CampoPermitido, string> = {
  regime_tributario: "Regime tributário",
  cnae: "CNAE",
  codigo_ibge_municipio: "Código IBGE do município",
  serie_nfse: "Série da NFS-e",
  serie_nfe: "Série da NF-e",
  serie_nfce: "Série da NFC-e",
};

/** Texto já sem espaços nas pontas (não vazio) -> valor a gravar, ou mensagem de erro. */
const REGRAS: Record<CampoPermitido, (v: string) => { valor: string } | { erro: string }> = {
  regime_tributario: (v) =>
    (REGIMES as readonly string[]).includes(v) ? { valor: v } : { erro: `deve ser um de: ${REGIMES.join(", ")}` },
  // Aceita a máscara (9511-8/00); grava só os dígitos.
  cnae: (v) => {
    const digitos = v.replace(/\D/g, "");
    return /^[\d.\-/\s]+$/.test(v) && digitos.length === 7 ? { valor: digitos } : { erro: "deve ter 7 dígitos" };
  },
  codigo_ibge_municipio: (v) => (/^\d{7}$/.test(v) ? { valor: v } : { erro: "deve ter 7 dígitos" }),
  // NFS-e: cada município tem seu padrão (ex.: 1, A1, RPS).
  serie_nfse: (v) => (/^[A-Za-z0-9]{1,5}$/.test(v) ? { valor: v.toUpperCase() } : { erro: "use até 5 letras ou números" }),
  serie_nfe: (v) => (/^\d{1,3}$/.test(v) ? { valor: v } : { erro: "use de 1 a 3 dígitos" }),
  serie_nfce: (v) => (/^\d{1,3}$/.test(v) ? { valor: v } : { erro: "use de 1 a 3 dígitos" }),
};

export function validarCorpo(corpo: unknown): ResultadoValidacao {
  if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) {
    return { ok: false, erro: "Corpo inválido: envie um objeto JSON." };
  }

  const chaves = Object.keys(corpo);
  const proibidas = chaves.filter((c) => !(CAMPOS_PERMITIDOS as readonly string[]).includes(c));
  if (proibidas.length > 0) {
    return { ok: false, erro: `Campos não permitidos: ${proibidas.join(", ")}.` };
  }

  const dados: DadosConfigFiscal = {};
  for (const campo of chaves as CampoPermitido[]) {
    const bruto = (corpo as Record<string, unknown>)[campo];
    if (bruto === null) {
      dados[campo] = null;
      continue;
    }
    if (typeof bruto !== "string") {
      return { ok: false, erro: `${ROTULOS[campo]}: envie texto ou null.` };
    }
    const texto = bruto.trim();
    if (texto === "") {
      dados[campo] = null;
      continue;
    }
    const r = REGRAS[campo](texto);
    if ("erro" in r) return { ok: false, erro: `${ROTULOS[campo]}: ${r.erro}.` };
    dados[campo] = r.valor;
  }
  return { ok: true, dados };
}

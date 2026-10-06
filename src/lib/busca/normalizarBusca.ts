/**
 * Busca digitável nos seletores de Pessoa e Dispositivo do registro de compra
 * (Origem de Dispositivos). Tudo no aparelho: as listas são pequenas (máx. ~90
 * dispositivos e ~30 pessoas por loja em out/2026). Sem dependências (testado
 * com Deno em scripts/testes-busca-compra/).
 */

/** Sem acentos, minúsculas, espaços colapsados. */
export function normalizarTexto(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function apenasDigitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** IMEI / número de série / código de barras: só letras e números, maiúsculas. */
export function normalizarCodigo(valor: string | null | undefined): string {
  return normalizarTexto(valor).replace(/[^a-z0-9]/g, "").toUpperCase();
}

/** Palavras do termo (já normalizadas); vazio = sem filtro. */
function palavras(termo: string): string[] {
  const t = normalizarTexto(termo);
  return t ? t.split(" ") : [];
}

/** CPF/CNPJ e telefone só entram na busca a partir de 3 dígitos digitados. */
const MIN_DIGITOS = 3;

export interface PessoaBusca {
  nome: string;
  nome_fantasia?: string | null;
  cpf_cnpj?: string | null;
  telefone?: string | null;
}

/**
 * Pessoas que batem com TODAS as palavras do termo (E). Cada palavra casa com
 * nome/nome fantasia (texto sem acento) ou, se tiver 3+ dígitos, com os dígitos
 * do CPF/CNPJ ou do telefone (com ou sem máscara). Termo vazio = lista inteira,
 * na mesma ordem.
 */
export function filtrarPessoas<T extends PessoaBusca>(lista: T[], termo: string): T[] {
  const ps = palavras(termo);
  if (ps.length === 0) return lista;
  // Termo só numérico com espaços/máscara ("(11) 98765-4321", "123 456 789"): busca pelos dígitos juntos.
  if (/^[\d\s.\-/()+]+$/.test(termo.trim())) {
    const d = apenasDigitos(termo);
    if (d.length >= MIN_DIGITOS) {
      return lista.filter((p) => apenasDigitos(p.cpf_cnpj).includes(d) || apenasDigitos(p.telefone).includes(d));
    }
  }
  return lista.filter((p) => {
    const texto = normalizarTexto(`${p.nome} ${p.nome_fantasia ?? ""}`);
    const digitos = [apenasDigitos(p.cpf_cnpj), apenasDigitos(p.telefone)];
    return ps.every((palavra) => {
      if (texto.includes(palavra)) return true;
      const d = apenasDigitos(palavra);
      return d.length >= MIN_DIGITOS && d.length === palavra.replace(/[.\-/()\s]/g, "").length
        && digitos.some((x) => x.includes(d));
    });
  });
}

export interface DispositivoBusca {
  marca?: string | null;
  modelo?: string | null;
  cor?: string | null;
  imei?: string | null;
  imei2?: string | null;
  numero_serie?: string | null;
  codigo_barras?: string | null;
  /** IMEIs das unidades (dispositivo_imeis). */
  imeis?: string[] | null;
}

/**
 * Dispositivos que batem com TODAS as palavras: marca/modelo/cor por texto, ou
 * IMEI/IMEI 2/série/código de barras por código normalizado (parcial, ex.: os
 * últimos dígitos do IMEI; "SN-12 34" acha "SN1234"). Termo vazio = lista inteira.
 */
export function filtrarDispositivos<T extends DispositivoBusca>(lista: T[], termo: string): T[] {
  const ps = palavras(termo);
  if (ps.length === 0) return lista;
  return lista.filter((d) => {
    const texto = normalizarTexto(`${d.marca ?? ""} ${d.modelo ?? ""} ${d.cor ?? ""}`);
    const codigos = [d.imei, d.imei2, d.numero_serie, d.codigo_barras, ...(d.imeis ?? [])]
      .map(normalizarCodigo)
      .filter(Boolean);
    return ps.every((palavra) => {
      if (texto.includes(palavra)) return true;
      const c = normalizarCodigo(palavra);
      return c.length > 0 && codigos.some((x) => x.includes(c));
    });
  });
}

export interface DispositivoDisponibilidade {
  id: string;
  vendido?: boolean | null;
  deleted_at?: string | null;
  compra_id?: string | null;
}

/**
 * Dispositivos que podem receber uma compra: não vendidos, não excluídos e sem
 * compra registrada. O pré-selecionado (ex.: ?dispositivo= ou o recém-criado)
 * entra sempre, mesmo que algum desses filtros o tirasse.
 */
export function dispositivosDisponiveisParaCompra<T extends DispositivoDisponibilidade>(
  lista: T[],
  idPreSelecionado?: string | null,
): T[] {
  return lista.filter((d) => (idPreSelecionado && d.id === idPreSelecionado) || (!d.vendido && !d.deleted_at && !d.compra_id));
}

/**
 * Endereço do cliente na impressão da OS (A4 Padrão, A4 Tech, A4 Personalizado,
 * PDF A4 e cupom 80 mm). Uma fonte só para o texto; cada modelo decide onde ele
 * cabe sem aumentar a folha.
 *
 * Colunas de `clientes`: endereco (rua/logradouro), numero, bairro, cidade,
 * estado (UF), cep. Cliente antigo tem o endereço inteiro em `endereco` — aí
 * número, bairro, cidade e UF que já estiverem no texto não se repetem.
 *
 * Sem nenhum campo preenchido = "" (e a impressão fica igual à de antes).
 */
export interface EnderecoClienteCampos {
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

/** Teto de caracteres por linha no cupom 80 mm (o resto vira "…"). */
export const MAX_CARACTERES_LINHA_CUPOM = 60;

const limpar = (valor: string | null | undefined): string =>
  (valor ?? "").replace(/\s+/g, " ").trim();

/** Minúsculas e sem acento, para comparar "já está no texto?". */
const normalizar = (valor: string): string =>
  valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const escaparRegex = (valor: string): string => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** true = `parte` já aparece em `texto` como palavra inteira (sem acento/caixa). */
function contem(texto: string, parte: string): boolean {
  if (!texto || !parte) return false;
  const re = new RegExp(`(^|[^a-z0-9])${escaparRegex(normalizar(parte))}($|[^a-z0-9])`);
  return re.test(normalizar(texto));
}

function formatarCep(cep: string): string {
  const digitos = cep.replace(/\D/g, "");
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : cep;
}

/** Corta o texto em `max` caracteres, terminando em "…". */
export function cortarComReticencias(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  if (max <= 1) return "…";
  return `${texto.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Maior prefixo de `texto` (terminado em "…") que `cabe` aceita. Para o PDF,
 * onde `cabe` mede a largura real na fonte do jsPDF.
 */
export function cortarAteCaber(texto: string, cabe: (candidato: string) => boolean): string {
  if (cabe(texto)) return texto;
  let baixo = 0;
  let alto = texto.length - 1;
  let melhor = "…";
  while (baixo <= alto) {
    const meio = Math.floor((baixo + alto) / 2);
    const candidato = `${texto.slice(0, meio).trimEnd()}…`;
    if (cabe(candidato)) {
      melhor = candidato;
      baixo = meio + 1;
    } else {
      alto = meio - 1;
    }
  }
  return melhor;
}

/** As três partes do endereço: "rua, número", "bairro, cidade/UF" e "CEP 00000-000". */
export function partesEnderecoCliente(cliente: EnderecoClienteCampos | null | undefined): string[] {
  if (!cliente) return [];
  const rua = limpar(cliente.endereco);
  const numero = limpar(cliente.numero);
  const bairro = limpar(cliente.bairro);
  const cidade = limpar(cliente.cidade);
  const estado = limpar(cliente.estado).toUpperCase();
  const cep = limpar(cliente.cep);

  const numeroNovo = numero && !contem(rua, numero) ? numero : "";
  const ruaNumero = rua
    ? [rua, numeroNovo].filter(Boolean).join(", ")
    : numeroNovo ? `nº ${numeroNovo}` : "";

  const bairroNovo = bairro && !contem(rua, bairro) ? bairro : "";
  const cidadeNova = cidade && !contem(rua, cidade) ? cidade : "";
  // UF só some se a cidade também já estava no texto (senão "SP" solto pode ser outra coisa).
  const estadoNovo = estado && !(contem(rua, estado) && (!cidade || !cidadeNova)) ? estado : "";
  const local = cidadeNova && estadoNovo
    ? `${cidadeNova}/${estadoNovo}`
    : cidadeNova || estadoNovo;
  const bairroLocal = [bairroNovo, local].filter(Boolean).join(", ");

  const cepJaNoTexto = [cep, formatarCep(cep), cep.replace(/\D/g, "")].some((forma) => contem(rua, forma));
  const cepNovo = cep && !cepJaNoTexto ? `CEP ${formatarCep(cep)}` : "";

  return [ruaNumero, bairroLocal, cepNovo].filter(Boolean);
}

/** "Rua X, 123 – Bairro, Cidade/UF – CEP 00000-000" (ou "" sem endereço). Uma linha só. */
export function textoEnderecoCliente(cliente: EnderecoClienteCampos | null | undefined): string {
  return partesEnderecoCliente(cliente).join(" – ");
}

/** Cupom 80 mm: uma parte por linha curta, cada uma com no máximo `max` caracteres. */
export function linhasEnderecoCupom(
  cliente: EnderecoClienteCampos | null | undefined,
  max: number = MAX_CARACTERES_LINHA_CUPOM,
): string[] {
  return partesEnderecoCliente(cliente).map((parte) => cortarComReticencias(parte, max));
}

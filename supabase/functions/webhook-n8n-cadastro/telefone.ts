// Telefone no formato que o n8n espera: só dígitos, com código do país.
//
// Brasil: exatamente a regra de sempre (só dígitos; "55" na frente quando não
// começa com 55). Sem o "55" quando o número já vem com "+" e outro código de
// país, ou quando a conta não é BR (mercado ou país): aí o número já é
// internacional e o "55" o estragaria.
// Região desconhecida (perfil não lido) conta como BR, igual a hoje.

export type RegiaoUsuario = { mercado?: string | null; pais?: string | null } | null;

export function formatarTelefoneN8n(telefone: string, regiao: RegiaoUsuario): string {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.startsWith("55")) return digitos;

  const comMais = telefone.trim().startsWith("+");
  const contaBR = (regiao?.mercado ?? "BR") === "BR" && (regiao?.pais ?? "BR") === "BR";
  if (comMais || !contaBR) return digitos;

  return "55" + digitos;
}

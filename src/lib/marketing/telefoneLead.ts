// CRM de leads (app). Cópia EXATA de supabase/functions/crm-leads/telefone.ts
// e espelho de public.crm_normalizar_telefone
// (supabase/migrations/20261121120000_crm_leads_1_estrutura.sql). Os três são
// testados com scripts/crm-leads/casos-telefone.json (números fictícios);
// scripts/testes-crm-leads/telefone.test.ts exige os dois .ts idênticos.
//
// Brasil: "+55" + DDD + número; celular antigo de 8 dígitos (6-9) ganha o 9.
// Fora do Brasil: só com "+" explícito. Qualquer outra coisa: null.
// Aceita JID do WhatsApp (@s.whatsapp.net / @c.us); @lid e grupo são recusados.

export function normalizarTelefone(bruto: string | null | undefined): string | null {
  let txt = (bruto ?? "").trim();
  // JID do WhatsApp: só "<número>[:<aparelho>]@s.whatsapp.net" ou "@c.us".
  // Qualquer outro domínio (@lid, grupo @g.us...) NÃO é telefone: null.
  if (txt.includes("@")) {
    const dominio = txt.split("@")[1].toLowerCase();
    if (dominio !== "s.whatsapp.net" && dominio !== "c.us") return null;
    txt = txt.split("@")[0].split(":")[0];
  }
  let dig = txt.replace(/\D/g, "");
  if (dig === "") return null;

  if (txt.startsWith("+") && !dig.startsWith("55")) {
    return dig.length >= 8 && dig.length <= 15 && !dig.startsWith("0") ? "+" + dig : null;
  }

  dig = dig.replace(/^0+/, "");
  let nac: string;
  if (dig.startsWith("55") && (dig.length === 12 || dig.length === 13)) nac = dig.slice(2);
  else if (dig.length === 10 || dig.length === 11) nac = dig;
  else return null;

  const ddd = nac.slice(0, 2);
  let loc = nac.slice(2);
  if (!/^[1-9][1-9]$/.test(ddd)) return null;

  if (loc.length === 8) {
    if ("6789".includes(loc[0])) loc = "9" + loc;
    else if (!"2345".includes(loc[0])) return null;
  } else if (loc.length === 9) {
    if (loc[0] !== "9") return null;
  } else {
    return null;
  }
  return "+55" + ddd + loc;
}

/** Para logs e para a lista: "+55 11 •••••-4321". Nunca logar o número inteiro. */
export function mascararTelefone(e164: string | null | undefined): string {
  if (!e164) return "—";
  const fim = e164.slice(-4);
  if (e164.startsWith("+55") && e164.length >= 13) return `+55 ${e164.slice(3, 5)} •••••-${fim}`;
  return `${e164.slice(0, 3)} •••• ${fim}`;
}

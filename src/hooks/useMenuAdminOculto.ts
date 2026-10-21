import { useSyncExternalStore } from "react";

// "Ver como usuário": esconde os itens da seção Admin do menu lateral (desktop) e do
// menu do celular. Só afeta o menu — não bloqueia nem libera nenhuma rota.
// Estado em módulo para AppSidebar e MobileMenuDrawer ficarem sempre coerentes; se o
// localStorage falhar (modo privado, bloqueado), vale só para a sessão.
const MENU_ADMIN_OCULTO_KEY = "menu_admin_oculto";

function lerSalvo(): boolean {
  try {
    return localStorage.getItem(MENU_ADMIN_OCULTO_KEY) === "1";
  } catch {
    return false;
  }
}

let oculto = lerSalvo();
const ouvintes = new Set<() => void>();

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function definirOculto(valor: boolean) {
  oculto = valor;
  try {
    if (valor) localStorage.setItem(MENU_ADMIN_OCULTO_KEY, "1");
    else localStorage.removeItem(MENU_ADMIN_OCULTO_KEY);
  } catch { /* noop: fica só na sessão */ }
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function useMenuAdminOculto() {
  const menuAdminOculto = useSyncExternalStore(assinar, () => oculto);
  const alternarMenuAdmin = () => definirOculto(!oculto);
  return { menuAdminOculto, alternarMenuAdmin };
}

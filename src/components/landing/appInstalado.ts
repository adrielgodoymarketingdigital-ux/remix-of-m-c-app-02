/** Aberto como app instalado (PWA na tela inicial): a landing manda direto para o login. */
export function ehAppInstalado(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true // fallback iOS
  );
}

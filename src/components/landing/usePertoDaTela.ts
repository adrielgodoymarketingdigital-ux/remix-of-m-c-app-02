import { useEffect, useRef, useState } from "react";

/**
 * true quando o elemento chega a `margem` da área visível (e fica true daí em diante).
 * Sem IntersectionObserver (navegador antigo), considera perto logo de cara.
 */
export function usePertoDaTela<T extends Element>(margem: string) {
  const ref = useRef<T>(null);
  const [perto, setPerto] = useState(false);

  useEffect(() => {
    if (perto) return;
    const elemento = ref.current;
    if (!elemento) return;
    if (typeof IntersectionObserver === "undefined") {
      setPerto(true);
      return;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setPerto(true);
          observador.disconnect();
        }
      },
      { rootMargin: margem },
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [perto, margem]);

  return [ref, perto] as const;
}

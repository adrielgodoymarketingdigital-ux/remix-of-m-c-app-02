import { useEffect, useState, type RefObject } from "react";

// Entrada ao rolar: marca cada [data-reveal] com "is-in" quando ele entra na tela.
// Não roda com prefers-reduced-motion (o conteúdo aparece direto).
export function useReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const root = document.documentElement;
    root.classList.add("reveal-on");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );

    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      root.classList.remove("reveal-on");
    };
  }, []);
}

// Diz se um elemento está visível na tela (usado para mostrar a barra fixa do celular).
export function useInView<T extends Element>(ref: RefObject<T>, initial = true) {
  const [inView, setInView] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}

// Escreve o progresso da rolagem (0 a 1) e a rolagem em px como variáveis CSS no <html>,
// uma vez por quadro. Usado pela barra de progresso e pelo leve parallax do primeiro bloco.
export function useRolagemCSS() {
  useEffect(() => {
    const root = document.documentElement;
    let quadro = 0;
    const atualizar = () => {
      quadro = 0;
      const max = root.scrollHeight - window.innerHeight;
      root.style.setProperty("--progresso", String(max > 0 ? window.scrollY / max : 0));
      root.style.setProperty("--rolagem", String(Math.min(window.scrollY, 1200)));
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(atualizar);
    };
    atualizar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, []);
}

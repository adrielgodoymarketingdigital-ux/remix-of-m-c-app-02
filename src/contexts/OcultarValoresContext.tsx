import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface OcultarValoresContextType {
  valoresOcultos: boolean;
  toggleValores: () => void;
}

const OcultarValoresContext = createContext<OcultarValoresContextType>({
  valoresOcultos: false,
  toggleValores: () => {},
});

export function OcultarValoresProvider({ children }: { children: ReactNode }) {
  const [valoresOcultos, setValoresOcultos] = useState(() => {
    try {
      return localStorage.getItem("ocultarValores") === "true";
    } catch {
      return false;
    }
  });

  const toggleValores = useCallback(() => {
    setValoresOcultos((v) => {
      const novo = !v;
      try {
        localStorage.setItem("ocultarValores", String(novo));
      } catch {}
      return novo;
    });
  }, []);

  return (
    <OcultarValoresContext.Provider value={{ valoresOcultos, toggleValores }}>
      {children}
    </OcultarValoresContext.Provider>
  );
}

export function useOcultarValores() {
  return useContext(OcultarValoresContext);
}

import { ReactNode } from "react";

interface EtapaCardWrapperProps {
  children: ReactNode;
  dataEtapa?: number;
}

/** Envolve uma etapa do wizard em um card visualmente separado, usado no layout de rolagem única (PWA mobile). */
export function EtapaCardWrapper({ children, dataEtapa }: EtapaCardWrapperProps) {
  return (
    <div
      data-etapa={dataEtapa}
      className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm"
    >
      {children}
    </div>
  );
}

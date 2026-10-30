import { LINKS } from "../links";
import { Botao } from "./Botao";

// Barra fixa só no celular: aparece quando o botão principal do primeiro bloco sai da tela.
// Respeita a área segura do iPhone; o <main> tem espaço embaixo para ela não cobrir conteúdo.
export function BarraCelular({ visivel }: { visivel: boolean }) {
  return (
    <div
      aria-hidden={!visivel}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 pt-3 shadow-[0_-8px_24px_-12px_rgba(2,6,23,0.25)] transition-[transform,opacity] duration-300 ease-out md:hidden ${
        visivel ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <Botao href={LINKS.testeGratis} seta tamanho="md" className="h-12 w-full text-base" tabIndex={visivel ? 0 : -1}>
        Começar teste grátis
      </Botao>
    </div>
  );
}

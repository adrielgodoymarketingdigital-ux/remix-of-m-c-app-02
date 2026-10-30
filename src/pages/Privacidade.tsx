import { PaginaLegal } from "@/components/landing-v4/legal/PaginaLegal";
import { privacidade } from "@/components/landing-v4/legal/textos";
import { LINKS } from "@/components/landing-v4/links";
import "@/components/landing-v4/estudio.css";
import "@/components/landing-v4/v3/tech.css";

// Página pública /privacidade: política de privacidade (texto do estúdio de landings, em src/components/landing-v4/legal/textos.ts).
export default function Privacidade() {
  return (
    <div className="v3 claro min-h-screen">
      <PaginaLegal doc={privacidade} outro={{ titulo: "Termos de uso", href: LINKS.termos }} inicio="/" funcionalidades="/funcionalidades" />
    </div>
  );
}

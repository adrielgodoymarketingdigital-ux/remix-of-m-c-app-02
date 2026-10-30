import { PaginaLegal } from "@/components/landing-v4/legal/PaginaLegal";
import { termos } from "@/components/landing-v4/legal/textos";
import { LINKS } from "@/components/landing-v4/links";
import "@/components/landing-v4/estudio.css";
import "@/components/landing-v4/v3/tech.css";

// Página pública /termos: termos de uso (texto do estúdio de landings, em src/components/landing-v4/legal/textos.ts).
export default function Termos() {
  return (
    <div className="v3 claro min-h-screen">
      <PaginaLegal doc={termos} outro={{ titulo: "Política de privacidade", href: LINKS.privacidade }} inicio="/" funcionalidades="/funcionalidades" />
    </div>
  );
}

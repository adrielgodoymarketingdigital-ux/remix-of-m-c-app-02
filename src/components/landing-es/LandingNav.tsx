import { Button } from "@/components/ui/button";
import { useLinkParaSecao } from "@/components/landing/SecoesAdiadas";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { imgLogo as logoMec } from "@/components/landing/imagensLanding";

// Botões são links (<a href>): funcionam no topo estático do HTML, antes do JavaScript.
export function LandingNav() {
  const linkParaSecao = useLinkParaSecao();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-white/10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logoMec.src} width={logoMec.width} height={logoMec.height} alt="Méc" className="h-10 object-contain" />
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#recursos" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
            Funciones
          </a>
          <a href="#planos" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
            Planes
          </a>
          <a href="#faq" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
            FAQ
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            className="text-slate-300 hover:text-white hover:bg-white/10"
          >
            <Link to="/auth?intl=1">Iniciar sesión</Link>
          </Button>
          <Button
            asChild
            className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-medium shadow-lg shadow-blue-500/25 hidden sm:flex"
          >
            <a {...linkParaSecao("planos")}>
              <Zap className="mr-2 h-4 w-4" />
              Suscribirme
            </a>
          </Button>
        </div>
      </div>
    </nav>
  );
}

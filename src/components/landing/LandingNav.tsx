import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import logoMec from "@/assets/logo-mec-new.png";
import { Zap } from "lucide-react";

export function LandingNav() {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-white/10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logoMec} alt="Méc" className="h-10 object-contain" />
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <a href="#recursos" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
            Recursos
          </a>
          <a href="#planos" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
            Planos
          </a>
          <a href="#faq" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
            FAQ
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={() => navigate("/auth")} 
            variant="ghost" 
            className="text-slate-300 hover:text-white hover:bg-white/10"
          >
            Entrar
          </Button>
          <Button 
            onClick={() => {
              const element = document.getElementById('planos');
              element?.scrollIntoView({ behavior: 'smooth' });
            }} 
            className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-medium shadow-lg shadow-blue-500/25 hidden sm:flex"
          >
            <Zap className="mr-2 h-4 w-4" />
            Assinar
          </Button>
        </div>
      </div>
    </nav>
  );
}

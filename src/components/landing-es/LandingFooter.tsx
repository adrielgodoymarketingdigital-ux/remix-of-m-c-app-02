import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import logoMec from "@/assets/logo-mec-new.png";

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 py-12 px-4">
      <div className="container mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src={logoMec} alt="Méc" className="h-10 object-contain" />
            </div>
            <p className="text-sm text-slate-400">
              Sistema completo de gestión para talleres de reparación y tiendas de celulares.
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-4 text-white text-sm">Producto</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#recursos" className="hover:text-blue-400 transition-colors">Funciones</a></li>
              <li><a href="#planos" className="hover:text-blue-400 transition-colors">Planes</a></li>
              <li><a href="#faq" className="hover:text-blue-400 transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-4 text-white text-sm">Empresa</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-blue-400 transition-colors">Nosotros</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Contacto</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Blog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-4 text-white text-sm">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="hover:text-blue-400 transition-colors">Términos de Uso</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Política de Privacidad</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Soporte</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">© 2025 Méc. Todos los derechos reservados.</p>

          <div className="flex items-center gap-4">
            <a href="#" className="text-slate-500 hover:text-blue-400 transition-colors">
              <Facebook className="h-4 w-4" />
            </a>
            <a href="https://www.instagram.com/mecappoficial/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-400 transition-colors">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="#" className="text-slate-500 hover:text-blue-400 transition-colors">
              <Twitter className="h-4 w-4" />
            </a>
            <a href="#" className="text-slate-500 hover:text-blue-400 transition-colors">
              <Linkedin className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

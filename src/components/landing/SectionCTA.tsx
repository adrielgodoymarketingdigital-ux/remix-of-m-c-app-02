import { ArrowRight } from "lucide-react";

export function SectionCTA() {
  return (
    <div className="text-center mt-12">
      <a
        href="#planos"
        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-base shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-105 transition-all duration-300 group"
      >
        Assinar Agora
        <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
      </a>
    </div>
  );
}

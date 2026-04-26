import adrielPhoto from "@/assets/adriel-fundador.jpg";
import { Quote } from "lucide-react";
import { SectionCTA } from "./SectionCTA";

export function FounderSection() {
  return (
    <section className="py-24 lg:py-32 bg-slate-50 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/8 rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-sm font-medium mb-6">
            <Quote className="h-4 w-4" />
            Nossa História
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900">
            Quem criou o{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Méc?</span>
          </h2>
        </div>
        
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          {/* Foto do Adriel */}
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full blur-[30px]" />
              <div className="relative w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-blue-400/50 shadow-2xl shadow-blue-500/15">
                <img 
                  src={adrielPhoto} 
                  alt="Adriel - Fundador do Méc" 
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg whitespace-nowrap">
                Adriel - Fundador
              </div>
            </div>
          </div>
          
          {/* Texto */}
          <div className="flex-1 text-center lg:text-left px-2 sm:px-0">
            <div className="relative p-5 sm:p-6 md:p-10 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <Quote className="absolute top-4 left-4 h-8 w-8 text-blue-500/20" />
              <blockquote className="text-sm sm:text-base md:text-lg text-slate-700 leading-relaxed sm:leading-loose pl-6 sm:pl-8 space-y-3 sm:space-y-4">
                <p>Meu nome é <span className="font-semibold text-slate-900">Adriel</span>, e há mais de 6 anos eu vivo na prática o dia a dia de uma assistência técnica.</p>
                <p>Eu sei exatamente como é: loja cheia, cliente cobrando, aparelho entrando e saindo… e no final do dia aquela dúvida — <span className="font-medium text-slate-800">será que eu realmente tive lucro ou só trabalhei muito?</span></p>
                <p>Por muito tempo, eu vivia perdido no meio de anotações em papel, ordens de serviço desorganizadas e zero controle do que realmente estava acontecendo na minha empresa.</p>
                <p>Eu tentei resolver isso buscando sistemas no mercado… mas todos eram complicados demais, caros e feitos por quem nunca viveu a realidade de uma assistência técnica.</p>
                <p className="font-medium text-slate-800">Foi aí que eu decidi fazer diferente.</p>
                <p>Criei um sistema simples, direto e pensado para o dia a dia real de uma assistência — algo que qualquer pessoa consiga usar desde o primeiro dia, sem complicação.</p>
                <p>Hoje, esse sistema é o que me dá controle total da minha loja… e agora eu quero que você também tenha isso.</p>
                <p className="font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Se ele transformou a minha assistência, pode transformar a sua também.</p>
              </blockquote>
            </div>
          </div>
        </div>

        <SectionCTA />
      </div>
    </section>
  );
}

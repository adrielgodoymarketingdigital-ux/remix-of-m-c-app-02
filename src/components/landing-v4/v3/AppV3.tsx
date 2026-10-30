import { useRef } from "react";
import { BarraCelular } from "../components/BarraCelular";
import { Depoimentos } from "../components/Depoimentos";
import { Fundador } from "../components/Fundador";
import { Menu } from "../components/Menu";
import { Perguntas } from "../components/Perguntas";
import { Planos } from "../components/Planos";
import { Rodape } from "../components/Rodape";
import { useInView, useReveal, useRolagemCSS } from "../hooks/useReveal";
import { Areas } from "../v2/Areas";
import { ChamadaTech } from "./ChamadaTech";
import { ErrosTech } from "./ErrosTech";
import { FluxoTech } from "./FluxoTech";
import { HeroTech } from "./HeroTech";
import { Recomendador } from "./Recomendador";
import { SuporteTech } from "./SuporteTech";
import { TemaClaro } from "./tema";

// VERSÃO 3 (escura, em /v3/) e VERSÃO 4 (mesmo layout no tema claro, em /v4/).
// Mais conversiva e com layout tecnológico (detalhes ciano, rótulos em código).
// 12 blocos: topo, problemas que o MécApp resolve, depoimentos (prova logo cedo), fluxo (como funciona), telas reais em abas,
// fundador, suporte 100% humano, recomendador de plano (logo antes dos planos), planos, perguntas, chamada final e rodapé. Mesmos links, oferta e preços das outras versões.
// No tema claro, as seções reaproveitadas ficam com as cores originais (claras) e os planos seguem numa faixa escura.
export default function AppV3({ claro = false }: { claro?: boolean }) {
  useReveal();
  useRolagemCSS();
  const ctaHero = useRef<HTMLAnchorElement>(null);
  const ctaVisivel = useInView(ctaHero);
  // escurece as seções reaproveitadas só no tema escuro
  const escuro = claro ? "" : "escuro-auto";

  return (
    <TemaClaro.Provider value={claro}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-cyan-300 focus:px-4 focus:py-2 focus:text-slate-950"
      >
        Pular para o conteúdo
      </a>
      <Menu tech={!claro} funcionalidades="funcionalidades/" />
      <main id="conteudo" className="pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0">
        <HeroTech ref={ctaHero} />
        {/* Ordem de página de vendas: promessa → problema → prova → como funciona → o produto →
            confiança (fundador e suporte humano) → escolha do plano → oferta → objeções → chamada final */}
        <ErrosTech />
        <div className={escuro}>
          <Depoimentos cta />
        </div>
        <FluxoTech />
        <Areas tech />
        <div className={escuro}>
          <Fundador />
        </div>
        <SuporteTech />
        <Recomendador />
        <Planos />
        <div className={escuro}>
          <Perguntas />
        </div>
        <ChamadaTech />
        <div className={escuro}>
          <Rodape />
        </div>
      </main>
      <div className={escuro}>
        <BarraCelular visivel={!ctaVisivel} />
      </div>
    </TemaClaro.Provider>
  );
}

import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSectionLP2 } from "@/components/landing/HeroSectionLP2";
import { PaginaComSecoesAdiadas } from "@/components/landing/SecoesAdiadas";
import { SecoesDaLanding, criarSecoesDaLanding } from "@/components/landing/SecoesDaLanding";
import "./LandingLP2.css";

// Seções abaixo do topo: um arquivo só, baixado sob demanda (ver SecoesAdiadas.tsx).
const carregarSecoes = () => import("@/components/landing/secoesAbaixoDaDobra");
const SECOES = criarSecoesDaLanding(carregarSecoes);

export default function LandingLP2() {
  return (
    <PaginaComSecoesAdiadas carregar={carregarSecoes} className="lp2-dark min-h-screen">
      <LandingNav />
      <HeroSectionLP2 />
      <SecoesDaLanding secoes={SECOES} />
    </PaginaComSecoesAdiadas>
  );
}

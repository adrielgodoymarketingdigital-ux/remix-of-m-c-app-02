import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ehAppInstalado } from "@/components/landing/appInstalado";
import { useRemoverTopoEstatico } from "@/components/landing/topoEstatico";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { PaginaComSecoesAdiadas } from "@/components/landing/SecoesAdiadas";
import { SecoesDaLanding, criarSecoesDaLanding } from "@/components/landing/SecoesDaLanding";

// Seções abaixo do topo: um arquivo só, baixado sob demanda (ver SecoesAdiadas.tsx).
const carregarSecoes = () => import("@/components/landing/secoesAbaixoDaDobra");
const SECOES = criarSecoesDaLanding(carregarSecoes);

export default function Landing() {
  const navigate = useNavigate();
  // Checagem síncrona (matchMedia): o visitante vê o conteúdo já na primeira
  // renderização; só quem abriu pelo app instalado fica sem nada até o redirecionamento.
  const [appInstalado] = useState(ehAppInstalado);
  useRemoverTopoEstatico();

  useEffect(() => {
    if (appInstalado) navigate("/auth", { replace: true });
  }, [appInstalado, navigate]);

  if (appInstalado) {
    return null;
  }

  return (
    <PaginaComSecoesAdiadas carregar={carregarSecoes} className="min-h-screen bg-slate-50">
      <LandingNav />
      <HeroSection />
      <SecoesDaLanding secoes={SECOES} />
    </PaginaComSecoesAdiadas>
  );
}

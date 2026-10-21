import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ehAppInstalado } from "@/components/landing/appInstalado";
import { useRemoverTopoEstatico } from "@/components/landing/topoEstatico";
import { LandingNav } from "@/components/landing-es/LandingNav";
import { HeroSection } from "@/components/landing-es/HeroSection";
import { PaginaComSecoesAdiadas } from "@/components/landing/SecoesAdiadas";
import { SecoesDaLanding, criarSecoesDaLanding } from "@/components/landing/SecoesDaLanding";

// Seções abaixo do topo: um arquivo só, baixado sob demanda (ver SecoesAdiadas.tsx).
const carregarSecoes = () => import("@/components/landing-es/secoesAbaixoDaDobra");
const SECOES = criarSecoesDaLanding(carregarSecoes);

// Landing en español (MVP de validación de demanda internacional) — espejo
// estructural exacto de src/pages/Landing.tsx (misma composición de
// secciones, mismo orden, mismo layout). Cada componente importado de
// components/landing-es/ es un fork con el texto traducido; los pocos
// componentes 100% genéricos (sin texto propio) se reusan directo de
// components/landing/ (FeatureCard, StatCard). Nada de esto toca
// src/pages/Landing.tsx ni components/landing/* originales.
// Las secciones debajo del hero se cargan bajo demanda, igual que en Landing.tsx
// (mismas alturas reservadas: components/landing/SecoesDaLanding.tsx).

export default function LandingES() {
  const navigate = useNavigate();
  // Checagem síncrona (matchMedia): o visitante vê o conteúdo já na primeira
  // renderização; só quem abriu pelo app instalado fica sem nada até o redirecionamento.
  const [appInstalado] = useState(ehAppInstalado);
  useRemoverTopoEstatico();

  useEffect(() => {
    if (appInstalado) navigate("/auth?intl=1", { replace: true });
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

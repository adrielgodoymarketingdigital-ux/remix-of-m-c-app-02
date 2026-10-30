import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ehAppInstalado } from "@/components/landing/appInstalado";
import AppV3 from "@/components/landing-v4/v3/AppV3";
import "@/components/landing-v4/estudio.css";
import "@/components/landing-v4/v3/tech.css";

// Landing principal: versão 4 (tema claro) feita no estúdio de landings (src/components/landing-v4).
// As cores do tema vêm da classe "v3 claro" neste div (no estúdio ficavam no <body>).
export default function Landing() {
  const navigate = useNavigate();
  // Checagem síncrona (matchMedia): o visitante vê o conteúdo já na primeira
  // renderização; só quem abriu pelo app instalado fica sem nada até o redirecionamento.
  const [appInstalado] = useState(ehAppInstalado);

  useEffect(() => {
    if (appInstalado) navigate("/auth", { replace: true });
  }, [appInstalado, navigate]);

  if (appInstalado) {
    return null;
  }

  return (
    <div className="v3 claro min-h-screen">
      <AppV3 claro />
    </div>
  );
}

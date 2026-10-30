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

  // Quem chega com âncora (ex.: /#planos vindo de /funcionalidades, /termos ou de um anúncio)
  // vai direto à seção, como na landing anterior. O navegador sozinho não rola, porque a seção
  // só existe depois que o React monta a página.
  useEffect(() => {
    if (appInstalado) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    let mexeu = false;
    const parar = () => {
      mexeu = true;
    };
    const ir = () => {
      if (!mexeu) document.getElementById(id)?.scrollIntoView({ behavior: "instant", block: "start" });
    };
    const quadro = requestAnimationFrame(ir);
    // Imagens que terminam de carregar podem mudar a altura de cima: confere de novo no fim do carregamento,
    // a não ser que a pessoa já tenha rolado por conta própria.
    window.addEventListener("wheel", parar, { once: true, passive: true });
    window.addEventListener("touchstart", parar, { once: true, passive: true });
    if (document.readyState !== "complete") window.addEventListener("load", ir, { once: true });
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("load", ir);
      window.removeEventListener("wheel", parar);
      window.removeEventListener("touchstart", parar);
    };
  }, [appInstalado]);

  if (appInstalado) {
    return null;
  }

  return (
    <div className="v3 claro min-h-screen">
      <AppV3 claro />
    </div>
  );
}

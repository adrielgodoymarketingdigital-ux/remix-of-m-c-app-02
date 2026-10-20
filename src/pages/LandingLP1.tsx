import { useState, useEffect } from "react";
import { trackPageView } from "@/lib/pixel";
import { useNavigate } from "react-router-dom";
import {
  Zap, Menu, X,
} from "lucide-react";
import { PaginaComSecoesAdiadas, SecaoAdiada, secaoDe, useIrParaSecao } from "@/components/landing/SecoesAdiadas";
import { BLUE } from "./landingLP1Tema";

// ─── NAV ────────────────────────────────────────────────────
function LP1Nav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const irParaSecao = useIrParaSecao();
  // Monta as seções adiadas antes de rolar (ver SecoesAdiadas.tsx).
  const scrollTo = (id: string) => {
    irParaSecao(id);
    setOpen(false);
  };

  return (
    <header className="fixed top-0 w-full z-50 border-b bg-white/80 backdrop-blur-md" style={{ borderColor: BLUE[100] }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <span className="font-black text-2xl tracking-tighter uppercase" style={{ color: BLUE[900] }}>
          MecApp
        </span>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: BLUE[800] }}>
          <button onClick={() => scrollTo("funcionalidades")} className="hover:opacity-70 transition-opacity">Funcionalidades</button>
          <button onClick={() => scrollTo("depoimentos")} className="hover:opacity-70 transition-opacity">Depoimentos</button>
          <button onClick={() => scrollTo("planos")} className="hover:opacity-70 transition-opacity">Planos</button>
          <button onClick={() => scrollTo("faq")} className="hover:opacity-70 transition-opacity">FAQ</button>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => navigate("/auth")}
            className="px-4 py-2 text-sm font-semibold border rounded-lg transition-colors"
            style={{ borderColor: BLUE[200], color: BLUE[700] }}
          >
            Login
          </button>
          <button
            onClick={() => navigate("/auth")}
            className="px-5 py-2 text-sm font-bold text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ background: BLUE[600] }}
          >
            Começar Grátis
          </button>
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t px-6 py-4 bg-white space-y-3" style={{ borderColor: BLUE[100] }}>
          <button onClick={() => scrollTo("funcionalidades")} className="block w-full text-left text-sm font-medium py-2">Funcionalidades</button>
          <button onClick={() => scrollTo("depoimentos")} className="block w-full text-left text-sm font-medium py-2">Depoimentos</button>
          <button onClick={() => scrollTo("planos")} className="block w-full text-left text-sm font-medium py-2">Planos</button>
          <button onClick={() => scrollTo("faq")} className="block w-full text-left text-sm font-medium py-2">FAQ</button>
          <button onClick={() => navigate("/auth")} className="block w-full text-white text-center font-bold text-sm py-3 rounded-lg mt-2" style={{ background: BLUE[600] }}>
            Começar Grátis
          </button>
        </div>
      )}
    </header>
  );
}

// ─── HERO ───────────────────────────────────────────────────
function LP1Hero() {
  const navigate = useNavigate();
  const irParaSecao = useIrParaSecao();

  return (
    <section className="min-h-screen flex items-center pt-20" style={{ background: BLUE[50] }}>
      <div className="max-w-7xl mx-auto w-full px-6 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left */}
          <div className="lg:col-span-7 flex flex-col justify-center lg:pr-12">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-8 w-fit"
              style={{ background: BLUE[100], color: BLUE[700] }}
            >
              <Zap size={14} />
              Sistema completo para assistências
            </div>

            <h1
              className="text-5xl md:text-7xl xl:text-[5.5rem] font-black tracking-[-0.04em] leading-[0.9] mb-6"
              style={{ color: BLUE[900] }}
            >
              Organize a bancada.{" "}
              <span style={{ color: BLUE[400] }}>Multiplique o lucro.</span>
            </h1>

            <p className="text-lg md:text-xl max-w-[46ch] leading-relaxed mb-10" style={{ color: `${BLUE[900]}B3` }}>
              Transforme filas caóticas em uma operação orquestrada. 
              Transparência total do diagnóstico à entrega, com lucro calculado em tempo real.
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate("/auth")}
                className="px-8 py-4 text-sm font-bold text-white tracking-wide rounded-lg transition-opacity hover:opacity-90"
                style={{ background: BLUE[600] }}
              >
                Começar Agora — É Grátis
              </button>
              <button
                onClick={() => irParaSecao("funcionalidades")}
                className="px-8 py-4 text-sm font-bold border rounded-lg transition-colors"
                style={{ borderColor: BLUE[200], color: BLUE[700] }}
              >
                Ver Funcionalidades
              </button>
            </div>

            <div className="mt-12 pt-8 grid grid-cols-3 gap-6 max-w-md" style={{ borderTop: `1px solid ${BLUE[200]}` }}>
              {[
                { value: "350+", label: "Lojas Ativas" },
                { value: "24h", label: "Teste Grátis" },
                { value: "99.9%", label: "Uptime" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-3xl font-black tracking-tight" style={{ color: BLUE[900] }}>{s.value}</div>
                  <div className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: BLUE[400] }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — UI Card */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md bg-white border rounded-2xl shadow-xl overflow-hidden" style={{ borderColor: BLUE[200] }}>
              {/* Card Header */}
              <div className="px-6 py-4 border-b flex justify-between items-center" style={{ borderColor: BLUE[100], background: BLUE[50] }}>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: BLUE[400] }}>Ordem de Serviço</div>
                  <div className="font-bold text-lg" style={{ color: BLUE[900] }}>OS #8842</div>
                </div>
                <span className="px-3 py-1 text-xs font-bold rounded-full" style={{ background: BLUE[100], color: BLUE[600] }}>
                  Em andamento
                </span>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Cliente", value: "Marcelo T." },
                    { label: "Técnico", value: "Carlos M." },
                    { label: "Dispositivo", value: "iPhone 14 Pro" },
                    { label: "Serviço", value: "Troca de Tela OLED" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BLUE[400] }}>{item.label}</div>
                      <div className="font-medium text-sm mt-0.5" style={{ color: BLUE[900] }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BLUE[400] }}>Progresso</span>
                    <span className="text-xs font-mono font-bold" style={{ color: BLUE[600] }}>74%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: BLUE[100] }}>
                    <div className="h-full rounded-full" style={{ width: "74%", background: BLUE[500] }} />
                  </div>
                </div>

                {/* Values */}
                <div className="pt-4 space-y-2" style={{ borderTop: `1px solid ${BLUE[100]}` }}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: BLUE[400] }}>Custo peça</span>
                    <span className="font-medium" style={{ color: BLUE[900] }}>R$ 1.850,00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: BLUE[400] }}>Mão de obra</span>
                    <span className="font-medium" style={{ color: BLUE[900] }}>R$ 450,00</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: `1px dashed ${BLUE[200]}` }}>
                    <span style={{ color: BLUE[600] }}>Lucro projetado</span>
                    <span style={{ color: BLUE[600] }}>R$ 450,00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── SEÇÕES ABAIXO DO TOPO (sob demanda) ────────────────────
// Altura da reserva = altura medida com 390 / 768 / 1280 px de largura (arredondada para baixo).
const carregarSecoes = () => import("./LandingLP1Secoes");
const SECOES = ([
  ["LP1Features", "min-h-[1810px] md:min-h-[1080px] lg:min-h-[860px]"],
  ["LP1HowItWorks", "min-h-[860px] md:min-h-[480px] lg:min-h-[520px]"],
  ["LP1Testimonials", "min-h-[1080px] md:min-h-[590px] lg:min-h-[590px]"],
  ["LP1Pricing", "min-h-[1710px] md:min-h-[880px] lg:min-h-[860px]"],
  ["LP1FAQ", "min-h-[630px] md:min-h-[600px] lg:min-h-[660px]"],
  ["LP1FinalCTA", "min-h-[520px] md:min-h-[450px] lg:min-h-[510px]"],
  ["LP1Footer", "min-h-[120px] md:min-h-[90px] lg:min-h-[90px]"],
] as const).map(([nome, altura]) => ({ nome, altura, secao: secaoDe(carregarSecoes, nome) }));

// ─── PÁGINA COMPLETA ────────────────────────────────────────
export default function LandingLP1() {
  useEffect(() => {
    trackPageView()
  }, [])

  return (
    <PaginaComSecoesAdiadas carregar={carregarSecoes} className="min-h-screen" style={{ background: BLUE[50] }}>
      <LP1Nav />
      <LP1Hero />
      {SECOES.map(({ nome, altura, secao }, ordem) => (
        <SecaoAdiada key={nome} secao={secao} ordem={ordem} altura={altura} />
      ))}
    </PaginaComSecoesAdiadas>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CheckCircle2, ArrowRight, Smartphone, Wrench, BarChart3, 
  Package, Users, FileText, Shield, Headphones, Zap, CreditCard,
  Star, ChevronDown, Menu, X
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PLANOS } from "@/types/plano";

// ─── Cores do tema ─────────────────────────────────────────
const BLUE = {
  50: "#EFF6FF",
  100: "#DBEAFE",
  200: "#BFDBFE",
  300: "#93C5FD",
  400: "#60A5FA",
  500: "#3B82F6",
  600: "#2563EB",
  700: "#1D4ED8",
  800: "#1E3A5F",
  900: "#0F172A",
};

// ─── NAV ────────────────────────────────────────────────────
function LP1Nav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
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
                onClick={() => document.getElementById("funcionalidades")?.scrollIntoView({ behavior: "smooth" })}
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

// ─── FUNCIONALIDADES ────────────────────────────────────────
const FEATURES = [
  { icon: Wrench, title: "Ordens de Serviço", desc: "Gerencie OS do início ao fim com status, checklist, avarias e garantia." },
  { icon: Package, title: "Estoque Inteligente", desc: "Controle peças, produtos e dispositivos com alerta de estoque baixo." },
  { icon: BarChart3, title: "Dashboard Financeiro", desc: "Receitas, despesas e lucro em tempo real com gráficos detalhados." },
  { icon: Users, title: "Gestão de Equipe", desc: "Funcionários com permissões, comissões e controle de acesso." },
  { icon: Smartphone, title: "Catálogo Online", desc: "Vitrine digital com landing page para vender dispositivos." },
  { icon: FileText, title: "Recibos e Termos", desc: "Impressão de OS, recibos, termos de garantia e responsabilidade." },
];

function LP1Features() {
  return (
    <section id="funcionalidades" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: BLUE[500] }}>Funcionalidades</div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: BLUE[900] }}>
            Tudo que sua assistência precisa
          </h2>
          <p className="text-lg mt-4 max-w-2xl mx-auto" style={{ color: `${BLUE[900]}80` }}>
            Do balcão ao financeiro, um sistema único que conecta toda a operação.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group p-8 border rounded-xl hover:shadow-lg transition-all duration-300"
              style={{ borderColor: BLUE[100] }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors"
                style={{ background: BLUE[50], color: BLUE[500] }}
              >
                <f.icon size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: BLUE[900] }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: `${BLUE[900]}80` }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── COMO FUNCIONA ──────────────────────────────────────────
function LP1HowItWorks() {
  const steps = [
    { num: "01", title: "Crie sua conta", desc: "Cadastro rápido em menos de 2 minutos. Sem cartão de crédito." },
    { num: "02", title: "Configure sua loja", desc: "Adicione dados da loja, logo e personalize suas OS e recibos." },
    { num: "03", title: "Comece a gerenciar", desc: "Cadastre clientes, crie OS, controle estoque e veja o lucro crescer." },
  ];

  return (
    <section className="py-20 lg:py-28" style={{ background: BLUE[50] }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: BLUE[500] }}>Como funciona</div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: BLUE[900] }}>
            3 passos para organizar tudo
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.num} className="text-center md:text-left">
              <div
                className="text-6xl font-black tracking-tighter mb-4"
                style={{ color: BLUE[200] }}
              >
                {s.num}
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: BLUE[900] }}>{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: `${BLUE[900]}80` }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── DEPOIMENTOS ────────────────────────────────────────────
const TESTIMONIALS = [
  { name: "Carlos M.", role: "Dono de Assistência - SP", text: "Antes eu perdia horas com planilhas. Com o MecApp, reduzi o tempo de gestão pela metade e aumentei meu lucro em 30%.", stars: 5 },
  { name: "Juliana R.", role: "Técnica - RJ", text: "O controle de OS é perfeito. Os clientes adoram receber as notificações de status pelo WhatsApp.", stars: 5 },
  { name: "Ricardo S.", role: "Gestor - MG", text: "O catálogo online me ajudou a vender mais dispositivos. É como ter uma vitrine 24h por dia.", stars: 5 },
];

function LP1Testimonials() {
  return (
    <section id="depoimentos" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: BLUE[500] }}>Depoimentos</div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: BLUE[900] }}>
            Quem usa, recomenda
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="p-8 border rounded-xl" style={{ borderColor: BLUE[100] }}>
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} size={16} fill={BLUE[500]} color={BLUE[500]} />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-6" style={{ color: `${BLUE[900]}CC` }}>"{t.text}"</p>
              <div>
                <div className="font-bold text-sm" style={{ color: BLUE[900] }}>{t.name}</div>
                <div className="text-xs" style={{ color: BLUE[400] }}>{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── PLANOS ─────────────────────────────────────────────────
function LP1Pricing() {
  const navigate = useNavigate();
  const [isAnual, setIsAnual] = useState(false);

  const planos = [
    {
      nome: "Básico",
      preco: isAnual ? "29,90" : "37,90",
      desc: "Para quem está começando",
      features: ["50 Dispositivos", "20 OS/mês", "Produtos ilimitados", "500MB armazenamento"],
      destaque: false,
    },
    {
      nome: "Intermediário",
      preco: isAnual ? "54,90" : "67,90",
      desc: "O mais escolhido",
      features: ["500 Dispositivos", "60 OS/mês", "10 no Catálogo", "1 Funcionário", "5GB armazenamento"],
      destaque: true,
    },
    {
      nome: "Profissional",
      preco: isAnual ? "89,90" : "109,90",
      desc: "Para assistências maiores",
      features: ["Dispositivos ilimitados", "OS ilimitadas", "50 no Catálogo", "5 Funcionários", "20GB armazenamento"],
      destaque: false,
    },
  ];

  return (
    <section id="planos" className="py-20 lg:py-28" style={{ background: BLUE[50] }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: BLUE[500] }}>Planos</div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: BLUE[900] }}>
            Escolha o plano ideal
          </h2>
          <p className="text-lg mt-4" style={{ color: `${BLUE[900]}80` }}>
            Menos de R$1 real por dia. Cancele quando quiser.
          </p>

          <div className="flex items-center justify-center gap-3 mt-8">
            <Label className="text-sm font-medium" style={{ color: isAnual ? BLUE[400] : BLUE[900] }}>Mensal</Label>
            <Switch checked={isAnual} onCheckedChange={setIsAnual} />
            <Label className="text-sm font-medium" style={{ color: isAnual ? BLUE[900] : BLUE[400] }}>
              Anual <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-1" style={{ background: BLUE[100], color: BLUE[600] }}>-20%</span>
            </Label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {planos.map((p) => (
            <div
              key={p.nome}
              className="relative p-8 rounded-xl border bg-white flex flex-col"
              style={{
                borderColor: p.destaque ? BLUE[500] : BLUE[200],
                boxShadow: p.destaque ? `0 0 0 1px ${BLUE[500]}, 0 20px 40px -12px ${BLUE[500]}20` : undefined,
              }}
            >
              {p.destaque && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-bold text-white rounded-full"
                  style={{ background: BLUE[600] }}
                >
                  Mais popular
                </div>
              )}
              <h3 className="text-xl font-bold" style={{ color: BLUE[900] }}>{p.nome}</h3>
              <p className="text-xs mt-1 mb-4" style={{ color: BLUE[400] }}>{p.desc}</p>
              <div className="mb-6">
                <span className="text-4xl font-black tracking-tight" style={{ color: BLUE[900] }}>R$ {p.preco}</span>
                <span className="text-sm" style={{ color: BLUE[400] }}>/mês</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: `${BLUE[900]}CC` }}>
                    <CheckCircle2 size={16} style={{ color: BLUE[500], flexShrink: 0, marginTop: 2 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate("/auth")}
                className="w-full py-3 text-sm font-bold rounded-lg transition-opacity hover:opacity-90"
                style={{
                  background: p.destaque ? BLUE[600] : "transparent",
                  color: p.destaque ? "white" : BLUE[700],
                  border: p.destaque ? "none" : `1px solid ${BLUE[200]}`,
                }}
              >
                Começar Agora
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: "Preciso pagar para testar?", a: "Não! Você pode testar gratuitamente por 24 horas sem precisar de cartão de crédito." },
  { q: "Posso usar no celular?", a: "Sim! O MecApp é 100% responsivo e funciona em qualquer dispositivo com navegador." },
  { q: "Consigo imprimir OS e recibos?", a: "Sim! Temos modelos A4 e 80mm, personalizáveis com a logo e dados da sua loja." },
  { q: "Como funciona o catálogo online?", a: "Você ativa o catálogo, adiciona dispositivos e compartilha o link com seus clientes. É como uma vitrine 24h." },
  { q: "Posso cancelar a qualquer momento?", a: "Sim, sem multa e sem burocracia. Você pode cancelar diretamente pelo sistema." },
];

function LP1FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 lg:py-28 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: BLUE[500] }}>FAQ</div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: BLUE[900] }}>
            Perguntas frequentes
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="border rounded-xl overflow-hidden" style={{ borderColor: BLUE[100] }}>
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <span className="font-bold text-sm" style={{ color: BLUE[900] }}>{item.q}</span>
                <ChevronDown
                  size={18}
                  style={{ color: BLUE[400], transform: openIdx === i ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
                />
              </button>
              {openIdx === i && (
                <div className="px-6 pb-4 text-sm leading-relaxed" style={{ color: `${BLUE[900]}99` }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA FINAL ──────────────────────────────────────────────
function LP1FinalCTA() {
  const navigate = useNavigate();

  return (
    <section className="py-20 lg:py-28" style={{ background: BLUE[900] }}>
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
          Pronto para organizar sua assistência?
        </h2>
        <p className="text-lg mb-8" style={{ color: BLUE[300] }}>
          Comece gratuitamente e veja a diferença em minutos.
        </p>
        <button
          onClick={() => navigate("/auth")}
          className="px-10 py-5 text-lg font-bold text-white rounded-xl transition-opacity hover:opacity-90 inline-flex items-center gap-2"
          style={{ background: BLUE[500] }}
        >
          Começar Agora <ArrowRight size={20} />
        </button>
        <div className="flex items-center justify-center gap-6 mt-8 text-sm" style={{ color: BLUE[400] }}>
          <span className="flex items-center gap-1"><Shield size={14} /> Sem cartão</span>
          <span className="flex items-center gap-1"><Headphones size={14} /> Suporte incluso</span>
          <span className="flex items-center gap-1"><CreditCard size={14} /> Cancele quando quiser</span>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ─────────────────────────────────────────────────
function LP1Footer() {
  return (
    <footer className="py-8 border-t" style={{ borderColor: BLUE[100], background: BLUE[50] }}>
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <span className="font-black text-lg tracking-tighter" style={{ color: BLUE[900] }}>MecApp</span>
        <span className="text-xs" style={{ color: BLUE[400] }}>© {new Date().getFullYear()} MecApp. Todos os direitos reservados.</span>
      </div>
    </footer>
  );
}

// ─── PÁGINA COMPLETA ────────────────────────────────────────
export default function LandingLP1() {
  return (
    <div className="min-h-screen" style={{ background: BLUE[50] }}>
      <LP1Nav />
      <LP1Hero />
      <LP1Features />
      <LP1HowItWorks />
      <LP1Testimonials />
      <LP1Pricing />
      <LP1FAQ />
      <LP1FinalCTA />
      <LP1Footer />
    </div>
  );
}

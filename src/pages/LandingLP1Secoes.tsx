// Seções da /lp1 abaixo do topo: um arquivo só, carregado sob demanda
// (ver components/landing/SecoesAdiadas.tsx). Não importar estático daqui no topo.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2, ArrowRight, Smartphone, Wrench, BarChart3, Package, Users, FileText, Shield, Headphones, CreditCard, Star, ChevronDown,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PLANOS } from "@/types/plano";
import { BLUE } from "./landingLP1Tema";

// ─── FUNCIONALIDADES ────────────────────────────────────────
const FEATURES = [
  { icon: Wrench, title: "Ordens de Serviço", desc: "Gerencie OS do início ao fim com status, checklist, avarias e garantia." },
  { icon: Package, title: "Estoque Inteligente", desc: "Controle peças, produtos e dispositivos com alerta de estoque baixo." },
  { icon: BarChart3, title: "Dashboard Financeiro", desc: "Receitas, despesas e lucro em tempo real com gráficos detalhados." },
  { icon: Users, title: "Gestão de Equipe", desc: "Funcionários com permissões, comissões e controle de acesso." },
  { icon: Smartphone, title: "Catálogo Online", desc: "Vitrine digital com landing page para vender dispositivos." },
  { icon: FileText, title: "Recibos e Termos", desc: "Impressão de OS, recibos, termos de garantia e responsabilidade." },
];

export function LP1Features() {
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
export function LP1HowItWorks() {
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

export function LP1Testimonials() {
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
export function LP1Pricing() {
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

export function LP1FAQ() {
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
export function LP1FinalCTA() {
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
export function LP1Footer() {
  return (
    <footer className="py-8 border-t" style={{ borderColor: BLUE[100], background: BLUE[50] }}>
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <span className="font-black text-lg tracking-tighter" style={{ color: BLUE[900] }}>MecApp</span>
        <span className="text-xs" style={{ color: BLUE[400] }}>© {new Date().getFullYear()} MecApp. Todos os direitos reservados.</span>
      </div>
    </footer>
  );
}

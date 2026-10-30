import { useEffect, useState, type CSSProperties } from "react";
import { LINKS } from "../links";
import { ComparacaoPlanos } from "./ComparacaoPlanos";
import { IconeCheck } from "./Icones";
import { temaDo, temas } from "./temasPlanos";
import type { NivelPlano } from "./SeloPlano";

// Planos: valores e recursos copiados de src/types/plano.ts do MecApp (confirmados como atuais em 2026-10-18).
// Visual: seção escura, bordas em degradê azul (paleta da marca) e borda neon girando no plano em destaque.
// Preços FIXOS (sem contador). Destaque: Intermediário. Ultra com o recurso "Em breve" marcado como tal. Botões -> /cadastro-plano?plan=<chave> (igual à landing atual).

type Plano = {
  nome: string;
  curto: string;
  nivel: NivelPlano;
  chave: { mensal: string; anual: string };
  mensal: number;
  anual: number;
  publico: string;
  recursos: string[];
  emBreve?: string[];
  destaque?: boolean;
  novo?: boolean;
};

const planos: Plano[] = [
  {
    nome: "Básico",
    curto: "Básico",
    nivel: "basico",
    chave: { mensal: "basico_mensal", anual: "basico_anual" },
    mensal: 19.9,
    anual: 190.8,
    publico: "Para quem está começando",
    recursos: ["Até 50 dispositivos", "Até 20 ordens de serviço por mês", "PDV e vendas", "Produtos e peças ilimitados", "Suporte por e-mail"],
  },
  {
    nome: "Intermediário",
    curto: "Interm.",
    nivel: "intermediario",
    chave: { mensal: "intermediario_mensal", anual: "intermediario_anual" },
    mensal: 39.9,
    anual: 382.8,
    publico: "Para a loja que está crescendo",
    destaque: true,
    recursos: [
      "Tudo do Básico",
      "Até 500 dispositivos",
      "60 ordens de serviço por mês",
      "Financeiro, contas, clientes e fornecedores",
      "Acompanhamento de OS (10 por mês)",
      "Assinatura digital do cliente na OS",
      "1 funcionário com comissão",
      "Suporte via WhatsApp",
    ],
  },
  {
    nome: "Profissional",
    curto: "Profis.",
    nivel: "profissional",
    chave: { mensal: "profissional_mensal", anual: "profissional_anual" },
    mensal: 79.9,
    anual: 898.8,
    publico: "Para operações maiores",
    recursos: [
      "Tudo do Intermediário",
      "Dispositivos e ordens de serviço ilimitados",
      "Funcionários e comissões ilimitados",
      "Acompanhamento de OS (50 por mês)",
      "Consulta de IMEI pela Anatel",
      "Verificação de garantia Apple",
      "Suporte prioritário por WhatsApp",
    ],
  },
  {
    nome: "Ultra",
    curto: "Ultra",
    nivel: "ultra",
    chave: { mensal: "profissional_ultra_mensal", anual: "profissional_ultra_anual" },
    mensal: 129.9,
    anual: 1318.8,
    publico: "Para redes e múltiplas filiais",
    novo: true,
    recursos: ["Tudo do Profissional", "Multi Empresas (até 3 filiais)", "Acompanhamento de OS ilimitado"],
    emBreve: ["Avaliador de preço de dispositivo"],
  },
];

const real = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Card({ p, anual, i }: { p: Plano; anual: boolean; i: number }) {
  const preco = anual ? p.anual : p.mensal;
  const [inteiro, centavos] = real(preco).split(",");
  const d = p.destaque;
  const t = temaDo(p);
  const premium = t === temas.violeta || t === temas.ouro;

  return (
    <article
      data-reveal
      style={{ "--i": i } as CSSProperties}
      className={`group relative flex rounded-[1.75rem] ${d || premium ? "p-[2px]" : "p-px"} transition-transform duration-500 ease-out hover:-translate-y-1.5 ${
        d ? "order-first md:order-none xl:-my-5" : ""
      }`}
    >
      {/* Borda: neon girando no destaque; degradê nos demais */}
      {d ? (
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[1.75rem] bg-brand-600/40">
          <span className="neon-giro absolute left-1/2 top-1/2 aspect-square w-[250%] bg-[conic-gradient(from_0deg,transparent_0deg,#2563EB_30deg,#7DD3FC_70deg,transparent_120deg,transparent_180deg,#2563EB_210deg,#7DD3FC_250deg,transparent_300deg)]" />
        </span>
      ) : (
        <span aria-hidden="true" className={`absolute inset-0 overflow-hidden rounded-[1.75rem] ${t.borda}`}>
          {/* Reflexo que atravessa a borda dos cards premium no hover */}
          {premium && (
            <span className="reflexo absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent" />
          )}
        </span>
      )}
      {/* Halo atrás do card (estático; acende no hover) */}
      <span
        aria-hidden="true"
        style={{ background: `radial-gradient(closest-side, ${t.halo}, transparent)` }}
        className={`pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] transition-opacity duration-500 ${
          t.haloSempre ? "opacity-100" : premium ? "opacity-40 group-hover:opacity-90" : "opacity-0 group-hover:opacity-60"
        }`}
      />

      <div
        className={`relative flex w-full flex-col overflow-hidden ${d || premium ? "rounded-[calc(1.75rem-2px)]" : "rounded-[calc(1.75rem-1px)]"} p-7 sm:p-8 ${t.fundo} ${
          d ? "xl:py-12" : ""
        }`}
      >
        <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b ${t.luz} to-transparent`} />
        <span aria-hidden="true" className={`absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent ${t.linha} to-transparent`} />

        <div className="relative md:min-h-[6.5rem]">
          {t.rotulo && (
            <span className={`mb-3 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${t.selo}`}>{t.rotulo}</span>
          )}
          <h3 className="font-display text-2xl font-bold text-white">{p.nome}</h3>
          <p className="mt-1 text-sm text-slate-400">{p.publico}</p>
        </div>

        <p className="relative mt-6 flex items-start gap-1">
          <span className="mt-2 text-base font-semibold text-slate-400">R$</span>
          <span className={`font-display text-6xl font-bold leading-none tracking-tight ${t.preco}`}>{inteiro}</span>
          <span className="mt-1 flex flex-col">
            <span className={`font-display text-xl font-bold ${t.centavos}`}>,{centavos}</span>
            <span className="text-xs text-slate-400">{anual ? "/ano" : "/mês"}</span>
          </span>
        </p>
        <p className={`relative mt-2 h-5 text-sm ${t.equivale}`}>{anual ? `Equivale a R$ ${real(p.anual / 12)} por mês` : ""}</p>

        <a
          href={LINKS.plano(anual ? p.chave.anual : p.chave.mensal)}
          className={`brilho relative mt-7 inline-flex h-12 items-center justify-center rounded-xl font-display text-sm font-semibold transition-[transform,box-shadow,background-color,border-color] duration-300 hover:-translate-y-0.5 ${t.botao}`}
        >
          Assinar o {p.nome}
        </a>

        <div aria-hidden="true" className="relative my-8 h-px bg-gradient-to-r from-white/15 via-white/10 to-transparent" />

        <ul className="relative space-y-3 text-sm">
          {p.recursos.map((r) => (
            <li key={r} className="flex gap-3 text-slate-300">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${t.check}`}>
                <IconeCheck className="h-3 w-3" />
              </span>
              {r}
            </li>
          ))}
          {p.emBreve?.map((r) => (
            <li key={r} className="flex items-start gap-3 text-slate-400">
              <span className="mt-0.5 shrink-0 whitespace-nowrap rounded border border-white/20 px-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-200">
                Em breve
              </span>
              {r}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function Planos() {
  const [anual, setAnual] = useState(false);
  // abas: cards dos planos ou tabela de comparação (#comparar abre direto a comparação)
  const [comparar, setComparar] = useState(false);
  useEffect(() => {
    const ver = () => {
      if (location.hash === "#comparar") {
        setComparar(true);
        document.getElementById("planos")?.scrollIntoView();
      }
    };
    ver();
    addEventListener("hashchange", ver);
    return () => removeEventListener("hashchange", ver);
  }, []);

  return (
    <section id="planos" aria-labelledby="planos-titulo" className="relative isolate overflow-clip bg-slate-950 py-24 text-white md:py-32">
      <div aria-hidden="true" className="fundo-grade-escuro pointer-events-none absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[55%] -z-10 h-[40rem] w-[70rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.25),transparent)]"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <h2
              id="planos-titulo"
              data-reveal
              className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            >
              Comece grátis.{" "}
              <span className="bg-gradient-to-r from-brand-400 to-sky-300 bg-clip-text text-transparent">Escolha o plano depois.</span>
            </h2>
            <p data-reveal style={{ "--i": 1 } as CSSProperties} className="mt-5 max-w-xl text-lg text-slate-300">
              Todo cadastro ganha 24h de acesso para testar os principais recursos. Cancele a qualquer momento.
            </p>
          </div>

          <div data-reveal style={{ "--i": 2 } as CSSProperties} className="lg:col-span-4 lg:justify-self-end">
            <div role="group" aria-label="Período de cobrança" className="relative inline-grid grid-cols-2 rounded-xl border border-white/10 bg-white/5 p-1">
              <span
                aria-hidden="true"
                className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-[0.5rem] bg-gradient-to-r from-brand-600 to-sky-500 shadow-[0_0_20px_rgba(59,130,246,0.6)] transition-transform duration-500 [transition-timing-function:cubic-bezier(0.2,0.7,0.2,1)] ${
                  anual ? "translate-x-full" : "translate-x-0"
                }`}
              />
              {[
                { v: false, t: "Mensal" },
                { v: true, t: "Anual" },
              ].map((o) => (
                <button
                  key={o.t}
                  type="button"
                  aria-pressed={anual === o.v}
                  onClick={() => setAnual(o.v)}
                  className={`relative rounded-[0.5rem] px-6 py-2.5 font-display text-sm font-semibold transition-colors duration-300 ${
                    anual === o.v ? "text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {o.t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Abas: ver os planos ou comparar lado a lado */}
        <div id="comparar" role="tablist" aria-label="Como ver os planos" className="mt-12 flex scroll-mt-24 justify-center">
          <div className="inline-grid grid-cols-2 rounded-2xl border border-white/10 bg-white/5 p-1">
            {[
              { v: false, t: "Ver planos" },
              { v: true, t: "Comparar planos" },
            ].map((o) => (
              <button
                key={o.t}
                type="button"
                role="tab"
                aria-selected={comparar === o.v}
                aria-controls="planos-conteudo"
                onClick={() => setComparar(o.v)}
                className={`rounded-xl px-5 py-2.5 font-display text-sm font-semibold transition-colors duration-300 sm:px-7 ${
                  comparar === o.v ? "bg-white text-slate-950" : "text-slate-300 hover:text-white"
                }`}
              >
                {o.t}
              </button>
            ))}
          </div>
        </div>

        <div id="planos-conteudo" role="tabpanel">
          {comparar && <ComparacaoPlanos planos={planos} anual={anual} />}
          {/* os cards continuam na página (só escondidos) para não perder a animação de entrada */}
          <div className={`mt-12 gap-5 md:grid-cols-2 xl:grid-cols-4 xl:items-stretch ${comparar ? "hidden" : "grid"}`}>
            {planos.map((p, i) => (
              <Card key={p.nome} p={p} anual={anual} i={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

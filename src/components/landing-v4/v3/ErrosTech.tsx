import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useInView } from "../hooks/useReveal";
import { LINKS } from "../links";
import { Botao } from "../components/Botao";
import { SeloPlano, type NivelPlano } from "../components/SeloPlano";

// VERSÃO 3/4 - "Alguns problemas que o MécApp resolve" (pedido do Adriel em 2026-10-29: clean, tecnológico, escuro com degradê).
// Faixa sempre escura (também na v4, como a seção de planos), com brilhos em degradê ao fundo.
// Cada card: o problema (fala do lojista) em cima e, depois de uma linha em degradê, a solução do MécApp com o plano.
const problemas: {
  fala: string;
  solucao: string;
  detalhe: string;
  plano: NivelPlano;
}[] = [
  {
    fala: "Contei o dinheiro duas vezes e o valor ainda não bate.",
    solucao: "Extrato da loja",
    detalhe: "Tudo o que entrou e saiu, dia a dia.",
    plano: "intermediario",
  },
  {
    fala: "Esse aparelho chegou com qual defeito mesmo?",
    solucao: "Checklist de entrada na OS",
    detalhe: "O estado do aparelho e o defeito relatado, guardados.",
    plano: "basico",
  },
  {
    fala: "Terceira ligação hoje perguntando se o celular ficou pronto.",
    solucao: "Link de acompanhamento",
    detalhe: "O cliente acompanha o conserto pelo WhatsApp.",
    plano: "intermediario",
  },
  {
    fala: "Vendi a última película e só descobri quando o cliente pediu outra.",
    solucao: "Estoque de produtos e peças",
    detalhe: "Quantidade baixa a cada venda no PDV.",
    plano: "basico",
  },
  {
    fala: "Paguei tudo e não sei dizer se a loja deu lucro.",
    solucao: "Análise de lucros",
    detalhe: "Lucro bruto e lucro líquido do mês na tela.",
    plano: "intermediario",
  },
  {
    fala: "Para saber como está a filial, só ligando para lá.",
    solucao: "Multi Empresas",
    detalhe: "Matriz e filiais no mesmo painel.",
    plano: "ultra",
  },
];

// Luz de "diagnóstico" que passa sozinha de um card para o próximo (no celular, descendo um a um):
// o card da vez acende a borda, ganha um círculo pulsando e um ponto corre pela linha até o ✓.
// Só roda com a seção na tela e fica parada com prefers-reduced-motion.
const INTERVALO = 2400;

export function ErrosTech() {
  const lista = useRef<HTMLUListElement>(null);
  const naTela = useInView(lista, false);
  const [ativo, setAtivo] = useState(-1);

  useEffect(() => {
    if (!naTela || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setAtivo((a) => (a + 1) % problemas.length), INTERVALO);
    return () => window.clearInterval(t);
  }, [naTela]);

  return (
    <section aria-labelledby="erros-titulo" className="relative isolate overflow-clip bg-slate-950 py-24 text-white md:py-32">
      {/* brilhos em degradê ao fundo (estáticos, sem blur em elemento animado) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-[calc(50%-30rem)] h-[36rem] w-[60rem] rounded-full aurora bg-[radial-gradient(closest-side,rgba(37,99,235,0.28),transparent)]" />
        <div
          style={{ "--d": "-6s" } as CSSProperties}
          className="aurora absolute -bottom-48 -left-32 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.14),transparent)]"
        />
        <div
          style={{ "--d": "-11s" } as CSSProperties}
          className="aurora absolute -bottom-48 -right-32 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.16),transparent)]"
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p
            data-reveal
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-300"
          >
            <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
              <span className="anel absolute inset-0 rounded-full bg-cyan-300" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-cyan-300" />
            </span>
            Diagnóstico da loja
          </p>
          <h2
            id="erros-titulo"
            data-reveal
            style={{ "--i": 1 } as CSSProperties}
            className="mt-5 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Alguns problemas que o{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 bg-clip-text text-transparent">MécApp resolve</span>
          </h2>
          <p data-reveal style={{ "--i": 2 } as CSSProperties} className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            Se você fala ou já falou alguma dessas frases no seu dia a dia, é sinal de que precisa do MécApp.
          </p>
        </div>

        <ul ref={lista} className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {problemas.map((p, i) => {
            const aceso = i === ativo;
            return (
              <li
                key={p.solucao}
                data-reveal="zoom"
                style={{ "--i": i } as CSSProperties}
                className={`cartao-tech relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-transform duration-300 hover:-translate-y-1`}
                data-aceso={aceso}
              >
                {/* brilho de fundo do card da vez */}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-[radial-gradient(120%_80%_at_50%_0%,rgba(34,211,238,0.12),transparent_70%)] transition-opacity duration-700 ${
                    aceso ? "opacity-100" : "opacity-0"
                  }`}
                />
                {/* círculo pulsando: "diagnosticando este problema" */}
                <span
                  aria-hidden="true"
                  className={`absolute right-5 top-5 flex h-2.5 w-2.5 transition-opacity duration-500 ${aceso ? "opacity-100" : "opacity-0"}`}
                >
                  <span className="anel absolute inset-0 rounded-full bg-cyan-300" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_2px_rgba(34,211,238,0.8)]" />
                </span>
                <p
                  className={`min-h-[2.75em] pr-4 text-[17px] leading-snug transition-colors duration-500 ${aceso ? "text-white" : "text-slate-300"}`}
                >
                  “{p.fala}”
                </p>

                <div aria-hidden="true" className="my-5 flex items-center gap-3">
                  <span className="anima-risco relative h-px flex-1 bg-gradient-to-r from-white/10 via-cyan-400/50 to-violet-400/50">
                    {/* ponto que corre do problema até a solução */}
                    {aceso && (
                      <span key={ativo} className="anim-correr absolute inset-0">
                        <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_2px_rgba(34,211,238,0.8)]" />
                      </span>
                    )}
                  </span>
                  <span
                    style={{ "--d": "700ms" } as CSSProperties}
                    className="anima-pop flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-xs font-bold text-slate-950 shadow-[0_0_16px_rgba(34,211,238,0.6)]"
                  >
                    <span className={`transition-transform duration-500 ${aceso ? "scale-125" : ""}`}>✓</span>
                  </span>
                </div>

                <p className="anima-sobe font-display text-lg font-semibold text-white">
                  <span className="sr-only">Solução: </span>
                  {p.solucao}
                </p>
                <p style={{ "--d": "550ms" } as CSSProperties} className="anima-sobe mt-1 text-sm text-slate-400">
                  {p.detalhe}
                </p>
                <span style={{ "--d": "650ms" } as CSSProperties} className="anima-sobe mt-auto pt-4">
                  <SeloPlano nivel={p.plano} escuro />
                </span>
              </li>
            );
          })}
        </ul>

        <div data-reveal className="mt-12 flex flex-col items-center gap-3 text-center">
          <Botao href={LINKS.testeGratis} seta className="w-full sm:w-auto">
            Resolver na minha loja
          </Botao>
          <p className="text-sm text-slate-400">24h de acesso Premium grátis · Cancele a qualquer momento</p>
        </div>
      </div>
    </section>
  );
}

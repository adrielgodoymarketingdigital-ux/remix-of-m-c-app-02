import type { CSSProperties } from "react";
import { LINKS } from "../links";
import { Botao } from "../components/Botao";

// VERSÃO 3/4 - "Como funciona" como um fluxo de dados: 4 etapas ligadas por linhas com um ponto correndo
// (só transform/opacity). Cada etapa mostra o que VOCÊ faz e o que o MécApp faz sozinho.
// Faixa sempre escura com brilhos em degradê (também na v4), no mesmo estilo da seção de problemas (pedido do Adriel em 2026-10-29).
const etapas = [
  {
    n: "01",
    nome: "Balcão",
    voce: "Cadastra a OS com o aparelho e o problema",
    sistema: "Guarda o checklist de entrada e o histórico do cliente",
  },
  {
    n: "02",
    nome: "Bancada",
    voce: "Muda o status enquanto conserta",
    sistema: "Atualiza a etapa no link que o cliente recebeu",
  },
  {
    n: "03",
    nome: "WhatsApp",
    voce: "Envia o link uma vez só",
    sistema: "O cliente acompanha sozinho, sem ligar para a loja",
  },
  {
    n: "04",
    nome: "Caixa",
    voce: "Registra a venda ou a entrega",
    sistema: "Lança no financeiro e mostra quanto entrou e quanto sobrou",
  },
];

export function FluxoTech() {
  return (
    <section id="como-funciona" aria-labelledby="fluxo-titulo" className="relative isolate overflow-clip bg-slate-950 py-24 text-white md:py-32">
      {/* brilhos em degradê ao fundo (estáticos) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="aurora absolute -left-40 top-1/4 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.2),transparent)]" />
        <div style={{ "--d": "-7s" } as CSSProperties} className="aurora absolute -right-40 top-0 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.16),transparent)]" />
        <div style={{ "--d": "-12s" } as CSSProperties} className="aurora absolute bottom-[-18rem] left-[calc(50%-28rem)] h-[30rem] w-[56rem] rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.24),transparent)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p
            data-reveal
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-violet-300"
          >
            <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
              <span className="anel absolute inset-0 rounded-full bg-violet-300" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-violet-300" />
            </span>
            Como funciona
          </p>
          <h2
            id="fluxo-titulo"
            data-reveal
            style={{ "--i": 1 } as CSSProperties}
            className="mt-5 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Você faz o pouco.{" "}
            <span className="bg-gradient-to-r from-violet-400 via-sky-400 to-cyan-300 bg-clip-text text-transparent">O MécApp faz o resto.</span>
          </h2>
        </div>

        <ol className="relative mt-16 grid gap-6 lg:grid-cols-4 lg:gap-5">
          {etapas.map((e, i) => (
            <li key={e.n} data-reveal="zoom" style={{ "--i": i } as CSSProperties} className="relative">
              {/* Linha em degradê até a próxima etapa (computador: horizontal / celular: vertical) com um ponto de dado correndo */}
              {i < etapas.length - 1 && (
                <>
                  <span
                    aria-hidden="true"
                    className="anima-risco absolute left-[calc(100%-0.5rem)] top-11 hidden h-px w-[calc(1.25rem+1rem)] bg-gradient-to-r from-violet-400/60 to-cyan-400/60 lg:block"
                  >
                    <span className="anim-correr absolute inset-0" style={{ "--d": `${i * 700}ms` } as CSSProperties}>
                      <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_2px_rgba(34,211,238,0.8)]" />
                    </span>
                  </span>
                  <span aria-hidden="true" className="anima-risco-v absolute left-11 top-full h-6 w-px bg-gradient-to-b from-violet-400/60 to-cyan-400/60 lg:hidden">
                    <span className="anim-correr-baixo absolute inset-0" style={{ "--d": `${i * 700}ms` } as CSSProperties}>
                      <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_2px_rgba(34,211,238,0.8)]" />
                    </span>
                  </span>
                </>
              )}

              <div className="cartao-tech h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-transform duration-300 hover:-translate-y-1">
                <div className="flex items-center gap-3">
                  <span className="anima-pop flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-blue-600 to-cyan-500 font-mono text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(99,102,241,0.8)]">
                    {e.n}
                  </span>
                  <h3 className="font-display text-xl font-semibold text-white">{e.nome}</h3>
                </div>
                <dl className="mt-6 space-y-4">
                  <div style={{ "--d": "400ms" } as CSSProperties} className="anima-sobe">
                    <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">Você</dt>
                    <dd className="mt-1 text-slate-300">{e.voce}</dd>
                  </div>
                  <div style={{ "--d": "650ms" } as CSSProperties} className="anima-sobe rounded-xl border border-white/10 bg-gradient-to-br from-violet-500/[0.12] via-blue-500/[0.08] to-cyan-400/[0.1] p-3.5">
                    <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-300">MécApp</dt>
                    <dd className="mt-1 font-medium text-white">{e.sistema}</dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ol>
        <p data-reveal className="mt-6 text-center text-xs text-slate-500">
          * O link de acompanhamento e o financeiro começam no plano Intermediário. OS, PDV e estoque já vêm no Básico.
        </p>

        <div data-reveal className="mt-12 flex flex-col items-center gap-3 text-center">
          <Botao href={LINKS.testeGratis} seta className="w-full sm:w-auto">
            Criar minha conta grátis
          </Botao>
          <p className="text-sm text-slate-400">Sem instalação. Funciona no computador, no tablet e no celular.</p>
        </div>
      </div>
    </section>
  );
}

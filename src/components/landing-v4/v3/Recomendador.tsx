import { useState, type CSSProperties } from "react";
import { LINKS } from "../links";
import { IconeCheck } from "../components/Icones";
import { temas, type Tema } from "../components/temasPlanos";

// VERSÃO 3/4 - "Descubra seu plano": 4 perguntas e o plano indicado na hora.
// O card do resultado usa as MESMAS cores do card do plano na seção de preços (temasPlanos.ts), então muda de cor com as respostas.
// Regras tiradas dos limites REAIS de src/types/plano.ts do MécApp:
// Básico: até 20 OS/mês, sem financeiro, sem funcionário com comissão.
// Intermediário: até 60 OS/mês, financeiro, link de acompanhamento, 1 funcionário com comissão.
// Profissional: OS ilimitadas, funcionários ilimitados.  Ultra: Multi Empresas (até 3 filiais).
type Nivel = 0 | 1 | 2 | 3;

const temaDoNivel: Record<Nivel, Tema> = { 0: temas.neutro, 1: temas.azul, 2: temas.violeta, 3: temas.ouro };

const planos: Record<Nivel, { nome: string; preco: string; chave: string; destaque: string[] }> = {
  0: {
    nome: "Básico",
    preco: "19,90",
    chave: "basico_mensal",
    destaque: ["Até 20 ordens de serviço por mês", "PDV e vendas", "Produtos e peças ilimitados"],
  },
  1: {
    nome: "Intermediário",
    preco: "39,90",
    chave: "intermediario_mensal",
    destaque: ["60 ordens de serviço por mês", "Financeiro, contas e extrato", "Link de acompanhamento da OS", "1 funcionário com comissão"],
  },
  2: {
    nome: "Profissional",
    preco: "79,90",
    chave: "profissional_mensal",
    destaque: ["Ordens de serviço ilimitadas", "Funcionários e comissões ilimitados", "Consulta de IMEI e garantia Apple"],
  },
  3: {
    nome: "Ultra",
    preco: "129,90",
    chave: "profissional_ultra_mensal",
    destaque: ["Multi Empresas (até 3 filiais)", "Acompanhamento de OS ilimitado", "Tudo do Profissional"],
  },
};

type Pergunta = { id: string; texto: string; opcoes: { rotulo: string; nivel: Nivel }[] };

const perguntas: Pergunta[] = [
  {
    id: "lojas",
    texto: "Quantas lojas você tem?",
    opcoes: [
      { rotulo: "Uma loja", nivel: 0 },
      { rotulo: "Mais de uma", nivel: 3 },
    ],
  },
  {
    id: "os",
    texto: "Quantas OS você abre por mês?",
    opcoes: [
      { rotulo: "Até 20", nivel: 0 },
      { rotulo: "De 21 a 60", nivel: 1 },
      { rotulo: "Mais de 60", nivel: 2 },
    ],
  },
  {
    id: "financeiro",
    texto: "Quer controlar o caixa e mandar o link da OS ao cliente?",
    opcoes: [
      { rotulo: "Ainda não", nivel: 0 },
      { rotulo: "Sim", nivel: 1 },
    ],
  },
  {
    id: "equipe",
    texto: "Quantas pessoas trabalham com você?",
    opcoes: [
      { rotulo: "Só eu", nivel: 0 },
      { rotulo: "1 funcionário", nivel: 1 },
      { rotulo: "2 ou mais", nivel: 2 },
    ],
  },
];

export function Recomendador() {
  const [resp, setResp] = useState<Record<string, number>>({ lojas: 0, os: 1, financeiro: 1, equipe: 0 });

  const nivel = Math.max(...perguntas.map((p) => p.opcoes[resp[p.id]].nivel)) as Nivel;
  const plano = planos[nivel];
  const t = temaDoNivel[nivel];
  const [inteiro, centavos] = plano.preco.split(",");
  const neon = nivel === 1;

  return (
    <section aria-labelledby="reco-titulo" className="relative isolate overflow-clip py-24 md:py-32">
      {/* brilhos em degradê ao fundo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="aurora absolute -left-40 top-10 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.12),transparent)]" />
        <div style={{ "--d": "-8s" } as CSSProperties} className="aurora absolute -right-40 bottom-0 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.14),transparent)]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p
            data-reveal
            className="inline-flex items-center gap-2 rounded-full border t-borda t-sup-2 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] t-acento"
          >
            <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
              <span className="anel absolute inset-0 rounded-full bg-current" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            Descubra seu plano
          </p>
          <h2
            id="reco-titulo"
            data-reveal
            style={{ "--i": 1 } as CSSProperties}
            className="mt-5 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight t-txt sm:text-5xl lg:text-6xl"
          >
            Não sabe qual plano escolher?{" "}
            <span className="bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 bg-clip-text text-transparent">A gente te indica o plano certo.</span>
          </h2>
          <p data-reveal style={{ "--i": 2 } as CSSProperties} className="mt-5 text-lg t-txt-3">
            É só responder as 4 perguntas abaixo:
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-12">
          <form
            data-reveal="esq"
            className="flex flex-col divide-y t-divide overflow-hidden rounded-3xl border t-borda t-sup shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:col-span-7"
            onSubmit={(e) => e.preventDefault()}
          >
            {perguntas.map((p, i) => (
              <fieldset key={p.id} style={{ "--d": `${200 + i * 120}ms` } as CSSProperties} className="anima-sobe flex flex-1 flex-col justify-center gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:px-7">
                <legend className="sr-only">{p.texto}</legend>
                <div aria-hidden="true" className="flex items-start gap-3 sm:max-w-[17rem]">
                  <span style={{ "--d": `${350 + i * 120}ms` } as CSSProperties} className="anima-pop flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.5rem] bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 font-mono text-xs font-bold text-white shadow-[0_6px_16px_-6px_rgba(59,130,246,0.8)]">
                    0{i + 1}
                  </span>
                  <p className="pt-1 font-display text-base font-semibold leading-snug t-txt">{p.texto}</p>
                </div>
                <div className={`grid shrink-0 gap-2 sm:w-[19rem] ${p.opcoes.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                  {p.opcoes.map((o, j) => {
                    const marcado = resp[p.id] === j;
                    return (
                      <label
                        key={o.rotulo}
                        className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-2 py-2 text-center text-sm font-semibold leading-tight transition-[transform,box-shadow,color] duration-300 hover:-translate-y-0.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cyan-400 ${
                          marcado
                            ? "bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 text-white shadow-[0_10px_24px_-10px_rgba(59,130,246,0.9)]"
                            : "border t-borda bg-[color:var(--t-fundo)] t-txt-2 t-hover-txt"
                        }`}
                      >
                        <input
                          type="radio"
                          name={p.id}
                          value={j}
                          checked={marcado}
                          onChange={() => setResp((r) => ({ ...r, [p.id]: j }))}
                          className="sr-only"
                        />
                        {o.rotulo}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </form>

          {/* Resultado com as cores do plano indicado */}
          <div data-reveal="dir" style={{ "--i": 2 } as CSSProperties} className="lg:col-span-5">
            <div className="flutua-leve relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] opacity-70 transition-[background] duration-500"
                style={{ background: `radial-gradient(closest-side, ${t.halo}, transparent)` }}
              />
              <div aria-live="polite" className={`group relative rounded-3xl ${neon || t.borda ? "p-[2px]" : "p-px"}`}>
                {neon ? (
                  <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-3xl bg-brand-600/40">
                    <span className="neon-giro absolute left-1/2 top-1/2 aspect-square w-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,#2563EB_30deg,#7DD3FC_70deg,transparent_120deg,transparent_180deg,#2563EB_210deg,#7DD3FC_250deg,transparent_300deg)]" />
                  </span>
                ) : (
                  <span aria-hidden="true" className={`absolute inset-0 overflow-hidden rounded-3xl ${t.borda}`}>
                    {t.rotulo && <span className="reflexo absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent" />}
                  </span>
                )}
                <div className={`relative overflow-hidden rounded-[calc(1.5rem-2px)] p-6 text-white sm:p-8 ${t.fundo}`}>
                  <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${t.luz} to-transparent`} />
                  <span aria-hidden="true" className={`absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent ${t.linha} to-transparent`} />
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                    <span className="reflexo-auto absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
                  </span>

                  <div className="relative flex items-center justify-between gap-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-300">Plano indicado para você</p>
                    {t.rotulo && <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${t.selo}`}>{t.rotulo}</span>}
                  </div>

                  <div key={plano.nome} className="anim-entrar relative">
                    <p className="mt-5 break-words font-display text-[2rem] font-bold leading-tight sm:text-4xl">{plano.nome}</p>
                    <p className="mt-3 flex items-start gap-1 leading-none">
                      <span className="mt-1.5 text-sm font-semibold text-slate-400">R$</span>
                      <span key={inteiro} className={`preco-pula font-display text-5xl font-bold tracking-tight ${t.preco}`}>
                        {inteiro}
                      </span>
                      <span className={`mt-1 font-display text-lg font-bold ${t.centavos}`}>,{centavos}</span>
                      <span className="ml-1 self-end pb-1 text-sm text-slate-400">/mês</span>
                    </p>

                    <ul className="mt-7 space-y-3">
                      {plano.destaque.map((d) => (
                        <li key={d} className="flex items-start gap-3 text-slate-200">
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${t.check}`}>
                            <IconeCheck className="h-3 w-3" />
                          </span>
                          {d}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-8 flex flex-col gap-2">
                      <a
                        href={LINKS.plano(plano.chave)}
                        className={`brilho group/btn inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl font-display text-base font-semibold transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 ${t.botao}`}
                      >
                        Assinar o {plano.nome}
                        <span aria-hidden="true" className="transition-transform duration-300 group-hover/btn:translate-x-1">
                          →
                        </span>
                      </a>
                      <a
                        href={LINKS.testeGratis}
                        className="py-2.5 text-center text-sm font-semibold text-slate-300 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white"
                      >
                        Prefiro testar 24h grátis antes
                      </a>
                    </div>
                  </div>

                  <p className="relative mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-400">
                    Indicação pelos limites de cada plano. Você pode trocar de plano depois.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

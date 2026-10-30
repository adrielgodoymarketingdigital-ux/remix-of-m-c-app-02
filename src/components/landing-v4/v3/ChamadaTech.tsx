import type { CSSProperties } from "react";
import { LINKS } from "../links";
import { Botao } from "../components/Botao";
import { IconeCheck } from "../components/Icones";

// VERSÃO 3 - chamada final: um pedido de ação com as garantias reais (24h Premium grátis e cancelar quando quiser).
const garantias = [
  { titulo: "24h de acesso Premium", texto: "Teste todos os recursos antes de escolher o plano." },
  { titulo: "Cancele quando quiser", texto: "Sem multa, pelo próprio sistema. Seus dados continuam guardados." },
  { titulo: "Sem instalar nada", texto: "Funciona no navegador do computador, do tablet e do celular." },
];

export function ChamadaTech() {
  return (
    <section aria-labelledby="final-titulo" className="relative overflow-hidden py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          data-reveal="zoom"
          className="hud relative overflow-hidden rounded-[2rem] border t-acento-borda t-sup px-4 py-12 min-[360px]:px-6 sm:px-12 md:py-20"
        >
          <div aria-hidden="true" className="fundo-placa pointer-events-none absolute inset-0" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <span className="reflexo-auto absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-cyan-300/[0.06] to-transparent" />
          </span>
          <div
            aria-hidden="true"
            className="anim-flutuar pointer-events-none absolute -right-32 -top-40 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.25),transparent)]"
          />
          <div className="relative grid gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <p className="font-mono text-sm t-acento">{"> pronto para começar"}</p>
              <h2
                id="final-titulo"
                className="mt-4 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight t-txt sm:text-5xl lg:text-6xl"
              >
                Abra a primeira OS <span className="texto-neon">ainda hoje.</span>
              </h2>
              <p className="mt-6 max-w-xl text-lg t-txt-2">
                Crie a conta, cadastre o primeiro aparelho e envie o link de acompanhamento para o seu cliente.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Botao
                  href={LINKS.testeGratis}
                  seta
                  className="w-full shadow-[0_0_0_1px_rgba(103,232,249,0.35),0_18px_40px_-12px_rgba(37,99,235,0.9)] sm:w-auto"
                >
                  Começar teste grátis
                </Botao>
                <a
                  href={LINKS.planos}
                  className="inline-flex h-14 w-full items-center justify-center rounded-xl border t-borda px-7 font-display font-semibold t-txt transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-cyan-300/50 sm:w-auto"
                >
                  Ver planos
                </a>
              </div>
            </div>

            <ul className="grid gap-3 lg:col-span-5">
              {garantias.map((g, i) => (
                <li
                  key={g.titulo}
                  data-reveal="dir"
                  style={{ "--i": i + 2 } as CSSProperties}
                  className="cartao-tech flex gap-4 rounded-2xl border t-borda t-sup-2 p-5"
                >
                  <span className="anima-pop flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 ring-1 ring-emerald-400/30">
                    <IconeCheck className="h-4 w-4 t-ok" />
                  </span>
                  <div>
                    <p className="font-display font-semibold t-txt">{g.titulo}</p>
                    <p className="mt-1 text-sm t-txt-3">{g.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

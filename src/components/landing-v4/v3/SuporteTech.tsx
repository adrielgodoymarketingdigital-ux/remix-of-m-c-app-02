import type { CSSProperties } from "react";
import { LINKS } from "../links";
import { Botao } from "../components/Botao";
import { IconeCheck, IconeX } from "../components/Icones";
import { LogoWhatsApp } from "../components/MensagemWhatsApp";

// VERSÃO 3/4 - Suporte 100% humano (diferencial confirmado pelo Adriel em 2026-10-29).
// Canais por plano tirados de src/types/plano.ts: Básico por e-mail, Intermediário via WhatsApp,
// Profissional (e Ultra, que inclui tudo do Profissional) com suporte prioritário por WhatsApp.
// "Em português" vem da landing atual do MécApp. Central de ajuda e tutoriais existem no app (/ajuda e /tutoriais).
// Sem prazos de resposta e sem horários: não temos esses dados.
const canais = [
  { plano: "Básico", canal: "Por e-mail", destaque: false },
  { plano: "Intermediário", canal: "Pelo WhatsApp", destaque: false },
  { plano: "Profissional e Ultra", canal: "Prioritário no WhatsApp", destaque: true },
];

const robo = ["Menu de opções que não acaba", "Resposta pronta que não resolve", "“Digite 1 para falar com um atendente”"];
const humano = [
  "Uma pessoa lê e responde a sua dúvida",
  "Atendimento em português",
  "Central de ajuda e tutoriais dentro do próprio app",
];

export function SuporteTech() {
  return (
    <section id="suporte" aria-labelledby="suporte-titulo" className="relative overflow-hidden py-24 md:py-32">
      <div aria-hidden="true" className="fundo-placa pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
          <div className="lg:col-span-6">
            <p data-reveal className="font-mono text-sm t-acento">
              {"// suporte"}
            </p>
            <h2
              id="suporte-titulo"
              data-reveal
              style={{ "--i": 1 } as CSSProperties}
              className="mt-4 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight t-txt sm:text-5xl lg:text-6xl"
            >
              Suporte 100% humano. <span className="texto-neon">Nada de robô.</span>
            </h2>
            <p data-reveal style={{ "--i": 2 } as CSSProperties} className="mt-6 max-w-xl text-lg t-txt-2">
              Quando você precisar de ajuda, quem responde é uma pessoa de verdade. Esse é um dos maiores diferenciais do MécApp.
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {canais.map((c, i) => (
                <li
                  key={c.plano}
                  data-reveal="zoom"
                  style={{ "--i": i + 2 } as CSSProperties}
                  className={`cartao-tech rounded-2xl border p-4 ${c.destaque ? "t-acento-borda t-acento-bg" : "t-borda t-sup-2"}`}
                >
                  <p className="font-mono text-xs uppercase tracking-[0.12em] t-txt-3">{c.plano}</p>
                  <p className="mt-2 flex items-start gap-2 font-display font-semibold leading-snug t-txt">
                    {c.canal.includes("WhatsApp") && <LogoWhatsApp className="mt-0.5 h-5 w-5 shrink-0" />}
                    {c.canal}
                  </p>
                </li>
              ))}
            </ul>

            <div data-reveal className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Botao href={LINKS.testeGratis} seta className="w-full sm:w-auto">
                Começar teste grátis
              </Botao>
              <p className="text-sm t-txt-3">24h de acesso Premium grátis · Cancele a qualquer momento</p>
            </div>
          </div>

          {/* Comparativo robô x gente */}
          <div className="grid gap-4 lg:col-span-6">
            <div data-reveal="dir" className="rounded-3xl border t-borda t-sup-2 p-6 sm:p-7">
              <p className="font-mono text-xs uppercase tracking-[0.14em] t-txt-4">Suporte de robô</p>
              <ul className="mt-4 space-y-3">
                {robo.map((t, n) => (
                  <li key={t} className="flex gap-3 t-txt-3">
                    <span style={{ "--d": `${350 + n * 120}ms` } as CSSProperties} className="anima-pop mt-0.5 shrink-0">
                      <IconeX className="h-5 w-5 text-rose-500" />
                    </span>
                    <span className="line-through decoration-rose-400/50">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              data-reveal="dir"
              style={{ "--i": 3 } as CSSProperties}
              className="hud relative overflow-hidden rounded-3xl border t-acento-borda t-sup p-6 shadow-[0_0_80px_-24px_rgba(34,211,238,0.5)] sm:p-7"
            >
              <div className="flex items-center gap-3">
                <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl t-acento-bg ring-1 t-ring-acento">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 t-acento" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" strokeLinecap="round" />
                  </svg>
                  <span className="anim-pulso absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white/80" aria-hidden="true" />
                </span>
                <p className="font-mono text-xs uppercase tracking-[0.14em] t-acento">Suporte do MécApp</p>
              </div>
              <ul className="mt-5 space-y-3">
                {humano.map((t, n) => (
                  <li key={t} className="flex gap-3 font-medium t-txt">
                    <span style={{ "--d": `${450 + n * 120}ms` } as CSSProperties} className="anima-pop mt-1 shrink-0">
                      <IconeCheck className="h-4 w-4 t-ok" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

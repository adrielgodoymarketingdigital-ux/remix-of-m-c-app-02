import type { CSSProperties } from "react";

// Perguntas frequentes: só respostas sustentadas pelo brief, pelos planos (src/types/plano.ts) e pela FAQ atual do MecApp.
// O que não sabemos com certeza ficou de fora ou está marcado [PREENCHER].
const perguntas = [
  {
    p: "Como funciona o teste grátis?",
    r: "Você cria a conta e ganha 24h de acesso Premium para testar todos os recursos. Depois, escolhe o plano que faz sentido para a sua loja.",
  },
  {
    p: "Posso cancelar quando quiser?",
    r: "Sim. Você cancela a qualquer momento pelo próprio sistema, sem multa. Ao cancelar, a conta volta na hora para o plano gratuito e seus dados continuam guardados.",
  },
  {
    p: "Posso mudar de plano depois?",
    r: "Sim. Você pode subir ou descer de plano a qualquer momento. No upgrade, os novos recursos ficam disponíveis na hora.",
  },
  {
    p: "Como o cliente acompanha a OS?",
    r: "Cada OS gera um link de acompanhamento que você envia pelo WhatsApp. O cliente abre no celular e vê a etapa do conserto, sem precisar ligar para a loja.",
  },
  {
    p: "Serve para quem tem mais de uma loja?",
    r: "Sim. O plano Ultra inclui Multi Empresas (até 3 filiais), com faturamento, OS e vendas de cada loja lado a lado.",
  },
  {
    p: "O MécApp emite nota fiscal?",
    r: "Ainda não. A emissão de nota fiscal está em desenvolvimento e vai chegar em breve.",
  },
  {
    p: "Preciso instalar alguma coisa?",
    r: "Não. O MécApp funciona no navegador do computador, do tablet e do celular.",
  },
  {
    p: "Que tipo de suporte eu tenho?",
    r: "O plano Básico tem suporte por e-mail, o Intermediário via WhatsApp e o Profissional tem suporte prioritário por WhatsApp.",
  },
];

export function Perguntas() {
  return (
    <section id="faq" aria-labelledby="faq-titulo" className="bg-slate-50 py-24 md:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <div className="lg:col-span-4">
          <h2
            id="faq-titulo"
            data-reveal
            className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:sticky lg:top-28"
          >
            Perguntas frequentes
          </h2>
        </div>

        <div className="divide-y divide-slate-200 border-y border-slate-200 lg:col-span-8">
          {perguntas.map((q, i) => (
            <details key={q.p} data-reveal style={{ "--i": i % 3 } as CSSProperties} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 font-display text-lg font-semibold text-slate-950 marker:hidden [&::-webkit-details-marker]:hidden">
                {q.p}
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="faq-resposta pb-6 pr-12 text-slate-600">{q.r}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

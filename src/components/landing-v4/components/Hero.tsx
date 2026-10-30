import { forwardRef, type CSSProperties } from "react";
import { LINKS } from "../links";
import { Botao } from "./Botao";
import { IconeCheck } from "./Icones";
import { MensagemWhatsApp } from "./MensagemWhatsApp";
import { Rodizio, type Tela } from "./Rodizio";
import { StatusOS } from "./StatusOS";

// Tela dentro do celular: print REAL da página de acompanhamento da OS (/acompanhar/:token), tirado em
// tamanho de iPhone em 20/10/2026. Nome do cliente e dados da loja foram pixelados.
const TELA_CELULAR = {
  src: "/img/celular-acompanhamento.webp",
  w: 540,
  h: 1169,
  alt: "Página de acompanhamento da OS no celular do cliente: número da OS, status Serviço Finalizado, linha do tempo do reparo, aparelho, problema relatado e data de entrada",
};

// telas: prints do app no celular (já com a barra de status e a "ilha" do iPhone). Com mais de uma, trocam sozinhas.
export function Celular({ prioridade = false, telas }: { prioridade?: boolean; telas?: Tela[] }) {
  if (telas?.length) {
    return (
      <div className="rounded-[2.4rem] bg-slate-900 p-[7px] shadow-2xl shadow-slate-900/30">
        <Rodizio
          telas={telas}
          prioridade={prioridade}
          sizes="(min-width: 640px) 230px, 46vw"
          className="aspect-[9/19] rounded-[2rem] bg-white"
        />
      </div>
    );
  }
  return (
    <div className="rounded-[2.4rem] bg-slate-900 p-[7px] shadow-2xl shadow-slate-900/30">
      <div className="relative aspect-[9/19] overflow-hidden rounded-[2rem] bg-white">
        <span aria-hidden="true" className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-slate-900" />
        <img
          src={TELA_CELULAR.src}
          width={TELA_CELULAR.w}
          height={TELA_CELULAR.h}
          alt={TELA_CELULAR.alt}
          decoding="async"
          fetchPriority={prioridade ? "high" : undefined}
          className="block h-full w-full object-cover object-top"
        />
      </div>
    </div>
  );
}

// Primeiro bloco: título, texto e botão aparecem prontos. Os aparelhos entram, flutuam e têm parallax leve.
export const Hero = forwardRef<HTMLAnchorElement>(function Hero(_, ctaRef) {
  return (
    <section id="topo" className="relative overflow-hidden bg-white pt-20 md:pt-36">
      <div aria-hidden="true" className="fundo-grade pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-48 -top-24 h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.16),transparent)]"
      />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-8">
        <div className="pb-12 lg:col-span-6 lg:pb-28">
          <p
            className="anim-entrar mb-5 hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 sm:inline-flex"
            style={{ "--d": "80ms" } as CSSProperties}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden="true" />
            Para lojas de celular e assistências técnicas
          </p>

          <h1 className="text-balance font-display text-[2.3rem] font-bold leading-[1.04] tracking-tight text-slate-950 sm:text-6xl lg:text-[3.9rem] xl:text-[4.2rem]">
            Você não abriu sua loja para <span className="text-brand-600">trabalhar de graça.</span>
          </h1>

          {/* Só no celular: o aparelho aparece logo abaixo do título, já na primeira tela */}
          <div className="relative -mx-4 mt-6 h-[17.5rem] overflow-hidden border-b border-slate-200 sm:hidden" >
            <div className="absolute left-[12%] top-2 w-[46%]">
              <div className="anim-entrar" style={{ "--d": "120ms" } as CSSProperties}>
                <div className="anim-flutuar-2">
                  <Celular prioridade />
                </div>
              </div>
            </div>
            <div className="absolute right-3 top-10">
              <div className="anim-entrar" style={{ "--d": "350ms" } as CSSProperties}>
                <div className="anim-flutuar-3">
                  <MensagemWhatsApp compacta />
                </div>
              </div>
            </div>
          </div>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Você conserta, vende capa, película, carregador e celular o dia inteiro. Com o MécApp você vê{" "}
            <strong className="font-semibold text-slate-900">quanto entra, quanto sai e quanto sobra</strong>, abre OS com checklist e
            o cliente acompanha o conserto pelo link no WhatsApp.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row">
            <Botao ref={ctaRef} href={LINKS.testeGratis} seta className="w-full sm:w-auto">
              Começar teste grátis
            </Botao>
            <Botao href={LINKS.planos} variante="contorno" className="w-full sm:w-auto">
              Ver planos
            </Botao>
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            {["24h de acesso para testar os principais recursos", "Cancele a qualquer momento"].map((t, n) => (
              <li key={t} className="anim-entrar flex items-center gap-2" style={{ "--d": `${300 + n * 120}ms` } as CSSProperties}>
                <IconeCheck className="h-4 w-4 text-emerald-600" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Tablet e computador: notebook (Multi Empresas) + celular saindo pela base + status da OS + WhatsApp */}
        <div className="relative hidden h-[32rem] sm:block lg:col-span-6 lg:h-auto">
          <div className="parallax-lento absolute left-[10%] top-0 w-[118%] lg:left-[8%] lg:top-4 lg:w-[125%]">
            <div className="anim-entrar-lado">
              <div className="anim-flutuar">
                <div className="rounded-t-2xl border-[9px] border-b-[12px] border-slate-900 bg-slate-900 shadow-2xl shadow-slate-900/25">
                  <img
                    src="/img/hero-estoque-1258.webp"
                    srcSet="/img/hero-estoque-760.webp 760w, /img/hero-estoque-1258.webp 1258w"
                    sizes="(min-width: 1024px) 760px, 110vw"
                    width={1258}
                    height={677}
                    alt="Tela de estoque de dispositivos do MécApp com resumo do estoque (16 itens, custo total, venda total e lucro potencial) e aparelhos com custo, preço de venda e lucro"
                    fetchPriority="high"
                    decoding="async"
                    className="block h-auto w-full rounded-[0.375rem]"
                  />
                </div>
                <div className="mx-auto h-3 w-[112%] -translate-x-[5.4%] rounded-b-2xl bg-gradient-to-b from-slate-300 to-slate-400" />
              </div>
            </div>
          </div>

          <div className="parallax-rapido absolute left-0 top-40 w-[40%] max-w-[250px] lg:-left-6 lg:top-72">
            <div className="anim-entrar" style={{ "--d": "250ms" } as CSSProperties}>
              <div className="anim-flutuar-2">
                <Celular />
              </div>
            </div>
          </div>

          <div className="parallax-lento absolute left-[34%] top-[22rem] lg:left-[30%] lg:top-[27rem]">
            <div className="anim-entrar" style={{ "--d": "550ms" } as CSSProperties}>
              <div className="anim-flutuar-3">
                <MensagemWhatsApp />
              </div>
            </div>
          </div>

          <div className="parallax-lento absolute right-0 top-[52%] lg:-right-4 lg:top-[44%]">
            <div className="anim-entrar" style={{ "--d": "450ms" } as CSSProperties}>
              <div className="anim-flutuar">
                <StatusOS />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

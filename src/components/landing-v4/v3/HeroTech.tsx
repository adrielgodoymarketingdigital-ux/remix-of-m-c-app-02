import { forwardRef, useCallback, useState, type CSSProperties } from "react";
import { LINKS } from "../links";
import { Botao } from "../components/Botao";
import { IconeCheck } from "../components/Icones";
import { type Tela } from "../components/Rodizio";
import { CenaHero, DestaquesHero } from "./CenaHero";

// VERSÃO 3 - primeiro bloco "tecnológico": fundo de placa, rótulo em código com cursor, título centralizado,
// botão com brilho e o print REAL dentro de uma moldura de painel com linha de varredura.
// Painel de dados só com números verdadeiros (brief.md e src/types/plano.ts).
const dados = [
  { valor: "+6 anos", rotulo: "de assistência técnica do fundador" },
  { valor: "24h", rotulo: "de acesso para testar os principais recursos" },
  { valor: "R$ 19,90", rotulo: "por mês no plano Básico" },
  { valor: "3 filiais", rotulo: "no mesmo painel, no plano Ultra" },
];

// Telas do COMPUTADOR que trocam sozinhas no painel (prints reais; nenhum mostra nome ou telefone de cliente).
const dsk = (id: string, rotulo: string, alt: string): Tela => ({
  src: `/img/hero/${id}-1258.webp`,
  srcSet: `/img/hero/${id}-760.webp 760w, /img/hero/${id}-1258.webp 1258w`,
  w: 1258,
  h: 677,
  alt,
  rotulo,
});
const telasComputador: Tela[] = [
  {
    src: "/img/hero-estoque-1258.webp",
    srcSet: "/img/hero-estoque-760.webp 760w, /img/hero-estoque-1258.webp 1258w",
    w: 1258,
    h: 677,
    alt: "Tela de estoque de dispositivos do MécApp com resumo do estoque e aparelhos com custo, preço de venda e lucro",
    rotulo: "estoque",
  },
  dsk("dashboard", "dashboard", "Dashboard do MécApp com faturamento total, lucro líquido, faturamento e lucro de hoje e ordens abertas"),
  dsk("os", "ordens de serviço", "Centro de controle das ordens de serviço no MécApp com os indicadores de cada status"),
  dsk("financeiro", "financeiro", "Financeiro do MécApp com contas a pagar e a receber e análise de lucros e custos"),
  dsk("pdv", "pdv", "PDV do MécApp: frente de caixa com venda avulsa, dados do cliente, itens e resumo da venda"),
  dsk("multiempresas", "multi empresas", "Multi Empresas do MécApp com faturamento total, ordens de serviço e ticket médio de todas as lojas"),
];

// Celular do topo: a página de acompanhamento que o cliente abre pelo link do WhatsApp
// (print do Adriel com dados de clientes pixelados). Fica fixa para a cena fazer sentido:
// mensagem do WhatsApp chega, cliente abre o link, o status muda.
const acompanhamento: Tela = {
  src: "/img/cel/os-acompanhamento-400.webp",
  srcSet: "/img/cel/os-acompanhamento-400.webp 400w, /img/cel/os-acompanhamento.webp 744w",
  w: 400,
  h: 857,
  alt: "Página de acompanhamento da OS no celular do cliente: etapas do reparo, aparelho, problema relatado e fotos do aparelho",
};

export const HeroTech = forwardRef<HTMLAnchorElement>(function HeroTech(_, ctaRef) {
  const [tela, setTela] = useState(0);
  const aoTrocar = useCallback((i: number) => setTela(i), []);
  return (
    <section id="topo" className="relative overflow-hidden pt-24 md:pt-32">
      <div aria-hidden="true" className="fundo-placa pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[44rem] w-[70rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.30),rgba(34,211,238,0.08)_55%,transparent)]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p
            className="anim-entrar inline-flex items-center gap-2 rounded-[0.375rem] border t-acento-borda t-acento-bg px-3 py-1.5 font-mono text-xs t-acento sm:text-sm"
            style={{ "--d": "60ms" } as CSSProperties}
          >
            <span className="anim-pulso h-2 w-2 rounded-full bg-cyan-400" aria-hidden="true" />
            <span className="min-[360px]:hidden">assistência + loja de celular</span>
            <span className="hidden min-[360px]:inline sm:hidden">assistência técnica + loja de celular</span>
            <span className="hidden sm:inline">sistema para assistência técnica e loja de celular</span>
            <span className="cursor-piscando" aria-hidden="true">
              _
            </span>
          </p>

          <h1 className="mx-auto mt-6 max-w-4xl text-balance font-display text-[2.3rem] font-bold leading-[1.04] tracking-tight t-txt sm:text-6xl lg:text-[4.2rem]">
            Você não abriu sua loja para <span className="texto-neon">trabalhar de graça.</span>
          </h1>

          {/* Celular: a mesma cena, montada em pé, logo abaixo do título */}
          <div className="-mx-4 mt-6 text-left sm:hidden">
            <CenaHero
              arranjo="estreito"
              telasComputador={telasComputador}
              acompanhamento={acompanhamento}
              onTroca={aoTrocar}
              rotulo={telasComputador[tela].rotulo ?? ""}
            />
          </div>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed t-txt-2 sm:text-lg">
            Você conserta, vende capa, película, carregador e celular o dia inteiro. Com o MécApp você vê{" "}
            <strong className="font-semibold t-txt">quanto entra, quanto sai e quanto sobra</strong>, abre OS com checklist e o
            cliente acompanha o conserto pelo link no WhatsApp.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Botao
              ref={ctaRef}
              href={LINKS.testeGratis}
              seta
              className="w-full shadow-[0_0_0_1px_rgba(103,232,249,0.35),0_18px_40px_-12px_rgba(37,99,235,0.9)] sm:w-auto"
            >
              Começar teste grátis
            </Botao>
            <a
              href={LINKS.planos}
              className="inline-flex h-14 w-full items-center justify-center rounded-xl border t-borda t-sup-2 px-7 font-display font-semibold t-txt transition-[transform,background-color,border-color] duration-300 hover:-translate-y-0.5 hover:border-cyan-300/50 sm:w-auto"
            >
              Ver planos
            </a>
          </div>

          <ul className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm t-txt-3">
            {["24h de acesso para testar os principais recursos", "Cancele a qualquer momento", "Sem instalar nada"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <IconeCheck className="h-4 w-4 t-acento" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Computador e tablet: cena 3D (painel inclinado, celular na frente, status e WhatsApp) */}
        <div className="relative mx-auto mt-10 hidden max-w-6xl sm:block lg:mt-14">
          <CenaHero telasComputador={telasComputador} acompanhamento={acompanhamento} onTroca={aoTrocar} rotulo={telasComputador[tela].rotulo ?? ""} />
        </div>
        <DestaquesHero className="mx-auto mb-12 mt-10 max-w-5xl sm:mt-6 lg:mb-16" />
      </div>

      {/* Painel de dados verdadeiros */}
      <div className="relative z-10 border-y t-borda t-fundo-2">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 t-divide px-4 sm:px-6 lg:grid-cols-4 lg:divide-x lg:px-8">
          {dados.map((d, i) => (
            <div
              key={d.rotulo}
              className={`anim-entrar py-6 lg:px-8 lg:first:pl-0 ${i % 2 ? "pl-4" : "pr-4"} lg:pr-8`}
              style={{ "--d": `${300 + i * 100}ms` } as CSSProperties}
            >
              <dt className="sr-only">{d.rotulo}</dt>
              <dd>
                <span className="block font-display text-2xl font-bold t-txt sm:text-3xl">{d.valor}</span>
                <span className="mt-1 block font-mono text-xs leading-snug t-txt-3">{d.rotulo}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
});

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { IconeCheck } from "../components/Icones";
import { SeloPlano, type NivelPlano } from "../components/SeloPlano";
import { useTemaClaro } from "../v3/tema";

// Versão 2 - abas por área da loja (ideia da Fone Ninja): o lojista clica na parte dele e vê a tela REAL.
// Prints são os mesmos da versão 1 (dados de clientes pixelados). Selo do plano em cada aba (ideia da ReparoPRO).
type Img = { src: string; w: number; h: number; alt: string; largo?: boolean };
// Print do app no CELULAR (usado só na versão mobile da página, abaixo de 768px). rotulo aparece sob o print no carrossel.
type ImgCelular = { src: string; w: number; h: number; alt: string; rotulo: string };
type Area = {
  id: string;
  aba: string;
  plano: NivelPlano;
  titulo: string;
  pontos: string[];
  imagens: Img[];
  celular: ImgCelular[];
  pontosCelular?: string[]; // texto diferente só no celular
};

// Prints de celular: originais do Adriel (assets/telas-app/brutos/celular), recortados na tela, com nomes, telefone,
// IMEI e o saldo negativo do extrato pixelados (receita-celular.json). Resolução original (744x1594).
const cel = (arquivo: string, alt: string, rotulo: string, w = 744, h = 1594): ImgCelular => ({
  src: `/img/cel/${arquivo}.webp`,
  w,
  h,
  alt,
  rotulo,
});

const areas: Area[] = [
  {
    id: "bancada",
    aba: "Bancada",
    plano: "basico",
    titulo: "Cada aparelho com status, do orçamento à entrega.",
    pontos: [
      "Checklist de entrada em cada OS",
      "Status: aguardando aprovação, em andamento, finalizado, entregue e em garantia",
      "Busca por nome, IMEI, modelo ou número da OS",
    ],
    imagens: [
      { src: "/img/os-contadores.webp", w: 750, h: 210, alt: "Contadores de ordens de serviço do MécApp por status" },
      { src: "/img/os-tabela.webp", w: 945, h: 229, alt: "Lista de ordens de serviço do MécApp com aparelho, datas, serviço e status", largo: true },
    ],
    celular: [
      cel("os-lista", "Lista de ordens de serviço no celular, com número da OS, status, aparelho, defeito e valor", "Ordens de serviço"),
    ],
  },
  {
    id: "cliente",
    aba: "Cliente",
    plano: "intermediario",
    titulo: "O cliente acompanha o conserto pelo link, sem ligar.",
    pontos: [
      "Link de acompanhamento enviado pelo WhatsApp",
      "Linha do tempo com cada etapa do reparo",
      "Assinatura digital do cliente na OS",
    ],
    imagens: [
      {
        src: "/img/acompanhamento-pagina.webp",
        w: 415,
        h: 600,
        alt: "Página de acompanhamento da OS que o cliente recebe, com status e linha do tempo do reparo",
      },
    ],
    celular: [
      cel(
        "os-acompanhamento",
        "Página de acompanhamento da OS no celular do cliente: etapas do reparo, aparelho, problema relatado e fotos do aparelho",
        "Acompanhamento da OS",
      ),
    ],
  },
  {
    id: "balcao",
    aba: "Balcão e estoque",
    plano: "basico",
    titulo: "Cada aparelho com custo, preço de venda e lucro.",
    pontos: [
      "Resumo de quanto você tem parado no estoque",
      "Do estoque para o PDV em 1 toque",
      "Produtos e peças ilimitados para vender no balcão",
    ],
    imagens: [
      { src: "/img/estoque-resumo.webp", w: 930, h: 162, alt: "Resumo do estoque no MécApp: total de itens, custo total e venda total", largo: true },
      {
        src: "/img/estoque-grade.webp",
        w: 940,
        h: 315,
        alt: "Aparelhos no estoque do MécApp com custo, preço de venda, lucro potencial e botão Vender no PDV",
        largo: true,
      },
    ],
    celular: [
      cel("estoque", "Estoque de aparelhos no celular: cada aparelho com custo, preço de venda, lucro e botão Vender no PDV", "Estoque de aparelhos"),
      cel("pdv-1", "PDV no celular: frente de caixa com venda avulsa, fechar caixa, sangria, cliente e itens da venda", "PDV: frente de caixa"),
      cel("pdv-2", "PDV no celular: resumo da venda com subtotal, desconto, total, vendedor e forma de pagamento", "PDV: fechando a venda"),
    ],
  },
  {
    id: "financeiro",
    aba: "Financeiro",
    plano: "intermediario",
    titulo: "O dinheiro da loja como um extrato de banco.",
    pontos: [
      "Contas a pagar e a receber, com o que venceu e o que atrasou",
      "Lucro bruto e lucro líquido do período",
      "Entradas e saídas dia a dia",
    ],
    imagens: [
      // extrato completo (saldo pixelado), o mesmo print da página de funcionalidades
      {
        src: "/img/func/pc-extrato.webp",
        w: 1260,
        h: 673,
        alt: "Extrato da loja no MécApp com saldo, entradas, saídas, filtros por período e a lista de movimentações",
        largo: true,
      },
      { src: "/img/financeiro-contas.webp", w: 880, h: 83, alt: "Resumo de contas a pagar e a receber no MécApp", largo: true },
      { src: "/img/financeiro-lucros.webp", w: 880, h: 83, alt: "Análise de lucros no MécApp: faturado, custos, lucro bruto e líquido", largo: true },
    ],
    celular: [
      cel("extrato", "Extrato no celular: entradas e saídas do período e cada movimentação do caixa", "Extrato"),
      cel(
        "vendas-a-receber",
        "Vendas a receber no celular: total a receber, vendas vencidas, vencendo em 3 dias e lista de vendas pendentes",
        "Vendas a receber",
        740,
        1586,
      ),
      cel(
        "contas",
        "Contas a pagar e a receber no celular: total a pagar, a receber, pago, recebido e contas vencidas",
        "Contas a pagar e a receber",
        851,
        1848,
      ),
    ],
    pontosCelular: [
      "Extrato com tudo o que entrou e saiu, dia a dia",
      "Vendas a receber: quanto falta entrar, o que já venceu e o que vence nos próximos dias",
      "Contas a pagar e a receber do período, com as vencidas em destaque",
    ],
  },
  {
    id: "filiais",
    aba: "Várias lojas",
    plano: "ultra",
    titulo: "Matriz e filiais lado a lado, com um clique para entrar em cada uma.",
    pontos: ["Faturamento, OS e vendas de cada loja", "Ticket médio por loja", "Até 3 filiais no plano Ultra"],
    imagens: [
      {
        src: "/img/multi-empresas-filiais.webp",
        w: 820,
        h: 500,
        alt: "Tela Multi Empresas do MécApp com a Matriz e uma filial lado a lado",
      },
    ],
    celular: [
      cel(
        "multiempresas",
        "Multi Empresas no celular: faturamento da matriz, total de OS, vendas, ticket médio e meta de faturamento",
        "Multi Empresas",
        740,
        1586,
      ),
    ],
  },
];

// Moldura de iPhone feita em CSS. A tela é o print recortado; os cantos arredondados escondem a borda preta do original.
// Largura: 74% da tela do celular, no máximo 300px (legível sem ficar gigante).
function PrintCelular({ img, prioridade = false }: { img: ImgCelular; prioridade?: boolean }) {
  return (
    <div
      className="mx-auto w-[74vw] max-w-[300px] bg-slate-900 p-[5px] shadow-[0_24px_50px_-20px_rgba(15,23,42,0.55)] ring-1 ring-white/10"
      style={{ borderRadius: "22% / 10.4%" }}
    >
      <div className="overflow-hidden bg-white" style={{ borderRadius: "20.5% / 9.6%" }}>
        <img
          src={img.src}
          width={img.w}
          height={img.h}
          alt={img.alt}
          loading={prioridade ? "eager" : "lazy"}
          decoding="async"
          sizes="300px"
          className="block h-auto w-full"
        />
      </div>
    </div>
  );
}

// Carrossel de prints no celular: arrasta com o dedo (scroll-snap), bolinhas mostram e escolhem o print.
function CarrosselCelular({ imagens, nome, tech }: { imagens: ImgCelular[]; nome: string; tech: boolean }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);
  const quadro = useRef(0);

  function aoRolar() {
    if (quadro.current) return;
    quadro.current = requestAnimationFrame(() => {
      quadro.current = 0;
      const t = trilho.current;
      if (!t) return;
      const slides = [...t.children] as HTMLElement[];
      const centro = t.scrollLeft + t.clientWidth / 2;
      let melhor = 0;
      slides.forEach((s, i) => {
        if (Math.abs(s.offsetLeft + s.offsetWidth / 2 - centro) < Math.abs(slides[melhor].offsetLeft + slides[melhor].offsetWidth / 2 - centro)) melhor = i;
      });
      setAtual(melhor);
    });
  }

  function ir(i: number) {
    const t = trilho.current;
    const s = t?.children[i] as HTMLElement | undefined;
    if (!t || !s) return;
    t.scrollTo({ left: s.offsetLeft - (t.clientWidth - s.offsetWidth) / 2, behavior: "smooth" });
  }

  return (
    <div>
      <div
        ref={trilho}
        onScroll={aoRolar}
        tabIndex={0}
        role="region"
        aria-roledescription="carrossel"
        aria-label={`Prints de ${nome} no celular (arraste para o lado)`}
        className="-mx-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[calc(50%_-_min(37vw,150px))] pb-2 pt-1 [scrollbar-width:none] sm:-mx-5"
      >
        {imagens.map((img, i) => (
          <figure
            key={img.src}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${imagens.length}: ${img.rotulo}`}
            className="shrink-0 snap-center"
          >
            <PrintCelular img={img} />
            <figcaption className={`mt-3 text-center font-mono text-xs ${tech ? "t-txt-3" : "text-slate-500"}`}>{img.rotulo}</figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-1" role="group" aria-label={`Escolher print de ${nome}`}>
        {imagens.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => ir(i)}
            aria-label={`Ver ${img.rotulo}`}
            aria-current={i === atual}
            className="flex h-11 w-9 items-center justify-center"
          >
            <span
              className={`block h-1.5 w-6 origin-center rounded-full transition-[transform,background-color] duration-500 ${
                i === atual ? (tech ? "scale-x-100 bg-cyan-400" : "scale-x-100 bg-brand-600") : "scale-x-50 bg-slate-400/60"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// tech: visual escuro da versão 3 (mesmos dados e prints)
export function Areas({ tech = false }: { tech?: boolean }) {
  const claro = useTemaClaro();
  const [ativa, setAtiva] = useState(0);
  const abas = useRef<(HTMLButtonElement | null)[]>([]);
  const area = areas[ativa];

  // Setas do teclado trocam de aba (padrão de abas acessíveis)
  function teclas(e: KeyboardEvent) {
    const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const nova = (ativa + passo + areas.length) % areas.length;
    setAtiva(nova);
    abas.current[nova]?.focus();
  }

  return (
    <section id="recursos" aria-labelledby="areas-titulo" className={`py-24 md:py-32 ${tech ? "" : "bg-slate-50"}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p
            data-reveal
            className={tech ? "font-mono text-sm t-acento" : "text-sm font-semibold uppercase tracking-[0.14em] text-brand-600"}
          >
            {tech ? "// telas reais do sistema" : "Telas reais do sistema"}
          </p>
          <h2
            id="areas-titulo"
            data-reveal
            style={{ "--i": 1 } as CSSProperties}
            className={`mt-4 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl ${tech ? "t-txt" : "text-slate-950"}`}
          >
            Uma tela para cada parte da sua loja.
          </h2>
          <p data-reveal style={{ "--i": 2 } as CSSProperties} className={`mt-4 text-lg ${tech ? "t-txt-3" : "text-slate-600"}`}>
            Escolha a tela que quer ver.
          </p>
        </div>

        <div
          data-reveal
          style={{ "--i": 2 } as CSSProperties}
          className="-mx-4 mt-10 flex gap-2 overflow-x-auto px-4 pb-2 [mask-image:linear-gradient(to_right,#000_78%,transparent)] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:[mask-image:none]"
        >
        <div role="tablist" aria-label="Áreas da loja" onKeyDown={teclas} className="flex shrink-0 gap-2 sm:flex-wrap sm:justify-center">
          {areas.map((a, i) => {
            const sel = i === ativa;
            return (
              <button
                key={a.id}
                ref={(el) => (abas.current[i] = el)}
                type="button"
                role="tab"
                id={`aba-${a.id}`}
                aria-selected={sel}
                aria-controls={`painel-${a.id}`}
                tabIndex={sel ? 0 : -1}
                onClick={() => setAtiva(i)}
                className={`shrink-0 rounded-xl px-5 py-3 font-display text-sm font-semibold transition-[transform,background-color,color,box-shadow] duration-300 hover:-translate-y-0.5 sm:text-base ${
                  sel
                    ? tech
                      ? "t-acento-bg t-acento ring-1 t-ring-acento shadow-[0_0_24px_-6px_rgba(34,211,238,0.7)]"
                      : "bg-brand-600 text-white shadow-[0_12px_24px_-12px_rgba(37,99,235,0.9)]"
                    : tech
                      ? "t-sup-2 t-txt-2 ring-1 t-ring t-hover-txt"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:text-slate-950"
                }`}
              >
                {a.aba}
              </button>
            );
          })}
        </div>
          {/* Link para a página com todas as funcionalidades (só nas versões tech: /v3/ e /v4/) */}
          {tech && (
            <a
              href="funcionalidades/"
              className="group inline-flex shrink-0 items-center gap-2 rounded-xl border border-dashed t-acento-borda px-5 py-3 font-display text-sm font-semibold t-acento transition-[transform,background-color] duration-300 hover:-translate-y-0.5 hover:bg-cyan-400/10 sm:text-base"
            >
              Mais funcionalidades
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </a>
          )}
        </div>

        <div
          key={area.id}
          role="tabpanel"
          id={`painel-${area.id}`}
          aria-labelledby={`aba-${area.id}`}
          className={`anim-entrar mt-8 grid grid-cols-1 gap-8 rounded-[2rem] p-5 sm:p-8 lg:grid-cols-12 lg:items-center lg:gap-10 lg:p-10 ${
            tech ? "hud border t-borda t-sup" : "bg-white ring-1 ring-slate-200"
          }`}
        >
          <div className="min-w-0 lg:col-span-4">
            <SeloPlano nivel={area.plano} escuro={tech && !claro} />
            <h3 className={`mt-4 font-display text-2xl font-semibold leading-tight sm:text-3xl ${tech ? "t-txt" : "text-slate-950"}`}>
              {area.titulo}
            </h3>
            {[
              { lista: area.pontosCelular ?? area.pontos, classe: "md:hidden" },
              { lista: area.pontos, classe: "hidden md:block" },
            ]
              .filter((v, i) => i === 0 || area.pontosCelular)
              .map((v, i) => (
                <ul key={i} className={`mt-6 space-y-3 ${area.pontosCelular ? v.classe : ""}`}>
                  {v.lista.map((p) => (
                    <li key={p} className={`flex gap-3 ${tech ? "t-txt-2" : "text-slate-700"}`}>
                      <IconeCheck className={`mt-1 h-4 w-4 shrink-0 ${tech ? "t-acento" : "text-brand-600"}`} />
                      {p}
                    </li>
                  ))}
                </ul>
              ))}
          </div>

          <div className="min-w-0 lg:col-span-8">
            {/* CELULAR (abaixo de 768px): print do app em moldura de iPhone; 2 ou mais viram carrossel */}
            <div
              className={`rounded-3xl px-3 py-6 md:hidden ${
                tech
                  ? "bg-gradient-to-b from-cyan-400/15 via-brand-600/10 to-transparent ring-1 ring-cyan-400/20"
                  : "bg-gradient-to-b from-brand-100 via-brand-50 to-white ring-1 ring-brand-100"
              }`}
            >
              {area.celular.length > 1 ? (
                <CarrosselCelular imagens={area.celular} nome={area.aba} tech={tech} />
              ) : (
                <figure>
                  <PrintCelular img={area.celular[0]} />
                  <figcaption className={`mt-3 text-center font-mono text-xs ${tech ? "t-txt-3" : "text-slate-500"}`}>
                    {area.celular[0].rotulo}
                  </figcaption>
                </figure>
              )}
            </div>

            {/* COMPUTADOR E TABLET (768px ou mais): prints largos de sempre */}
            <div
              className={`hidden flex-col gap-3 rounded-3xl p-3 sm:p-5 md:flex ${
                tech
                  ? "bg-gradient-to-br from-cyan-400/15 via-brand-600/10 to-transparent ring-1 ring-cyan-400/20 shadow-[0_0_60px_-20px_rgba(34,211,238,0.4)]"
                  : "bg-gradient-to-br from-brand-100 via-brand-50 to-white ring-1 ring-brand-100"
              }`}
            >
              {area.imagens.map((img) => (
                <div key={img.src} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
                  <img
                    src={img.src}
                    width={img.w}
                    height={img.h}
                    alt={img.alt}
                    loading="lazy"
                    decoding="async"
                    className={`block h-auto w-full ${img.h > img.w ? "mx-auto md:w-auto md:max-h-[34rem]" : ""}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

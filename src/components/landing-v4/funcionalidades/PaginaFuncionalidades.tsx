import { useEffect, useRef, useState } from "react";
import { LINKS } from "../links";
import { Botao } from "../components/Botao";
import { IconeCheck } from "../components/Icones";
import { Menu } from "../components/Menu";
import { Rodape } from "../components/Rodape";
import { SeloPlano } from "../components/SeloPlano";
import { useReveal, useRolagemCSS } from "../hooks/useReveal";
import { TemaClaro } from "../v3/tema";
import { grupos, type Funcionalidade, type Img } from "./dados";

// Página /v3/funcionalidades/ (escura) e /v4/funcionalidades/ (clara): todas as funcionalidades do MécApp
// numa tela só, enxuta (pedido do Adriel: sem monte de card, sem rolar várias telas, sem poluição).
// Áreas em grade de botões (celular) ou linha (computador). Funções: lista no computador; no celular, um botão que abre a lista,
// as setas e arrastar a tela para o lado.
// Só UMA tela real aparece por vez, com o selo do plano, o texto e o botão de teste grátis.
// Endereço com #id (ex.: #fidelidade) abre direto a funcionalidade.

const total = grupos.reduce((n, g) => n + g.itens.length, 0);
const planos = "/#planos";

// Mesmo ponto de quebra do "md:" do Tailwind (768px): acima dele aparece a tela do computador, abaixo a do celular.
const TELA_GRANDE = "(min-width: 768px)";

// Só a tela que está visível carrega na hora (sem lazy); a que fica escondida (display: none) usa
// loading="lazy" e o navegador nem baixa. As duas têm width/height, então não há pulo de layout.
function useTelaGrande() {
  const [grande, setGrande] = useState(() => typeof window !== "undefined" && window.matchMedia(TELA_GRANDE).matches);
  useEffect(() => {
    const mq = window.matchMedia(TELA_GRANDE);
    const mudar = () => setGrande(mq.matches);
    mq.addEventListener("change", mudar);
    return () => mq.removeEventListener("change", mudar);
  }, []);
  return grande;
}

type Carregamento = "eager" | "lazy";

function MolduraCelular({ img, altura, carregamento }: { img: Img; altura: string; carregamento: Carregamento }) {
  // largura calculada pela altura máxima, para a tela caber sem rolar
  return (
    <div
      className="mx-auto bg-slate-900 p-[4px] shadow-[0_20px_40px_-20px_rgba(15,23,42,0.55)] ring-1 ring-white/10"
      style={{ borderRadius: "22% / 10.4%", width: `min(100%, calc(${altura} * ${img.w / img.h}))` }}
    >
      <div className="overflow-hidden bg-white" style={{ borderRadius: "20.5% / 9.6%" }}>
        <img src={img.src} width={img.w} height={img.h} alt={img.alt} loading={carregamento} decoding="async" className="block h-auto w-full" />
      </div>
    </div>
  );
}

function MolduraComputador({ img, altura, carregamento }: { img: Img; altura: string; carregamento: Carregamento }) {
  return (
    <div
      className="mx-auto overflow-hidden rounded-xl border t-borda t-sup shadow-[0_20px_40px_-24px_rgba(15,23,42,0.45)]"
      style={{ width: `min(100%, calc(${altura} * ${img.w / img.h}))` }}
    >
      <div className="flex items-center gap-1.5 border-b t-borda px-3 py-2" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-rose-400/70" />
        <span className="h-2 w-2 rounded-full bg-amber-300/70" />
        <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
      </div>
      <img src={img.src} width={img.w} height={img.h} alt={img.alt} loading={carregamento} decoding="async" className="block h-auto w-full bg-white" />
    </div>
  );
}

function Tela({
  f,
  img,
  altura,
  abrir,
  carregamento,
  className = "",
}: {
  f: Funcionalidade;
  img: Img;
  altura: string;
  abrir: (i: Img) => void;
  carregamento: Carregamento;
  className?: string;
}) {
  return (
    <button
      type="button"
      key={img.src}
      onClick={() => abrir(img)}
      aria-label={`Ampliar: ${img.alt}`}
      className={`anim-entrar w-full cursor-zoom-in ${className}`}
    >
      {img === f.cel ? (
        <MolduraCelular img={img} altura={altura} carregamento={carregamento} />
      ) : (
        <MolduraComputador img={img} altura={altura} carregamento={carregamento} />
      )}
    </button>
  );
}

function SemTela({ f, className = "" }: { f: Funcionalidade; className?: string }) {
  return (
    <div className={`w-full flex-col items-center justify-center rounded-2xl border border-dashed t-borda p-8 text-center ${className}`}>
      <p className="font-display text-lg font-semibold t-txt">{f.nome}</p>
      <p className="mt-2 text-sm t-txt-3">{f.emBreve ? "Em breve no MécApp." : "Teste grátis e veja essa tela por dentro."}</p>
    </div>
  );
}

export default function PaginaFuncionalidades({ claro = false }: { claro?: boolean }) {
  useReveal();
  useRolagemCSS();
  const escuro = !claro;
  const dialogo = useRef<HTMLDialogElement>(null);
  const painel = useRef<HTMLElement>(null);
  const seletor = useRef<HTMLDivElement>(null);
  const [lista, setLista] = useState(false);
  const [aberta, setAberta] = useState<Img | null>(null);
  const [grupoId, setGrupoId] = useState(grupos[0].id);
  // funcionalidade escolhida em cada área (começa na primeira)
  const [escolhida, setEscolhida] = useState<Record<string, string>>(() => Object.fromEntries(grupos.map((g) => [g.id, g.itens[0].id])));

  const grupo = grupos.find((g) => g.id === grupoId) ?? grupos[0];
  const f = grupo.itens.find((i) => i.id === escolhida[grupo.id]) ?? grupo.itens[0];
  const imgPc = f.pc ?? f.cel;
  const telaGrande = useTelaGrande();
  const imgCel = f.cel ?? f.pc;
  const pos = grupo.itens.indexOf(f);

  function abrir(img: Img) {
    setAberta(img);
    dialogo.current?.showModal();
  }

  function escolher(id: string) {
    setEscolhida((e) => ({ ...e, [grupo.id]: id }));
  }

  function passo(d: number) {
    const n = grupo.itens.length;
    escolher(grupo.itens[(pos + d + n) % n].id);
  }

  // no celular, a lista de funções fecha ao trocar de área ou ao tocar fora dela
  useEffect(() => setLista(false), [grupo.id]);
  useEffect(() => {
    if (!lista) return;
    const fora = (e: PointerEvent) => !seletor.current?.contains(e.target as Node) && setLista(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setLista(false);
    addEventListener("pointerdown", fora);
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("pointerdown", fora);
      removeEventListener("keydown", esc);
    };
  }, [lista]);

  // arrastar a tela para o lado troca de função (celular)
  const toque = useRef<number | null>(null);

  // #id no endereço abre a área e a funcionalidade
  useEffect(() => {
    const ir = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const g = id && grupos.find((x) => x.id === id || x.itens.some((i) => i.id === id));
      if (!g) return;
      setGrupoId(g.id);
      const item = g.itens.find((i) => i.id === id)?.id ?? g.itens[0].id;
      setEscolhida((e) => ({ ...e, [g.id]: item }));
      requestAnimationFrame(() => painel.current?.scrollIntoView({ block: "start" }));
    };
    ir();
    addEventListener("hashchange", ir);
    return () => removeEventListener("hashchange", ir);
  }, []);

  return (
    <TemaClaro.Provider value={claro}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[0.5rem] focus:bg-cyan-300 focus:px-4 focus:py-2 focus:text-slate-950"
      >
        Pular para o conteúdo
      </a>
      <Menu tech={escuro} prefixo="/" funcionalidades="/funcionalidades" />
      <main id="conteudo">
        <section ref={painel} id="painel" aria-labelledby="func-titulo" className="relative overflow-hidden pb-14 pt-24 md:pb-16 md:pt-24">
          <div aria-hidden="true" className="fundo-placa pointer-events-none absolute inset-0" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.2),rgba(34,211,238,0.05)_55%,transparent)]"
          />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            {/* Título em uma linha de leitura */}
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <a href="/" className="inline-flex items-center gap-2 py-1 text-sm font-semibold t-acento hover:underline">
                  <span aria-hidden="true">←</span> Página inicial
                </a>
                <h1 id="func-titulo" className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight t-txt sm:text-4xl">
                  Tudo o que o MécApp faz <span className="texto-neon">pela sua loja.</span>
                </h1>
              </div>
              <p className="font-mono text-xs t-txt-3 md:pb-1.5">{`// ${total} funcionalidades · telas reais`}</p>
            </div>

            {/* Áreas: grade de 5 botões no celular (tudo visível, sem rolar para o lado), linha no computador */}
            <div role="tablist" aria-label="Áreas" className="mt-6 grid grid-cols-6 gap-2 md:flex md:flex-wrap md:gap-1.5">
              {grupos.map((g, n) => {
                const ativo = g.id === grupo.id;
                return (
                  <button
                    key={g.id}
                    id={`aba-${g.id}`}
                    role="tab"
                    type="button"
                    aria-selected={ativo}
                    aria-controls="area"
                    onClick={() => setGrupoId(g.id)}
                    className={`${n < 3 ? "col-span-2" : "col-span-3"} min-h-11 rounded-xl border px-2 py-2 text-[13px] font-semibold leading-tight transition-colors duration-300 md:min-h-0 md:rounded-full md:px-4 md:text-sm ${
                      ativo ? "border-cyan-400 bg-cyan-400 text-slate-950" : "t-borda t-sup-2 t-txt-2 t-hover-txt md:border-transparent md:bg-transparent"
                    }`}
                  >
                    <span className="md:hidden">{g.curto}</span>
                    <span className="hidden md:inline">{g.titulo}</span>
                  </button>
                );
              })}
            </div>

            <div id="area" role="tabpanel" aria-labelledby={`aba-${grupo.id}`} className="mt-5 border-t t-borda pt-5 md:grid md:grid-cols-12 md:gap-8 md:pt-8">
              {/* Celular: um botão que abre a lista de funções da área */}
              <div ref={seletor} className="relative z-20 md:hidden">
                <button
                  type="button"
                  aria-expanded={lista}
                  aria-controls="lista-funcoes"
                  onClick={() => setLista((v) => !v)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border t-acento-borda t-acento-bg px-4 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[11px] t-txt-3">{`função ${pos + 1} de ${grupo.itens.length} · toque para trocar`}</span>
                    <span className="mt-0.5 block truncate font-display font-semibold t-txt">{f.nome}</span>
                  </span>
                  <svg
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    className={`h-5 w-5 shrink-0 t-acento transition-transform duration-300 ${lista ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {lista && (
                  <ul
                    id="lista-funcoes"
                    className="anim-entrar absolute inset-x-0 top-full mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border t-borda t-sup p-1.5 shadow-2xl shadow-slate-950/30"
                  >
                    {grupo.itens.map((i) => {
                      const ativo = i.id === f.id;
                      return (
                        <li key={i.id}>
                          <button
                            type="button"
                            aria-current={ativo}
                            onClick={() => {
                              escolher(i.id);
                              setLista(false);
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-[15px] ${ativo ? "t-acento-bg font-semibold t-txt" : "t-txt-2"}`}
                          >
                            {i.nome}
                            {ativo && <IconeCheck className="h-4 w-4 shrink-0 t-acento" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Computador: lista simples de nomes */}
              <div className="hidden md:col-span-4 md:block md:space-y-0.5 lg:col-span-3">
                {grupo.itens.map((i) => {
                  const ativo = i.id === f.id;
                  return (
                    <button
                      key={i.id}
                      data-id={i.id}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => escolher(i.id)}
                      className={`block w-full border-l-2 px-3 py-1.5 text-left text-sm transition-colors duration-300 ${
                        ativo ? "t-acento-borda t-acento-bg font-semibold t-txt" : "border-transparent t-txt-3 t-hover-txt"
                      }`}
                    >
                      {i.nome}
                    </button>
                  );
                })}
              </div>

              {/* Uma tela por vez + texto + ação */}
              <div className="mt-5 md:col-span-8 md:mt-0 lg:col-span-9">
                <div
                  className="relative flex touch-pan-y items-center justify-center rounded-3xl bg-gradient-to-b from-cyan-400/10 to-transparent px-12 py-4 sm:p-6 md:px-14"
                  onTouchStart={(e) => (toque.current = e.touches[0].clientX)}
                  onTouchEnd={(e) => {
                    const dx = e.changedTouches[0].clientX - (toque.current ?? e.changedTouches[0].clientX);
                    toque.current = null;
                    if (Math.abs(dx) > 50) passo(dx < 0 ? 1 : -1);
                  }}
                >
                  {imgCel ? <Tela f={f} img={imgCel} altura="min(22rem, 46vh)" abrir={abrir} carregamento={telaGrande ? "lazy" : "eager"} className="block md:hidden" /> : <SemTela f={f} className="flex min-h-[12rem] md:hidden" />}
                  {imgPc ? <Tela f={f} img={imgPc} altura="min(24rem, 46vh)" abrir={abrir} carregamento={telaGrande ? "eager" : "lazy"} className="hidden md:block" /> : <SemTela f={f} className="hidden min-h-[20rem] md:flex" />}
                  {/* anterior / próxima */}
                  <div className="absolute inset-x-1 top-1/2 flex -translate-y-1/2 justify-between sm:inset-x-2">
                    {[
                      [-1, "Funcionalidade anterior", "‹"],
                      [1, "Próxima funcionalidade", "›"],
                    ].map(([d, rotulo, seta]) => (
                      <button
                        key={rotulo as string}
                        type="button"
                        onClick={() => passo(d as number)}
                        aria-label={rotulo as string}
                        className="flex h-10 w-10 items-center justify-center rounded-full border t-borda t-sup text-xl t-txt-2 shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] transition-transform duration-300 hover:scale-105"
                      >
                        {seta}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div key={f.id} className="anim-entrar min-w-0 lg:max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl font-semibold t-txt">{f.nome}</h2>
                      {f.plano && <SeloPlano nivel={f.plano} escuro={escuro} />}
                      {f.emBreve && (
                        <span className="rounded-[0.375rem] border t-borda px-2 py-0.5 text-xs font-bold uppercase tracking-wider t-txt-2">Em breve</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed t-txt-2 sm:text-base">{f.texto}</p>
                    {f.limite && <p className="mt-1.5 font-mono text-xs leading-relaxed t-txt-3">{f.limite}</p>}
                  </div>
                  <div className="shrink-0">
                    <Botao href={LINKS.testeGratis} seta className="w-full lg:w-auto">
                      Começar teste grátis
                    </Botao>
                    <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs t-txt-3 lg:justify-start">
                      <span className="inline-flex items-center gap-1">
                        <IconeCheck className="h-3.5 w-3.5 t-acento" /> 24h de acesso para testar os principais recursos
                      </span>
                      <a href={planos} className="font-semibold t-acento hover:underline">
                        Ver planos →
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className={claro ? "" : "escuro-auto"}>
          <Rodape prefixo="/" />
        </div>
      </main>

      {/* Imagem ampliada */}
      <dialog
        ref={dialogo}
        onClose={() => setAberta(null)}
        onClick={(e) => e.target === dialogo.current && dialogo.current?.close()}
        aria-label={aberta?.alt}
        className="m-auto max-h-[94vh] w-[min(96vw,1300px)] overflow-auto rounded-2xl bg-transparent p-0 backdrop:bg-slate-950/80"
      >
        {aberta && (
          <div className="relative">
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="sticky left-full top-2 z-10 mr-2 mt-2 flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/90 text-xl text-white ring-1 ring-white/20"
              aria-label="Fechar"
            >
              ×
            </button>
            <img
              src={aberta.src}
              width={aberta.w}
              height={aberta.h}
              alt={aberta.alt}
              className={`-mt-[3.25rem] block h-auto rounded-2xl bg-white ${aberta.h > aberta.w ? "mx-auto w-auto max-h-[92vh]" : "w-full"}`}
            />
          </div>
        )}
      </dialog>
    </TemaClaro.Provider>
  );
}

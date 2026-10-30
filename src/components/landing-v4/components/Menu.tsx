import { useEffect, useState } from "react";
import { LINKS } from "../links";
import { Botao } from "./Botao";
import { IconeMenu } from "./Icones";

const itens = [
  { href: LINKS.recursos, texto: "Recursos" },
  { href: LINKS.planos, texto: "Planos" },
  { href: LINKS.faq, texto: "Dúvidas" },
];

export function Marca({ claro = false, href = "#topo" }: { claro?: boolean; href?: string }) {
  return (
    <a href={href} className="-my-1.5 flex items-center gap-2.5 py-1.5" aria-label="MécApp, voltar ao início">
      <img src="/img/mecapp-icone.webp" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
      <span className={`font-display text-lg font-bold tracking-tight transition-colors duration-300 ${claro ? "text-white" : "text-slate-950"}`}>
        MécApp
      </span>
    </a>
  );
}

// escuro: o menu começa transparente sobre um primeiro bloco escuro (versão 2), com texto claro.
// tech: página toda escura (versão 3); ao rolar, o menu fica escuro em vez de branco.
// funcionalidades: endereço da página de funcionalidades (só v3/v4 têm); quando vem, o item aparece no menu.
// prefixo: em subpáginas (ex.: /v4/funcionalidades/) os links de âncora voltam para a página principal ("../").
export function Menu({
  escuro = false,
  tech = false,
  prefixo = "",
  funcionalidades,
}: {
  escuro?: boolean;
  tech?: boolean;
  prefixo?: string;
  funcionalidades?: string;
}) {
  const links = [
    { href: prefixo + itens[0].href, texto: itens[0].texto },
    ...(funcionalidades ? [{ href: funcionalidades, texto: "Funcionalidades" }] : []),
    ...itens.slice(1).map((i) => ({ href: prefixo + i.href, texto: i.texto })),
  ];
  const [rolou, setRolou] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 8);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  const solido = rolou || aberto;
  const claro = tech || (escuro && !solido);
  const corLink = claro ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-950";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solido
          ? tech
            ? "border-b border-white/10 bg-[#05070d]/95"
            : "border-b border-slate-200 bg-white/95"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div aria-hidden="true" className="barra-progresso absolute inset-x-0 top-0 h-0.5 bg-brand-600" />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Marca claro={claro} href={prefixo ? prefixo : "#topo"} />

        <nav aria-label="Principal" className="hidden items-center gap-8 md:flex">
          {links.map((i) => (
            <a
              key={i.href}
              href={i.href}
              className={`relative text-sm font-medium transition-colors duration-300 after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-brand-600 after:transition-transform after:duration-300 hover:after:scale-x-100 ${corLink}`}
            >
              {i.texto}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-5 md:flex">
          <a href={LINKS.entrar} className={`text-sm font-medium transition-colors duration-300 ${corLink}`}>
            Entrar
          </a>
          <Botao href={LINKS.testeGratis} tamanho="md">
            Teste grátis
          </Botao>
        </div>

        <button
          type="button"
          className={`-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg md:hidden ${claro ? "text-white" : "text-slate-950"}`}
          aria-expanded={aberto}
          aria-controls="menu-celular"
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          onClick={() => setAberto((v) => !v)}
        >
          <IconeMenu aberto={aberto} />
        </button>
      </div>

      {aberto && (
        <div id="menu-celular" className="border-t border-slate-200 bg-white px-4 pb-6 pt-2 shadow-xl shadow-slate-900/5 md:hidden">
          <nav aria-label="Principal no celular" className="flex flex-col">
            {links.map((i) => (
              <a
                key={i.href}
                href={i.href}
                onClick={() => setAberto(false)}
                className="border-b border-slate-100 py-4 font-display text-2xl font-semibold text-slate-950"
              >
                {i.texto}
              </a>
            ))}
            <a href={LINKS.entrar} className="py-4 text-base font-medium text-slate-600">
              Entrar
            </a>
          </nav>
          <Botao href={LINKS.testeGratis} seta className="mt-2 w-full">
            Começar teste grátis
          </Botao>
        </div>
      )}
    </header>
  );
}

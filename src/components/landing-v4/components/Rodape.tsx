import { LINKS } from "../links";

// Rodapé: só links com destino real (nada de "#").
// Termos de uso e Política de privacidade: páginas criadas no estúdio em 2026-10-30 (src/legal/).
// prefixo: endereço da landing principal, para os links de âncora (#planos etc.) funcionarem fora dela.
const montarColunas = (prefixo: string) => [
  {
    titulo: "Produto",
    links: [
      { t: "Recursos", href: prefixo + LINKS.recursos },
      { t: "Como funciona", href: prefixo + LINKS.comoFunciona },
      { t: "Planos", href: prefixo + LINKS.planos },
      { t: "Perguntas frequentes", href: prefixo + LINKS.faq },
    ],
  },
  {
    titulo: "Conta",
    links: [
      { t: "Começar teste grátis", href: LINKS.testeGratis },
      { t: "Entrar", href: LINKS.entrar },
    ],
  },
  {
    titulo: "Ajuda",
    links: [
      { t: "Suporte pelo WhatsApp", href: LINKS.whatsappSuporte, externo: true },
      { t: "Termos de uso", href: LINKS.termos },
      { t: "Política de privacidade", href: LINKS.privacidade },
    ],
  },
];

export function Rodape({ prefixo = "" }: { prefixo?: string }) {
  const colunas = montarColunas(prefixo);
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-4">
          <a href={prefixo ? prefixo : "#topo"} className="flex items-center gap-2.5" aria-label="MécApp, voltar ao início">
            <img src="/img/mecapp-icone.webp" alt="" width={32} height={32} loading="lazy" className="h-8 w-8 rounded-[0.5rem]" />
            <span className="font-display text-lg font-bold tracking-tight text-slate-950">MécApp</span>
          </a>
          <p className="mt-4 max-w-xs text-sm text-slate-600">Sistema para lojas de celular e assistências técnicas.</p>
          <a
            href={LINKS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:text-brand-700"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            @mecappoficial
          </a>
        </div>

        <nav aria-label="Rodapé" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
          {colunas.map((c) => (
            <div key={c.titulo}>
              <p className="font-display text-sm font-semibold text-slate-950">{c.titulo}</p>
              <ul className="mt-3 space-y-1 text-sm sm:mt-4 sm:space-y-3">
                {c.links.map((l) => (
                  <li key={l.t}>
                    <a
                      href={l.href}
                      {...("externo" in l && l.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="inline-block py-2 text-slate-600 transition-colors hover:text-slate-950 sm:py-0"
                    >
                      {l.t}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-slate-200">
        <p className="mx-auto max-w-7xl px-4 py-6 text-sm text-slate-500 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} MécApp. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}

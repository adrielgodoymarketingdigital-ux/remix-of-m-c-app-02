import { Fragment, type ReactNode } from "react";
import { Menu } from "../components/Menu";
import { Rodape } from "../components/Rodape";
import { DADOS, type Bloco, type Documento } from "./textos";

// Página de texto legal (Termos de uso e Política de privacidade), no visual claro da V4.
// Computador: índice fixo ao lado. Celular: índice recolhível no topo.
// Trechos [PREENCHER] aparecem destacados em amarelo para ninguém publicar sem preencher.
// "inicio" é o endereço da landing principal: no estúdio "/v4/", no MécApp "/".

function comDestaques(texto: string): ReactNode {
  const partes = texto.split(/(\[PREENCHER[^\]]*\])/g);
  return partes.map((p, i) =>
    p.startsWith("[PREENCHER") ? (
      <mark key={i} className="rounded bg-amber-100 px-1 font-semibold text-amber-900 ring-1 ring-amber-300">
        {p}
      </mark>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

function Blocos({ blocos }: { blocos: Bloco[] }) {
  return (
    <>
      {blocos.map((b, i) =>
        typeof b === "string" ? (
          <p key={i} className="mt-4 leading-relaxed text-slate-700">
            {comDestaques(b)}
          </p>
        ) : (
          <ul key={i} className="mt-4 space-y-2.5">
            {b.lista.map((item) => (
              <li key={item} className="flex gap-3 leading-relaxed text-slate-700">
                <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600" />
                <span>{comDestaques(item)}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}

export function PaginaLegal({
  doc,
  outro,
  inicio = "/",
  funcionalidades = "/funcionalidades",
}: {
  doc: Documento;
  outro: { titulo: string; href: string };
  inicio?: string;
  funcionalidades?: string;
}) {
  return (
    <>
      <Menu prefixo={inicio} funcionalidades={funcionalidades} />
      <main id="conteudo">
        {/* Topo */}
        <section className="relative isolate overflow-clip border-b border-slate-200 bg-white pb-12 pt-32 md:pb-16 md:pt-40">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-40 left-[calc(50%-24rem)] h-[28rem] w-[48rem] rounded-full bg-[radial-gradient(closest-side,rgba(56,189,248,0.18),transparent)]" />
            <div className="absolute -right-32 top-10 h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.12),transparent)]" />
          </div>
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-700">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
              MécApp
            </p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl">
              <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-violet-600 bg-clip-text text-transparent">{doc.titulo}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">{doc.resumo}</p>
            <p className="mt-4 text-sm text-slate-500">Atualizado em {DADOS.atualizado}</p>
          </div>
        </section>

        <div className="bg-slate-50">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-12 lg:px-8">
            {/* Índice */}
            <nav aria-label="Neste documento" className="lg:col-span-4">
              <details className="group rounded-2xl border border-slate-200 bg-white p-5 lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between font-display font-semibold text-slate-950 [&::-webkit-details-marker]:hidden">
                  Neste documento
                  <span aria-hidden="true" className="text-slate-400 transition-transform duration-300 group-open:rotate-180">
                    ⌄
                  </span>
                </summary>
                <ol className="mt-4 space-y-1">
                  {doc.secoes.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="block py-1.5 text-sm text-slate-600 hover:text-blue-700">
                        {s.titulo}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
              <div className="sticky top-24 hidden rounded-2xl border border-slate-200 bg-white p-5 lg:block">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">Neste documento</p>
                <ol className="mt-3 space-y-0.5">
                  {doc.secoes.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="block rounded-[0.5rem] px-2 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-700"
                      >
                        {s.titulo}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </nav>

            {/* Texto */}
            <article className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 lg:col-span-8">
              {doc.secoes.map((s, i) => (
                <section key={s.id} id={s.id} className={`scroll-mt-24 ${i > 0 ? "mt-10 border-t border-slate-100 pt-10" : ""}`}>
                  <h2 className="font-display text-xl font-semibold text-slate-950 sm:text-2xl">{s.titulo}</h2>
                  <Blocos blocos={s.blocos} />
                </section>
              ))}

              <div className="mt-12 flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50 p-5 ring-1 ring-blue-100 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-700">Leia também a nossa {outro.titulo.toLowerCase()}.</p>
                <a href={outro.href} className="inline-flex items-center gap-1 font-display text-sm font-semibold text-blue-700 hover:underline">
                  {outro.titulo} <span aria-hidden="true">→</span>
                </a>
              </div>
            </article>
          </div>
        </div>
      </main>
      <Rodape prefixo={inicio} />
    </>
  );
}

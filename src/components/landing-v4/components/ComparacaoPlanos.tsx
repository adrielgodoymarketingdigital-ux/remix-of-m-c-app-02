import { useState, type ReactNode } from "react";
import { LINKS } from "../links";
import { grupos } from "../funcionalidades/dados";
import { IconeCheck } from "./Icones";
import type { NivelPlano } from "./SeloPlano";
import { temaDo, temas, type Tema } from "./temasPlanos";

// Aba "Comparar planos" da seção de planos (pedido do Adriel em 2026-10-29).
// Limites: src/types/plano.ts e src/types/assinatura.ts do MecApp (somente leitura).
// Funcionalidades: o plano mínimo de cada uma vem de src/funcionalidades/dados.ts (mesma fonte da página de funcionalidades).
// Cores: as mesmas dos cards da aba "Ver planos" (temasPlanos.ts): cabeçalho de cada coluna é um mini card
// com a borda em degradê (neon girando no Intermediário), colunas tingidas e ✓ na cor do plano.
// Por padrão mostra só o que MUDA entre os planos; um botão mostra também o que todos os planos têm.

export type PlanoComparado = {
  nome: string;
  curto: string;
  nivel: NivelPlano;
  mensal: number;
  anual: number;
  chave: { mensal: string; anual: string };
  destaque?: boolean;
};

const ordem: NivelPlano[] = ["basico", "intermediario", "profissional", "ultra"];
const real = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Valor = string | boolean | "em-breve";
type Linha = { nome: string; valores: Valor[] };

const limites: Linha[] = [
  { nome: "Aparelhos no estoque", valores: ["Até 50", "Até 500", "Ilimitados", "Ilimitados"] },
  { nome: "Ordens de serviço por mês", valores: ["20", "60", "Ilimitadas", "Ilimitadas"] },
  { nome: "Link de acompanhamento da OS", valores: [false, "10 por mês", "50 por mês", "Ilimitado"] },
  { nome: "Aparelhos no catálogo", valores: [false, "10", "Ilimitados", "Ilimitados"] },
  { nome: "Funcionários com comissão", valores: [false, "1", "Ilimitados", "Ilimitados"] },
  { nome: "Armazenamento", valores: ["500 MB", "5 GB", "50 GB", "50 GB"] },
  { nome: "Suporte humano", valores: ["E-mail", "WhatsApp", "WhatsApp prioritário", "WhatsApp prioritário"] },
  { nome: "Multi Empresas", valores: [false, false, false, "Matriz + 3 filiais"] },
];

// funcionalidades com plano definido, já com ✓/✗ por plano
const funcionalidades = grupos.map((g) => ({
  titulo: g.curto,
  linhas: g.itens
    .filter((f) => f.plano && f.id !== "multi") // Multi Empresas já está nos limites
    .map((f) => {
      const min = ordem.indexOf(f.plano!);
      return {
        nome: f.nome,
        valores: ordem.map((_, i) => (i < min ? false : f.emBreve ? "em-breve" : true)) as Valor[],
        todos: min === 0 && !f.emBreve,
      };
    }),
}));

function Celula({ v, t }: { v: Valor; t: Tema }) {
  let conteudo: ReactNode;
  if (v === true)
    conteudo = (
      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${t.check}`}>
        <IconeCheck className="h-3.5 w-3.5" />
        <span className="sr-only">Incluído</span>
      </span>
    );
  else if (v === false)
    conteudo = (
      <span className="text-slate-600" aria-label="Não incluído">
        —
      </span>
    );
  else if (v === "em-breve")
    conteudo = <span className="rounded border border-white/20 px-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-200">Em breve</span>;
  else conteudo = <span className="text-[13px] font-semibold leading-tight text-white sm:text-sm">{v}</span>;
  return (
    <div role="cell" className={`flex items-center justify-center px-1 py-3 text-center ${t.coluna}`}>
      {conteudo}
    </div>
  );
}

function LinhaTabela({ l, ts }: { l: Linha; ts: Tema[] }) {
  return (
    <div role="row" className="grid grid-cols-4 border-t border-white/[0.07] md:grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(0,1fr))]">
      <div role="rowheader" className="col-span-4 px-3 pt-3 text-sm font-medium text-slate-300 md:col-span-1 md:flex md:items-center md:py-3">
        {l.nome}
      </div>
      {l.valores.map((v, i) => (
        <Celula key={i} v={v} t={ts[i]} />
      ))}
    </div>
  );
}

function Titulo({ children }: { children: ReactNode }) {
  return (
    <div role="row" className="border-t border-white/10 bg-white/[0.03] px-3 py-2.5">
      <span role="columnheader" className="font-mono text-xs uppercase tracking-[0.14em] text-sky-300">
        {children}
      </span>
    </div>
  );
}

export function ComparacaoPlanos({ planos, anual }: { planos: PlanoComparado[]; anual: boolean }) {
  const [tudo, setTudo] = useState(false);
  const ts = planos.map(temaDo);

  return (
    <div className="mt-12 overflow-clip rounded-3xl border border-white/10 bg-slate-900/60">
      <div role="table" aria-label="Comparação dos planos">
        {/* Cabeçalho que fica preso no topo ao rolar a tabela */}
        <div role="rowgroup" className="sticky top-16 z-10 border-b border-white/10 bg-slate-950">
          <div role="row" className="grid grid-cols-4 md:grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(0,1fr))]">
            <div className="hidden items-end px-3 pb-4 md:flex">
              <span className="text-sm text-slate-400">{anual ? "Preço por ano" : "Preço por mês"}</span>
            </div>
            {planos.map((p, n) => {
              const t = ts[n];
              const preco = anual ? p.anual : p.mensal;
              const [inteiro, centavos] = real(preco).split(",");
              const premium = t === temas.violeta || t === temas.ouro;
              return (
                <div key={p.nome} role="columnheader" className={`p-1 sm:p-2 ${t.coluna}`}>
                  <div className={`group relative h-full rounded-2xl ${p.destaque || premium ? "p-[2px]" : "p-px"}`}>
                    {/* Borda: neon girando no destaque; degradê nos demais (igual aos cards) */}
                    {p.destaque ? (
                      <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-2xl bg-brand-600/40">
                        <span className="neon-giro absolute left-1/2 top-1/2 aspect-square w-[250%] bg-[conic-gradient(from_0deg,transparent_0deg,#2563EB_30deg,#7DD3FC_70deg,transparent_120deg,transparent_180deg,#2563EB_210deg,#7DD3FC_250deg,transparent_300deg)]" />
                      </span>
                    ) : (
                      <span aria-hidden="true" className={`absolute inset-0 overflow-hidden rounded-2xl ${t.borda}`}>
                        {premium && (
                          <span className="reflexo absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                        )}
                      </span>
                    )}
                    <div
                      className={`relative flex h-full flex-col items-center gap-1 overflow-hidden px-1 py-3 text-center sm:px-2 sm:py-4 ${t.fundo} ${
                        p.destaque || premium ? "rounded-[calc(1rem-2px)]" : "rounded-[calc(1rem-1px)]"
                      }`}
                    >
                      <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${t.luz} to-transparent`} />
                      <span aria-hidden="true" className={`absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent ${t.linha} to-transparent`} />
                      {t.rotulo && (
                        <span className={`relative hidden rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider lg:inline-block ${t.selo}`}>
                          {t.rotulo}
                        </span>
                      )}
                      <span className="relative font-display text-sm font-bold text-white sm:text-lg">
                        <span className="sm:hidden">{p.curto}</span>
                        <span className="hidden sm:inline">{p.nome}</span>
                      </span>
                      <span className="relative flex items-start gap-0.5 leading-none">
                        <span className="mt-0.5 text-[10px] font-semibold text-slate-400 sm:text-xs">R$</span>
                        <span className={`font-display text-lg font-bold tracking-tight sm:text-3xl ${t.preco}`}>{inteiro}</span>
                        <span className={`font-display text-[11px] font-bold sm:text-sm ${t.centavos}`}>,{centavos}</span>
                      </span>
                      <span className="relative text-[10px] text-slate-400 sm:text-xs">{anual ? "/ano" : "/mês"}</span>
                      <a
                        href={LINKS.plano(anual ? p.chave.anual : p.chave.mensal)}
                        className={`brilho relative mt-2 hidden h-10 w-full max-w-[9rem] items-center justify-center rounded-xl font-display text-xs font-semibold transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 md:inline-flex ${t.botao}`}
                      >
                        Assinar
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div role="rowgroup">
          <Titulo>Limites e suporte</Titulo>
          {limites.map((l) => (
            <LinhaTabela key={l.nome} l={l} ts={ts} />
          ))}

          {funcionalidades.map((g) => {
            const linhas = g.linhas.filter((l) => tudo || !l.todos);
            if (!linhas.length) return null;
            return (
              <div key={g.titulo}>
                <Titulo>{g.titulo}</Titulo>
                {linhas.map((l) => (
                  <LinhaTabela key={l.nome} l={l} ts={ts} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 border-t border-white/10 p-5 sm:flex-row sm:justify-between">
        <button
          type="button"
          aria-pressed={tudo}
          onClick={() => setTudo((v) => !v)}
          className="text-sm font-semibold text-sky-300 hover:underline"
        >
          {tudo ? "Mostrar só o que muda entre os planos" : "Mostrar também o que todos os planos têm"}
        </button>
        <p className="text-center text-sm text-slate-400">Todo cadastro ganha 24h de acesso Premium para testar tudo.</p>
      </div>

      {/* Celular: botões de assinar embaixo (no cabeçalho não cabem) */}
      <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-4 md:hidden">
        {planos.map((p, n) => (
          <a
            key={p.nome}
            href={LINKS.plano(anual ? p.chave.anual : p.chave.mensal)}
            className={`brilho inline-flex h-11 items-center justify-center rounded-xl font-display text-sm font-semibold ${ts[n].botao}`}
          >
            Assinar o {p.curto}
          </a>
        ))}
      </div>
    </div>
  );
}

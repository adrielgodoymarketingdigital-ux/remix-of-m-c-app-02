import type { ReactNode } from "react";
import { Box, Check, Crown, Gem, Package, Star, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BotoesPagamentoPagarme } from "@/components/planos/BotoesPagamentoPagarme";
import { formatCurrency } from "@/lib/formatters";
import { descontoAnual, descricaoPlano, formatarPercentual, limparRecurso } from "@/lib/planos/apresentacaoPlano";
import { cn } from "@/lib/utils";
import { PLANOS, type PlanoInfo } from "@/types/plano";

type Periodo = "mensal" | "anual";

const ICONES: Record<string, { Icone: LucideIcon; cor: string }> = {
  free: { Icone: Box, cor: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300" },
  basico: { Icone: Package, cor: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
  intermediario: { Icone: Crown, cor: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400" },
  profissional: { Icone: Gem, cor: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400" },
  profissional_ultra: { Icone: Star, cor: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400" },
};

const nivelDo = (key: string) => key.replace(/_(mensal|anual)$/, "");

/** Um cartão por vez em 5 colunas; em 3, os 2 últimos ficam centralizados na grade de 6. */
const COLUNAS = "col-span-2 min-[1484px]:col-span-1";

function SeloMudanca({ tipo, children }: { tipo: "upgrade" | "downgrade"; children: ReactNode }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap border-transparent",
        tipo === "upgrade"
          ? "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-400"
          : "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-400",
      )}
    >
      {children}
    </Badge>
  );
}

interface CartaoPlanoProps {
  planoKey: string;
  nome: string;
  preco: number;
  periodoTexto: string;
  recursos: string[];
  periodo: Periodo;
  selo: ReactNode;
  faixa?: "popular" | "novo";
  atual: boolean;
  destacado: boolean;
  /** 4º cartão: começa na 2ª posição da grade de 6 para centralizar a 2ª linha. */
  centralizar?: boolean;
  botao: ReactNode;
}

function CartaoPlano({ planoKey, nome, preco, periodoTexto, recursos, periodo, selo, faixa, atual, destacado, centralizar, botao }: CartaoPlanoProps) {
  const nivel = nivelDo(planoKey);
  const { Icone, cor } = ICONES[nivel] ?? ICONES.free;
  const descricao = descricaoPlano(planoKey);
  const desconto = periodo === "anual" ? descontoAnual(planoKey, PLANOS) : null;

  return (
    <Card
      id={`plan-${planoKey}`}
      className={cn(
        "relative flex min-w-0 flex-col rounded-xl px-4 pb-3 pt-5 transition-shadow hover:shadow-md",
        COLUNAS,
        centralizar && "col-start-2 min-[1484px]:col-start-auto",
        // Mais Popular sobra 4px acima e abaixo, como na referência; o padding compensa,
        // então preço, lista e botão continuam alinhados com os vizinhos.
        faixa === "popular" && "-my-1 border-primary pb-4 pt-6 shadow-md shadow-primary/10 ring-1 ring-primary/30",
        atual && "border-primary ring-2 ring-primary/20",
        destacado && "ring-4 ring-red-500/50",
      )}
    >
      {faixa && (
        <div
          data-faixa
          className={cn(
            "absolute right-0 top-0 z-10 rounded-bl-lg rounded-tr-[11px] px-3 py-0.5 text-xs font-bold",
            faixa === "popular" ? "bg-primary text-primary-foreground" : "bg-amber-400 text-amber-950",
          )}
        >
          {faixa === "popular" ? "Mais Popular" : "NOVO"}
        </div>
      )}

      {/* Altura igual em todos: o preço alinha, e o cartão sem selo centraliza nome e ícone. */}
      <div className="flex min-h-[82px] items-center gap-3">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", cor)}>
          <Icone className="h-6 w-6" />
        </span>
        <div className={cn("min-w-0", selo && "self-start")}>
          {selo && <div data-selo className="mb-1 flex">{selo}</div>}
          <h3 className="text-sm font-bold leading-snug text-foreground">{nome}</h3>
          {descricao && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{descricao}</p>}
        </div>
      </div>

      <div className={cn("mb-2 mt-1", periodo === "anual" && "min-h-[84px]")}>
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-2xl font-bold leading-tight tracking-tight text-foreground">{formatCurrency(preco)}</span>
          <span className="text-xs text-muted-foreground">{periodoTexto}</span>
        </p>
        {desconto && (
          <div className="mt-1 space-y-1">
            <p className="text-xs font-medium text-green-600 dark:text-green-400">
              {formatCurrency(desconto.valorMensalEquivalente)}/mês
            </p>
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400">
              Economize {formatarPercentual(desconto.percentualDesconto)}
            </Badge>
          </div>
        )}
      </div>

      <ul className="mb-3 flex-1 space-y-1">
        {recursos.map((recurso) => (
          <li key={recurso} className="flex items-start gap-2 text-xs leading-snug text-foreground">
            <Check strokeWidth={3} className="mt-px h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
            <span className="min-w-0">{limparRecurso(recurso)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">{botao}</div>
    </Card>
  );
}

interface GradePlanosDesktopProps {
  periodo: Periodo;
  onPeriodo: (periodo: Periodo) => void;
  planos: [string, PlanoInfo][];
  /** Lista do Free já com os limites desta conta (getLimitesFree). */
  recursosFree: string[];
  planoTipo?: string;
  statusAssinatura?: string;
  planoVencido: boolean;
  migracaoNecessaria: boolean;
  chavePlanoAnterior: string | null;
  planoDestacado: string | null;
  carregando: boolean;
  tipoMudanca: (planoKey: string) => string;
  onSucesso: () => void;
}

/** "Planos Disponíveis" no computador: mesmos planos, selos e botões do layout do celular. */
export function GradePlanosDesktop({
  periodo,
  onPeriodo,
  planos,
  recursosFree,
  planoTipo,
  statusAssinatura,
  planoVencido,
  migracaoNecessaria,
  chavePlanoAnterior,
  planoDestacado,
  carregando,
  tipoMudanca,
  onSucesso,
}: GradePlanosDesktopProps) {
  const freeAtual = planoTipo === "free";

  return (
    <section>
      <div id="planos-disponiveis" className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Planos Disponíveis</h2>
          <p className="text-[13px] text-muted-foreground">Investimento que se paga no primeiro mês. Cancele quando quiser.</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Período de cobrança" className="flex rounded-full bg-muted/60 p-0.5">
            {(["mensal", "anual"] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                aria-pressed={periodo === opcao}
                onClick={() => onPeriodo(opcao)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors",
                  periodo === opcao
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 pr-2 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opcao === "mensal" ? "Mensal" : "Anual"}
                {periodo === opcao && <span aria-hidden className="h-5 w-5 rounded-full border-2 border-white/90 bg-white/25" />}
              </button>
            ))}
          </div>
          <span className="rounded-full bg-green-100 px-3 py-2 text-xs font-bold text-green-700 dark:bg-green-900 dark:text-green-400">
            até 20%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-x-3 gap-y-4 min-[1484px]:grid-cols-5">
        <CartaoPlano
          planoKey="free"
          nome={PLANOS.free.nome}
          preco={0}
          periodoTexto="/mês"
          recursos={recursosFree}
          periodo={periodo}
          atual={freeAtual}
          destacado={false}
          selo={freeAtual && <Badge variant="secondary">{planoVencido ? "Em uso até renovar" : "Plano Atual"}</Badge>}
          botao={freeAtual ? (
            <Button className="h-10 w-full text-[13px]" disabled>{planoVencido ? "Recursos básicos" : "Plano Atual"}</Button>
          ) : (
            <Button variant="outline" className="h-10 w-full text-[13px]" disabled>Plano Gratuito</Button>
          )}
        />
        {planos.map(([key, plano], indice) => {
          const mudanca = tipoMudanca(key);
          const planoAtivo = planoTipo === key && (statusAssinatura === "active" || statusAssinatura === "trialing");
          const mesmoPlanoVencido = migracaoNecessaria && planoTipo === key;
          const mesmoNivelAnterior = !!chavePlanoAnterior && nivelDo(key) === nivelDo(chavePlanoAnterior);

          return (
            <CartaoPlano
              key={key}
              planoKey={key}
              nome={plano.nome}
              preco={plano.preco}
              periodoTexto={plano.periodo}
              recursos={plano.recursos}
              periodo={periodo}
              faixa={plano.popular ? "popular" : plano.novo ? "novo" : undefined}
              atual={planoAtivo}
              destacado={planoDestacado === `plan-${key}`}
              centralizar={indice === 2}
              selo={
                planoAtivo ? (
                  <Badge variant="secondary">Plano Atual</Badge>
                ) : mudanca === "upgrade" ? (
                  <SeloMudanca tipo="upgrade">
                    {planoVencido ? (mesmoNivelAnterior ? "Renovar o seu plano" : "Renovar") : "Upgrade"}
                  </SeloMudanca>
                ) : mudanca === "downgrade" ? (
                  <SeloMudanca tipo="downgrade">
                    Downgrade
                  </SeloMudanca>
                ) : null
              }
              botao={
                <BotoesPagamentoPagarme
                  compacto
                  planoKey={key}
                  planoAtual={planoAtivo || mesmoPlanoVencido}
                  popular={plano.popular}
                  carregando={carregando}
                  onSuccess={onSucesso}
                />
              }
            />
          );
        })}
      </div>
    </section>
  );
}

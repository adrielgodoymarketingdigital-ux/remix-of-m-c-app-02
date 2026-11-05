import type { ReactNode } from "react";
import { ArrowDownCircle, ArrowUpCircle, Box, Check, Crown, Gem, Package, RefreshCw, Star, type LucideIcon } from "lucide-react";
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
      className={tipo === "upgrade"
        ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700"
        : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/50 dark:text-orange-400 dark:border-orange-700"}
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
        "relative flex min-w-0 flex-col p-4 transition-shadow hover:shadow-md",
        COLUNAS,
        centralizar && "col-start-2 min-[1484px]:col-start-auto",
        faixa === "popular" && "border-primary shadow-sm",
        atual && "border-primary ring-2 ring-primary/20",
        destacado && "ring-4 ring-red-500/50",
      )}
    >
      {faixa && (
        <div
          className={cn(
            "absolute right-0 top-0 z-10 rounded-bl-lg rounded-tr-lg px-3 py-1 text-xs font-bold",
            faixa === "popular" ? "bg-primary text-primary-foreground" : "bg-amber-400 text-amber-950",
          )}
        >
          {faixa === "popular" ? "Mais Popular" : "NOVO"}
        </div>
      )}

      <div className={cn("mb-2 flex min-h-6 items-center", faixa && "pr-[90px]")}>{selo}</div>

      <div className="flex min-h-[72px] items-start gap-3">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", cor)}>
          <Icone className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold leading-snug text-foreground">{nome}</h3>
          {descricao && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{descricao}</p>}
        </div>
      </div>

      <div className={cn("mb-3 mt-2", periodo === "anual" && "min-h-[84px]")}>
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[26px] font-bold leading-tight tracking-tight text-foreground">{formatCurrency(preco)}</span>
          <span className="text-[13px] text-muted-foreground">{periodoTexto}</span>
        </p>
        {desconto && (
          <div className="mt-1 space-y-1">
            <p className="text-[13px] font-medium text-green-600 dark:text-green-400">
              {formatCurrency(desconto.valorMensalEquivalente)}/mês
            </p>
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400">
              Economize {formatarPercentual(desconto.percentualDesconto)}
            </Badge>
          </div>
        )}
      </div>

      <ul className="mb-4 flex-1 space-y-2">
        {recursos.map((recurso) => (
          <li key={recurso} className="flex items-start gap-2 text-[13px] leading-snug text-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
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
      <div id="planos-disponiveis" className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Planos Disponíveis</h2>
          <p className="text-[13px] text-muted-foreground">Investimento que se paga no primeiro mês. Cancele quando quiser.</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Período de cobrança" className="flex rounded-full border border-border bg-card p-0.5">
            {(["mensal", "anual"] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                aria-pressed={periodo === opcao}
                onClick={() => onPeriodo(opcao)}
                className={cn(
                  "h-9 rounded-full px-4 text-[13px] font-medium transition-colors",
                  periodo === opcao ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opcao === "mensal" ? "Mensal" : "Anual"}
              </button>
            ))}
          </div>
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700 dark:bg-green-900 dark:text-green-400">
            até 20%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3 min-[1484px]:grid-cols-5">
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
            <Button className="h-10 w-full" disabled>{planoVencido ? "Recursos básicos" : "Plano Atual"}</Button>
          ) : (
            <Button variant="outline" className="h-10 w-full" disabled>Plano Gratuito</Button>
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
                    {planoVencido ? (
                      <>
                        <RefreshCw className="mr-1 h-3 w-3 shrink-0" />
                        {mesmoNivelAnterior ? "Renovar o seu plano" : "Renovar"}
                      </>
                    ) : (
                      <>
                        <ArrowUpCircle className="mr-1 h-3 w-3 shrink-0" />
                        Upgrade
                      </>
                    )}
                  </SeloMudanca>
                ) : mudanca === "downgrade" ? (
                  <SeloMudanca tipo="downgrade">
                    <ArrowDownCircle className="mr-1 h-3 w-3 shrink-0" />
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

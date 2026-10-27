import { CheckCircle2, Circle, AlertTriangle, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

/** Mesmo retorno de validarConfiguracaoParaRecibos (useConfiguracaoLoja). */
export interface StatusPerfil {
  percentual: number;
  camposFaltando: string[];
}

/**
 * Checklist do cartão lateral. Os grupos usam os MESMOS campos obrigatórios de
 * validarConfiguracaoParaRecibos (pelos nomes de camposFaltando); nada é inventado.
 */
const GRUPOS = [
  { titulo: "gruposDadosBasicos", campos: ["Nome da loja", "Razão social"] },
  { titulo: "gruposContato", campos: ["Telefone", "E-mail"] },
  { titulo: "gruposEndereco", campos: ["CEP", "Logradouro", "Número", "Bairro", "Cidade", "Estado"] },
] as const;

/** Nome do campo (pt-BR, de camposFaltando) no idioma da tela; desconhecido sai como veio. */
function useNomeCampo() {
  const { t } = useTranslation("configuracoes");
  return (campo: string) => t(`campos.${campo}`, { defaultValue: campo });
}

export function ProgressoCircular({
  percentual,
  tamanho = "md",
}: {
  percentual: number;
  tamanho?: "md" | "lg";
}) {
  const pct = Math.max(0, Math.min(100, percentual));
  const { t } = useTranslation("configuracoes");
  return (
    <div
      role="img"
      aria-label={t("progresso.circuloAria", { percentual: pct })}
      className={cn(
        "grid shrink-0 place-items-center rounded-full",
        tamanho === "lg" ? "h-[140px] w-[140px]" : "h-20 w-20",
      )}
      style={{ background: `conic-gradient(hsl(var(--primary)) ${pct * 3.6}deg, hsl(var(--muted)) 0)` }}
    >
      <span
        className={cn(
          "grid place-items-center rounded-full bg-card font-extrabold text-foreground",
          tamanho === "lg" ? "h-[118px] w-[118px] text-[28px]" : "h-[65px] w-[65px] text-base",
        )}
      >
        {pct}%
      </span>
    </div>
  );
}

/** Caixa verde (completo) ou âmbar (faltando dados) do cartão de status. */
function CaixaSituacao({ status }: { status: StatusPerfil }) {
  const completo = status.percentual === 100;
  const n = status.camposFaltando.length;
  const { t } = useTranslation("configuracoes");
  const nomeCampo = useNomeCampo();
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl px-5 py-4 lg:min-w-[300px] lg:max-w-[420px]",
        completo
          ? "bg-success/10 text-success"
          : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
      )}
    >
      {completo ? (
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <strong className="block text-sm font-bold">
          {completo ? t("progresso.completoExclamacao") : t("progresso.faltamCampos", { count: n })}
        </strong>
        <span className="mt-1 block text-xs leading-relaxed opacity-90">
          {completo
            ? t("progresso.lojaPronta")
            : status.camposFaltando.map(nomeCampo).join(", ")}
        </span>
      </div>
    </div>
  );
}

/** Cartão "Status do Perfil" do topo da página. */
export function CardStatusPerfil({ status }: { status: StatusPerfil }) {
  const { t } = useTranslation("configuracoes");
  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-card px-5 py-5 shadow-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-5 sm:gap-6">
        <ProgressoCircular percentual={status.percentual} />
        <div className="min-w-0">
          <h2 className="text-base font-bold sm:text-[17px]">{t("progresso.statusTitulo")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("progresso.statusDescricao")}
          </p>
        </div>
      </div>
      <CaixaSituacao status={status} />
    </section>
  );
}

/** Cartão lateral "Progresso do Perfil" (sticky no desktop). */
export function CardProgressoPerfil({ status }: { status: StatusPerfil }) {
  const completo = status.percentual === 100;
  const faltando = new Set(status.camposFaltando);
  const { t } = useTranslation("configuracoes");
  const nomeCampo = useNomeCampo();
  return (
    <aside className="rounded-2xl border bg-card p-6 shadow-sm xl:sticky xl:top-6">
      <h2 className="flex items-center gap-2.5 text-[15px] font-bold">
        <LayoutDashboard className="h-5 w-5 text-primary" aria-hidden="true" />
        {t("progresso.progressoTitulo")}
      </h2>
      <div className="mx-auto mb-4 mt-7 w-fit">
        <ProgressoCircular percentual={status.percentual} tamanho="lg" />
      </div>
      <div className="mb-6 text-center">
        <strong className="text-sm font-bold">{completo ? t("progresso.completo") : t("progresso.incompleto")}</strong>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {completo
            ? t("progresso.todosPreenchidos")
            : t("progresso.preenchaPendentes")}
        </p>
      </div>
      <ul className="space-y-0.5">
        {GRUPOS.map((g) => {
          const pendentes: string[] = g.campos.filter((c) => faltando.has(c));
          const ok = pendentes.length === 0;
          return (
            <li key={g.titulo} className="flex items-start gap-3 py-2.5 text-[13px]">
              {ok ? (
                <CheckCircle2 className="mt-px h-[18px] w-[18px] shrink-0 text-success" aria-hidden="true" />
              ) : (
                <Circle className="mt-px h-[18px] w-[18px] shrink-0 text-amber-500" aria-hidden="true" />
              )}
              <span className="min-w-0">
                <span className={cn("block", ok ? "text-foreground" : "font-medium text-foreground")}>{t(`progresso.${g.titulo}`)}</span>
                {!ok && (
                  <span className="block text-xs text-muted-foreground">{t("progresso.falta", { lista: pendentes.map(nomeCampo).join(", ") })}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

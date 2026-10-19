import { CheckCircle2, Circle, AlertTriangle, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { titulo: "Dados básicos", campos: ["Nome da loja", "Razão social"] },
  { titulo: "Contato", campos: ["Telefone", "E-mail"] },
  { titulo: "Endereço", campos: ["CEP", "Logradouro", "Número", "Bairro", "Cidade", "Estado"] },
];

export function ProgressoCircular({
  percentual,
  tamanho = "md",
}: {
  percentual: number;
  tamanho?: "md" | "lg";
}) {
  const pct = Math.max(0, Math.min(100, percentual));
  return (
    <div
      role="img"
      aria-label={`Perfil ${pct}% completo`}
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
          {completo ? "Perfil completo!" : `Falta${n > 1 ? "m" : ""} ${n} campo${n > 1 ? "s" : ""} obrigatório${n > 1 ? "s" : ""}`}
        </strong>
        <span className="mt-1 block text-xs leading-relaxed opacity-90">
          {completo
            ? "Sua loja está configurada e pronta para uso."
            : status.camposFaltando.join(", ")}
        </span>
      </div>
    </div>
  );
}

/** Cartão "Status do Perfil" do topo da página. */
export function CardStatusPerfil({ status }: { status: StatusPerfil }) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-card px-5 py-5 shadow-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-5 sm:gap-6">
        <ProgressoCircular percentual={status.percentual} />
        <div className="min-w-0">
          <h2 className="text-base font-bold sm:text-[17px]">Status do Perfil</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete todos os dados para gerar recibos profissionais.
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
  return (
    <aside className="rounded-2xl border bg-card p-6 shadow-sm xl:sticky xl:top-6">
      <h2 className="flex items-center gap-2.5 text-[15px] font-bold">
        <LayoutDashboard className="h-5 w-5 text-primary" aria-hidden="true" />
        Progresso do Perfil
      </h2>
      <div className="mx-auto mb-4 mt-7 w-fit">
        <ProgressoCircular percentual={status.percentual} tamanho="lg" />
      </div>
      <div className="mb-6 text-center">
        <strong className="text-sm font-bold">{completo ? "Perfil completo" : "Perfil incompleto"}</strong>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {completo
            ? "Todos os dados obrigatórios foram preenchidos."
            : "Preencha os itens pendentes para gerar recibos profissionais."}
        </p>
      </div>
      <ul className="space-y-0.5">
        {GRUPOS.map((g) => {
          const pendentes = g.campos.filter((c) => faltando.has(c));
          const ok = pendentes.length === 0;
          return (
            <li key={g.titulo} className="flex items-start gap-3 py-2.5 text-[13px]">
              {ok ? (
                <CheckCircle2 className="mt-px h-[18px] w-[18px] shrink-0 text-success" aria-hidden="true" />
              ) : (
                <Circle className="mt-px h-[18px] w-[18px] shrink-0 text-amber-500" aria-hidden="true" />
              )}
              <span className="min-w-0">
                <span className={cn("block", ok ? "text-foreground" : "font-medium text-foreground")}>{g.titulo}</span>
                {!ok && (
                  <span className="block text-xs text-muted-foreground">Falta: {pendentes.join(", ")}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

// Ícones das categorias do Catálogo no computador: os 20 nomes da lista fechada
// (src/lib/catalogo/iconeCategoria.ts) viram componentes lucide aqui, e o seletor do diálogo.
import type { LucideIcon, LucideProps } from "lucide-react";
import {
  BatteryCharging,
  Cable,
  Camera,
  Cpu,
  Folder,
  Gamepad2,
  Gift,
  Headphones,
  Laptop,
  Monitor,
  Package,
  PlugZap,
  Shield,
  Smartphone,
  Sparkles,
  Speaker,
  Tablet,
  Tag,
  Watch,
  Wrench,
} from "lucide-react";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { ICONES_CATEGORIA, iconeDaCategoria, sugerirIconePorNome, type IconeCategoria as NomeIcone } from "@/lib/catalogo/iconeCategoria";
import { normalizarCorNivel } from "@/components/fidelidade/desktop/corNivel";
import { proximoIndiceRadio } from "@/lib/catalogo/navegacaoRadio";
import { cn } from "@/lib/utils";

export const COMPONENTE_ICONE: Record<NomeIcone, LucideIcon> = {
  folder: Folder,
  smartphone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  watch: Watch,
  headphones: Headphones,
  speaker: Speaker,
  cable: Cable,
  "battery-charging": BatteryCharging,
  "plug-zap": PlugZap,
  shield: Shield,
  monitor: Monitor,
  "gamepad-2": Gamepad2,
  camera: Camera,
  cpu: Cpu,
  wrench: Wrench,
  package: Package,
  tag: Tag,
  gift: Gift,
  sparkles: Sparkles,
};

/** Ícone da categoria: o salvo (se for da lista) ou o escolhido pelo nome. */
export function IconeDaCategoria({ nome, icone, ...props }: { nome?: string | null; icone?: string | null } & LucideProps) {
  const Icone = COMPONENTE_ICONE[iconeDaCategoria({ nome, icone })];
  return <Icone aria-hidden="true" {...props} />;
}

/** Cor da categoria normalizada para "#rrggbb", ou null (cai no visual neutro). */
export const corDaCategoria = (cor: string | null | undefined) => normalizarCorNivel(cor);

interface SeletorIconeCategoriaProps {
  /** undefined = automático (pelo nome). */
  valor: string | undefined;
  nomeCategoria: string;
  cor: string;
  onChange: (icone: string | undefined) => void;
}

export function SeletorIconeCategoria({ valor, nomeCategoria, cor, onChange }: SeletorIconeCategoriaProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop.categorias" });
  const hex = corDaCategoria(cor);
  const automatico = sugerirIconePorNome(nomeCategoria);
  const IconeAuto = COMPONENTE_ICONE[automatico];
  // Padrão "radio": um só ponto de Tab (o escolhido); as setas andam e escolhem.
  const opcoes: (string | undefined)[] = [undefined, ...ICONES_CATEGORIA];
  const marcado = ICONES_CATEGORIA.includes(valor as NomeIcone) ? valor : undefined;
  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    const proximo = proximoIndiceRadio(e.key, opcoes.indexOf(marcado), opcoes.length);
    if (proximo === null) return;
    e.preventDefault();
    const escolhido = opcoes[proximo];
    onChange(escolhido);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-icone="${escolhido ?? "auto"}"]`)?.focus();
  };
  const opcao = (ativo: boolean) =>
    cn(
      "grid h-10 w-10 place-items-center rounded-lg border transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      ativo ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border hover:bg-muted",
    );

  return (
    <div className="space-y-2">
      <Label>{t("icone")}</Label>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("icone")} onKeyDown={teclado}>
        <button
          type="button"
          role="radio"
          aria-checked={marcado === undefined}
          tabIndex={marcado === undefined ? 0 : -1}
          data-icone="auto"
          title={t("iconeAutomatico")}
          className={cn(opcao(marcado === undefined), "inline-flex w-auto gap-1.5 px-2.5 text-xs font-medium")}
          onClick={() => onChange(undefined)}
        >
          <IconeAuto className="h-4 w-4" style={hex ? { color: hex } : undefined} aria-hidden="true" />
          {t("iconeAutomatico")}
        </button>
        {ICONES_CATEGORIA.map((nome) => {
          const Icone = COMPONENTE_ICONE[nome];
          const ativo = marcado === nome;
          const rotulo = t(`nomesIcones.${nome}`, { defaultValue: nome });
          return (
            <button
              key={nome}
              type="button"
              role="radio"
              aria-checked={ativo}
              tabIndex={ativo ? 0 : -1}
              data-icone={nome}
              aria-label={rotulo}
              title={rotulo}
              className={opcao(ativo)}
              onClick={() => onChange(nome)}
            >
              <Icone className="h-4 w-4" style={ativo && hex ? { color: hex } : undefined} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t("iconeAjuda")}</p>
    </div>
  );
}

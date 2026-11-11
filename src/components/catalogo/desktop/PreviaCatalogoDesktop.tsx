// Prévia do Catálogo no computador: o CatalogoOnline REAL (o mesmo do link público, sem alteração),
// com o estado da tela (muda na hora; só vai ao link com o Salvar do topo). Nunca recebe custo,
// lucro nem o modo de edição: o ItemCatalogo não tem custo e o modoEdicao não é passado.
// Larguras: celular 375 px, tablet 768 px, computador = largura toda do cartão. Quando 768 px não
// cabem, a prévia é reduzida em escala (mesmo desenho, menor) em vez de cortada.
import { useLayoutEffect, useRef, useState } from "react";
import { Eye, Monitor, Smartphone, Tablet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CatalogoOnline } from "@/components/catalogo/CatalogoOnline";
import type { ConfiguracaoCatalogo } from "@/types/catalogo";
import type { ItemCatalogo } from "@/types/catalogo-item";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { cn } from "@/lib/utils";

export type DispositivoPrevia = "mobile" | "tablet" | "desktop";

const LARGURA_FIXA: Record<DispositivoPrevia, number | null> = { mobile: 375, tablet: 768, desktop: null };

export function SeletorDispositivoPrevia({
  valor,
  onChange,
  compacto = false,
}: {
  valor: DispositivoPrevia;
  onChange: (v: DispositivoPrevia) => void;
  compacto?: boolean;
}) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop.previa" });
  const item = cn(
    compacto ? "px-2" : "h-9 px-3",
    "rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm",
  );
  return (
    <ToggleGroup type="single" value={valor} onValueChange={(v) => v && onChange(v as DispositivoPrevia)} className="gap-1 rounded-lg border bg-background p-1">
      <ToggleGroupItem value="desktop" aria-label={t("computador")} title={t("computador")} className={item}>
        <Monitor className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="tablet" aria-label={t("tablet")} title={t("tablet")} className={item}>
        <Tablet className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="mobile" aria-label={t("celular")} title={t("celular")} className={item}>
        <Smartphone className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/** Largura do elemento (ResizeObserver). */
function useLarguraDe<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setLargura(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(() => setLargura(el.clientWidth));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, largura] as const;
}

interface PreviaCatalogoDesktopProps {
  itens: ItemCatalogo[];
  configLoja: ConfiguracaoLoja | null;
  config: ConfiguracaoCatalogo;
  dispositivo: DispositivoPrevia;
  onDispositivo: (v: DispositivoPrevia) => void;
  titulo: string;
  descricao: string;
  /** Altura visível da prévia, em px. */
  altura: number;
  /** Frase "muda na hora, grava com o Salvar". */
  mostrarAvisoAoVivo?: boolean;
  className?: string;
}

export function PreviaCatalogoDesktop(p: PreviaCatalogoDesktopProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop.previa" });
  const [areaRef, larguraArea] = useLarguraDe<HTMLDivElement>();

  const fixa = LARGURA_FIXA[p.dispositivo];
  const larguraConteudo = fixa ?? larguraArea;
  const escala = fixa && larguraArea > 0 && fixa > larguraArea ? larguraArea / fixa : 1;
  const larguraVisivel = larguraConteudo * escala;
  const margem = Math.max(0, (larguraArea - larguraVisivel) / 2);

  return (
    <Card className={cn("overflow-hidden rounded-2xl", p.className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Eye className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-lg">{p.titulo}</CardTitle>
            <CardDescription>{p.descricao}</CardDescription>
          </div>
        </div>
        <SeletorDispositivoPrevia valor={p.dispositivo} onChange={p.onDispositivo} />
      </CardHeader>
      {p.mostrarAvisoAoVivo && <p className="-mt-2 px-6 pb-3 text-xs text-muted-foreground">{t("aoVivo")}</p>}
      {escala < 1 && <p className="-mt-2 px-6 pb-3 text-xs text-muted-foreground">{t("larguraReduzida")}</p>}
      <CardContent className="border-t bg-muted/40 p-0 dark:bg-muted/20">
        <div ref={areaRef} className="relative w-full overflow-hidden" style={{ height: p.altura }}>
          {larguraConteudo > 0 && (
            <div
              role="region"
              aria-label={t("rotulo")}
              data-previa={p.dispositivo}
              data-escala={escala.toFixed(3)}
              className={cn("absolute top-0 bg-background", fixa !== null && "border-x shadow-sm")}
              // O transform (mesmo em escala 1) faz deste quadro o "chão" do botão flutuante do
              // WhatsApp (position: fixed no CatalogoOnline): ele fica dentro da prévia, não na tela.
              style={{
                left: margem,
                width: larguraConteudo,
                height: p.altura / escala,
                transform: `scale(${escala})`,
                transformOrigin: "top left",
              }}
            >
              <div className="h-full overflow-y-auto overflow-x-hidden">
                <CatalogoOnline itens={p.itens} configuracaoLoja={p.configLoja} config={p.config} />
              </div>
            </div>
          )}
        </div>
      </CardContent>
      {p.itens.length === 0 && <p className="border-t px-6 py-2 text-xs text-muted-foreground">{t("vazio")}</p>}
    </Card>
  );
}

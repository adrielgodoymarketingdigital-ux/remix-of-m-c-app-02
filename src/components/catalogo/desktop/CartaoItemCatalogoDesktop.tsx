// Cartão de um item no passo Itens (computador), em grade ou lista. Só a tela do dono:
// Custo e Lucro aparecem aqui quando a permissão deixa, com o custo vindo de fora (mapa
// id → custo), nunca do ItemCatalogo. Duas ações separadas: "Entra no catálogo" (rascunho,
// grava com o Salvar do topo) e o olho "Ocultar" (grava exibir_no_catalogo na hora).
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2, Package, Pencil, PackageCheck, PackageX, Smartphone, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";
import {
  categoriasDoItem,
  codigoDoItem,
  estaOculto,
  lucroDoItem,
  precoEfetivo,
  seloEstoque,
  type GrupoCategoria,
} from "@/lib/catalogo/listaItensDesktop";
import type { ItemCatalogo } from "@/types/catalogo-item";
import { cn } from "@/lib/utils";
import { corDaCategoria, IconeDaCategoria } from "./IconeCategoria";

export type ModoVisualizacao = "grade" | "lista";

interface CartaoItemCatalogoDesktopProps {
  item: ItemCatalogo;
  modo: ModoVisualizacao;
  grupos: GrupoCategoria[];
  marcado: boolean;
  onAlternarMarcado: () => void;
  onAlternarOculto: () => void;
  atualizandoOculto: boolean;
  modoEdicao: boolean;
  onEditar: () => void;
  /** Custo do mapa à parte; undefined/null = desconhecido ("—"). */
  custo: number | null | undefined;
  mostrarCusto: boolean;
  mostrarLucro: boolean;
}

const COR_TIPO = {
  dispositivo: "bg-blue-600 text-white",
  produto: "bg-violet-600 text-white",
  peca: "bg-amber-600 text-white",
} as const;

export function CartaoItemCatalogoDesktop(p: CartaoItemCatalogoDesktopProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop.cartao" });
  const { valoresOcultos } = useOcultarValores();
  const { item } = p;
  const foto = item.fotos?.[0] || item.foto_url;
  const codigo = codigoDoItem(item);
  const categorias = categoriasDoItem(item.id, p.grupos);
  const oculto = estaOculto(item);
  const estoque = seloEstoque(item);
  const preco = precoEfetivo(item);
  const temPromocao = preco != null && item.preco != null && preco < item.preco;
  const lucro = lucroDoItem(item, p.custo);
  const IconeTipo = item.tipo_item === "dispositivo" ? Smartphone : item.tipo_item === "peca" ? Wrench : Package;
  const corLucro = valoresOcultos || lucro == null ? undefined : lucro < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";
  const detalhes =
    item.tipo_item === "dispositivo"
      ? [item.tipo_dispositivo, item.capacidade_gb ? `${item.capacidade_gb}GB` : null, item.cor].filter(Boolean).join(" · ")
      : null;
  const idMarcar = `entra-${item.id}`;

  const fotoBloco = (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-muted to-muted/40",
        p.modo === "grade" ? "aspect-square w-36 xl:w-40" : "h-16 w-16",
      )}
    >
      {foto ? (
        <img src={foto} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted-foreground/50">
          <IconeTipo className={p.modo === "grade" ? "h-10 w-10" : "h-6 w-6"} aria-hidden="true" />
        </div>
      )}
      {p.modo === "grade" && (
        <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold", COR_TIPO[item.tipo_item])}>
          {t(`tipos.${item.tipo_item}`)}
        </span>
      )}
      {p.modo === "grade" && item.quantidade > 1 && (
        <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
          {t("quantidade", { count: item.quantidade })}
        </span>
      )}
    </div>
  );

  const chips = (
    <div className="flex flex-wrap items-center gap-1.5">
      {p.modo === "lista" && (
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", COR_TIPO[item.tipo_item])}>{t(`tipos.${item.tipo_item}`)}</span>
      )}
      {codigo && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{codigo}</span>}
      {categorias.map((c) => {
        const hex = corDaCategoria(c.cor);
        return (
          <span
            key={c.id}
            className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", !hex && "border-border bg-muted")}
            style={hex ? { backgroundColor: `color-mix(in srgb, ${hex} 12%, transparent)`, borderColor: `color-mix(in srgb, ${hex} 40%, transparent)` } : undefined}
          >
            <IconeDaCategoria nome={c.nome} icone={c.icone} className="h-3 w-3" style={hex ? { color: hex } : undefined} />
            {c.nome}
          </span>
        );
      })}
    </div>
  );

  const valores = (
    <div className={cn("grid gap-2", p.modo === "grade" ? "border-t pt-3" : "", colunas(p.mostrarCusto, p.mostrarLucro, p.modo))}>
      {p.mostrarCusto && (
        <Valor rotulo={t("custo")}>{p.custo == null ? "—" : <ValorMonetario valor={p.custo} tipo="custo" />}</Valor>
      )}
      <Valor rotulo={t("preco")}>
        {preco == null ? (
          <span className="text-muted-foreground">{t("consulte")}</span>
        ) : (
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            {temPromocao && (
              <span className="text-xs font-normal text-muted-foreground line-through">
                <ValorMonetario valor={item.preco!} tipo="preco" />
              </span>
            )}
            <ValorMonetario valor={preco} tipo="preco" />
          </span>
        )}
      </Valor>
      {p.mostrarLucro && (
        <Valor rotulo={t("lucro")} className={corLucro}>
          {lucro == null ? "—" : <ValorMonetario valor={lucro} tipo="lucro" />}
        </Valor>
      )}
    </div>
  );

  const selos = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
          estoque === "em_estoque"
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
            : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
        )}
      >
        {estoque === "em_estoque" ? <PackageCheck className="h-3 w-3" aria-hidden="true" /> : <PackageX className="h-3 w-3" aria-hidden="true" />}
        {estoque === "em_estoque" ? t("emEstoque") : t("semEstoque")}
      </span>
      {oculto && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          <EyeOff className="h-3 w-3" aria-hidden="true" />
          {t("oculto")}
        </span>
      )}
    </div>
  );

  const acoes = (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor={idMarcar}
        className={cn(
          "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
          p.marcado ? "border-primary/50 bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
        )}
      >
        <Checkbox id={idMarcar} checked={p.marcado} onCheckedChange={p.onAlternarMarcado} />
        {t("entra")}
      </label>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
            disabled={p.atualizandoOculto}
            onClick={p.onAlternarOculto}
            aria-label={`${oculto ? t("mostrar") : t("ocultar")}: ${oculto ? t("mostrarAjuda") : t("ocultarAjuda")}`}
          >
            {p.atualizandoOculto ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : oculto ? (
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {oculto ? t("mostrar") : t("ocultar")}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{oculto ? t("mostrarAjuda") : t("ocultarAjuda")}</TooltipContent>
      </Tooltip>
      {p.modoEdicao && (
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={p.onEditar} aria-label={t("editar")} title={t("editar")}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );

  if (p.modo === "lista") {
    return (
      <div className={cn("flex items-center gap-4 rounded-xl border bg-card p-3", oculto && "opacity-80")}>
        {fotoBloco}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold" title={item.nome}>
            {item.nome}
          </p>
          {detalhes && <p className="truncate text-xs text-muted-foreground">{detalhes}</p>}
          {chips}
        </div>
        <div className="w-[280px] shrink-0">{valores}</div>
        <div className="w-[150px] shrink-0">{selos}</div>
        <div className="shrink-0">{acoes}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-4 rounded-2xl border bg-card p-3 shadow-sm", oculto && "opacity-80")}>
      {fotoBloco}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-snug" title={item.nome}>
            {item.nome}
          </p>
          {detalhes && <p className="truncate text-xs text-muted-foreground">{detalhes}</p>}
        </div>
        {chips}
        <div className="mt-auto space-y-2">
          {valores}
          {selos}
          {acoes}
        </div>
      </div>
    </div>
  );
}

function colunas(custo: boolean, lucro: boolean, modo: ModoVisualizacao) {
  const n = 1 + (custo ? 1 : 0) + (lucro ? 1 : 0);
  if (modo === "lista") return n === 3 ? "grid-cols-3" : n === 2 ? "grid-cols-2" : "grid-cols-1";
  return n === 3 ? "grid-cols-3 divide-x [&>*:not(:first-child)]:pl-2" : n === 2 ? "grid-cols-2 divide-x [&>*:not(:first-child)]:pl-2" : "grid-cols-1";
}

function Valor({ rotulo, children, className }: { rotulo: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{rotulo}</p>
      <div className={cn("truncate text-sm font-bold", className)}>{children}</div>
    </div>
  );
}

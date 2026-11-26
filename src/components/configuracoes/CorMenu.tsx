/**
 * "Cor do menu" (Configurações → Cores): uma cor só para a barra lateral
 * (computador) e a barra inferior (celular/PWA). Grava SÓ a chave menu_cor de
 * cores_personalizadas, em cada linha do dono (matriz e filiais), mesclando com
 * o que a linha já tem. "Restaurar padrão" remove a chave: o menu volta ao CSS
 * de sempre. Texto, ícones e destaque saem de src/lib/menu/corMenu.ts, sempre
 * com contraste.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Check, Home, LayoutGrid, Loader2, Menu, PanelLeft, RotateCcw, ShoppingCart, Smartphone, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  definirCorMenu,
  gravarCoresPorLinha,
  removerCorMenu,
  type ClienteCores,
} from "@/lib/configuracaoLoja/coresPersonalizadasLinhas";
import { NOMES_VARIAVEIS_MENU, VARIAVEIS_MENU_PADRAO, normalizarCorHex, variaveisDoMenu, variavelParaHex } from "@/lib/menu/corMenu";
import { aplicarCorMenu } from "@/lib/menu/aplicarCorMenu";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { CHAVE_QUERY_COR_MENU } from "@/hooks/useCorMenu";

/** Paletas prontas. `cor: null` = padrão do sistema (sem chave gravada). Nome: cores.menu.paletas.<id>. */
const PALETAS_MENU: { id: string; cor: string | null }[] = [
  { id: "padrao", cor: null },
  { id: "preto", cor: "#000000" },
  { id: "grafite", cor: "#1f2937" },
  { id: "azulMarinho", cor: "#172554" },
  { id: "azul", cor: "#1d4ed8" },
  { id: "roxo", cor: "#4c1d95" },
  { id: "verde", cor: "#064e3b" },
  { id: "vinho", cor: "#4a0e1c" },
  { id: "laranja", cor: "#c2410c" },
  { id: "claro", cor: "#f1f5f9" },
];

/** Variáveis --sidebar-* inline num contêiner: a prévia usa as mesmas classes do menu de verdade. */
function estiloVariaveis(cor: string | null): CSSProperties {
  const v = variaveisDoMenu(cor) ?? VARIAVEIS_MENU_PADRAO;
  const estilo: Record<string, string> = {};
  for (const nome of NOMES_VARIAVEIS_MENU) estilo[`--sidebar-${nome}`] = v[nome];
  return estilo as CSSProperties;
}

interface Props {
  /** Cor já gravada (null = padrão). */
  corSalva: string | null;
  onGravada: (cor: string | null) => void;
}

export function CorMenu({ corSalva, onGravada }: Props) {
  const { t } = useTranslation("configuracoes");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { lojaUserId } = useFuncionarioPermissoes();
  const [rascunho, setRascunho] = useState<string | null>(corSalva);
  const [textoHex, setTextoHex] = useState(corSalva ?? "");
  const [gravando, setGravando] = useState(false);

  useEffect(() => {
    setRascunho(corSalva);
    setTextoHex(corSalva ?? "");
  }, [corSalva]);

  const escolher = (cor: string | null) => {
    const hex = cor ? normalizarCorHex(cor) : null;
    if (cor && !hex) return;
    setRascunho(hex);
    setTextoHex(hex ?? "");
  };

  const digitar = (valor: string) => {
    setTextoHex(valor);
    const hex = normalizarCorHex(valor);
    if (hex) setRascunho(hex);
  };

  const textoInvalido = textoHex.trim() !== "" && !normalizarCorHex(textoHex);
  const variaveisPrevia = estiloVariaveis(rascunho);

  const gravar = async (cor: string | null) => {
    setGravando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const linhas = await gravarCoresPorLinha(
        supabase as unknown as ClienteCores,
        user.id,
        cor ? definirCorMenu(cor) : removerCorMenu,
      );
      if (linhas === 0) throw new Error("Nenhuma configuração da loja para gravar");
      onGravada(cor);
      // Gravou na própria loja: o menu muda na hora (e fica lembrado para a próxima abertura).
      if (lojaUserId === user.id) aplicarCorMenu(cor);
      queryClient.invalidateQueries({ queryKey: [CHAVE_QUERY_COR_MENU] });
      toast({
        title: cor ? t("cores.menu.salva") : t("cores.menu.voltouPadrao"),
        description: t("cores.menu.salvaDescricao"),
      });
    } catch (erro) {
      console.error("Erro ao salvar a cor do menu:", erro);
      toast({ title: t("cores.erroSalvar"), description: t("cores.menu.erroSalvar"), variant: "destructive" });
    } finally {
      setGravando(false);
    }
  };

  const itensPrevia = [
    { icone: Home, rotulo: t("cores.menu.previaItemNormal"), estado: "normal" as const },
    { icone: Wrench, rotulo: t("cores.menu.previaItemHover"), estado: "hover" as const },
    { icone: ShoppingCart, rotulo: t("cores.menu.previaItemAtivo"), estado: "ativo" as const },
    { icone: Users, rotulo: t("cores.menu.previaItemNormal"), estado: "normal" as const },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PanelLeft className="h-5 w-5" />
          {t("cores.menu.titulo")}
        </CardTitle>
        <CardDescription>{t("cores.menu.descricao")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>{t("cores.escolhaPaleta")}</Label>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {PALETAS_MENU.map((p) => {
              const ativo = rascunho === p.cor;
              const nome = t(`cores.menu.paletas.${p.id}`);
              const fundo = p.cor ?? variavelParaHex(VARIAVEIS_MENU_PADRAO.background);
              const marca = variavelParaHex((variaveisDoMenu(p.cor) ?? VARIAVEIS_MENU_PADRAO)["accent-foreground"]);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => escolher(p.cor)}
                  aria-pressed={ativo}
                  title={nome}
                  aria-label={nome}
                  className={cn(
                    "relative h-10 rounded-md border-2 transition-all hover:scale-105",
                    ativo ? "border-foreground ring-2 ring-foreground ring-offset-2" : "border-border hover:border-muted-foreground/50",
                  )}
                  style={{ background: fundo }}
                >
                  {ativo && <Check className="absolute inset-0 m-auto h-5 w-5" style={{ color: marca }} />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="menu-cor-livre">{t("cores.menu.corLivre")}</Label>
            <input
              id="menu-cor-livre"
              type="color"
              value={rascunho ?? variavelParaHex(VARIAVEIS_MENU_PADRAO.background)}
              onChange={(e) => escolher(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded-md border border-input bg-background p-1"
            />
          </div>
          <div className="flex flex-col gap-2 sm:w-40">
            <Label htmlFor="menu-cor-hex">{t("cores.menu.codigo")}</Label>
            <Input
              id="menu-cor-hex"
              value={textoHex}
              placeholder="#1f2937"
              maxLength={7}
              onChange={(e) => digitar(e.target.value)}
              aria-invalid={textoInvalido}
            />
          </div>
          {textoInvalido && <p className="text-sm text-destructive sm:pb-2">{t("cores.menu.codigoInvalido")}</p>}
        </div>

        <div className="space-y-3">
          <Label>{t("cores.menu.previa")}</Label>
          <div className="p-4 rounded-lg border bg-muted/30 space-y-4" data-previa-cor-menu={rascunho ?? "padrao"}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {/* Barra lateral (computador) */}
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><PanelLeft className="h-3.5 w-3.5" />{t("cores.menu.previaLateral")}</p>
                <div style={variaveisPrevia} className="w-full sm:w-52 overflow-hidden rounded-md border border-sidebar-border bg-sidebar">
                  <div className="flex items-center gap-2 border-b border-sidebar-border px-3 py-2">
                    <div className="h-5 w-5 rounded bg-sidebar-primary" />
                    <span className="text-sm font-bold text-sidebar-accent-foreground">Méc</span>
                  </div>
                  <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-muted">{t("cores.menu.previaGrupo")}</p>
                  <div className="space-y-0.5 p-2">
                    {itensPrevia.map(({ icone: Icone, rotulo, estado }, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                          estado === "ativo" && "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary [&>svg]:text-sidebar-primary",
                          estado === "hover" && "bg-sidebar-hover text-sidebar-hover-foreground",
                          estado === "normal" && "text-sidebar-foreground",
                        )}
                      >
                        <Icone className="h-4 w-4 shrink-0" />
                        <span className="truncate">{rotulo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Barra inferior (celular) — as mesmas cores da MobileBottomNav */}
              <div className="flex-1 space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Smartphone className="h-3.5 w-3.5" />{t("cores.menu.previaInferior")}</p>
                <div style={variaveisPrevia} className="max-w-xs">
                  <div
                    className={cn("flex h-14 items-stretch justify-around rounded-md border-t", rascunho ? "border-sidebar-border" : "border-border/50")}
                    style={{ background: rascunho ? "hsl(var(--sidebar-background) / 0.97)" : "hsl(var(--foreground) / 0.97)" }}
                  >
                    {[
                      { icone: Home, ativo: true },
                      { icone: Wrench, ativo: false },
                      { icone: LayoutGrid, ativo: false },
                      { icone: Menu, ativo: false },
                    ].map(({ icone: Icone, ativo }, i) => (
                      <div
                        key={i}
                        className={cn(
                          "relative flex flex-1 flex-col items-center justify-center gap-0.5",
                          ativo ? (rascunho ? "text-sidebar-primary" : "text-primary") : (rascunho ? "text-sidebar-foreground" : "text-background/60"),
                        )}
                      >
                        {ativo && <div className={cn("absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full", rascunho ? "bg-sidebar-primary" : "bg-primary")} />}
                        <Icone className={cn("h-5 w-5", ativo && "scale-110")} />
                        <span className={cn("text-[10px] font-medium", ativo && "font-semibold")}>
                          {ativo ? t("cores.menu.previaItemAtivo") : t("cores.menu.previaItemNormal")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{rascunho ? t("cores.menu.previaEscolhida") : t("cores.menu.previaPadrao")}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button onClick={() => gravar(rascunho)} disabled={gravando || rascunho === corSalva} className="flex-1">
            {gravando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            {gravando ? t("cores.salvando") : t("cores.menu.salvar")}
          </Button>
          <Button variant="outline" onClick={() => (corSalva ? gravar(null) : escolher(null))} disabled={gravando || (!corSalva && !rascunho)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("cores.menu.restaurarPadrao")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CreditCard, KeyRound, LogOut, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DialogTrocarSenha } from "@/components/layout/DialogTrocarSenha";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useLogout } from "@/hooks/useLogout";
import { MENU_PRINCIPAL, filtrarMenuVisivel } from "@/lib/menu/menuPrincipal";
import type { PermissoesModulos } from "@/types/funcionario";

const iniciaisDe = (texto: string) => {
  const palavras = texto.trim().split(/\s+/);
  if (palavras.length >= 2) return (palavras[0][0] + palavras[1][0]).toUpperCase();
  return palavras[0]?.[0]?.toUpperCase() ?? "?";
};

/** Avatar da topbar com o menu da conta. Plano e Configurações seguem a regra do menu lateral. */
export function MenuUsuario() {
  const { t } = useTranslation("menu");
  const navigate = useNavigate();
  const sair = useLogout();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [trocarSenhaAberto, setTrocarSenhaAberto] = useState(false);
  const { temAcessoModulo: temAcessoFuncionario, isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const { assinatura, carregando: carregandoAssinatura, temAcessoModulo: temAcessoPlano } = useAssinatura();

  useEffect(() => {
    let cancelado = false;
    const carregar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || cancelado) return;
      setEmail(user.email ?? "");
      const { data } = await supabase.from("profiles").select("nome").eq("id", user.id).maybeSingle();
      if (!cancelado) setNome(data?.nome || user.user_metadata?.full_name || user.user_metadata?.name || "");
    };
    carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  const itensVisiveis = useMemo(() => {
    if (carregandoPermissoes) return new Set<string>();
    const itens = filtrarMenuVisivel(MENU_PRINCIPAL.filter((item) => item.url === "/plano" || item.url === "/configuracoes"), {
      carregandoPermissoes,
      isFuncionario,
      carregandoAssinatura,
      temAssinatura: !!assinatura,
      isUltra: false,
      isAdmin: false,
      fiscalVisivel: false,
      importacaoXmlVisivel: false,
      temAcessoPlano: (modulo) => temAcessoPlano(modulo as Parameters<typeof temAcessoPlano>[0]),
      temAcessoFuncionario: (modulo) => temAcessoFuncionario(modulo as keyof PermissoesModulos),
    });
    return new Set(itens.map((item) => item.url));
  }, [assinatura, carregandoAssinatura, carregandoPermissoes, isFuncionario, temAcessoFuncionario, temAcessoPlano]);

  const titulo = nome || email;

  return (
    <>
      {/* modal={false}: o menu fecha sem travar o foco do diálogo de trocar senha */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("cabecalho.perfil")}
            title={titulo || t("cabecalho.perfil")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-shadow hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                {iniciaisDe(titulo)}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            {nome && <p className="truncate text-sm font-semibold text-foreground">{nome}</p>}
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {itensVisiveis.has("/plano") && (
            <DropdownMenuItem onSelect={() => navigate("/plano")}>
              <CreditCard className="mr-2 h-4 w-4" />
              {t("conta.meuPlano")}
            </DropdownMenuItem>
          )}
          {itensVisiveis.has("/configuracoes") && (
            <DropdownMenuItem onSelect={() => navigate("/configuracoes")}>
              <Settings className="mr-2 h-4 w-4" />
              {t("itens.configuracoes")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={!email} onSelect={() => setTrocarSenhaAberto(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            {t("conta.trocarSenha")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => sair()}
            className="text-red-700 focus:bg-red-500/10 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("sair")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogTrocarSenha email={email} aberto={trocarSenhaAberto} onOpenChange={setTrocarSenhaAberto} />
    </>
  );
}

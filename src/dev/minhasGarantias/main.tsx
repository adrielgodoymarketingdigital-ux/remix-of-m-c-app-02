/**
 * Página de teste de "Minhas garantias" — SÓ desenvolvimento
 * (dev/minhas-garantias.html, fora do build). O Playwright simula o Supabase
 * (sessão fictícia; user_roles decide admin) — scripts/minhas-garantias/tela.playwright.mjs.
 *
 * Mostra o MESMO item de menu e o MESMO diálogo sob demanda da página
 * Dispositivos (AcessoMinhasGarantias), com o freio de verdade.
 */
import "@/index.css";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DialogMinhasGarantiasSobDemanda, ItemMenuMinhasGarantias } from "@/components/dispositivos/garantias/AcessoMinhasGarantias";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

function Pagina() {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="p-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button id="menu-configuracoes" variant="outline" className="gap-2">
            <Settings className="h-4 w-4" /> Configurações
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem>Layout de Impressão</DropdownMenuItem>
          <DropdownMenuItem>Termo de Garantia</DropdownMenuItem>
          <DropdownMenuItem>Tipos de Garantia</DropdownMenuItem>
          <ItemMenuMinhasGarantias onAbrir={() => setAberto(true)} />
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogMinhasGarantiasSobDemanda open={aberto} onOpenChange={setAberto} />
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Pagina />
    </QueryClientProvider>
  </StrictMode>,
);

import { Link, Navigate } from "react-router-dom";
import { ChevronRight, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { LeitorXmlCompra } from "@/components/fiscal/LeitorXmlCompra";
import { useImportacaoXmlCompraVisivelStatus } from "@/hooks/useImportacaoXmlCompraVisivel";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";

/**
 * Configurações › Fiscal › Importar XML de compra (etapa 1: só leitura).
 * Só quem passa em useImportacaoXmlCompraVisivel (hoje admin); os demais são
 * redirecionados, mesmo abrindo a URL direto. A leitura do arquivo é toda no
 * navegador (LeitorXmlCompra); a única consulta da página é a configuração da
 * loja, para conferir o CNPJ do destinatário.
 */
export default function ImportarXmlCompra() {
  const { visivel, carregando } = useImportacaoXmlCompraVisivelStatus();
  const { config: configLoja } = useConfiguracaoLoja();

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!visivel) return <Navigate to="/dashboard" replace />;

  return (
    <AppLayout>
      <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">
          <div className="lg:pt-6">
            <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              <Link to="/configuracoes" className="hover:text-foreground">Configurações</Link>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              <Link to="/configuracoes/fiscal" className="hover:text-foreground">Fiscal</Link>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              <span className="text-foreground">Importar XML de compra</span>
            </nav>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-[28px]">Importar XML de compra</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Leia o XML da NF-e que o fornecedor emitiu para a sua loja.
            </p>
          </div>

          <LeitorXmlCompra documentosLoja={[configLoja?.cnpj]} />
        </div>
      </main>
    </AppLayout>
  );
}

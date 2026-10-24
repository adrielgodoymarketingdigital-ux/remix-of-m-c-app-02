import { useCallback, useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useComecarDoZeroVisivel } from "@/hooks/useComecarDoZeroVisivel";
import { FluxoComecarDoZero } from "./FluxoComecarDoZero";

const TITULO = "Começar do zero";
const DESCRICAO = "Apague de vez os dados que você escolher (vendas, OS, clientes, financeiro, estoque ou orçamentos). Login, plano e configurações da loja ficam.";

interface Props {
  /** id do card de exportação, para o atalho "Exportar meus dados antes". */
  idExportacao: string;
}

/** Card "Começar do zero" de Configurações › Exportação. Não existe para quem não pode ver. */
export function CardComecarDoZero({ idExportacao }: Props) {
  const visivel = useComecarDoZeroVisivel();
  const isMobile = useIsMobile();
  const [aberto, setAberto] = useState(false);
  const [abertura, setAbertura] = useState(0);
  const [executando, setExecutando] = useState(false);

  const mudarAberto = useCallback((v: boolean) => {
    if (!v && executando) return; // não fecha no meio da exclusão
    setAberto(v);
  }, [executando]);
  const abrir = () => { setAbertura((n) => n + 1); setAberto(true); };
  const irParaExportacao = () => {
    setAberto(false);
    window.setTimeout(() => document.getElementById(idExportacao)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
  };

  if (!visivel) return null;

  const fluxo = (
    <FluxoComecarDoZero
      key={abertura}
      onFechar={() => mudarAberto(false)}
      onIrParaExportacao={irParaExportacao}
      onExecutandoChange={setExecutando}
    />
  );

  return (
    <>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" aria-hidden="true" />
            {TITULO}
          </CardTitle>
          <CardDescription>{DESCRICAO}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={abrir}>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Começar do zero
          </Button>
        </CardContent>
      </Card>

      {isMobile ? (
        <Drawer open={aberto} onOpenChange={mudarAberto} dismissible={!executando}>
          <DrawerContent className="max-h-[92vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>{TITULO}</DrawerTitle>
              <DrawerDescription>Apagar dados da sua loja</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">{fluxo}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={aberto} onOpenChange={mudarAberto}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{TITULO}</DialogTitle>
              <DialogDescription>Apagar dados da sua loja</DialogDescription>
            </DialogHeader>
            {fluxo}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

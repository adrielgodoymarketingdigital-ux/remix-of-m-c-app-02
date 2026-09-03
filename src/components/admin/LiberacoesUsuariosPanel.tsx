import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { KeyRound, Plus, RefreshCw, ChevronDown, History } from "lucide-react";
import { useLiberacoesTemporarias } from "@/hooks/useLiberacoesTemporarias";
import { DialogLiberacaoTemporaria } from "@/components/admin/DialogLiberacaoTemporaria";
import { TabelaLiberacoesAtivas } from "@/components/admin/TabelaLiberacoesAtivas";

export function LiberacoesUsuariosPanel() {
  const {
    liberacoesAtivas,
    historico,
    isLoading,
    isLoadingHistorico,
    recarregar,
    revogarLiberacao,
  } = useLiberacoesTemporarias();

  const [dialogAberto, setDialogAberto] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-green-600" />
              Liberações Ativas
              <Badge variant="secondary">{liberacoesAtivas.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={recarregar} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button onClick={() => setDialogAberto(true)} className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-1" />
                Nova liberação
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Acessos concedidos por prazo. Revertem sozinhos ao expirar (cron a cada 10 min) ou
            manualmente em "Revogar agora".
          </p>
        </CardHeader>
        <CardContent>
          <TabelaLiberacoesAtivas
            liberacoes={liberacoesAtivas}
            isLoading={isLoading}
            onRevogar={revogarLiberacao}
          />
        </CardContent>
      </Card>

      <Collapsible open={historicoAberto} onOpenChange={setHistoricoAberto}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Histórico (últimas 30)
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    historicoAberto ? "rotate-180" : ""
                  }`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <TabelaLiberacoesAtivas liberacoes={historico} isLoading={isLoadingHistorico} modoHistorico />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <DialogLiberacaoTemporaria
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        onConfirmado={recarregar}
      />
    </div>
  );
}

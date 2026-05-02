import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Columns3, Zap } from "lucide-react";
import { useOSColunas, COLUNAS_DISPONIVEIS, ACOES_DISPONIVEIS, CONFIG_PADRAO, ConfiguracaoColunas } from "@/hooks/useOSColunas";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DialogPersonalizarColunas({ open, onOpenChange }: Props) {
  const { config, salvar } = useOSColunas();
  const [colunasAtivas, setColunasAtivas] = useState<string[]>(config.colunas);
  const [acoesAtivas, setAcoesAtivas] = useState<string[]>(config.acoes_principais);

  // Sincroniza quando config carregar do Supabase
  useEffect(() => {
    setColunasAtivas(config.colunas);
    setAcoesAtivas(config.acoes_principais);
  }, [config]);

  const toggleColuna = (key: string) => {
    setColunasAtivas(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const toggleAcao = (key: string) => {
    setAcoesAtivas(prev =>
      prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key]
    );
  };

  const handleSalvar = async () => {
    if (colunasAtivas.length === 0) {
      toast.error("Selecione pelo menos uma coluna");
      return;
    }
    await salvar({ colunas: colunasAtivas, acoes_principais: acoesAtivas });
    toast.success("Preferências salvas!");
    onOpenChange(false);
  };

  const handleRedefinir = () => {
    setColunasAtivas(CONFIG_PADRAO.colunas);
    setAcoesAtivas(CONFIG_PADRAO.acoes_principais);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Columns3 className="h-5 w-5 text-blue-500" />
            Personalizar Tabela de OS
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">

          {/* Colunas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Colunas visíveis</p>
              <Badge variant="outline" className="text-xs">
                {colunasAtivas.length}/{COLUNAS_DISPONIVEIS.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {COLUNAS_DISPONIVEIS.map(col => (
                <div key={col.key}
                  className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{col.label}</span>
                  </div>
                  <Switch
                    checked={colunasAtivas.includes(col.key)}
                    onCheckedChange={() => toggleColuna(col.key)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium">Ações principais</p>
                <p className="text-xs text-muted-foreground">
                  As demais ficam no menu "..."
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {acoesAtivas.length}/{ACOES_DISPONIVEIS.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {ACOES_DISPONIVEIS.map(acao => (
                <div key={acao.key}
                  className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{acao.label}</span>
                    {!acoesAtivas.includes(acao.key) && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        no menu
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={acoesAtivas.includes(acao.key)}
                    onCheckedChange={() => toggleAcao(acao.key)}
                  />
                </div>
              ))}
            </div>
          </div>

        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={handleRedefinir}>
            Redefinir padrão
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar}>
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

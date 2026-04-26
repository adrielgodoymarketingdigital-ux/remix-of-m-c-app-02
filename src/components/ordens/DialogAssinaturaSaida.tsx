import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Smartphone, Loader2, Banknote, CreditCard, Wallet, Calendar, DollarSign } from "lucide-react";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { AvariasOS, TipoAssinatura } from "@/types/ordem-servico";
import { AssinaturaDigital } from "./AssinaturaDigital";
import { formatCurrency } from "@/lib/formatters";
import { checklistIcons } from "@/lib/checklist-icons";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'debito', label: 'Cartão de Débito', icon: CreditCard },
  { value: 'credito', label: 'Cartão de Crédito', icon: CreditCard },
  { value: 'credito_parcelado', label: 'Crédito Parcelado', icon: Wallet },
  { value: 'a_prazo', label: 'A Prazo', icon: Calendar },
];

interface DialogAssinaturaSaidaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico | null;
  onSuccess: () => void;
}

export const DialogAssinaturaSaida = ({
  open,
  onOpenChange,
  ordem,
  onSuccess,
}: DialogAssinaturaSaidaProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [assinaturaSaida, setAssinaturaSaida] = useState<string | null>(null);
  const [tipoAssinaturaSaida, setTipoAssinaturaSaida] = useState<TipoAssinatura>("digital");
  const [formaPagamento, setFormaPagamento] = useState<string>("");

  if (!ordem) return null;

  const avariasData = ordem.avarias as AvariasOS | null;
  const checklistSaida = avariasData?.checklist?.saida || {};
  const formaPagamentoAtual = avariasData?.dados_pagamento?.forma || (ordem as any).forma_pagamento || "";

  const handleSalvarAssinatura = async () => {
    // Se for digital, precisa ter assinatura
    if (tipoAssinaturaSaida === 'digital' && !assinaturaSaida) {
      toast({
        title: "Assinatura necessária",
        description: "Por favor, assine no campo para confirmar o recebimento.",
        variant: "destructive",
      });
      return;
    }

    const formaSelecionada = formaPagamento || formaPagamentoAtual;

    setLoading(true);
    try {
      // Resolver userId efetivo via função do banco (funcionário usa ID do dono)
      const { data: effectiveUserId, error: rpcError } = await supabase.rpc('get_loja_owner_id');
      if (rpcError || !effectiveUserId) throw new Error("Não foi possível identificar o usuário");

      // Atualizar o campo avarias com a assinatura de saída e forma de pagamento
      const novasAvarias: AvariasOS = {
        ...avariasData,
        assinaturas: {
          ...avariasData?.assinaturas,
          cliente_saida: tipoAssinaturaSaida === 'digital' ? assinaturaSaida : undefined,
          data_assinatura_saida: new Date().toISOString(),
          tipo_assinatura_saida: tipoAssinaturaSaida,
        },
        dados_pagamento: {
          ...avariasData?.dados_pagamento,
          forma: formaSelecionada || avariasData?.dados_pagamento?.forma,
        },
      };

      const updateData: any = {
        avarias: novasAvarias as any,
        status: "entregue",
      };

      // Atualizar forma_pagamento na tabela principal também
      if (formaSelecionada) {
        updateData.forma_pagamento = formaSelecionada;
      }

      const { error } = await supabase
        .from("ordens_servico")
        .update(updateData)
        .eq("id", ordem.id)
        .eq("user_id", effectiveUserId);

      if (error) throw error;

      // Marcar conta vinculada como recebida (exceto se for a_prazo)
      const deveMarcarRecebido = formaSelecionada !== 'a_prazo';

      if (deveMarcarRecebido) {
        // Buscar conta vinculada por os_numero
        let contaId: string | null = null;

        const { data: contaPorNumero } = await supabase
          .from("contas")
          .select("id")
          .eq("user_id", effectiveUserId)
          .eq("os_numero", ordem.numero_os)
          .eq("tipo", "receber")
          .eq("status", "pendente")
          .maybeSingle();

        contaId = contaPorNumero?.id || null;

        if (!contaId) {
          const { data: contaPorNome } = await supabase
            .from("contas")
            .select("id")
            .eq("user_id", effectiveUserId)
            .ilike("nome", `%OS ${ordem.numero_os}%`)
            .eq("tipo", "receber")
            .eq("status", "pendente")
            .maybeSingle();
          contaId = contaPorNome?.id || null;
        }

        if (contaId) {
          await supabase
            .from("contas")
            .update({ status: "recebido" })
            .eq("id", contaId);
        }
      }

      toast({
        title: "Entrega confirmada",
        description: "A assinatura de recebimento foi registrada com sucesso.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar assinatura:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível registrar a assinatura.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formaAtualLabel = FORMAS_PAGAMENTO.find(f => f.value === formaPagamentoAtual)?.label || formaPagamentoAtual;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar Entrega - OS #{ordem.numero_os}</DialogTitle>
          <DialogDescription>
            O cliente deve assinar abaixo para confirmar o recebimento do dispositivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo da OS */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resumo do Serviço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dispositivo:</span>
                <span className="font-medium">
                  {ordem.dispositivo_marca} {ordem.dispositivo_modelo}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Defeito:</span>
                <span className="font-medium truncate max-w-[200px]">
                  {ordem.defeito_relatado}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor:</span>
                <span className="font-bold text-primary">
                  {formatCurrency(ordem.total || 0)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Forma de Pagamento */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Forma de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {formaPagamentoAtual && (
                <p className="text-xs text-muted-foreground mb-2">
                  Forma atual: <span className="font-medium">{formaAtualLabel}</span>
                </p>
              )}
              <Select value={formaPagamento || formaPagamentoAtual} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((forma) => {
                    const Icon = forma.icon;
                    return (
                      <SelectItem key={forma.value} value={forma.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {forma.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Checklist de Saída */}
          {Object.keys(checklistSaida).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Checklist de Saída</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(checklistSaida).map(([item, status]) => {
                    const Icon = checklistIcons[item] || Smartphone;
                    return (
                      <div key={item}>
                        <div className="flex items-center gap-2 text-sm">
                          <Icon className="h-3 w-3 text-muted-foreground" />
                          <span className="flex-1 capitalize text-xs">
                            {item.replace(/_/g, " ")}
                          </span>
                          {status ? (
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-600" />
                          )}
                        </div>
                        {item === 'peca_trocada' && status && avariasData?.checklist?.peca_trocada_descricao_saida && (
                          <p className="text-xs text-muted-foreground italic pl-5">
                            Peça: {avariasData.checklist.peca_trocada_descricao_saida}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Assinatura */}
          <AssinaturaDigital
            label="Assinatura de Recebimento"
            textoAceite="Declaro ter recebido o dispositivo nas condições descritas acima e estou ciente do termo de garantia de 90 dias para o serviço executado."
            onSave={setAssinaturaSaida}
            onClear={() => setAssinaturaSaida(null)}
            onTipoChange={(tipo) => {
              setTipoAssinaturaSaida(tipo);
              if (tipo === 'fisica') setAssinaturaSaida(null);
            }}
            tipoAssinatura={tipoAssinaturaSaida}
            mostrarCheckbox={true}
            mostrarSeletorTipo={true}
          />
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSalvarAssinatura} disabled={loading || (tipoAssinaturaSaida === 'digital' && !assinaturaSaida)}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Confirmar Entrega"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

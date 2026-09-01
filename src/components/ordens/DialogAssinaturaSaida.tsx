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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Smartphone, Loader2, Banknote, CreditCard, Wallet, Calendar, DollarSign, ClipboardCheck, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { AvariasOS, Checklist, TipoAssinatura } from "@/types/ordem-servico";
import { AssinaturaDigital } from "./AssinaturaDigital";
import { ChecklistDispositivo } from "./ChecklistDispositivo";
import { formatCurrency } from "@/lib/formatters";
import { checklistIcons } from "@/lib/checklist-icons";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ajustarCaixasFechadosOS } from "@/lib/caixa/ajustarCaixasFechadosOS";
import type { OrdemParaCaixa } from "@/lib/caixa/servicosCaixa";

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
  const [dataRecebimento, setDataRecebimento] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [saldoAPrazo, setSaldoAPrazo] = useState(false);
  const [formaPagamentoSaldo, setFormaPagamentoSaldo] = useState<string>("dinheiro");
  const [dataVencimentoSaldo, setDataVencimentoSaldo] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [mostrarChecklistSaida, setMostrarChecklistSaida] = useState(false);
  const [editandoChecklistSaida, setEditandoChecklistSaida] = useState(false);
  const [checklistPreenchido, setChecklistPreenchido] = useState<Checklist | null>(null);

  // Tempo gasto é sempre persistido em horas decimais (tempo_gasto_horas), mas o
  // usuário pode digitar em minutos ou horas — a unidade é só facilidade de entrada.
  // Ao editar uma OS com tempo já salvo, escolhe a unidade mais natural para exibição:
  // menos de 1h mostra em minutos, 1h ou mais mostra em horas.
  const tempoGastoInicial = ordem?.tempo_gasto_horas;
  const [unidadeTempo, setUnidadeTempo] = useState<"minutos" | "horas">(
    tempoGastoInicial != null && tempoGastoInicial > 0 && tempoGastoInicial < 1 ? "minutos" : "horas"
  );
  const [tempoGasto, setTempoGasto] = useState<string>(() => {
    if (tempoGastoInicial == null) return "";
    return unidadeTempo === "minutos"
      ? String(Math.round(tempoGastoInicial * 60))
      : String(tempoGastoInicial);
  });

  const handleTrocarUnidade = (novaUnidade: "minutos" | "horas") => {
    if (novaUnidade === unidadeTempo) return;

    const valorAtual = tempoGasto ? Number(tempoGasto.replace(",", ".")) : null;
    if (valorAtual != null && !Number.isNaN(valorAtual)) {
      const valorEmHoras = unidadeTempo === "minutos" ? valorAtual / 60 : valorAtual;
      const novoValor =
        novaUnidade === "minutos" ? String(Math.round(valorEmHoras * 60)) : String(valorEmHoras);
      setTempoGasto(novoValor);
    }
    setUnidadeTempo(novaUnidade);
  };

  if (!ordem) return null;

  const avariasData = ordem.avarias as AvariasOS | null;
  const checklistSaida = avariasData?.checklist?.saida || {};
  const checklistSaidaJaPreenchido = Object.keys(checklistSaida).length > 0;
  const formaPagamentoAtual = avariasData?.dados_pagamento?.forma || (ordem as any).forma_pagamento || "";
  const entradaPaga = Number(avariasData?.dados_pagamento?.entrada || 0);
  const temEntrada = entradaPaga > 0;
  const saldoRestante = temEntrada ? Math.max(0, (ordem.total || 0) - entradaPaga) : (ordem.total || 0);

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
      // Resolver userId efetivo: gerente de filial usa proprietario_id
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: gerenteFilial } = await supabase
        .from('empresa_usuarios' as any)
        .select('proprietario_id, empresa_id')
        .eq('gerente_id' as any, authUser?.id)
        .maybeSingle() as any;

      let effectiveUserId: string;
      let empresaIdParaUpdate: string | null = null;

      if (gerenteFilial?.proprietario_id) {
        effectiveUserId = gerenteFilial.proprietario_id;
        empresaIdParaUpdate = gerenteFilial.empresa_id;
      } else {
        const { data: rpcId, error: rpcError } = await supabase.rpc('get_loja_owner_id');
        if (rpcError || !rpcId) throw new Error("Não foi possível identificar o usuário");
        effectiveUserId = rpcId;
      }

      // Checklist de saída é opcional: só grava se o usuário preencheu algo (etapa nova)
      // ou se entrou explicitamente no modo de edição de um checklist já existente
      const houveChecklistSaidaPreenchido =
        !!checklistPreenchido &&
        (editandoChecklistSaida ||
          Object.keys(checklistPreenchido.saida || {}).length > 0 ||
          !!checklistPreenchido.peca_trocada_descricao_saida);

      // Atualizar o campo avarias com a assinatura de saída e forma de pagamento
      const novasAvarias: AvariasOS = {
        ...avariasData,
        checklist: houveChecklistSaidaPreenchido
          ? {
              ...(avariasData?.checklist || { entrada: {}, saida: {} }),
              saida: checklistPreenchido!.saida || {},
              peca_trocada_descricao_saida: checklistPreenchido!.peca_trocada_descricao_saida,
            }
          : avariasData?.checklist,
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

      const tempoGastoDigitado = tempoGasto ? Number(tempoGasto.replace(",", ".")) : null;
      const tempoGastoValido = tempoGastoDigitado != null && !Number.isNaN(tempoGastoDigitado);
      const tempoGastoEmHoras = tempoGastoValido
        ? unidadeTempo === "minutos"
          ? tempoGastoDigitado / 60
          : tempoGastoDigitado
        : null;

      const updateData: any = {
        avarias: novasAvarias as any,
        status: "entregue",
        data_saida: `${dataRecebimento}T${new Date().toTimeString().split(" ")[0]}`,
        // "Data no caixa" (DATE puro) — referência canônica para associar o
        // recebimento desta OS a um caixa no fechamento.
        data_caixa: dataRecebimento,
        tempo_gasto_horas: tempoGastoEmHoras,
      };

      // Atualizar forma_pagamento na tabela principal também
      if (formaSelecionada) {
        updateData.forma_pagamento = formaSelecionada;
      }

      let qUpdate = supabase
        .from("ordens_servico")
        .update(updateData)
        .eq("id", ordem.id)
        .eq("user_id", effectiveUserId);
      if (empresaIdParaUpdate) qUpdate = (qUpdate as any).eq("empresa_id", empresaIdParaUpdate);
      const { error, data: updatedRows } = await (qUpdate as any).select("id");

      if (error) throw error;
      if (!updatedRows || updatedRows.length === 0) throw new Error("Nenhuma OS atualizada — verifique RLS ou empresa_id");

      if (houveChecklistSaidaPreenchido) {
        await supabase.from("os_audit_log").insert({
          os_id: ordem.id,
          acao: "CHECKLIST_SAIDA",
          user_id: effectiveUserId,
          dados_depois: { checklist_saida: checklistPreenchido!.saida },
        } as any);
      }

      if (temEntrada && saldoRestante > 0) {
        // Buscar conta existente da OS
        const { data: contaExistente } = await supabase
          .from("contas")
          .select("id")
          .eq("user_id", effectiveUserId)
          .eq("os_numero", ordem.numero_os)
          .eq("tipo", "receber")
          .eq("status", "pendente")
          .maybeSingle();

        if (saldoAPrazo) {
          // Cenário 2: saldo fica como conta a receber pendente
          if (contaExistente) {
            await supabase.from("contas").update({
              valor: saldoRestante,
              valor_pago: entradaPaga,
              status: "pendente",
              data_vencimento: dataVencimentoSaldo,
              forma_pagamento: formaPagamentoSaldo,
            }).eq("id", contaExistente.id);
          } else {
            await supabase.from("contas").insert({
              nome: `OS ${ordem.numero_os} - ${ordem.cliente?.nome || ""}`.trim(),
              tipo: "receber",
              valor: saldoRestante,
              valor_pago: entradaPaga,
              data: dataVencimentoSaldo,
              data_vencimento: dataVencimentoSaldo,
              os_numero: ordem.numero_os,
              status: "pendente",
              recorrente: false,
              categoria: "Serviços",
              user_id: effectiveUserId,
              empresa_id: empresaIdParaUpdate,
              forma_pagamento: formaPagamentoSaldo,
            });
          }
        } else {
          // Cenário 1: saldo pago na entrega — marcar conta como recebida
          const formaSelecionadaFinal = formaPagamento || formaPagamentoAtual;
          if (contaExistente) {
            await supabase.from("contas").update({
              status: "recebido",
              data: dataRecebimento,
              data_pagamento: dataRecebimento,
              forma_pagamento: formaSelecionadaFinal,
            }).eq("id", contaExistente.id);
          } else {
            await supabase.from("contas").insert({
              nome: `OS ${ordem.numero_os} - ${ordem.cliente?.nome || ""}`.trim(),
              tipo: "receber",
              valor: saldoRestante,
              valor_pago: entradaPaga,
              data: dataRecebimento,
              data_pagamento: dataRecebimento,
              os_numero: ordem.numero_os,
              status: "recebido",
              recorrente: false,
              categoria: "Serviços",
              user_id: effectiveUserId,
              empresa_id: empresaIdParaUpdate,
              forma_pagamento: formaSelecionadaFinal,
            });
          }
        }
      } else {
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
              .update({ status: "recebido", data: dataRecebimento, data_pagamento: dataRecebimento })
              .eq("id", contaId);
          } else {
            await supabase.from("contas").insert({
              nome: `OS ${ordem.numero_os} - ${ordem.cliente?.nome || ""}`.trim(),
              tipo: "receber",
              valor: ordem.total || 0,
              data: dataRecebimento,
              data_pagamento: dataRecebimento,
              os_numero: ordem.numero_os,
              status: "recebido",
              recorrente: false,
              categoria: "Serviços",
              user_id: effectiveUserId,
              empresa_id: empresaIdParaUpdate,
            });
          }
        }
      }

      // Se a "Data no caixa" cair em um caixa JÁ FECHADO (ex.: entrega
      // retroativa), ajusta os totais congelados desse caixa. Caixa aberto se
      // resolve sozinho no próximo fechamento. Nunca bloqueia a entrega.
      try {
        const { data: contaAtual } = await supabase
          .from("contas")
          .select("status")
          .eq("user_id", effectiveUserId)
          .eq("os_numero", ordem.numero_os)
          .eq("tipo", "receber")
          .maybeSingle();

        const ordemBase = ordem as unknown as OrdemParaCaixa & { forma_pagamento?: string | null };
        await ajustarCaixasFechadosOS({
          ordemAntes: { ...ordemBase },
          ordemDepois: {
            ...ordemBase,
            status: "entregue",
            avarias: novasAvarias as unknown as OrdemParaCaixa["avarias"],
            forma_pagamento: formaSelecionada || ordemBase.forma_pagamento || null,
            data_caixa: dataRecebimento,
            data_saida: updateData.data_saida,
          },
          statusContaAntes: null,
          statusContaDepois: contaAtual?.status ?? null,
          userIdCaixa: effectiveUserId,
          empresaId: empresaIdParaUpdate,
        });
      } catch (e) {
        console.error("[DialogAssinaturaSaida] ajuste de caixa fechado falhou:", e);
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
      <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
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
              <div className="flex justify-between items-center pt-1">
                <Label htmlFor="data-recebimento" className="text-muted-foreground font-normal">Data no caixa:</Label>
                <Input
                  id="data-recebimento"
                  type="date"
                  value={dataRecebimento}
                  onChange={(e) => setDataRecebimento(e.target.value)}
                  className="w-auto text-right h-7 text-sm px-2"
                />
              </div>
              <div className="flex justify-between items-center pt-1">
                <Label htmlFor="tempo-gasto" className="text-muted-foreground font-normal">
                  Tempo gasto — opcional:
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="tempo-gasto"
                    type="text"
                    inputMode="decimal"
                    placeholder={unidadeTempo === "minutos" ? "Ex: 90" : "Ex: 1.5"}
                    value={tempoGasto}
                    onChange={(e) => setTempoGasto(e.target.value)}
                    className="w-20 text-right h-7 text-sm px-2"
                  />
                  <div className="flex items-center rounded-md border overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTrocarUnidade("minutos")}
                      className={`px-2 h-7 text-xs transition-colors ${
                        unidadeTempo === "minutos"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      min
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTrocarUnidade("horas")}
                      className={`px-2 h-7 text-xs transition-colors border-l ${
                        unidadeTempo === "horas"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      h
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {temEntrada && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Resumo Financeiro</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor total:</span>
                  <span className="font-medium">{formatCurrency(ordem.total || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Entrada já paga ({avariasData?.dados_pagamento?.forma_pagamento_entrada || 'entrada'}):</span>
                  <span className="font-medium text-green-600">- {formatCurrency(entradaPaga)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Saldo restante:</span>
                  <span className="text-orange-600">{formatCurrency(saldoRestante)}</span>
                </div>
              </CardContent>
            </Card>
          )}

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

          {temEntrada && saldoRestante > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="saldo-prazo"
                  checked={saldoAPrazo}
                  onChange={(e) => setSaldoAPrazo(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="saldo-prazo" className="cursor-pointer">
                  Saldo de {formatCurrency(saldoRestante)} será recebido a prazo
                </Label>
              </div>
              {saldoAPrazo && (
                <div className="space-y-2 pl-6">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Forma de pagamento do saldo</Label>
                    <Select value={formaPagamentoSaldo} onValueChange={setFormaPagamentoSaldo}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAS_PAGAMENTO.filter(f => f.value !== 'a_prazo').map(f => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Data de vencimento</Label>
                    <Input
                      type="date"
                      value={dataVencimentoSaldo}
                      onChange={(e) => setDataVencimentoSaldo(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Checklist de Saída — se já existe (de uma entrega anterior), mostra resumo com opção de editar;
              se não existe, é uma etapa opcional que pode ser pulada sem afetar a confirmação de entrega */}
          <Card>
            <CardHeader className="pb-2">
              {checklistSaidaJaPreenchido && !editandoChecklistSaida ? (
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Checklist de Saída</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setChecklistPreenchido(avariasData?.checklist || { entrada: {}, saida: {} });
                      setEditandoChecklistSaida(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarChecklistSaida((v) => !v)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Checklist de Saída (opcional)
                  </CardTitle>
                  {mostrarChecklistSaida ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )}
              {!checklistSaidaJaPreenchido && !mostrarChecklistSaida && (
                <p className="text-xs text-muted-foreground pt-1">
                  Você pode confirmar a entrega sem preencher esta etapa.
                </p>
              )}
            </CardHeader>

            {/* Resumo somente leitura (já preenchido, ainda não entrou em modo edição) */}
            {checklistSaidaJaPreenchido && !editandoChecklistSaida && (
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
            )}

            {/* Formulário editável: etapa nova (ainda sem dado) expandida, ou edição de um checklist já existente */}
            {((!checklistSaidaJaPreenchido && mostrarChecklistSaida) || (checklistSaidaJaPreenchido && editandoChecklistSaida)) && (
              <CardContent>
                <ChecklistDispositivo
                  tipoDispositivo={ordem.dispositivo_tipo}
                  value={checklistPreenchido || { entrada: {}, saida: {} }}
                  onChange={setChecklistPreenchido}
                  apenasSaida
                />
              </CardContent>
            )}
          </Card>

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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, User, Smartphone, Wrench, Package, CheckCircle2 } from "lucide-react";
import { Orcamento } from "@/types/orcamento";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { useIdentidade } from "@/hooks/useResolvedUserId";

interface DialogConverterOrcamentoOSProps {
  aberto: boolean;
  onFechar: () => void;
  orcamento: Orcamento | null;
  onConvertido: (orcamentoId: string) => void;
}

export function DialogConverterOrcamentoOS({
  aberto,
  onFechar,
  orcamento,
  onConvertido,
}: DialogConverterOrcamentoOSProps) {
  const [convertendo, setConvertendo] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { userId: resolvedUserId, empresaId } = useIdentidade();

  if (!orcamento) return null;

  const itensServico = orcamento.itens.filter((i) => i.tipo === "servico");
  const itensProduto = orcamento.itens.filter((i) => i.tipo === "produto");

  // Monta o defeito relatado a partir dos serviços do orçamento
  const defeitoRelatado = itensServico.length > 0
    ? itensServico.map((i) => i.descricao).join(", ")
    : orcamento.itens.map((i) => i.descricao).join(", ");

  const handleConverter = async () => {
    if (!orcamento) return;
    setConvertendo(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const effectiveUserId = resolvedUserId ?? user.id;

      // 1. Gerar número da OS
      const { data: numeroOS, error: numeroError } = await supabase
        .rpc("generate_os_number", { p_user_id: effectiveUserId });
      if (numeroError) throw numeroError;

      // 2. Resolver cliente_id: se o orçamento tem cliente vinculado, usar; senão tentar buscar por nome
      let clienteId = orcamento.cliente_id || null;

      if (!clienteId && orcamento.cliente_nome) {
        const { data: clienteEncontrado } = await supabase
          .from("clientes")
          .select("id")
          .eq("user_id", effectiveUserId)
          .ilike("nome", orcamento.cliente_nome.trim())
          .maybeSingle();
        clienteId = clienteEncontrado?.id || null;
      }

      // 3. Se não encontrou cliente, criar um novo
      if (!clienteId && orcamento.cliente_nome) {
        const { data: novoCliente, error: clienteError } = await supabase
          .from("clientes")
          .insert({
            user_id: effectiveUserId,
            nome: orcamento.cliente_nome,
            telefone: orcamento.cliente_telefone || null,
            empresa_id: empresaId ?? null,
          })
          .select("id")
          .single();

        if (clienteError) throw clienteError;
        clienteId = novoCliente.id;
      }

      if (!clienteId) throw new Error("Não foi possível identificar ou criar o cliente.");

      // 4. Criar OS
      const { error: osError } = await supabase.from("ordens_servico").insert([{
        numero_os: numeroOS,
        user_id: effectiveUserId,
        cliente_id: clienteId,
        dispositivo_tipo: orcamento.tipo_dispositivo || "celular",
        dispositivo_marca: orcamento.marca_dispositivo || orcamento.fabricante || "",
        dispositivo_modelo: orcamento.modelo_dispositivo || "",
        dispositivo_cor: orcamento.cor_dispositivo || "",
        defeito_relatado: defeitoRelatado,
        total: orcamento.valor_total > 0 ? orcamento.valor_total : null,
        status: "aguardando",
        empresa_id: empresaId ?? null,
        avarias: {
          observacoes_internas: `Convertido do orçamento ${orcamento.numero_orcamento}`,
        },
      }]);

      if (osError) throw osError;

      // 5. Marcar orçamento como convertido
      await supabase
        .from("orcamentos")
        .update({ status: "convertido" })
        .eq("id", orcamento.id);

      onConvertido(orcamento.id);

      toast({
        title: "OS criada com sucesso! 🎉",
        description: `OS ${numeroOS} criada a partir do orçamento ${orcamento.numero_orcamento}.`,
      });

      onFechar();
      navigate("/ordem-servico");
    } catch (err: any) {
      console.error("[converter-orcamento-os]", err);
      toast({
        title: "Erro ao converter",
        description: err.message || "Não foi possível criar a OS.",
        variant: "destructive",
      });
    } finally {
      setConvertendo(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={onFechar}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Converter em Ordem de Serviço
          </DialogTitle>
          <DialogDescription>
            Os dados do orçamento <strong>{orcamento.numero_orcamento}</strong> serão usados para abrir uma nova OS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cliente */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
            <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Cliente</p>
              <p className="text-sm font-semibold">{orcamento.cliente_nome || "—"}</p>
              {orcamento.cliente_telefone && (
                <p className="text-xs text-muted-foreground">{orcamento.cliente_telefone}</p>
              )}
              {!orcamento.cliente_id && orcamento.cliente_nome && (
                <p className="text-xs text-amber-600 mt-1">⚠ Cliente avulso — será cadastrado automaticamente</p>
              )}
            </div>
          </div>

          {/* Dispositivo */}
          {(orcamento.marca_dispositivo || orcamento.modelo_dispositivo || orcamento.tipo_dispositivo) && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
              <Smartphone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Dispositivo</p>
                <p className="text-sm font-semibold">
                  {[orcamento.marca_dispositivo, orcamento.modelo_dispositivo].filter(Boolean).join(" ") || orcamento.tipo_dispositivo}
                </p>
                {orcamento.cor_dispositivo && (
                  <p className="text-xs text-muted-foreground">{orcamento.cor_dispositivo}</p>
                )}
              </div>
            </div>
          )}

          {/* Itens que viram defeito relatado */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
            <Wrench className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Defeito relatado (serviços)</p>
              <p className="text-sm font-medium line-clamp-2">{defeitoRelatado || "—"}</p>
            </div>
          </div>

          {/* Produtos */}
          {itensProduto.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <Package className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-700">Peças / Produtos</p>
                <p className="text-xs text-amber-600">
                  {itensProduto.length} peça(s) do orçamento não são adicionadas automaticamente ao estoque da OS. Você pode adicioná-las manualmente após a criação.
                </p>
              </div>
            </div>
          )}

          {/* Valor */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-sm text-muted-foreground">Valor total da OS</span>
            <span className="font-bold text-primary text-lg">{formatCurrency(orcamento.valor_total)}</span>
          </div>

          {/* O que será criado */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">O que será criado</p>
            {[
              "Nova OS com status 'Aguardando'",
              "Defeito relatado com os serviços do orçamento",
              "Orçamento marcado como 'Convertido'",
              orcamento.cliente_id ? "Cliente vinculado automaticamente" : "Novo cliente criado no cadastro",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button type="button" variant="outline" onClick={onFechar} disabled={convertendo}>
            Cancelar
          </Button>
          <Button onClick={handleConverter} disabled={convertendo}>
            {convertendo ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando OS...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Criar OS
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

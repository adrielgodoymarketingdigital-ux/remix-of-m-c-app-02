import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Phone, MessageCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useResolvedUserId } from "@/hooks/useResolvedUserId";

interface Inadimplente {
  clienteId: string;
  nome: string;
  telefone: string | null;
  totalDevido: number;
  qtdContas: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DialogInadimplentes({ open, onOpenChange }: Props) {
  const [inadimplentes, setInadimplentes] = useState<Inadimplente[]>([]);
  const [loading, setLoading] = useState(false);
  const resolvedUserId = useResolvedUserId();

  useEffect(() => {
    if (!open) return;
    buscarInadimplentes();
  }, [open, resolvedUserId]);

  const buscarInadimplentes = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const targetUserId = resolvedUserId ?? user.id;
      const hoje = new Date().toISOString().split("T")[0];

      const mapa = new Map<string, Inadimplente>();

      // 1) Contas reais vencidas com os_numero → buscar cliente via ordens_servico
      const { data: contasOS } = await supabase
        .from("contas")
        .select("id, nome, valor, data, os_numero")
        .eq("user_id", targetUserId)
        .eq("status", "pendente")
        .not("os_numero", "is", null)
        .lt("data", hoje);

      if (contasOS && contasOS.length > 0) {
        const numerosOS = [...new Set(contasOS.map((c: any) => c.os_numero))];
        const { data: ordensData } = await supabase
          .from("ordens_servico")
          .select("numero_os, clientes(id, nome, telefone)")
          .in("numero_os", numerosOS);

        if (ordensData) {
          const osParaCliente = new Map(
            ordensData.map((os: any) => [os.numero_os, os.clientes])
          );
          contasOS.forEach((conta: any) => {
            const cliente = osParaCliente.get(conta.os_numero) as any;
            if (!cliente) return;
            adicionarInadimplente(mapa, cliente.id, cliente.nome, cliente.telefone, Number(conta.valor));
          });
        }
      }

      // 2) Contas reais vencidas com descricao venda_id:xxx
      const { data: contasVendaDesc } = await supabase
        .from("contas")
        .select("id, nome, valor, data, descricao")
        .eq("user_id", targetUserId)
        .eq("status", "pendente")
        .like("descricao", "venda_id:%")
        .lt("data", hoje);

      if (contasVendaDesc && contasVendaDesc.length > 0) {
        const vendaIds = contasVendaDesc.map((c: any) => c.descricao.replace("venda_id:", ""));
        const { data: vendasData } = await supabase
          .from("vendas")
          .select("id, clientes!vendas_cliente_fkey(id, nome, telefone)")
          .in("id", vendaIds);

        if (vendasData) {
          const vendaParaCliente = new Map(vendasData.map((v: any) => [v.id, v.clientes]));
          contasVendaDesc.forEach((conta: any) => {
            const vendaId = conta.descricao.replace("venda_id:", "");
            const cliente = vendaParaCliente.get(vendaId) as any;
            if (!cliente) return;
            adicionarInadimplente(mapa, cliente.id, cliente.nome, cliente.telefone, Number(conta.valor));
          });
        }
      }

      // 3) Vendas a prazo/a receber vencidas sem conta correspondente
      const { data: vendasVencidas } = await supabase
        .from("vendas")
        .select("id, total, data_prevista_recebimento, data, cliente_id, clientes!vendas_cliente_fkey(id, nome, telefone)")
        .eq("user_id", targetUserId)
        .in("forma_pagamento", ["a_receber", "a_prazo"])
        .eq("recebido", false)
        .eq("cancelada", false)
        .lt("data_prevista_recebimento", hoje);

      if (vendasVencidas && vendasVencidas.length > 0) {
        // Excluir as que já têm conta criada (para não duplicar)
        const idsComConta = new Set(
          (contasVendaDesc || []).map((c: any) => c.descricao.replace("venda_id:", ""))
        );
        vendasVencidas.forEach((v: any) => {
          if (idsComConta.has(v.id)) return;
          const cliente = v.clientes as any;
          if (!cliente) return;
          adicionarInadimplente(mapa, cliente.id, cliente.nome, cliente.telefone, Number(v.total));
        });
      }

      setInadimplentes(
        Array.from(mapa.values()).sort((a, b) => b.totalDevido - a.totalDevido)
      );
    } finally {
      setLoading(false);
    }
  };

  const adicionarInadimplente = (
    mapa: Map<string, Inadimplente>,
    clienteId: string,
    nome: string,
    telefone: string | null,
    valor: number
  ) => {
    const existente = mapa.get(clienteId);
    if (existente) {
      existente.totalDevido += valor;
      existente.qtdContas += 1;
    } else {
      mapa.set(clienteId, { clienteId, nome, telefone, totalDevido: valor, qtdContas: 1 });
    }
  };

  const abrirWhatsApp = (telefone: string, nome: string, totalDevido: number) => {
    const numero = telefone.replace(/\D/g, "");
    const numeroFormatado = numero.startsWith("55") ? numero : `55${numero}`;
    const valorFormatado = totalDevido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const mensagem = encodeURIComponent(
      `Olá ${nome.split(" ")[0]}! Identificamos uma pendência de ${valorFormatado} em nossa loja. Podemos conversar sobre isso?`
    );
    window.open(`https://wa.me/${numeroFormatado}?text=${mensagem}`, "_blank");
  };

  const comTelefone = inadimplentes.filter(i => i.telefone);
  const semTelefone = inadimplentes.filter(i => !i.telefone);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Clientes Inadimplentes
          </DialogTitle>
          <DialogDescription>
            {loading
              ? "Buscando inadimplentes..."
              : inadimplentes.length === 0
              ? "Nenhum cliente inadimplente encontrado"
              : `${inadimplentes.length} cliente(s) com contas vencidas`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : inadimplentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <AlertCircle className="h-10 w-10 opacity-30" />
            <p className="text-sm">Nenhum cliente inadimplente encontrado.</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-3 pb-2">
              {comTelefone.map(inadimplente => (
                <div key={inadimplente.clienteId} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{inadimplente.nome}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {inadimplente.telefone}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-destructive text-sm">
                        <ValorMonetario valor={inadimplente.totalDevido} />
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {inadimplente.qtdContas} conta(s)
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => abrirWhatsApp(inadimplente.telefone!, inadimplente.nome, inadimplente.totalDevido)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Cobrar via WhatsApp
                  </Button>
                </div>
              ))}

              {semTelefone.length > 0 && (
                <div className="space-y-2">
                  {comTelefone.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">
                      Sem telefone cadastrado
                    </p>
                  )}
                  {semTelefone.map(inadimplente => (
                    <div key={inadimplente.clienteId} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{inadimplente.nome}</p>
                        <p className="text-xs text-muted-foreground">Sem telefone cadastrado</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-destructive text-sm">
                          <ValorMonetario valor={inadimplente.totalDevido} />
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {inadimplente.qtdContas} conta(s)
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

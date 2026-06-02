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
import { Conta } from "@/types/conta";

interface Inadimplente {
  clienteId: string;
  nome: string;
  telefone: string | null;
  totalDevido: number;
  contas: Conta[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contasVencidas: Conta[];
}

export function DialogInadimplentes({ open, onOpenChange, contasVencidas }: Props) {
  const [inadimplentes, setInadimplentes] = useState<Inadimplente[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || contasVencidas.length === 0) {
      setInadimplentes([]);
      return;
    }
    buscarInadimplentes();
  }, [open, contasVencidas]);

  const buscarInadimplentes = async () => {
    setLoading(true);
    try {
      const mapa = new Map<string, Inadimplente>();

      // Separar contas por origem
      const contasOS = contasVencidas.filter(c => c.os_numero);
      const contasVenda = contasVencidas.filter(c => c.id.startsWith("venda_"));
      const contasDescricaoVenda = contasVencidas.filter(
        c => !c.os_numero && !c.id.startsWith("venda_") && c.descricao?.startsWith("venda_id:")
      );

      // 1) Contas vinculadas a OS → buscar cliente via ordens_servico
      if (contasOS.length > 0) {
        const numerosOS = [...new Set(contasOS.map(c => c.os_numero!))];
        const { data: ordensData } = await supabase
          .from("ordens_servico")
          .select("numero_os, cliente_id, clientes(id, nome, telefone)")
          .in("numero_os", numerosOS);

        if (ordensData) {
          const osParaCliente = new Map(
            ordensData.map((os: any) => [os.numero_os, os.clientes])
          );
          contasOS.forEach(conta => {
            const cliente = osParaCliente.get(conta.os_numero!) as any;
            if (!cliente) return;
            adicionarInadimplente(mapa, cliente.id, cliente.nome, cliente.telefone, conta);
          });
        }
      }

      // 2) Contas virtuais de venda (id = venda_xxx)
      if (contasVenda.length > 0) {
        const vendaIds = contasVenda.map(c => c.id.replace("venda_", ""));
        const { data: vendasData } = await supabase
          .from("vendas")
          .select("id, cliente_id, clientes!vendas_cliente_fkey(id, nome, telefone)")
          .in("id", vendaIds);

        if (vendasData) {
          const vendaParaCliente = new Map(
            vendasData.map((v: any) => [v.id, v.clientes])
          );
          contasVenda.forEach(conta => {
            const vendaId = conta.id.replace("venda_", "");
            const cliente = vendaParaCliente.get(vendaId) as any;
            if (!cliente) return;
            adicionarInadimplente(mapa, cliente.id, cliente.nome, cliente.telefone, conta);
          });
        }
      }

      // 3) Contas reais com descricao venda_id:xxx
      if (contasDescricaoVenda.length > 0) {
        const vendaIds = contasDescricaoVenda.map(c => c.descricao!.replace("venda_id:", ""));
        const { data: vendasData } = await supabase
          .from("vendas")
          .select("id, cliente_id, clientes!vendas_cliente_fkey(id, nome, telefone)")
          .in("id", vendaIds);

        if (vendasData) {
          const vendaParaCliente = new Map(
            vendasData.map((v: any) => [v.id, v.clientes])
          );
          contasDescricaoVenda.forEach(conta => {
            const vendaId = conta.descricao!.replace("venda_id:", "");
            const cliente = vendaParaCliente.get(vendaId) as any;
            if (!cliente) return;
            adicionarInadimplente(mapa, cliente.id, cliente.nome, cliente.telefone, conta);
          });
        }
      }

      // Contas sem vínculo com cliente → agrupar como "Sem cliente"
      const contasSemCliente = contasVencidas.filter(
        c => !c.os_numero && !c.id.startsWith("venda_") && !c.descricao?.startsWith("venda_id:")
      );
      if (contasSemCliente.length > 0) {
        contasSemCliente.forEach(conta => {
          adicionarInadimplente(mapa, "__sem_cliente__", conta.nome, null, conta);
        });
      }

      setInadimplentes(Array.from(mapa.values()).sort((a, b) => b.totalDevido - a.totalDevido));
    } finally {
      setLoading(false);
    }
  };

  const adicionarInadimplente = (
    mapa: Map<string, Inadimplente>,
    clienteId: string,
    nome: string,
    telefone: string | null,
    conta: Conta
  ) => {
    const existente = mapa.get(clienteId);
    if (existente) {
      existente.totalDevido += Number(conta.valor);
      existente.contas.push(conta);
    } else {
      mapa.set(clienteId, {
        clienteId,
        nome,
        telefone,
        totalDevido: Number(conta.valor),
        contas: [conta],
      });
    }
  };

  const abrirWhatsApp = (telefone: string, nome: string) => {
    const numero = telefone.replace(/\D/g, "");
    const numeroFormatado = numero.startsWith("55") ? numero : `55${numero}`;
    const mensagem = encodeURIComponent(
      `Olá ${nome.split(" ")[0]}! Identificamos uma pendência financeira em nossa loja. Podemos conversar sobre isso?`
    );
    window.open(`https://wa.me/${numeroFormatado}?text=${mensagem}`, "_blank");
  };

  const clientesComTelefone = inadimplentes.filter(
    i => i.clienteId !== "__sem_cliente__" && i.telefone
  );
  const clientesSemTelefone = inadimplentes.filter(
    i => i.clienteId !== "__sem_cliente__" && !i.telefone
  );
  const semCliente = inadimplentes.find(i => i.clienteId === "__sem_cliente__");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Clientes Inadimplentes
          </DialogTitle>
          <DialogDescription>
            {loading ? "Carregando..." : `${clientesComTelefone.length + clientesSemTelefone.length} cliente(s) com contas vencidas`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-3 pb-2">
              {clientesComTelefone.length === 0 && clientesSemTelefone.length === 0 && !semCliente && (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Nenhum cliente identificado nas contas vencidas.
                </p>
              )}

              {clientesComTelefone.map(inadimplente => (
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
                        {inadimplente.contas.length} conta(s)
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => abrirWhatsApp(inadimplente.telefone!, inadimplente.nome)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Cobrar via WhatsApp
                  </Button>
                </div>
              ))}

              {clientesSemTelefone.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Sem telefone cadastrado
                  </p>
                  {clientesSemTelefone.map(inadimplente => (
                    <div key={inadimplente.clienteId} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{inadimplente.nome}</p>
                        <p className="text-xs text-muted-foreground">Sem telefone</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-destructive text-sm">
                          <ValorMonetario valor={inadimplente.totalDevido} />
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {inadimplente.contas.length} conta(s)
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {semCliente && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Contas sem cliente vinculado
                  </p>
                  {semCliente.contas.map(conta => (
                    <div key={conta.id} className="border rounded-lg p-3 flex items-center justify-between gap-2 opacity-70">
                      <p className="text-sm truncate">{conta.nome}</p>
                      <p className="font-semibold text-destructive text-sm shrink-0">
                        <ValorMonetario valor={conta.valor} />
                      </p>
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

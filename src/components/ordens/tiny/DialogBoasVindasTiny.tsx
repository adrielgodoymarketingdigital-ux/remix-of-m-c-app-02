import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plug } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConectar: () => void;
}

export function DialogBoasVindasTiny({ open, onClose, onConectar }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base leading-tight">
                Conecte sua Assistência Parceira
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Veja em tempo real as ordens de serviço, financeiro e reparos da assistência que trabalha com você
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground mb-1">O que é isso?</p>
            <p>
              Essa funcionalidade conecta o seu sistema ao sistema da assistência técnica parceira.
              Assim, você consegue ver diretamente aqui tudo o que está acontecendo lá: os pedidos,
              o status dos reparos e o financeiro — sem precisar ligar ou entrar no sistema deles.
            </p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-2">O que você vai conseguir ver:</p>
            <ul className="space-y-1">
              <li>✅ Ordens de serviço e pedidos em aberto ou concluídos</li>
              <li>✅ Status dos reparos em andamento</li>
              <li>✅ Contas a receber e a pagar</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Como funciona a conexão:</p>
            <p>
              Você vai ser redirecionado para autorizar o acesso ao sistema da assistência parceira.
              É rápido e seguro — funciona como o "Entrar com Google".
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>
            Agora não
          </Button>
          <Button onClick={onConectar} className="gap-2">
            <Plug className="h-4 w-4" />
            Conectar com Tiny
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

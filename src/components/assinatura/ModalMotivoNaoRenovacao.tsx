import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useMotivoNaoRenovacao } from "@/hooks/useMotivoNaoRenovacao";
import {
  AssinaturaParaModal,
  OPCOES_MOTIVO_NAO_RENOVACAO,
  MotivoNaoRenovacaoCategoria,
} from "@/lib/motivosNaoRenovacao";

interface ModalMotivoNaoRenovacaoProps {
  /** `status` de `useVerificacaoAcesso` (repassado pelo ProtectedAppRoute). */
  statusAcesso: string | null | undefined;
  /** `assinatura` de `useVerificacaoAcesso` (repassado pelo ProtectedAppRoute). */
  assinatura: AssinaturaParaModal | null | undefined;
}

/**
 * Modal "Por que você não renovou?" — aparece UMA vez, no primeiro acesso
 * depois do plano vencer. Não trava nada: é fechável e independente do
 * fluxo de acesso (o ProtectedAppRoute segue decidindo o que o usuário
 * pode ou não ver).
 */
export function ModalMotivoNaoRenovacao({
  statusAcesso,
  assinatura,
}: ModalMotivoNaoRenovacaoProps) {
  const { aberto, salvando, registrarResposta, descartar } = useMotivoNaoRenovacao(
    statusAcesso,
    assinatura,
  );

  const [mostrarTexto, setMostrarTexto] = useState(false);
  const [texto, setTexto] = useState("");

  const handleEscolha = (categoria: MotivoNaoRenovacaoCategoria, abreTexto?: boolean) => {
    if (abreTexto) {
      setMostrarTexto(true);
      return;
    }
    void registrarResposta(categoria);
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v && !salvando) descartar();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Por que você não renovou?</DialogTitle>
          <DialogDescription>
            Leva 5 segundos e nos ajuda a melhorar. Se preferir, é só fechar.
          </DialogDescription>
        </DialogHeader>

        {!mostrarTexto ? (
          <div className="flex flex-col gap-2">
            {OPCOES_MOTIVO_NAO_RENOVACAO.map((opcao) => (
              <Button
                key={opcao.categoria}
                variant="outline"
                className="w-full justify-start h-auto py-3 text-left whitespace-normal"
                disabled={salvando}
                onClick={() => handleEscolha(opcao.categoria, opcao.abreTextoLivre)}
              >
                {opcao.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              disabled={salvando}
              onClick={descartar}
            >
              Agora não
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Textarea
              autoFocus
              placeholder="Conta pra gente o que aconteceu (opcional)"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              maxLength={1000}
              disabled={salvando}
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                disabled={salvando}
                onClick={() => {
                  setMostrarTexto(false);
                  setTexto("");
                }}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                disabled={salvando}
                onClick={() => void registrarResposta("outro", texto)}
              >
                {salvando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  "Enviar"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

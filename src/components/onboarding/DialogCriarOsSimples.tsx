import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DadosOsSimples } from "@/hooks/usePrimeirosPassos";

interface DialogCriarOsSimplesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriar: (dados: DadosOsSimples) => Promise<void>;
}

/**
 * Formulário curto para criar a primeira OS direto do card "Primeiros
 * Passos" — sem sair do Dashboard para o menu de OS. A OS é real
 * (aparece nas listas), só não conta na cota do plano.
 */
export function DialogCriarOsSimples({ open, onOpenChange, onCriar }: DialogCriarOsSimplesProps) {
  const [salvando, setSalvando] = useState(false);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [dispositivoTipo, setDispositivoTipo] = useState("celular");
  const [dispositivoMarca, setDispositivoMarca] = useState("");
  const [dispositivoModelo, setDispositivoModelo] = useState("");
  const [defeito, setDefeito] = useState("");

  const podeSalvar =
    clienteNome.trim().length > 0 &&
    dispositivoMarca.trim().length > 0 &&
    defeito.trim().length > 0;

  const handleSalvar = async () => {
    if (!podeSalvar || salvando) return;
    setSalvando(true);
    try {
      await onCriar({
        clienteNome,
        clienteTelefone,
        dispositivoTipo,
        dispositivoMarca,
        dispositivoModelo,
        defeito,
      });
      toast.success("Primeira OS criada! Ela não entra no limite do seu plano.");
      onOpenChange(false);
      setClienteNome("");
      setClienteTelefone("");
      setDispositivoTipo("celular");
      setDispositivoMarca("");
      setDispositivoModelo("");
      setDefeito("");
    } catch (e) {
      console.error("[DialogCriarOsSimples] falha ao criar OS", e);
      toast.error("Não foi possível criar a OS. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crie sua primeira Ordem de Serviço</DialogTitle>
          <DialogDescription>
            Leva menos de 1 minuto. É uma OS de verdade — só não conta no limite do plano.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pp-cliente-nome">Nome do cliente *</Label>
            <Input
              id="pp-cliente-nome"
              placeholder="Ex: João da Silva"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pp-cliente-tel">Telefone (opcional)</Label>
            <Input
              id="pp-cliente-tel"
              placeholder="(00) 00000-0000"
              value={clienteTelefone}
              onChange={(e) => setClienteTelefone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={dispositivoTipo} onValueChange={setDispositivoTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="celular">Celular</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="notebook">Notebook</SelectItem>
                  <SelectItem value="computador">Computador</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-marca">Marca *</Label>
              <Input
                id="pp-marca"
                placeholder="Ex: Samsung"
                value={dispositivoMarca}
                onChange={(e) => setDispositivoMarca(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pp-modelo">Modelo (opcional)</Label>
            <Input
              id="pp-modelo"
              placeholder="Ex: Galaxy A54"
              value={dispositivoModelo}
              onChange={(e) => setDispositivoModelo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pp-defeito">Defeito relatado *</Label>
            <Textarea
              id="pp-defeito"
              placeholder="Ex: Tela quebrada, não dá imagem"
              rows={2}
              value={defeito}
              onChange={(e) => setDefeito(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              className="flex-1"
              disabled={salvando}
              onClick={() => onOpenChange(false)}
            >
              Agora não
            </Button>
            <Button className="flex-1" disabled={!podeSalvar || salvando} onClick={handleSalvar}>
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando…
                </>
              ) : (
                "Criar OS"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

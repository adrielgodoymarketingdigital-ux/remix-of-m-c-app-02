import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Hash, Save, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const ConfiguracaoNumeracaoOS = () => {
  const [proximoNumero, setProximoNumero] = useState<number | null>(null);
  const [novoNumero, setNovoNumero] = useState("");
  const [loading, setLoading] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregarProximoNumero = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase.rpc("get_next_os_number", { p_user_id: user.id });
      if (error) throw error;
      setProximoNumero(data);
    } catch (error) {
      console.error("Erro ao carregar próximo número:", error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarProximoNumero();
  }, []);

  const handleSalvar = async () => {
    const numero = parseInt(novoNumero);
    
    if (isNaN(numero) || numero <= 0) {
      toast.error("Digite um número válido maior que zero");
      return;
    }

    if (proximoNumero && numero <= proximoNumero - 1) {
      toast.error(`O número deve ser maior que ${proximoNumero - 1} (última OS criada)`);
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }
      
      const { error } = await supabase.rpc("set_os_sequence_start", {
        p_user_id: user.id,
        novo_inicio: numero,
      });

      if (error) {
        if (error.message.includes("maior que o último")) {
          toast.error("O número deve ser maior que a última OS existente");
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Próxima OS será: OS-${String(numero).padStart(6, "0")}`);
      setNovoNumero("");
      await carregarProximoNumero();
    } catch (error) {
      console.error("Erro ao definir número:", error);
      toast.error("Erro ao definir número inicial");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          Numeração de Ordem de Serviço
        </CardTitle>
        <CardDescription>
          Configure o número inicial das ordens de serviço
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            O próximo número de OS será:{" "}
            <strong>
              {carregando
                ? "Carregando..."
                : `OS-${String(proximoNumero).padStart(6, "0")}`}
            </strong>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="novoNumero">Definir novo número inicial</Label>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-muted-foreground font-medium">OS-</span>
              <Input
                id="novoNumero"
                type="number"
                min={proximoNumero || 1}
                value={novoNumero}
                onChange={(e) => setNovoNumero(e.target.value)}
                placeholder={`Ex: ${(proximoNumero || 0) + 100}`}
                className="flex-1"
              />
            </div>
            <Button onClick={handleSalvar} disabled={loading || !novoNumero}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O número deve ser maior que a última OS criada. Use para iniciar em um número específico (ex: 1000).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

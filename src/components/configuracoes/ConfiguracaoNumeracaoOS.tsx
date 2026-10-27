import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Hash, Save, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Resolve o user_id do dono da loja: funcionário → lojaUserId, gerente → proprietário, dono → próprio id
async function resolverTargetUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Funcionário comum
  const { data: funcData } = await supabase
    .from("loja_funcionarios")
    .select("loja_user_id")
    .eq("funcionario_user_id", user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (funcData?.loja_user_id) return funcData.loja_user_id;

  // Gerente de filial
  const { data: gerenteData } = await supabase
    .from("empresa_usuarios")
    .select("proprietario_id")
    .eq("gerente_id", user.id)
    .maybeSingle();
  if (gerenteData?.proprietario_id) return gerenteData.proprietario_id;

  return user.id;
}

export const ConfiguracaoNumeracaoOS = () => {
  // Textos: namespace "configuracoes" (numeracao.*). Toasts com i18n.t: saem no idioma da hora.
  const { t, i18n } = useTranslation("configuracoes");
  const tt = (chave: string, valores?: Record<string, unknown>) => i18n.t(chave, { ns: "configuracoes", ...valores });
  const [proximoNumero, setProximoNumero] = useState<number | null>(null);
  const [novoNumero, setNovoNumero] = useState("");
  const [loading, setLoading] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregarProximoNumero = async () => {
    try {
      const targetUserId = await resolverTargetUserId();
      if (!targetUserId) return;

      const { data, error } = await supabase.rpc("get_next_os_number", { p_user_id: targetUserId });
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
      toast.error(tt("numeracao.erroNumeroInvalido"));
      return;
    }

    if (proximoNumero && numero <= proximoNumero - 1) {
      toast.error(tt("numeracao.erroMenorQueUltima", { ultima: proximoNumero - 1 }));
      return;
    }

    setLoading(true);
    try {
      const targetUserId = await resolverTargetUserId();
      if (!targetUserId) {
        toast.error(tt("numeracao.erroNaoAutenticado"));
        return;
      }

      const { error } = await supabase.rpc("set_os_sequence_start", {
        p_user_id: targetUserId,
        novo_inicio: numero,
      });

      if (error) {
        if (error.message.includes("maior que o último")) {
          toast.error(tt("numeracao.erroMaiorQueExistente"));
        } else {
          throw error;
        }
        return;
      }

      toast.success(tt("numeracao.proximaSera", { numero: `OS-${String(numero).padStart(6, "0")}` }));
      setNovoNumero("");
      await carregarProximoNumero();
    } catch (error) {
      console.error("Erro ao definir número:", error);
      toast.error(tt("numeracao.erroDefinir"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          {t("numeracao.titulo")}
        </CardTitle>
        <CardDescription>
          {t("numeracao.descricao")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {t("numeracao.proximo")}{" "}
            <strong>
              {carregando
                ? t("numeracao.carregando")
                : `OS-${String(proximoNumero).padStart(6, "0")}`}
            </strong>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="novoNumero">{t("numeracao.definirNovo")}</Label>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-muted-foreground font-medium">OS-</span>
              <Input
                id="novoNumero"
                type="number"
                min={proximoNumero || 1}
                value={novoNumero}
                onChange={(e) => setNovoNumero(e.target.value)}
                placeholder={t("numeracao.exemplo", { numero: (proximoNumero || 0) + 100 })}
                className="flex-1"
              />
            </div>
            <Button onClick={handleSalvar} disabled={loading || !novoNumero}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? t("numeracao.salvando") : t("numeracao.salvar")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("numeracao.ajuda")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

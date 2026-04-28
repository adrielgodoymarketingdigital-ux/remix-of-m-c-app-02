import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type Preferencias = {
  notif_nova_venda: boolean;
  notif_novo_cadastro: boolean;
};

const defaults: Preferencias = {
  notif_nova_venda: true,
  notif_novo_cadastro: true,
};

export function PreferenciasNotificacaoPush() {
  const [prefs, setPrefs] = useState<Preferencias>(defaults);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<keyof Preferencias | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from("configuracoes_admin")
        .select("preferencias_notificacao")
        .limit(1)
        .maybeSingle();

      if (data?.preferencias_notificacao) {
        setPrefs({ ...defaults, ...(data.preferencias_notificacao as Partial<Preferencias>) });
      }
      setLoading(false);
    }
    carregar();
  }, []);

  async function alternar(chave: keyof Preferencias, valor: boolean) {
    setSalvando(chave);
    const novas = { ...prefs, [chave]: valor };

    const { data: atual } = await supabase
      .from("configuracoes_admin")
      .select("id")
      .limit(1)
      .maybeSingle();

    const op = atual
      ? supabase
          .from("configuracoes_admin")
          .update({ preferencias_notificacao: novas, updated_at: new Date().toISOString() })
          .eq("id", atual.id)
      : supabase
          .from("configuracoes_admin")
          .insert({ preferencias_notificacao: novas });

    const { error } = await op;

    if (error) {
      toast({ title: "Erro ao salvar preferência", variant: "destructive" });
    } else {
      setPrefs(novas);
    }
    setSalvando(null);
  }

  const itens: { chave: keyof Preferencias; label: string; descricao: string }[] = [
    {
      chave: "notif_nova_venda",
      label: "Notificar nova venda",
      descricao: "Receba um push quando um pagamento for confirmado",
    },
    {
      chave: "notif_novo_cadastro",
      label: "Notificar novo cadastro",
      descricao: "Receba um push quando um novo usuário se cadastrar",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preferências de Notificação Push</CardTitle>
        <CardDescription>Escolha quais eventos disparam uma notificação push via OneSignal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading
          ? itens.map((i) => <Skeleton key={i.chave} className="h-10 w-full" />)
          : itens.map(({ chave, label, descricao }) => (
              <div key={chave} className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor={chave} className="text-sm font-medium">
                    {label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{descricao}</p>
                </div>
                <Switch
                  id={chave}
                  checked={prefs[chave]}
                  disabled={salvando === chave}
                  onCheckedChange={(val) => alternar(chave, val)}
                />
              </div>
            ))}
      </CardContent>
    </Card>
  );
}

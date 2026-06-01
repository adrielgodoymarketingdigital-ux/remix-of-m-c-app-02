import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Localizacao {
  id: string;
  nome: string;
  ordem: number;
}

export function ConfiguracaoLocalizacaoOS() {
  const [localizacoes, setLocalizacoes] = useState<Localizacao[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("os_localizacoes")
      .select("id, nome, ordem")
      .eq("user_id", user.id)
      .order("ordem", { ascending: true });
    setLocalizacoes(data || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const adicionar = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSalvando(true);
    const proximaOrdem = localizacoes.length;
    const { error } = await supabase.from("os_localizacoes").insert({
      user_id: user.id,
      nome,
      ordem: proximaOrdem,
    });
    if (error) { toast.error("Erro ao adicionar localização"); }
    else { setNovoNome(""); await carregar(); toast.success("Localização adicionada!"); }
    setSalvando(false);
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("os_localizacoes").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    await carregar();
    toast.success("Localização removida!");
  };

  const renomear = async (id: string, novoNomeVal: string) => {
    setLocalizacoes(prev => prev.map(l => l.id === id ? { ...l, nome: novoNomeVal } : l));
  };

  const salvarRenomeacao = async (id: string, nome: string) => {
    if (!nome.trim()) return;
    await supabase.from("os_localizacoes").update({ nome: nome.trim() }).eq("id", id);
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Localizações Físicas dos Aparelhos</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        Configure os locais onde os aparelhos podem estar durante o atendimento. Ex: Laboratório Externo, Aguardando Peça.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {localizacoes.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma localização cadastrada ainda.</p>
          )}
          {localizacoes.map((loc) => (
            <div key={loc.id} className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <Input
                value={loc.nome}
                onChange={(e) => renomear(loc.id, e.target.value)}
                onBlur={(e) => salvarRenomeacao(loc.id, e.target.value)}
                className="h-8 text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                onClick={() => remover(loc.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-border/40">
        <div className="flex-1">
          <Label className="sr-only">Nova localização</Label>
          <Input
            placeholder="Nova localização (ex: Laboratório Externo)"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            className="h-8 text-sm"
          />
        </div>
        <Button size="sm" onClick={adicionar} disabled={salvando || !novoNome.trim()} className="h-8 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}

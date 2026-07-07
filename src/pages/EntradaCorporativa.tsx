import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, PackageSearch, Smartphone, XCircle } from "lucide-react";

interface ItemData {
  id: string;
  remessa_id: string;
  marca: string | null;
  modelo: string;
  cor: string | null;
  imei: string | null;
  numero_serie: string | null;
  defeito_padrao: string | null;
  os_ids: string[] | null;
  remessas_corporativas: {
    nome: string;
    user_id: string;
    cliente_id: string | null;
    clientes: { nome: string } | null;
  } | null;
}

function EntradaCorporativaContent() {
  const { itemId } = useParams<{ itemId: string }>();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [item, setItem] = useState<ItemData | null>(null);
  const [defeito, setDefeito] = useState("");
  const [criando, setCriando] = useState(false);
  const [numeroOSCriada, setNumeroOSCriada] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const carregarItem = async () => {
    if (!itemId) return;
    setCarregando(true);
    setErro(false);

    const { data, error } = await supabase
      .from("remessa_itens")
      .select(`
        id, remessa_id, marca, modelo, cor, imei, numero_serie, defeito_padrao, os_ids,
        remessas_corporativas ( nome, user_id, cliente_id, clientes ( nome ) )
      `)
      .eq("id", itemId)
      .maybeSingle();

    if (error || !data || !data.remessas_corporativas) {
      setErro(true);
      setCarregando(false);
      return;
    }

    setItem(data as unknown as ItemData);
    setDefeito(data.defeito_padrao || "");
    setCarregando(false);
  };

  useEffect(() => {
    carregarItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const handleCriarOS = async () => {
    if (!item || !item.remessas_corporativas || !defeito.trim()) return;

    setCriando(true);
    const remessa = item.remessas_corporativas;
    const itemId = item.id;

    const { data: osInserida, error: osError } = await supabase
      .from("ordens_servico")
      .insert({
        user_id: remessa.user_id,
        cliente_id: remessa.cliente_id || null,
        dispositivo_tipo: "celular",
        dispositivo_marca: item.marca || "",
        dispositivo_modelo: item.modelo,
        dispositivo_cor: item.cor || null,
        dispositivo_imei: item.imei || null,
        dispositivo_numero_serie: item.numero_serie || null,
        defeito_relatado: defeito.trim(),
        status: "pendente",
      })
      .select("id, numero_os")
      .single();

    if (osError) {
      toast.error(`Erro: ${osError.message}`);
      setCriando(false);
      return;
    }

    if (!osInserida?.id) {
      toast.error("OS não foi criada corretamente");
      setCriando(false);
      return;
    }

    // Atualizar os_ids no item da remessa
    const { data: itemAtual } = await supabase
      .from("remessa_itens")
      .select("os_ids")
      .eq("id", itemId)
      .single();

    const osIdsAtuais = (itemAtual?.os_ids as string[]) || [];
    const novosOsIds = [...osIdsAtuais, osInserida.id];

    await supabase
      .from("remessa_itens")
      .update({ os_ids: novosOsIds })
      .eq("id", itemId);

    setItem({ ...item, os_ids: novosOsIds });
    setNumeroOSCriada(osInserida.numero_os);
    setSucesso(true);
    toast.success("Ordem de serviço criada!");
    setCriando(false);
  };

  const handleCriarOutra = () => {
    setNumeroOSCriada(null);
    setSucesso(false);
    setDefeito(item?.defeito_padrao || "");
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando dispositivo...</p>
        </div>
      </div>
    );
  }

  if (erro || !item || !item.remessas_corporativas) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="font-medium">Dispositivo não encontrado</p>
            <p className="text-sm text-muted-foreground">
              Este QR Code é inválido ou o dispositivo foi removido da remessa.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const remessa = item.remessas_corporativas;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                {item.marca ? `${item.marca} ` : ""}{item.modelo}
              </CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Remessa: {remessa.nome}
              {remessa.clientes?.nome ? ` · ${remessa.clientes.nome}` : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-muted-foreground">Cor</p>
                <p className="font-medium">{item.cor || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">IMEI</p>
                <p className="font-medium">{item.imei || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Nº de Série</p>
                <p className="font-medium">{item.numero_serie || "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {sucesso ? (
          <Card>
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <div>
                <p className="font-medium">Ordem de serviço criada!</p>
                <Badge className="mt-2">OS {numeroOSCriada}</Badge>
              </div>
              <Button className="w-full mt-2" onClick={handleCriarOutra}>
                <PackageSearch className="h-4 w-4 mr-2" />
                Criar outra OS para este aparelho
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Criar Ordem de Serviço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Defeito relatado *</Label>
                <Textarea
                  placeholder="Descreva o defeito relatado pelo cliente"
                  value={defeito}
                  onChange={(e) => setDefeito(e.target.value)}
                  rows={4}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCriarOS}
                disabled={!defeito.trim() || criando}
              >
                {criando ? "Criando..." : "Criar Ordem de Serviço"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function EntradaCorporativa() {
  return <EntradaCorporativaContent />;
}

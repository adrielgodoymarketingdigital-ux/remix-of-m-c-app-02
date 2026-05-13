import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

interface TermoGarantiaDispositivoConfig {
  termo_com_garantia: string;
  termo_sem_garantia: string;
}

const VARIAVEIS_DISPONIVEIS = [
  { tag: "{{cliente}}", descricao: "Nome do cliente" },
  { tag: "{{cpf}}", descricao: "CPF do cliente" },
  { tag: "{{telefone}}", descricao: "Telefone do cliente" },
  { tag: "{{dispositivo}}", descricao: "Marca e modelo" },
  { tag: "{{imei}}", descricao: "IMEI do aparelho" },
  { tag: "{{numero_serie}}", descricao: "Número de série" },
  { tag: "{{cor}}", descricao: "Cor do aparelho" },
  { tag: "{{capacidade}}", descricao: "Capacidade (GB)" },
  { tag: "{{condicao}}", descricao: "Condição (Novo/Usado)" },
  { tag: "{{garantia_meses}}", descricao: "Meses de garantia" },
  { tag: "{{valor}}", descricao: "Valor da venda" },
  { tag: "{{data_venda}}", descricao: "Data da venda" },
  { tag: "{{loja}}", descricao: "Nome da loja" },
  { tag: "{{loja_telefone}}", descricao: "Telefone da loja" },
  { tag: "{{loja_cnpj}}", descricao: "CNPJ da loja" },
  { tag: "{{loja_endereco}}", descricao: "Endereço da loja" },
];

const TERMOS_PADRAO: TermoGarantiaDispositivoConfig = {
  termo_com_garantia: `TERMO DE GARANTIA

Loja: {{loja}}
CNPJ: {{loja_cnpj}}
Endereço: {{loja_endereco}}
Telefone: {{loja_telefone}}

COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}
Telefone: {{telefone}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Nº Série: {{numero_serie}}
Cor: {{cor}}  |  Capacidade: {{capacidade}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor pago: {{valor}}

1. GARANTIA LEGAL (CDC - Lei 8.078/90)
   • Garantia legal de 90 (noventa) dias, conforme Art. 26, II do CDC.
   • Cobre defeitos de fabricação ou vícios que comprometam o funcionamento.

2. GARANTIA CONTRATUAL ({{garantia_meses}} meses)
   • Garantia adicional de {{garantia_meses}} meses a partir da data desta venda.
   • Complementar à garantia legal, conforme Art. 50 do CDC.
   • Cobre defeitos de fabricação, excluindo mau uso, quedas ou oxidação.

3. DIREITOS DO CONSUMIDOR
   • Vício do produto: substituição, devolução ou abatimento (Art. 18 CDC).
   • Prazo suspenso durante reparo (Art. 26, §2º CDC).
   • Conserve este documento como comprovante.

4. EXCLUSÕES
   • Quedas, impactos, contato com líquidos, uso inadequado.
   • Violação de lacres ou reparo por terceiros não autorizados.
   • Desgaste natural de uso.

Para acionamento da garantia, apresente este termo na loja.`,

  termo_sem_garantia: `DECLARAÇÃO DE VENDA SEM GARANTIA CONTRATUAL

Loja: {{loja}}
CNPJ: {{loja_cnpj}}

COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor pago: {{valor}}

AVISO: Este produto é vendido sem garantia contratual adicional.
A garantia legal de 90 dias prevista no CDC (Art. 26, II) se aplica conforme a legislação.
O cliente declara estar ciente das condições do equipamento.`,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export function DialogConfiguracaoTermoGarantiaDispositivo({ open, onOpenChange, onSave }: Props) {
  const { config } = useConfiguracaoLoja();
  const [termos, setTermos] = useState<TermoGarantiaDispositivoConfig>(TERMOS_PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [mostrarVariaveis, setMostrarVariaveis] = useState(false);

  useEffect(() => {
    if (config?.termo_garantia_dispositivo_config) {
      setTermos({ ...TERMOS_PADRAO, ...(config.termo_garantia_dispositivo_config as any) });
    } else {
      setTermos(TERMOS_PADRAO);
    }
  }, [config, open]);

  const handleSalvar = async () => {
    try {
      setSalvando(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("configuracoes_loja")
        .update({ termo_garantia_dispositivo_config: termos as any })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({ title: "Termos salvos", description: "Termos de garantia do dispositivo atualizados." });
      onSave?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar os termos.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const restaurarPadrao = () => {
    setTermos(TERMOS_PADRAO);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Termo de Garantia — Dispositivos Vendidos</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Painel de variáveis disponíveis */}
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 text-sm font-medium hover:bg-muted transition-colors"
              onClick={() => setMostrarVariaveis((v) => !v)}
            >
              <span>Variáveis disponíveis — clique para inserir no texto</span>
              {mostrarVariaveis ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {mostrarVariaveis && (
              <div className="p-3 flex flex-wrap gap-2">
                {VARIAVEIS_DISPONIVEIS.map(({ tag, descricao }) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors font-mono text-xs"
                    title={descricao}
                    onClick={() => {
                      navigator.clipboard?.writeText(tag).catch(() => {});
                      toast({ title: "Copiado!", description: `${tag} — ${descricao}` });
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
                <p className="w-full text-xs text-muted-foreground mt-1">
                  Clique em uma variável para copiá-la, depois cole no texto abaixo. Ela será substituída automaticamente pelos dados reais na impressão.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Termo COM garantia contratual</Label>
            <p className="text-xs text-muted-foreground">
              Usado quando o dispositivo possui garantia cadastrada (campo "Garantia" marcado).
            </p>
            <Textarea
              value={termos.termo_com_garantia}
              onChange={(e) => setTermos((prev) => ({ ...prev, termo_com_garantia: e.target.value }))}
              rows={18}
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Termo SEM garantia contratual</Label>
            <p className="text-xs text-muted-foreground">
              Usado quando o dispositivo não possui garantia contratual.
            </p>
            <Textarea
              value={termos.termo_sem_garantia}
              onChange={(e) => setTermos((prev) => ({ ...prev, termo_sem_garantia: e.target.value }))}
              rows={10}
              className="text-xs font-mono"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={restaurarPadrao} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

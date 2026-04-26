import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, Gift, Calendar, Crown, Clock } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type PlanoAcesso = 
  | "trial"
  | "basico_mensal"
  | "basico_anual"
  | "intermediario_mensal"
  | "intermediario_anual"
  | "profissional_mensal"
  | "profissional_anual";

export type UnidadeTempo = "horas" | "dias";

interface DialogConcederAcessoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario: {
    user_id: string;
    nome: string;
    email: string;
    plano_tipo?: string;
    status?: string;
  } | null;
  onConfirmar: (userId: string, planoTipo: PlanoAcesso, tempoAcesso: number, unidadeTempo: UnidadeTempo, motivo: string) => Promise<boolean>;
  isLoading: boolean;
}

const OPCOES_PLANOS: { value: PlanoAcesso; label: string; dias_padrao: number }[] = [
  { value: "trial", label: "Trial (Teste Gratuito)", dias_padrao: 7 },
  { value: "basico_mensal", label: "Básico Mensal (R$19,90)", dias_padrao: 30 },
  { value: "basico_anual", label: "Básico Anual (R$15,90/mês)", dias_padrao: 365 },
  { value: "intermediario_mensal", label: "Intermediário Mensal (R$39,90)", dias_padrao: 30 },
  { value: "intermediario_anual", label: "Intermediário Anual (R$31,90/mês)", dias_padrao: 365 },
  { value: "profissional_mensal", label: "Profissional Mensal (R$79,90)", dias_padrao: 30 },
  { value: "profissional_anual", label: "Profissional Anual (R$74,90/mês)", dias_padrao: 365 },
];

export function DialogConcederAcesso({
  open,
  onOpenChange,
  usuario,
  onConfirmar,
  isLoading,
}: DialogConcederAcessoProps) {
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoAcesso>("intermediario_mensal");
  const [tempoAcesso, setTempoAcesso] = useState(30);
  const [unidadeTempo, setUnidadeTempo] = useState<UnidadeTempo>("dias");
  const [motivo, setMotivo] = useState("");

  if (!usuario) return null;

  const handlePlanoChange = (plano: PlanoAcesso) => {
    setPlanoSelecionado(plano);
    const opcao = OPCOES_PLANOS.find(p => p.value === plano);
    if (opcao) {
      setTempoAcesso(opcao.dias_padrao);
      setUnidadeTempo("dias");
    }
  };

  const handleUnidadeChange = (novaUnidade: UnidadeTempo) => {
    setUnidadeTempo(novaUnidade);
    // Ajustar valor padrão baseado na unidade
    if (novaUnidade === "horas") {
      setTempoAcesso(24); // Padrão 24 horas
    } else {
      const opcao = OPCOES_PLANOS.find(p => p.value === planoSelecionado);
      setTempoAcesso(opcao?.dias_padrao || 30);
    }
  };

  const handleConfirmar = async () => {
    const sucesso = await onConfirmar(usuario.user_id, planoSelecionado, tempoAcesso, unidadeTempo, motivo);
    if (sucesso) {
      setPlanoSelecionado("intermediario_mensal");
      setTempoAcesso(30);
      setUnidadeTempo("dias");
      setMotivo("");
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setPlanoSelecionado("intermediario_mensal");
    setTempoAcesso(30);
    setUnidadeTempo("dias");
    setMotivo("");
    onOpenChange(false);
  };

  const formatarPlanoAtual = (plano?: string) => {
    const planos: Record<string, string> = {
      demonstracao: "Aguardando Ativação",
      trial: "Trial",
      basico_mensal: "Básico Mensal",
      basico_anual: "Básico Anual",
      intermediario_mensal: "Intermediário Mensal",
      intermediario_anual: "Intermediário Anual",
      profissional_mensal: "Profissional Mensal",
      profissional_anual: "Profissional Anual",
      admin: "Admin",
    };
    return planos[plano || ""] || plano || "Nenhum";
  };
  
  const getTempoLabel = () => {
    if (unidadeTempo === "horas") {
      return tempoAcesso === 1 ? "hora" : "horas";
    }
    return tempoAcesso === 1 ? "dia" : "dias";
  };

  const formatarStatusAtual = (status?: string) => {
    const statusMap: Record<string, string> = {
      active: "Ativo",
      trialing: "Em Trial",
      canceled: "Cancelado",
      past_due: "Atrasado",
      unpaid: "Não Pago",
      incomplete: "Incompleto",
    };
    return statusMap[status || ""] || status || "Desconhecido";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-green-600" />
            Conceder Acesso ao Sistema
          </DialogTitle>
          <DialogDescription>
            Conceda acesso manual ao sistema para este usuário. Use para cortesias, 
            reativações ou situações especiais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do usuário */}
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium">{usuario.nome}</p>
            <p className="text-sm text-muted-foreground">{usuario.email}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>Plano atual: <strong>{formatarPlanoAtual(usuario.plano_tipo)}</strong></span>
              <span>Status: <strong>{formatarStatusAtual(usuario.status)}</strong></span>
            </div>
          </div>

          {/* Seleção de plano */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Plano a Conceder
            </Label>
            <Select value={planoSelecionado} onValueChange={(v) => handlePlanoChange(v as PlanoAcesso)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_PLANOS.map((plano) => (
                  <SelectItem key={plano.value} value={plano.value}>
                    {plano.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unidade de tempo */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" />
              Unidade de Tempo
            </Label>
            <RadioGroup
              value={unidadeTempo}
              onValueChange={(v) => handleUnidadeChange(v as UnidadeTempo)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="horas" id="horas" />
                <Label htmlFor="horas" className="cursor-pointer">Horas</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dias" id="dias" />
                <Label htmlFor="dias" className="cursor-pointer">Dias</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Tempo de acesso */}
          <div className="space-y-2">
            <Label htmlFor="tempo" className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              {unidadeTempo === "horas" ? "Horas de Acesso" : "Dias de Acesso"}
            </Label>
            <Input
              id="tempo"
              type="number"
              min={1}
              max={unidadeTempo === "horas" ? 720 : 365}
              value={tempoAcesso}
              onChange={(e) => setTempoAcesso(parseInt(e.target.value) || 1)}
            />
            <p className="text-xs text-muted-foreground">
              O acesso expirará em {tempoAcesso} {getTempoLabel()} a partir de agora.
            </p>
          </div>

          {/* Aviso */}
          <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <Gift className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800 dark:text-green-400">
              <p className="font-medium">O usuário terá acesso imediato!</p>
              <p className="text-xs mt-1">
                Isso irá desbloquear o usuário (se estiver bloqueado), definir o plano 
                selecionado e configurar a data de expiração automaticamente.
              </p>
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Textarea
              id="motivo"
              placeholder="Ex: Cortesia por problema técnico, parceria, teste especial..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? "Concedendo..." : "Conceder Acesso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

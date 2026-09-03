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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, Search, Clock, Crown, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLiberacoesTemporarias, UsuarioLookup } from "@/hooks/useLiberacoesTemporarias";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmado: () => void;
}

const OPCOES_PLANOS: { value: string; label: string }[] = [
  { value: "trial", label: "Trial (Teste Gratuito)" },
  { value: "basico_mensal", label: "Básico Mensal" },
  { value: "basico_anual", label: "Básico Anual" },
  { value: "intermediario_mensal", label: "Intermediário Mensal" },
  { value: "intermediario_anual", label: "Intermediário Anual" },
  { value: "profissional_mensal", label: "Profissional Mensal — libera tudo do Profissional" },
  { value: "profissional_anual", label: "Profissional Anual" },
  { value: "profissional_ultra_mensal", label: "Profissional Ultra Mensal" },
  { value: "profissional_ultra_anual", label: "Profissional Ultra Anual" },
];

const PRESETS: Record<string, { valor: number; unidade: "horas" | "dias"; label: string }> = {
  "2h": { valor: 2, unidade: "horas", label: "2 horas" },
  "6h": { valor: 6, unidade: "horas", label: "6 horas" },
  "12h": { valor: 12, unidade: "horas", label: "12 horas" },
  "24h": { valor: 24, unidade: "horas", label: "24 horas" },
  "48h": { valor: 48, unidade: "horas", label: "48 horas" },
  "7d": { valor: 7, unidade: "dias", label: "7 dias" },
};

const formatarPlano = (p?: string | null) =>
  p ? p.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "Nenhum";

export function DialogLiberacaoTemporaria({ open, onOpenChange, onConfirmado }: Props) {
  const { buscarUsuarioPorEmail, liberarAcesso } = useLiberacoesTemporarias();

  const [email, setEmail] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [usuario, setUsuario] = useState<UsuarioLookup | null>(null);

  const [plano, setPlano] = useState("profissional_mensal");
  const [preset, setPreset] = useState<string>("2h");
  const [customValor, setCustomValor] = useState(3);
  const [customUnidade, setCustomUnidade] = useState<"horas" | "dias">("horas");
  const [motivo, setMotivo] = useState("");
  const [confirmarPagante, setConfirmarPagante] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const resetar = () => {
    setEmail("");
    setUsuario(null);
    setPlano("profissional_mensal");
    setPreset("2h");
    setCustomValor(3);
    setCustomUnidade("horas");
    setMotivo("");
    setConfirmarPagante(false);
    setEnviando(false);
    setBuscando(false);
  };

  const fechar = () => {
    resetar();
    onOpenChange(false);
  };

  const handleBuscar = async () => {
    if (!email.trim()) return;
    setBuscando(true);
    setUsuario(null);
    setConfirmarPagante(false);
    const res = await buscarUsuarioPorEmail(email);
    setUsuario(res);
    setBuscando(false);
  };

  const duracao = preset === "custom" ? { valor: customValor, unidade: customUnidade } : PRESETS[preset];

  const podeEnviar =
    !!usuario &&
    !enviando &&
    duracao.valor > 0 &&
    (!usuario.era_pagante_real || confirmarPagante);

  const handleConfirmar = async () => {
    if (!usuario) return;
    setEnviando(true);
    const res = await liberarAcesso({
      user_id: usuario.user_id,
      plano_tipo: plano,
      duracao_valor: duracao.valor,
      duracao_unidade: duracao.unidade,
      motivo: motivo || undefined,
      confirmar_pagante_ativo: usuario.era_pagante_real ? confirmarPagante : undefined,
    });
    setEnviando(false);
    if (res.ok) {
      resetar();
      onOpenChange(false);
      onConfirmado();
    } else if (res.requerConfirmacao) {
      // backend pediu confirmação — revelar checkbox
      setUsuario({ ...usuario, era_pagante_real: true });
      setConfirmarPagante(false);
      toast.info(res.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : fechar())}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-green-600" />
            Nova Liberação Temporária
          </DialogTitle>
          <DialogDescription>
            Libera um plano por um período. O sistema reverte sozinho ao expirar
            (restaura o estado anterior; se não havia plano ativo, volta para Free).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* E-mail */}
          <div className="space-y-2">
            <Label htmlFor="lib-email">E-mail do usuário</Label>
            <div className="flex gap-2">
              <Input
                id="lib-email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
              />
              <Button type="button" variant="outline" onClick={handleBuscar} disabled={buscando || !email.trim()}>
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {usuario && (
            <>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium">{usuario.nome || "(sem nome)"}</p>
                <p className="text-sm text-muted-foreground">{usuario.email}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                  <span>
                    Plano atual: <strong>{formatarPlano(usuario.plano_tipo)}</strong>
                  </span>
                  <span>
                    Status: <strong>{usuario.status || "—"}</strong>
                  </span>
                </div>
                {usuario.liberacao_ativa && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Já tem liberação ativa ({formatarPlano(usuario.liberacao_ativa.plano_concedido)}) — ela será
                    revogada e substituída por esta.
                  </p>
                )}
              </div>

              {usuario.era_pagante_real && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Assinante pago real</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="text-xs">
                      Este usuário tem assinatura paga ativa. O plano real será salvo e restaurado
                      automaticamente ao fim da liberação.
                    </p>
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <Checkbox
                        checked={confirmarPagante}
                        onCheckedChange={(c) => setConfirmarPagante(c === true)}
                      />
                      Entendo — fazer o upgrade temporário e restaurar depois
                    </label>
                  </AlertDescription>
                </Alert>
              )}

              {/* Plano a liberar */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  Plano a liberar
                </Label>
                <Select value={plano} onValueChange={setPlano}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCOES_PLANOS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duração */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  Duração
                </Label>
                <Select value={preset} onValueChange={setPreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRESETS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Personalizado…</SelectItem>
                  </SelectContent>
                </Select>

                {preset === "custom" && (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={customUnidade === "horas" ? 720 : 365}
                      value={customValor}
                      onChange={(e) => setCustomValor(parseInt(e.target.value) || 1)}
                      className="w-28"
                    />
                    <Select value={customUnidade} onValueChange={(v) => setCustomUnidade(v as "horas" | "dias")}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="horas">Horas</SelectItem>
                        <SelectItem value="dias">Dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Expira {duracao.valor} {duracao.unidade} após a confirmação.
                </p>
              </div>

              {/* Motivo */}
              <div className="space-y-2">
                <Label htmlFor="lib-motivo">Motivo (opcional)</Label>
                <Textarea
                  id="lib-motivo"
                  placeholder="Ex: demonstração comercial, suporte, parceria…"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="min-h-[70px]"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={fechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!podeEnviar}
            className="bg-green-600 hover:bg-green-700"
          >
            {enviando ? "Liberando…" : "Liberar acesso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

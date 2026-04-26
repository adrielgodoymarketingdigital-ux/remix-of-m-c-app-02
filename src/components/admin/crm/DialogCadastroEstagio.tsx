import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

interface Estagio {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  descricao: string | null;
  filtro: FiltroEstagio | null;
}

export interface FiltroEstagio {
  campo: string;
  operador: string;
  valor: string | string[];
}

interface DialogCadastroEstagioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estagio: Estagio | null;
  onSalvar: (data: {
    nome: string;
    cor: string;
    descricao: string;
    filtro: FiltroEstagio | null;
  }) => void;
}

const CAMPOS_DISPONIVEIS = [
  { value: "plano_tipo", label: "Tipo do Plano (plano_tipo)" },
  { value: "status", label: "Status da Assinatura (status)" },
  { value: "whatsapp_status", label: "Status WhatsApp" },
  { value: "plano_tipo_pago", label: "Plano Pago + Status Ativo" },
];

const OPERADORES = [
  { value: "eq", label: "Igual a" },
  { value: "neq", label: "Diferente de" },
  { value: "in", label: "Está em (lista)" },
  { value: "not_in", label: "Não está em (lista)" },
];

const VALORES_PLANO = ["free", "demonstracao", "trial", "basico_mensal", "basico_anual", "intermediario_mensal", "intermediario_anual", "profissional_mensal", "profissional_anual"];
const VALORES_STATUS = ["active", "trialing", "canceled", "past_due", "incomplete", "incomplete_expired"];
const VALORES_WHATSAPP = ["never_sent", "sent", "delivered", "replied", "failed"];

const CORES_PRESET = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#64748b"];

export function DialogCadastroEstagio({ open, onOpenChange, estagio, onSalvar }: DialogCadastroEstagioProps) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#3b82f6");
  const [descricao, setDescricao] = useState("");
  const [usarFiltro, setUsarFiltro] = useState(false);
  const [campo, setCampo] = useState("plano_tipo");
  const [operador, setOperador] = useState("eq");
  const [valor, setValor] = useState("");

  useEffect(() => {
    if (estagio) {
      setNome(estagio.nome);
      setCor(estagio.cor);
      setDescricao(estagio.descricao || "");
      if (estagio.filtro) {
        setUsarFiltro(true);
        setCampo(estagio.filtro.campo);
        setOperador(estagio.filtro.operador);
        setValor(Array.isArray(estagio.filtro.valor) ? estagio.filtro.valor.join(", ") : estagio.filtro.valor);
      } else {
        setUsarFiltro(false);
        setCampo("plano_tipo");
        setOperador("eq");
        setValor("");
      }
    } else {
      setNome("");
      setCor("#3b82f6");
      setDescricao("");
      setUsarFiltro(false);
      setCampo("plano_tipo");
      setOperador("eq");
      setValor("");
    }
  }, [estagio, open]);

  const valoresDisponiveis = campo === "plano_tipo" || campo === "plano_tipo_pago"
    ? VALORES_PLANO
    : campo === "status"
    ? VALORES_STATUS
    : VALORES_WHATSAPP;

  const handleSalvar = () => {
    let filtro: FiltroEstagio | null = null;
    if (usarFiltro && campo && valor) {
      const isArray = operador === "in" || operador === "not_in";
      filtro = {
        campo,
        operador,
        valor: isArray ? valor.split(",").map((v) => v.trim()) : valor,
      };
    }
    onSalvar({ nome, cor, descricao, filtro });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{estagio ? "Editar Estágio" : "Novo Estágio"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Leads Quentes" />
          </div>

          <div>
            <Label>Cor</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {CORES_PRESET.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${cor === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setCor(c)}
                />
              ))}
            </div>
          </div>

          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="usarFiltro"
              checked={usarFiltro}
              onChange={(e) => setUsarFiltro(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="usarFiltro" className="cursor-pointer">Classificar automaticamente por filtro</Label>
          </div>

          {usarFiltro && (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <div>
                <Label>Campo</Label>
                <Select value={campo} onValueChange={setCampo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMPOS_DISPONIVEIS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Operador</Label>
                <Select value={operador} onValueChange={setOperador}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERADORES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Valor</Label>
                {(operador === "eq" || operador === "neq") ? (
                  <Select value={valor} onValueChange={setValor}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {valoresDisponiveis.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="Valores separados por vírgula"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={!nome}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

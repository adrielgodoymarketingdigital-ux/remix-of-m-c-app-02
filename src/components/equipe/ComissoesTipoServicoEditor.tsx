import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Percent, Tag } from "lucide-react";
import { useTiposServico, TipoServico } from "@/hooks/useTiposServico";

export interface ComissaoTipoServicoLocal {
  tipo_servico_id: string;
  tipo_servico_nome: string;
  comissao_tipo: string;
  comissao_valor: number;
}

interface ComissoesTipoServicoEditorProps {
  comissoes: ComissaoTipoServicoLocal[];
  onChange: (comissoes: ComissaoTipoServicoLocal[]) => void;
}

export function ComissoesTipoServicoEditor({ comissoes, onChange }: ComissoesTipoServicoEditorProps) {
  const { tiposServico, loading } = useTiposServico();

  // When tiposServico loads, sync with existing comissoes
  useEffect(() => {
    if (tiposServico.length === 0) return;
    
    // Add missing tipos to comissoes list
    const existing = new Set(comissoes.map(c => c.tipo_servico_id));
    const novas = tiposServico
      .filter(t => !existing.has(t.id))
      .map(t => ({
        tipo_servico_id: t.id,
        tipo_servico_nome: t.nome,
        comissao_tipo: "porcentagem",
        comissao_valor: 0,
      }));

    if (novas.length > 0) {
      // Also update names of existing ones
      const atualizadas = comissoes.map(c => {
        const tipo = tiposServico.find(t => t.id === c.tipo_servico_id);
        return tipo ? { ...c, tipo_servico_nome: tipo.nome } : c;
      });
      onChange([...atualizadas, ...novas]);
    }
  }, [tiposServico]);

  const updateComissao = (tipoServicoId: string, field: string, value: any) => {
    onChange(
      comissoes.map(c =>
        c.tipo_servico_id === tipoServicoId ? { ...c, [field]: value } : c
      )
    );
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando tipos de serviço...</p>;
  }

  if (tiposServico.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum tipo de serviço cadastrado. Cadastre tipos de serviço no menu Serviços para configurar comissões individuais.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {comissoes
        .filter(c => tiposServico.some(t => t.id === c.tipo_servico_id))
        .map((comissao) => {
          const exemplo = comissao.comissao_valor > 0
            ? comissao.comissao_tipo === "porcentagem"
              ? `${comissao.comissao_valor}% → venda R$ 100 = R$ ${(100 * comissao.comissao_valor / 100).toFixed(2)}`
              : `R$ ${comissao.comissao_valor.toFixed(2)} fixo por serviço`
            : null;

          return (
            <div key={comissao.tipo_servico_id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{comissao.tipo_servico_nome}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={comissao.comissao_tipo}
                    onValueChange={(v) => updateComissao(comissao.tipo_servico_id, "comissao_tipo", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="porcentagem">
                        <span className="flex items-center gap-1"><Percent className="h-3 w-3" /> %</span>
                      </SelectItem>
                      <SelectItem value="valor_fixo">
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> R$</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Valor</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      step={comissao.comissao_tipo === "porcentagem" ? "0.5" : "0.01"}
                      max={comissao.comissao_tipo === "porcentagem" ? "100" : undefined}
                      value={comissao.comissao_valor || ""}
                      onChange={(e) => updateComissao(comissao.tipo_servico_id, "comissao_valor", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs pr-8"
                      placeholder="0"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {comissao.comissao_tipo === "porcentagem" ? "%" : "R$"}
                    </span>
                  </div>
                </div>
              </div>
              {exemplo && (
                <Badge variant="outline" className="text-xs font-normal">{exemplo}</Badge>
              )}
            </div>
          );
        })}
    </div>
  );
}

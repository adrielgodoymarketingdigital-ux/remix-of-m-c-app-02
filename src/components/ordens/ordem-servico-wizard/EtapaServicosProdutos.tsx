import { Wrench, User, Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelecionadorServico } from "../SelecionadorServico";
import { SelecionadorProduto } from "../SelecionadorProduto";
import { EtapaCabecalho } from "./EtapaCabecalho";
import { FormData, TecnicoOS } from "./tipos";
import { Funcionario } from "@/types/funcionario";

interface EtapaServicosProdutosProps {
  formData: FormData;
  setFormData: (formData: FormData) => void;
  podeVerTecnicos: boolean;
  funcionarios: Funcionario[];
  tecnicosOS: TecnicoOS[];
  setTecnicosOS: (tecnicos: TecnicoOS[]) => void;
}

export function EtapaServicosProdutos({
  formData,
  setFormData,
  podeVerTecnicos,
  funcionarios,
  tecnicosOS,
  setTecnicosOS,
}: EtapaServicosProdutosProps) {
  return (
    <div>
      <EtapaCabecalho
        icone={Wrench}
        titulo="Serviços, Produtos e Peças"
        descricao="Selecione o que será utilizado neste atendimento."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Serviços</h4>
          <SelecionadorServico
            value={formData.servicos}
            onChange={(servicos) => setFormData({ ...formData, servicos })}
          />
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Produtos e Peças</h4>
          <SelecionadorProduto
            value={formData.produtos}
            onChange={(produtos) => setFormData({ ...formData, produtos })}
          />
        </div>
      </div>

      {podeVerTecnicos && funcionarios.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-1.5">
            <Label className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <User className="h-3.5 w-3.5" />
              Técnicos por Serviço
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setTecnicosOS([...tecnicosOS, { funcionario_id: "", descricao_servico: "", servico_id: "" }])}
              disabled={formData.servicos.length === 0}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar
            </Button>
          </div>
          {formData.servicos.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Adicione ao menos um serviço acima para vincular um técnico e calcular a comissão sobre o valor dele.
            </p>
          ) : (
            <>
              {tecnicosOS.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Vincule cada serviço realizado ao técnico responsável para calcular a comissão de cada um corretamente.
                </p>
              )}
              <div className="space-y-2">
                {tecnicosOS.map((tec, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 border rounded-xl bg-muted/30">
                    <div className="flex-1 space-y-2">
                      <Select
                        value={tec.servico_id || "selecionar"}
                        onValueChange={(value) => {
                          const novos = [...tecnicosOS];
                          const servico = formData.servicos.find(s => s.id === value);
                          novos[index] = {
                            ...novos[index],
                            servico_id: value === "selecionar" ? "" : value,
                            descricao_servico: servico?.nome || novos[index].descricao_servico,
                          };
                          setTecnicosOS(novos);
                        }}
                      >
                        <SelectTrigger className="h-9 rounded-lg">
                          <SelectValue placeholder="Qual serviço?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="selecionar">Selecione o serviço...</SelectItem>
                          {formData.servicos.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.nome} — {s.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={tec.funcionario_id || "selecionar"}
                        onValueChange={(value) => {
                          const novos = [...tecnicosOS];
                          novos[index] = { ...novos[index], funcionario_id: value === "selecionar" ? "" : value };
                          setTecnicosOS(novos);
                        }}
                      >
                        <SelectTrigger className="h-9 rounded-lg">
                          <SelectValue placeholder="Selecione o técnico" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="selecionar">Selecione...</SelectItem>
                          {funcionarios
                            .filter(f => f.ativo)
                            .map((func) => (
                              <SelectItem key={func.id} value={func.id}>
                                {func.nome}
                                {func.cargo ? ` (${func.cargo})` : ""}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-destructive hover:text-destructive shrink-0"
                      onClick={() => {
                        const novos = tecnicosOS.filter((_, i) => i !== index);
                        setTecnicosOS(novos);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

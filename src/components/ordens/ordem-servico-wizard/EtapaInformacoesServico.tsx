import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, Wrench, User, CalendarIcon, Plus, Check, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Funcionario } from "@/types/funcionario";
import { TipoServico } from "@/hooks/useTiposServico";
import { LocalizacaoOS } from "@/hooks/useLocalizacoesOS";
import { EtapaCabecalho } from "./EtapaCabecalho";
import { CampoLabel } from "./CampoLabel";
import { FormData, TecnicoOS } from "./tipos";

interface EtapaInformacoesServicoProps {
  formData: FormData;
  setFormData: (formData: FormData) => void;
  campoComErro: string | null;
  localizacoes: LocalizacaoOS[];
  podeVerTecnicos: boolean;
  funcionarios: Funcionario[];
  tecnicoObrigatorioOS: boolean;
  tecnicoId: string | null;
  setTecnicoId: (id: string | null) => void;
  tecnicosOS: TecnicoOS[];
  setTecnicosOS: (tecnicos: TecnicoOS[]) => void;
  tiposServico: TipoServico[];
  tipoServicoId: string | null;
  setTipoServicoId: (id: string | null) => void;
  criandoTipoServico: boolean;
  setCriandoTipoServico: (v: boolean) => void;
  novoTipoServicoNome: string;
  setNovoTipoServicoNome: (v: string) => void;
  criarTipoServico: (nome: string) => Promise<TipoServico | null>;
}

export function EtapaInformacoesServico({
  formData,
  setFormData,
  campoComErro,
  localizacoes,
  podeVerTecnicos,
  funcionarios,
  tecnicoObrigatorioOS,
  tecnicoId,
  setTecnicoId,
  tecnicosOS,
  setTecnicosOS,
  tiposServico,
  tipoServicoId,
  setTipoServicoId,
  criandoTipoServico,
  setCriandoTipoServico,
  novoTipoServicoNome,
  setNovoTipoServicoNome,
  criarTipoServico,
}: EtapaInformacoesServicoProps) {
  return (
    <div>
      <EtapaCabecalho
        icone={ClipboardList}
        titulo="Informações do Serviço"
        descricao="Descreva o problema e defina os responsáveis pelo atendimento."
      />

      <div className="space-y-5">
        <div>
          <CampoLabel htmlFor="defeitoRelatado" texto="Defeito Relatado" obrigatorio />
          <Textarea
            id="defeitoRelatado"
            value={formData.defeitoRelatado}
            onChange={(e) =>
              setFormData({ ...formData, defeitoRelatado: e.target.value })
            }
            rows={3}
            className={cn("rounded-xl", campoComErro === "defeitoRelatado" && "border-destructive")}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <CampoLabel htmlFor="observacoesInternas" texto="Observações Internas" />
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {formData.mostrarObsInternasImpressao ? "Aparece na impressão" : "Não aparece na impressão"}
              </span>
              <Switch
                checked={formData.mostrarObsInternasImpressao}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, mostrarObsInternasImpressao: checked })
                }
              />
            </div>
          </div>
          <Textarea
            id="observacoesInternas"
            value={formData.observacoesInternas}
            onChange={(e) =>
              setFormData({ ...formData, observacoesInternas: e.target.value })
            }
            rows={2}
            placeholder="Anotações internas sobre o aparelho"
            className="rounded-xl"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
          {localizacoes.length > 0 && (
            <div>
              <CampoLabel htmlFor="localizacaoFisica" texto="Localização Física" subtexto="Onde o aparelho está fisicamente armazenado ou em reparo." />
              <Select
                value={formData.localizacaoFisica || "__nenhuma__"}
                onValueChange={(value) =>
                  setFormData({ ...formData, localizacaoFisica: value === "__nenhuma__" ? "" : value })
                }
              >
                <SelectTrigger id="localizacaoFisica" className="h-10 rounded-xl">
                  <SelectValue placeholder="Selecionar localização" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__nenhuma__">— Sem localização —</SelectItem>
                  {localizacoes.map((loc) => (
                    <SelectItem key={loc.id} value={loc.nome}>
                      {loc.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <CampoLabel htmlFor="tempoGarantia" texto="Tempo de Garantia" />
            <Select
              value={formData.tempoGarantia?.toString() || "90"}
              onValueChange={(value) =>
                setFormData({ ...formData, tempoGarantia: value === "0" ? null : Number(value) })
              }
            >
              <SelectTrigger id="tempoGarantia" className="h-10 rounded-xl">
                <SelectValue placeholder="Selecione o tempo de garantia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sem garantia</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="15">15 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
                <SelectItem value="180">180 dias (6 meses)</SelectItem>
                <SelectItem value="365">365 dias (1 ano)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Técnico Responsável (principal - compatibilidade) */}
          {podeVerTecnicos && funcionarios.length > 0 && (
            <div>
              <CampoLabel
                htmlFor="tecnicoId"
                texto="Técnico Principal"
                obrigatorio={tecnicoObrigatorioOS}
              />
              <Select
                value={tecnicoId || "nenhum"}
                onValueChange={(value) => setTecnicoId(value === "nenhum" ? null : value)}
              >
                <SelectTrigger className={cn("h-10 rounded-xl", ((tecnicoObrigatorioOS && !tecnicoId) || campoComErro === "tecnicoId") && "border-destructive")}>
                  <SelectValue placeholder="Selecione o técnico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
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
          )}
        </div>

        {/* Técnicos Adicionais */}
        {podeVerTecnicos && funcionarios.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <User className="h-3.5 w-3.5" />
                Técnicos e Serviços Realizados
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setTecnicosOS([...tecnicosOS, { funcionario_id: "", descricao_servico: "" }])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar
              </Button>
            </div>
            {tecnicosOS.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Adicione técnicos para especificar o que cada um realizou nesta OS.
              </p>
            )}
            <div className="space-y-2">
              {tecnicosOS.map((tec, index) => (
                <div key={index} className="flex gap-2 items-start p-3 border rounded-xl bg-muted/30">
                  <div className="flex-1 space-y-2">
                    <Select
                      value={tec.funcionario_id || "selecionar"}
                      onValueChange={(value) => {
                        const novos = [...tecnicosOS];
                        novos[index].funcionario_id = value === "selecionar" ? "" : value;
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
                    <Input
                      placeholder="O que este técnico realizou? Ex: Troca de tela"
                      value={tec.descricao_servico}
                      onChange={(e) => {
                        const novos = [...tecnicosOS];
                        novos[index].descricao_servico = e.target.value;
                        setTecnicosOS(novos);
                      }}
                      className="h-9 text-sm rounded-lg"
                    />
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
          </div>
        )}

        {/* Tipo de Serviço */}
        <div>
          <Label className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Tipo de Serviço
          </Label>
          {criandoTipoServico ? (
            <div className="flex gap-2">
              <Input
                placeholder="Nome do tipo de serviço"
                value={novoTipoServicoNome}
                onChange={(e) => setNovoTipoServicoNome(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && novoTipoServicoNome.trim()) {
                    e.preventDefault();
                    const novo = await criarTipoServico(novoTipoServicoNome.trim());
                    if (novo) {
                      setTipoServicoId(novo.id);
                      setCriandoTipoServico(false);
                      setNovoTipoServicoNome("");
                    }
                  }
                }}
                autoFocus
                className="h-10 rounded-xl"
              />
              <Button
                type="button"
                size="icon"
                className="h-10 w-10 rounded-xl shrink-0"
                onClick={async () => {
                  if (novoTipoServicoNome.trim()) {
                    const novo = await criarTipoServico(novoTipoServicoNome.trim());
                    if (novo) {
                      setTipoServicoId(novo.id);
                      setCriandoTipoServico(false);
                      setNovoTipoServicoNome("");
                    }
                  }
                }}
                disabled={!novoTipoServicoNome.trim()}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl shrink-0"
                onClick={() => { setCriandoTipoServico(false); setNovoTipoServicoNome(""); }}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <Select
                value={tipoServicoId || "nenhum"}
                onValueChange={(value) => setTipoServicoId(value === "nenhum" ? null : value)}
              >
                <SelectTrigger className="flex-1 h-10 rounded-xl">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {tiposServico.map((tipo) => (
                    <SelectItem key={tipo.id} value={tipo.id}>
                      {tipo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-10 w-10 rounded-xl shrink-0"
                onClick={() => setCriandoTipoServico(true)}
                title="Criar novo tipo de serviço"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <CampoLabel texto="Data de Entrada" />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-10 rounded-xl",
                    !formData.dataEntrada && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.dataEntrada
                    ? format(formData.dataEntrada, "dd/MM/yyyy", { locale: ptBR })
                    : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.dataEntrada}
                  onSelect={(date) => date && setFormData({ ...formData, dataEntrada: date })}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <CampoLabel texto="Data de Saída" />
            <Button
              variant="outline"
              disabled
              className={cn(
                "w-full justify-start text-left font-normal h-10 rounded-xl",
                !formData.dataSaida && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.dataSaida
                ? format(formData.dataSaida, "dd/MM/yyyy", { locale: ptBR })
                : "Ao entregar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

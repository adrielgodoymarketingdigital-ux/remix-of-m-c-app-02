import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { SeletorPermissoes } from "./SeletorPermissoes";
import { ComissoesTipoServicoEditor, ComissaoTipoServicoLocal } from "./ComissoesTipoServicoEditor";
import type { Funcionario, FuncionarioFormData, Permissoes, ComissaoTipo, ComissaoEscopo, ComissaoCargo } from "@/types/funcionario";
import { PERMISSOES_DEFAULT, CARGOS_PADRAO, ESCOPOS_POR_CARGO } from "@/types/funcionario";
import { Loader2, Eye, EyeOff, DollarSign, Percent, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useComissoesTipoServico } from "@/hooks/useComissoesTipoServico";

interface DialogCadastroFuncionarioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionario?: Funcionario | null;
  onSalvar: (dados: FuncionarioFormData & { senha?: string }) => Promise<{ id: string } | void>;
  salvando?: boolean;
}

interface ComissaoCargoState {
  tipo: ComissaoTipo | "";
  valor: string;
  escopo: ComissaoEscopo | "";
}

export function DialogCadastroFuncionario({
  open,
  onOpenChange,
  funcionario,
  onSalvar,
  salvando = false,
}: DialogCadastroFuncionarioProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [permissoes, setPermissoes] = useState<Permissoes>(PERMISSOES_DEFAULT);
  const [cargosSelecionados, setCargosSelecionados] = useState<string[]>([]);
  const [cargoPersonalizado, setCargoPersonalizado] = useState("");
  const [mostrarCargoPersonalizado, setMostrarCargoPersonalizado] = useState(false);
  
  // Per-cargo commission state
  const [comissoesPorCargo, setComissoesPorCargo] = useState<Record<string, ComissaoCargoState>>({});
  const [cargoComissaoAtivo, setCargoComissaoAtivo] = useState<string>("");

  // Comissões por tipo de serviço
  const [comissoesTipoServico, setComissoesTipoServico] = useState<ComissaoTipoServicoLocal[]>([]);
  const { carregarPorFuncionario, salvarComissoes: salvarComissoesTipoServico } = useComissoesTipoServico();

  // Build all cargos list (including custom)
  const todosCargos = (() => {
    const cargos = [...cargosSelecionados];
    if (mostrarCargoPersonalizado && cargoPersonalizado.trim()) {
      cargoPersonalizado.split(",").map(c => c.trim()).filter(Boolean).forEach(c => {
        if (!cargos.includes(c)) cargos.push(c);
      });
    }
    return cargos;
  })();

  useEffect(() => {
    if (funcionario) {
      setNome(funcionario.nome);
      setEmail(funcionario.email);
      setPermissoes(funcionario.permissoes);
      setSenha("");
      
      const cargoValue = funcionario.cargo || "";
      if (cargoValue) {
        const cargos = cargoValue.split(",").map(c => c.trim()).filter(Boolean);
        const padrao = cargos.filter(c => CARGOS_PADRAO.includes(c));
        const custom = cargos.filter(c => !CARGOS_PADRAO.includes(c));
        setCargosSelecionados([...padrao]);
        if (custom.length > 0) {
          setMostrarCargoPersonalizado(true);
          setCargoPersonalizado(custom.join(", "));
        } else {
          setMostrarCargoPersonalizado(false);
          setCargoPersonalizado("");
        }
      } else {
        setCargosSelecionados([]);
        setMostrarCargoPersonalizado(false);
        setCargoPersonalizado("");
      }
      
      // Load per-cargo commissions
      if (funcionario.comissoes_por_cargo && Object.keys(funcionario.comissoes_por_cargo).length > 0) {
        const state: Record<string, ComissaoCargoState> = {};
        Object.entries(funcionario.comissoes_por_cargo).forEach(([cargo, config]) => {
          state[cargo] = {
            tipo: config.tipo || "",
            valor: String(config.valor || 0),
            escopo: config.escopo || "",
          };
        });
        setComissoesPorCargo(state);
      } else if (funcionario.comissao_tipo) {
        // Legacy: single commission → map to first cargo or "Geral"
        const primeiroCargo = (funcionario.cargo || "").split(",")[0]?.trim() || "Geral";
        setComissoesPorCargo({
          [primeiroCargo]: {
            tipo: funcionario.comissao_tipo,
            valor: String(funcionario.comissao_valor || 0),
            escopo: funcionario.comissao_escopo || "",
          },
        });
      } else {
        setComissoesPorCargo({});
      }

      // Load comissões por tipo de serviço
      if (funcionario.id) {
        carregarPorFuncionario(funcionario.id).then((data) => {
          setComissoesTipoServico(
            data.map(c => ({
              tipo_servico_id: c.tipo_servico_id,
              tipo_servico_nome: "",
              comissao_tipo: c.comissao_tipo,
              comissao_valor: c.comissao_valor,
            }))
          );
        });
      }
    } else {
      setNome("");
      setEmail("");
      setSenha("");
      setPermissoes(PERMISSOES_DEFAULT);
      setCargosSelecionados([]);
      setMostrarCargoPersonalizado(false);
      setCargoPersonalizado("");
      setComissoesPorCargo({});
      setComissoesTipoServico([]);
    }
  }, [funcionario, open]);

  // Set active tab when cargos change
  useEffect(() => {
    if (todosCargos.length > 0 && (!cargoComissaoAtivo || !todosCargos.includes(cargoComissaoAtivo))) {
      setCargoComissaoAtivo(todosCargos[0]);
    }
  }, [todosCargos, cargoComissaoAtivo]);

  const toggleCargo = (cargo: string) => {
    setCargosSelecionados(prev => {
      const isRemoving = prev.includes(cargo);
      const newCargos = isRemoving ? prev.filter(c => c !== cargo) : [...prev, cargo];
      
      // When adding a new cargo, copy commission from the previously selected single cargo
      if (!isRemoving && prev.length === 1) {
        const cargoAnterior = prev[0];
        const comissaoAnterior = comissoesPorCargo[cargoAnterior];
        if (comissaoAnterior && comissaoAnterior.tipo && parseFloat(comissaoAnterior.valor) > 0 && !comissoesPorCargo[cargo]) {
          setComissoesPorCargo(prevComissoes => ({
            ...prevComissoes,
            [cargo]: { ...comissaoAnterior },
          }));
        }
      }
      
      // When switching from one cargo to another (remove old, add new via separate click)
      // If only one cargo remains and new cargo has no commission, copy from removed one
      if (isRemoving && prev.length === 1) {
        const comissaoRemovida = comissoesPorCargo[cargo];
        if (comissaoRemovida && comissaoRemovida.tipo && parseFloat(comissaoRemovida.valor) > 0) {
          // Store temporarily so it can be applied to next added cargo
          setComissoesPorCargo(prevComissoes => ({
            ...prevComissoes,
            _ultimo_removido: { ...comissaoRemovida },
          }));
        }
      }
      
      if (!isRemoving && newCargos.length === 1 && comissoesPorCargo._ultimo_removido && !comissoesPorCargo[cargo]) {
        setComissoesPorCargo(prevComissoes => {
          const { _ultimo_removido, ...rest } = prevComissoes;
          return {
            ...rest,
            [cargo]: { ..._ultimo_removido },
          };
        });
      }
      
      return newCargos;
    });
  };

  const getComissaoCargo = (cargo: string): ComissaoCargoState => {
    return comissoesPorCargo[cargo] || { tipo: "", valor: "0", escopo: "" };
  };

  const setComissaoField = (cargo: string, field: keyof ComissaoCargoState, value: string) => {
    setComissoesPorCargo(prev => ({
      ...prev,
      [cargo]: {
        ...getComissaoCargo(cargo),
        [field]: value,
      },
    }));
  };

  const getEscoposForCargo = (cargo: string) => {
    return ESCOPOS_POR_CARGO[cargo] || ESCOPOS_POR_CARGO._default;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cargos = [...cargosSelecionados];
    if (mostrarCargoPersonalizado && cargoPersonalizado.trim()) {
      cargoPersonalizado.split(",").map(c => c.trim()).filter(Boolean).forEach(c => {
        if (!cargos.includes(c)) cargos.push(c);
      });
    }
    const cargoFinal = cargos.length > 0 ? cargos.join(", ") : null;

    // Build comissoes_por_cargo (only entries with actual config)
    const comissoesFinais: Record<string, ComissaoCargo> = {};
    let primaryTipo: ComissaoTipo | null = null;
    let primaryValor = 0;
    let primaryEscopo: ComissaoEscopo | null = null;

    Object.entries(comissoesPorCargo).forEach(([cargo, config]) => {
      if (config.tipo && config.escopo && parseFloat(config.valor) > 0) {
        comissoesFinais[cargo] = {
          tipo: config.tipo as ComissaoTipo,
          valor: parseFloat(config.valor),
          escopo: config.escopo as ComissaoEscopo,
        };
        // Use the first valid one as legacy fallback
        if (!primaryTipo) {
          primaryTipo = config.tipo as ComissaoTipo;
          primaryValor = parseFloat(config.valor);
          primaryEscopo = config.escopo as ComissaoEscopo;
        }
      }
    });

    const resultado = await onSalvar({
      nome,
      email,
      permissoes,
      senha: senha || undefined,
      cargo: cargoFinal,
      comissao_tipo: primaryTipo,
      comissao_valor: primaryValor,
      comissao_escopo: primaryEscopo,
      comissoes_por_cargo: Object.keys(comissoesFinais).length > 0 ? comissoesFinais : null,
    });

    // Salvar comissões por tipo de serviço
    const funcionarioId = funcionario?.id || (resultado as { id: string } | undefined)?.id;
    if (funcionarioId) {
      await salvarComissoesTipoServico(
        funcionarioId,
        comissoesTipoServico
          .filter(c => c.comissao_valor > 0)
          .map(c => ({
            tipo_servico_id: c.tipo_servico_id,
            comissao_tipo: c.comissao_tipo,
            comissao_valor: c.comissao_valor,
          }))
      );
    }

    if (!funcionario) {
      setNome("");
      setEmail("");
      setSenha("");
      setPermissoes(PERMISSOES_DEFAULT);
      setCargosSelecionados([]);
      setMostrarCargoPersonalizado(false);
      setCargoPersonalizado("");
      setComissoesPorCargo({});
      setComissoesTipoServico([]);
    }
  };

  const isEdicao = !!funcionario;
  
  const comissaoExemplo = (cargo: string) => {
    const config = getComissaoCargo(cargo);
    const valor = parseFloat(config.valor) || 0;
    if (!config.tipo || valor <= 0) return null;
    const escopos = getEscoposForCargo(cargo);
    const escopoLabel = escopos.find(e => e.value === config.escopo)?.label || "vendas";
    if (config.tipo === "porcentagem") {
      return `${valor}% sobre ${escopoLabel.toLowerCase()} → ex: venda de R$ 100 = R$ ${(100 * valor / 100).toFixed(2)}`;
    }
    return `R$ ${valor.toFixed(2)} por ${escopoLabel.toLowerCase()} realizada`;
  };

  const renderComissaoCargo = (cargo: string) => {
    const config = getComissaoCargo(cargo);
    const escopos = getEscoposForCargo(cargo);

    return (
      <div className="space-y-4" key={cargo}>
        {/* Escopo */}
        <div className="space-y-2">
          <Label className="text-sm">Comissão sobre</Label>
          <RadioGroup
            value={config.escopo}
            onValueChange={(v) => setComissaoField(cargo, "escopo", v)}
            className="grid gap-2"
          >
            {escopos.map((escopo) => (
              <div key={escopo.value} className="flex items-start space-x-3 rounded-md border p-3 hover:bg-muted/50 transition-colors">
                <RadioGroupItem value={escopo.value} id={`escopo-${cargo}-${escopo.value}`} className="mt-0.5" />
                <div className="space-y-0.5">
                  <Label htmlFor={`escopo-${cargo}-${escopo.value}`} className="text-sm font-medium cursor-pointer">
                    {escopo.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{escopo.descricao}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Tipo e Valor */}
        {config.escopo && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Tipo</Label>
              <Select value={config.tipo} onValueChange={(v) => setComissaoField(cargo, "tipo", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="porcentagem">
                    <span className="flex items-center gap-1"><Percent className="h-3 w-3" /> Porcentagem</span>
                  </SelectItem>
                  <SelectItem value="valor_fixo">
                    <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> Valor Fixo (R$)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Valor</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step={config.tipo === "porcentagem" ? "0.5" : "0.01"}
                  max={config.tipo === "porcentagem" ? "100" : undefined}
                  value={config.valor}
                  onChange={(e) => setComissaoField(cargo, "valor", e.target.value)}
                  placeholder="0"
                  disabled={!config.tipo}
                />
                {config.tipo && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {config.tipo === "porcentagem" ? "%" : "R$"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {comissaoExemplo(cargo) && (
          <Badge variant="outline" className="text-xs font-normal">
            {comissaoExemplo(cargo)}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdicao ? "Editar Funcionário" : "Cadastrar Funcionário"}
          </DialogTitle>
          <DialogDescription>
            {isEdicao
              ? "Atualize os dados e permissões do funcionário."
              : "Adicione um novo funcionário e defina suas permissões de acesso."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do funcionário"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                required
                disabled={isEdicao}
              />
              {!isEdicao && (
                <p className="text-xs text-muted-foreground">
                  O funcionário usará este email para fazer login no sistema.
                </p>
              )}
            </div>

            {!isEdicao && (
              <div className="space-y-2">
                <Label htmlFor="senha">Senha de Acesso</Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                  >
                    {mostrarSenha ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Crie uma senha para o funcionário. Ele poderá alterá-la depois.
                </p>
              </div>
            )}

            {/* Cargo / Categoria - Multi-select */}
            <div className="space-y-2">
              <Label>Cargo(s) / Categoria(s)</Label>
              <p className="text-xs text-muted-foreground">Selecione um ou mais cargos para este funcionário.</p>
              <div className="grid gap-2">
                {CARGOS_PADRAO.map((c) => (
                  <div key={c} className="flex items-center space-x-2 rounded-md border p-3 hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id={`cargo-${c}`}
                      checked={cargosSelecionados.includes(c)}
                      onCheckedChange={() => toggleCargo(c)}
                    />
                    <Label htmlFor={`cargo-${c}`} className="cursor-pointer font-medium text-sm flex-1">
                      {c}
                    </Label>
                  </div>
                ))}
                <div className="flex items-center space-x-2 rounded-md border p-3 hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id="cargo-personalizado"
                    checked={mostrarCargoPersonalizado}
                    onCheckedChange={(checked) => {
                      setMostrarCargoPersonalizado(!!checked);
                      if (!checked) setCargoPersonalizado("");
                    }}
                  />
                  <Label htmlFor="cargo-personalizado" className="cursor-pointer font-medium text-sm flex-1">
                    Personalizar...
                  </Label>
                </div>
              </div>
              {mostrarCargoPersonalizado && (
                <Input
                  value={cargoPersonalizado}
                  onChange={(e) => setCargoPersonalizado(e.target.value)}
                  placeholder="Digite o(s) cargo(s) personalizado(s), separados por vírgula"
                  className="mt-2"
                />
              )}
              {cargosSelecionados.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {cargosSelecionados.map(c => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                  {mostrarCargoPersonalizado && cargoPersonalizado && (
                    cargoPersonalizado.split(",").map(c => c.trim()).filter(Boolean).map(c => (
                      <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Comissão por Cargo */}
            <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Comissão
              </h3>

              {todosCargos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Selecione pelo menos um cargo acima para configurar a comissão.
                </p>
              ) : todosCargos.length === 1 ? (
                // Single cargo: no tabs needed
                renderComissaoCargo(todosCargos[0])
              ) : (
                // Multiple cargos: use tabs
                <Tabs value={cargoComissaoAtivo} onValueChange={setCargoComissaoAtivo}>
                  <TabsList className="w-full flex-wrap h-auto gap-1">
                    {todosCargos.map(cargo => {
                      const config = getComissaoCargo(cargo);
                      const hasConfig = config.tipo && config.escopo && parseFloat(config.valor) > 0;
                      return (
                        <TabsTrigger key={cargo} value={cargo} className="text-xs relative">
                          {cargo}
                          {hasConfig && (
                            <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  {todosCargos.map(cargo => (
                    <TabsContent key={cargo} value={cargo} className="mt-3">
                      {renderComissaoCargo(cargo)}
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </div>

            {/* Comissão por Tipo de Serviço */}
            <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Comissão por Tipo de Serviço
              </h3>
              {!isEdicao ? (
                <p className="text-sm text-muted-foreground">
                  Salve o funcionário primeiro. Depois, edite para configurar comissões por tipo de serviço.
                </p>
              ) : (
                <ComissoesTipoServicoEditor
                  comissoes={comissoesTipoServico}
                  onChange={setComissoesTipoServico}
                />
              )}
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-muted/30">
            <h3 className="font-semibold mb-4">Permissões de Acesso</h3>
            <SeletorPermissoes permissoes={permissoes} onChange={setPermissoes} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || (!isEdicao && senha.length < 6)}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdicao ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

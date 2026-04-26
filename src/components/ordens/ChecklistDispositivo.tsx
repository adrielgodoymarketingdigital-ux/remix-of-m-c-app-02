import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { checklistTemplates, checklistLabels, getChecklistKey } from "@/lib/checklist-templates";
import { checklistIcons } from "@/lib/checklist-icons";
import { Checklist } from "@/types/ordem-servico";
import React, { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { AlertTriangle } from "lucide-react";

interface ChecklistDispositivoProps {
  tipoDispositivo: string;
  sistema?: string;
  fabricante?: string;
  subtipo?: string;
  value: Checklist;
  onChange: (checklist: Checklist) => void;
  onSistemaChange?: (sistema: string) => void;
  onFabricanteChange?: (fabricante: string) => void;
  onSubtipoChange?: (subtipo: string) => void;
}

export const ChecklistDispositivo = ({ 
  tipoDispositivo, 
  sistema,
  fabricante,
  subtipo,
  value, 
  onChange,
  onSistemaChange,
  onFabricanteChange,
  onSubtipoChange
}: ChecklistDispositivoProps) => {
  const isMobile = useIsMobile();
  const [tipoSelecionado, setTipoSelecionado] = useState(tipoDispositivo);
  const [sistemaSelecionado, setSistemaSelecionado] = useState(sistema || '');
  const [fabricanteSelecionado, setFabricanteSelecionado] = useState(fabricante || '');
  const [subtipoSelecionado, setSubtipoSelecionado] = useState(subtipo || '');

  useEffect(() => {
    setTipoSelecionado(tipoDispositivo);
  }, [tipoDispositivo]);

  useEffect(() => {
    setSistemaSelecionado(sistema || '');
  }, [sistema]);

  useEffect(() => {
    setFabricanteSelecionado(fabricante || '');
  }, [fabricante]);

  useEffect(() => {
    setSubtipoSelecionado(subtipo || '');
  }, [subtipo]);

  const checklistKey = getChecklistKey(tipoSelecionado, sistemaSelecionado, fabricanteSelecionado);
  const items = checklistTemplates[checklistKey] || [];


  const handleSistemaChange = (novoSistema: string) => {
    setSistemaSelecionado(novoSistema);
    onChange({ entrada: {}, saida: {} });
    onSistemaChange?.(novoSistema);
  };

  const handleFabricanteChange = (novoFabricante: string) => {
    setFabricanteSelecionado(novoFabricante);
    onChange({ entrada: {}, saida: {} });
    onFabricanteChange?.(novoFabricante);
  };

  const handleSubtipoChange = (novoSubtipo: string) => {
    setSubtipoSelecionado(novoSubtipo);
    onSubtipoChange?.(novoSubtipo);
  };

  const handleChange = (item: string, estado: 'entrada' | 'saida', funciona: boolean) => {
    const valorAtual = value[estado]?.[item];
    // Toggle: se clicar no mesmo valor, desmarca (undefined)
    const novoValor = valorAtual === funciona ? undefined : funciona;
    const novoEstado = { ...value[estado] };
    if (novoValor === undefined) {
      delete novoEstado[item];
    } else {
      novoEstado[item] = novoValor;
    }
    onChange({
      ...value,
      [estado]: novoEstado
    });
  };

  const selecionarTodosEntrada = (marcar: boolean) => {
    const novoEstado = items.reduce((acc, item) => {
      acc[item] = marcar;
      return acc;
    }, {} as Record<string, boolean>);
    
    onChange({
      ...value,
      entrada: novoEstado
    });
  };

  const selecionarTodosSaida = (marcar: boolean) => {
    const novoEstado = items.reduce((acc, item) => {
      acc[item] = marcar;
      return acc;
    }, {} as Record<string, boolean>);
    
    onChange({
      ...value,
      saida: novoEstado
    });
  };

  const normalizarTipo = (tipo: string): string => {
    return tipo.toLowerCase().replace(/ /g, '_');
  };

  const tipoNormalizado = normalizarTipo(tipoSelecionado);
  const mostrarSistema = tipoNormalizado === 'celular' || tipoNormalizado === 'tablet';
  const mostrarFabricante = tipoNormalizado === 'notebook';
  const mostrarSubtipo = tipoNormalizado === 'relogio_smart';

  const renderMobileChecklist = () => (
    <div className="space-y-4 w-full max-w-full overflow-x-hidden">
      {/* Botões de ação rápida - Layout horizontal compacto */}
      <div className="flex gap-2 p-3 bg-muted/50 rounded-lg">
        <div className="flex-1 space-y-1.5">
          <p className="text-xs font-semibold text-center text-foreground">Entrada</p>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs px-2"
              onClick={() => selecionarTodosEntrada(true)}
            >
              ✅ Tudo OK
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => selecionarTodosEntrada(false)}
            >
              ❌
            </Button>
          </div>
        </div>
        <div className="w-px bg-border" />
        <div className="flex-1 space-y-1.5">
          <p className="text-xs font-semibold text-center text-foreground">Saída</p>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs px-2"
              onClick={() => selecionarTodosSaida(true)}
            >
              ✅ Tudo OK
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => selecionarTodosSaida(false)}
            >
              ❌
            </Button>
          </div>
        </div>
      </div>

      {/* Cards de itens - Layout mais limpo */}
      <div className="space-y-2">
        {items.map((item) => {
          const IconComponent = checklistIcons[item];
          const entradaValue = value.entrada?.[item];
          const saidaValue = value.saida?.[item];
          
          return (
            <div key={item} className="w-full max-w-full overflow-hidden p-3 border rounded-lg bg-card shadow-sm">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b min-w-0">
                {IconComponent && <IconComponent className="w-4 h-4 text-primary flex-shrink-0" />}
                <span className="font-medium text-sm flex-1 break-words">{checklistLabels[item]}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground text-center">Entrada</p>
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleChange(item, 'entrada', true)}
                      aria-pressed={entradaValue === true}
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-medium transition-all shadow-sm active:scale-95 border ${
                        entradaValue === true 
                          ? 'bg-primary text-primary-foreground border-primary ring-2 ring-ring ring-offset-1' 
                          : 'bg-muted text-foreground hover:bg-accent border-border'
                      }`}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange(item, 'entrada', false)}
                      aria-pressed={entradaValue === false}
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-medium transition-all shadow-sm active:scale-95 border ${
                        entradaValue === false 
                          ? 'bg-destructive text-destructive-foreground border-destructive ring-2 ring-ring ring-offset-1' 
                          : 'bg-muted text-foreground hover:bg-accent border-border'
                      }`}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground text-center">Saída</p>
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleChange(item, 'saida', true)}
                      aria-pressed={saidaValue === true}
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-medium transition-all shadow-sm active:scale-95 border ${
                        saidaValue === true 
                          ? 'bg-primary text-primary-foreground border-primary ring-2 ring-ring ring-offset-1' 
                          : 'bg-muted text-foreground hover:bg-accent border-border'
                      }`}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange(item, 'saida', false)}
                      aria-pressed={saidaValue === false}
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-medium transition-all shadow-sm active:scale-95 border ${
                        saidaValue === false 
                          ? 'bg-destructive text-destructive-foreground border-destructive ring-2 ring-ring ring-offset-1' 
                          : 'bg-muted text-foreground hover:bg-accent border-border'
                      }`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>

              {/* Campo de descrição para Peça Trocada */}
              {item === 'peca_trocada' && (entradaValue === true || saidaValue === true) && (
                <div className="mt-2 space-y-2">
                  {entradaValue === true && (
                    <Input
                      type="text"
                      placeholder="Qual peça foi trocada? (entrada)"
                      value={(value as any).peca_trocada_descricao_entrada || ''}
                      onChange={(e) => onChange({ ...value, peca_trocada_descricao_entrada: e.target.value || undefined } as any)}
                      className="h-8 text-xs"
                    />
                  )}
                  {saidaValue === true && (
                    <Input
                      type="text"
                      placeholder="Qual peça foi trocada? (saída)"
                      value={(value as any).peca_trocada_descricao_saida || ''}
                      onChange={(e) => onChange({ ...value, peca_trocada_descricao_saida: e.target.value || undefined } as any)}
                      className="h-8 text-xs"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderDesktopChecklist = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2 text-xs">Item</th>
            <th className="text-center p-2 text-xs">
              <div className="flex flex-col gap-1">
                <span className="font-semibold">Entrada</span>
                <div className="flex gap-1 justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => selecionarTodosEntrada(true)}
                  >
                    ✅ Todos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => selecionarTodosEntrada(false)}
                  >
                    ❌ Limpar
                  </Button>
                </div>
              </div>
            </th>
            <th className="text-center p-2 text-xs">
              <div className="flex flex-col gap-1">
                <span className="font-semibold">Saída</span>
                <div className="flex gap-1 justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => selecionarTodosSaida(true)}
                  >
                    ✅ Todos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => selecionarTodosSaida(false)}
                  >
                    ❌ Limpar
                  </Button>
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const IconComponent = checklistIcons[item];
            const entradaAtiva = value.entrada?.[item];
            const saidaAtiva = value.saida?.[item];
            return (
              <React.Fragment key={item}>
              <tr className="border-b last:border-0">
                <td className="p-2 font-medium">
                  <div className="flex items-center gap-2">
                    {IconComponent && <IconComponent className="w-4 h-4 text-muted-foreground" />}
                    <span>{checklistLabels[item]}</span>
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant={entradaAtiva === true ? "default" : "outline"}
                      size="sm"
                      className="h-8 min-w-10"
                      onClick={() => handleChange(item, 'entrada', true)}
                    >
                      ✓
                    </Button>
                    <Button
                      type="button"
                      variant={entradaAtiva === false ? "destructive" : "outline"}
                      size="sm"
                      className="h-8 min-w-10"
                      onClick={() => handleChange(item, 'entrada', false)}
                    >
                      ✕
                    </Button>
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant={saidaAtiva === true ? "default" : "outline"}
                      size="sm"
                      className="h-8 min-w-10"
                      onClick={() => handleChange(item, 'saida', true)}
                    >
                      ✓
                    </Button>
                    <Button
                      type="button"
                      variant={saidaAtiva === false ? "destructive" : "outline"}
                      size="sm"
                      className="h-8 min-w-10"
                      onClick={() => handleChange(item, 'saida', false)}
                    >
                      ✕
                    </Button>
                  </div>
                </td>
              </tr>
              {/* Campo de descrição para Peça Trocada - Desktop */}
              {item === 'peca_trocada' && (entradaAtiva === true || saidaAtiva === true) && (
                <tr>
                  <td colSpan={3} className="px-2 pb-2">
                    <div className="flex gap-2">
                      {entradaAtiva === true && (
                        <Input
                          type="text"
                          placeholder="Qual peça foi trocada? (entrada)"
                          value={(value as any).peca_trocada_descricao_entrada || ''}
                          onChange={(e) => onChange({ ...value, peca_trocada_descricao_entrada: e.target.value || undefined } as any)}
                          className="h-8 text-xs flex-1"
                        />
                      )}
                      {saidaAtiva === true && (
                        <Input
                          type="text"
                          placeholder="Qual peça foi trocada? (saída)"
                          value={(value as any).peca_trocada_descricao_saida || ''}
                          onChange={(e) => onChange({ ...value, peca_trocada_descricao_saida: e.target.value || undefined } as any)}
                          className="h-8 text-xs flex-1"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <Card className="p-2">
      <div className="space-y-2">
        {/* Título informativo */}
        <div className="mb-2">
          <p className="text-sm font-medium">
            Dispositivo: <span className="text-primary">{tipoSelecionado || "Não selecionado"}</span>
          </p>
        </div>

        {/* Sistema Operacional (iOS/Android) */}
        {mostrarSistema && (
          <div className="mb-3">
            <Label htmlFor="sistema" className="text-xs">Sistema Operacional</Label>
            <Select value={sistemaSelecionado} onValueChange={handleSistemaChange}>
              <SelectTrigger id="sistema" className="w-full h-10 sm:h-8">
                <SelectValue placeholder="Selecione o sistema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ios">iPhone (iOS)</SelectItem>
                <SelectItem value="android">Android</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Fabricante Notebook (Macbook/Outro) */}
        {mostrarFabricante && (
          <div className="mb-3">
            <Label htmlFor="fabricante" className="text-xs">Fabricante</Label>
            <Select value={fabricanteSelecionado} onValueChange={handleFabricanteChange}>
              <SelectTrigger id="fabricante" className="w-full h-10 sm:h-8">
                <SelectValue placeholder="Selecione o fabricante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="macbook">Macbook (Apple)</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Subtipo Relógio Smart */}
        {mostrarSubtipo && (
          <div className="mb-3">
            <Label htmlFor="subtipo" className="text-xs">Modelo</Label>
            <Select value={subtipoSelecionado} onValueChange={handleSubtipoChange}>
              <SelectTrigger id="subtipo" className="w-full h-10 sm:h-8">
                <SelectValue placeholder="Selecione o modelo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Apple Watch">Apple Watch</SelectItem>
                <SelectItem value="Garmin">Garmin</SelectItem>
                <SelectItem value="Samsung Watch">Samsung Watch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Opção Sem Teste */}
        <div className="flex items-center justify-between p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div>
              <Label htmlFor="sem-teste" className="text-sm font-medium cursor-pointer">
                Sem teste (entrada)
              </Label>
              <p className="text-xs text-muted-foreground">
                Marque se o aparelho chegou desligado e não foi possível testar
              </p>
            </div>
          </div>
          <Switch
            id="sem-teste"
            checked={value.sem_teste === true}
            onCheckedChange={(checked) => {
              onChange({
                ...value,
                sem_teste: checked || undefined,
              });
            }}
          />
        </div>

        {value.sem_teste && (
          <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-300">
            <span className="font-medium">⚠️ Sem teste:</span>{" "}
            Não foi possível realizar os testes porque o aparelho chegou desligado.
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center text-muted-foreground py-4 text-sm">
            Selecione um tipo de dispositivo para ver o checklist
          </div>
        ) : (
          isMobile ? renderMobileChecklist() : renderDesktopChecklist()
        )}
      </div>
    </Card>
  );
};
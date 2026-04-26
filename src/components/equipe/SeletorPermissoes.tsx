import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Database, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Permissoes, PermissoesModulos, PermissoesRecursos, PermissoesDados } from "@/types/funcionario";
import { MODULOS_LABELS, RECURSOS_LABELS, DADOS_LABELS, PERMISSOES_DEFAULT } from "@/types/funcionario";

interface SeletorPermissoesProps {
  permissoes: Permissoes;
  onChange: (permissoes: Permissoes) => void;
}

export function SeletorPermissoes({ permissoes, onChange }: SeletorPermissoesProps) {
  // Garantir que dados existe
  const permissoesCompletas: Permissoes = {
    ...permissoes,
    dados: permissoes.dados ?? PERMISSOES_DEFAULT.dados,
  };

  const handleModuloChange = (modulo: keyof PermissoesModulos, checked: boolean) => {
    onChange({
      ...permissoesCompletas,
      modulos: {
        ...permissoesCompletas.modulos,
        [modulo]: checked,
      },
    });
  };

  const handleRecursoChange = (recurso: keyof PermissoesRecursos, checked: boolean) => {
    onChange({
      ...permissoesCompletas,
      recursos: {
        ...permissoesCompletas.recursos,
        [recurso]: checked,
      },
    });
  };

  const handleDadosChange = (dado: keyof PermissoesDados, checked: boolean) => {
    onChange({
      ...permissoesCompletas,
      dados: {
        ...permissoesCompletas.dados!,
        [dado]: checked,
      },
    });
  };

  const permitirTudo = () => {
    const novosModulos = { ...permissoesCompletas.modulos };
    const novosRecursos = { ...permissoesCompletas.recursos };
    const novosDados = { ...permissoesCompletas.dados! };
    
    Object.keys(novosModulos).forEach((key) => {
      novosModulos[key as keyof PermissoesModulos] = true;
    });
    Object.keys(novosRecursos).forEach((key) => {
      novosRecursos[key as keyof PermissoesRecursos] = true;
    });
    Object.keys(novosDados).forEach((key) => {
      novosDados[key as keyof PermissoesDados] = true;
    });
    
    onChange({ modulos: novosModulos, recursos: novosRecursos, dados: novosDados });
  };

  const bloquearTudo = () => {
    const novosModulos = { ...PERMISSOES_DEFAULT.modulos };
    const novosRecursos = { ...PERMISSOES_DEFAULT.recursos };
    const novosDados = { ...PERMISSOES_DEFAULT.dados! };
    
    // Mantém apenas dashboard, suporte e novidades
    novosModulos.dashboard = true;
    novosModulos.suporte = true;
    novosModulos.novidades = true;
    
    onChange({ modulos: novosModulos, recursos: novosRecursos, dados: novosDados });
  };

  // Módulos que podem ser alterados (exclui os que são sempre ativos)
  const modulosEditaveis = Object.keys(MODULOS_LABELS).filter(
    (key) => !["suporte", "novidades"].includes(key)
  ) as (keyof PermissoesModulos)[];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={permitirTudo}
          className="flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Permitir Tudo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={bloquearTudo}
          className="flex items-center gap-2"
        >
          <XCircle className="h-4 w-4 text-destructive" />
          Bloquear Tudo
        </Button>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-3">Módulos</h4>
        <div className="grid grid-cols-2 gap-3">
          {modulosEditaveis.map((modulo) => (
            <div key={modulo} className="flex items-center space-x-2">
              <Checkbox
                id={`modulo-${modulo}`}
                checked={permissoesCompletas.modulos[modulo]}
                onCheckedChange={(checked) => handleModuloChange(modulo, !!checked)}
              />
              <Label
                htmlFor={`modulo-${modulo}`}
                className="text-sm cursor-pointer"
              >
                {MODULOS_LABELS[modulo]}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-3">Permissões Especiais</h4>
        <div className="grid grid-cols-1 gap-3">
          {(Object.keys(RECURSOS_LABELS) as (keyof PermissoesRecursos)[]).map((recurso) => (
            <div key={recurso} className="flex items-center space-x-2">
              <Checkbox
                id={`recurso-${recurso}`}
                checked={permissoesCompletas.recursos[recurso]}
                onCheckedChange={(checked) => handleRecursoChange(recurso, !!checked)}
              />
              <Label
                htmlFor={`recurso-${recurso}`}
                className="text-sm cursor-pointer"
              >
                {RECURSOS_LABELS[recurso]}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-4 w-4 text-foreground" />
          <h4 className="font-medium">Sincronização de Dados</h4>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Ao ativar estas opções, o funcionário terá acesso aos dados 
                  já cadastrados por você. Sem elas, verá apenas uma lista vazia.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Permite que o funcionário visualize e gerencie os dados já cadastrados na loja.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {(Object.keys(DADOS_LABELS) as (keyof PermissoesDados)[]).map((dado) => (
            <div key={dado} className="flex items-center space-x-2">
              <Checkbox
                id={`dado-${dado}`}
                checked={permissoesCompletas.dados?.[dado] ?? false}
                onCheckedChange={(checked) => handleDadosChange(dado, !!checked)}
              />
              <Label
                htmlFor={`dado-${dado}`}
                className="text-sm cursor-pointer"
              >
                {DADOS_LABELS[dado]}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        * Suporte e Novidades estão sempre disponíveis para todos os funcionários.
      </p>
    </div>
  );
}

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Database, Info, ChevronRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Permissoes, PermissoesModulos, PermissoesRecursos, PermissoesDados } from "@/types/funcionario";
import { DADOS_LABELS, PERMISSOES_DEFAULT } from "@/types/funcionario";

interface SeletorPermissoesProps {
  permissoes: Permissoes;
  onChange: (permissoes: Permissoes) => void;
}

// Estrutura de módulos com submenus agrupados
const GRUPOS_MODULOS: Array<{
  tipo: "item" | "grupo";
  modulo?: keyof PermissoesModulos;
  label?: string;
  pai?: keyof PermissoesModulos;
  paiLabel?: string;
  filhos?: Array<{ modulo: keyof PermissoesModulos; label: string }>;
}> = [
  { tipo: "item", modulo: "dashboard", label: "Dashboard" },
  { tipo: "item", modulo: "pdv", label: "PDV" },
  { tipo: "item", modulo: "ordem_servico", label: "Ordem de Serviço" },
  { tipo: "item", modulo: "produtos_pecas", label: "Produtos e Peças" },
  { tipo: "item", modulo: "servicos", label: "Serviços" },
  { tipo: "item", modulo: "dispositivos", label: "Dispositivos" },
  { tipo: "item", modulo: "catalogo", label: "Catálogo" },
  { tipo: "item", modulo: "origem_dispositivos", label: "Origem de Dispositivos" },
  { tipo: "item", modulo: "fornecedores", label: "Fornecedores" },
  {
    tipo: "grupo",
    pai: "clientes",
    paiLabel: "Clientes",
    filhos: [
      { modulo: "clientes", label: "Clientes" },
      { modulo: "fidelidade", label: "Fidelidade" },
    ],
  },
  { tipo: "item", modulo: "orcamentos", label: "Orçamentos" },
  { tipo: "item", modulo: "contas", label: "Contas" },
  { tipo: "item", modulo: "vendas", label: "Vendas" },
  {
    tipo: "grupo",
    pai: "financeiro",
    paiLabel: "Financeiro",
    filhos: [
      { modulo: "financeiro", label: "Financeiro" },
      { modulo: "relatorios", label: "Relatórios" },
    ],
  },
  { tipo: "item", modulo: "configuracoes", label: "Configurações" },
  { tipo: "item", modulo: "precificador", label: "Precificador" },
  { tipo: "item", modulo: "tutoriais", label: "Tutoriais" },
];

// Seções controláveis dentro do Financeiro
const SECOES_FINANCEIRO: Array<{ recurso: keyof PermissoesRecursos; label: string; descricao: string }> = [
  {
    recurso: "ver_contas_pagar_receber",
    label: "Contas a Pagar e Receber",
    descricao: "Permite ver e gerenciar contas dentro do Financeiro",
  },
  {
    recurso: "ver_analise_lucros",
    label: "Análise de Lucros e Custos",
    descricao: "Permite ver a análise de lucros e custos dentro do Financeiro",
  },
];

// Outros recursos especiais (excluindo os de seção do financeiro)
const RECURSOS_OUTROS: Array<{ recurso: keyof PermissoesRecursos; label: string }> = [
  { recurso: "ver_custos", label: "Ver custos dos produtos" },
  { recurso: "ver_lucros", label: "Ver lucros das vendas" },
  { recurso: "criar_servico_os", label: "Criar serviço novo na OS" },
  { recurso: "editar_produtos", label: "Editar quantidade e preço de produtos/peças" },
  { recurso: "ver_tecnicos_os", label: "Ver lista de técnicos na Ordem de Serviço" },
  { recurso: "ver_inventario", label: "Ver cards de inventário (estoque valorizado)" },
  { recurso: "ver_todas_os", label: "Ver todas as ordens de serviço (desativado = apenas as próprias)" },
];

export function SeletorPermissoes({ permissoes, onChange }: SeletorPermissoesProps) {
  const permissoesCompletas: Permissoes = {
    ...permissoes,
    dados: permissoes.dados ?? PERMISSOES_DEFAULT.dados,
    recursos: {
      ...PERMISSOES_DEFAULT.recursos,
      ...permissoes.recursos,
    },
  };

  const handleModuloChange = (modulo: keyof PermissoesModulos, checked: boolean) => {
    onChange({
      ...permissoesCompletas,
      modulos: { ...permissoesCompletas.modulos, [modulo]: checked },
    });
  };

  const handleRecursoChange = (recurso: keyof PermissoesRecursos, checked: boolean) => {
    onChange({
      ...permissoesCompletas,
      recursos: { ...permissoesCompletas.recursos, [recurso]: checked },
    });
  };

  const handleDadosChange = (dado: keyof PermissoesDados, checked: boolean) => {
    onChange({
      ...permissoesCompletas,
      dados: { ...permissoesCompletas.dados!, [dado]: checked },
    });
  };

  // Ao marcar/desmarcar o pai de um grupo, propaga para todos os filhos
  const handleGrupoPaiChange = (
    filhos: Array<{ modulo: keyof PermissoesModulos }>,
    checked: boolean
  ) => {
    const novosModulos = { ...permissoesCompletas.modulos };
    filhos.forEach(f => { novosModulos[f.modulo] = checked; });
    onChange({ ...permissoesCompletas, modulos: novosModulos });
  };

  const permitirTudo = () => {
    const novosModulos = Object.fromEntries(
      Object.keys(permissoesCompletas.modulos).map(k => [k, true])
    ) as PermissoesModulos;
    const novosRecursos = Object.fromEntries(
      Object.keys(permissoesCompletas.recursos).map(k => [k, true])
    ) as PermissoesRecursos;
    const novosDados = Object.fromEntries(
      Object.keys(permissoesCompletas.dados!).map(k => [k, true])
    ) as PermissoesDados;
    onChange({ modulos: novosModulos, recursos: novosRecursos, dados: novosDados });
  };

  const bloquearTudo = () => {
    const base = { ...PERMISSOES_DEFAULT };
    base.modulos = { ...PERMISSOES_DEFAULT.modulos, dashboard: true, suporte: true, novidades: true };
    onChange(base);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={permitirTudo} className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Permitir Tudo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={bloquearTudo} className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-destructive" />
          Bloquear Tudo
        </Button>
      </div>

      <Separator />

      {/* MÓDULOS */}
      <div>
        <h4 className="font-medium mb-3">Módulos</h4>
        <div className="space-y-2">
          {GRUPOS_MODULOS.map((entry, idx) => {
            if (entry.tipo === "item" && entry.modulo) {
              return (
                <div key={entry.modulo} className="flex items-center space-x-2">
                  <Checkbox
                    id={`modulo-${entry.modulo}`}
                    checked={permissoesCompletas.modulos[entry.modulo]}
                    onCheckedChange={(checked) => handleModuloChange(entry.modulo!, !!checked)}
                  />
                  <Label htmlFor={`modulo-${entry.modulo}`} className="text-sm cursor-pointer">
                    {entry.label}
                  </Label>
                </div>
              );
            }

            if (entry.tipo === "grupo" && entry.filhos) {
              const todosAtivos = entry.filhos.every(f => permissoesCompletas.modulos[f.modulo]);
              const algumAtivo = entry.filhos.some(f => permissoesCompletas.modulos[f.modulo]);
              return (
                <div key={`grupo-${entry.pai}-${idx}`} className="space-y-1">
                  {/* Pai do grupo */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`grupo-${entry.pai}`}
                      checked={todosAtivos}
                      data-state={!todosAtivos && algumAtivo ? "indeterminate" : undefined}
                      onCheckedChange={(checked) => handleGrupoPaiChange(entry.filhos!, !!checked)}
                      className={!todosAtivos && algumAtivo ? "opacity-70" : ""}
                    />
                    <Label htmlFor={`grupo-${entry.pai}`} className="text-sm font-medium cursor-pointer flex items-center gap-1">
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      {entry.paiLabel}
                    </Label>
                  </div>
                  {/* Filhos indentados */}
                  <div className="ml-6 space-y-1 border-l border-muted pl-3">
                    {entry.filhos.map(filho => (
                      <div key={filho.modulo} className="flex items-center space-x-2">
                        <Checkbox
                          id={`modulo-${filho.modulo}`}
                          checked={permissoesCompletas.modulos[filho.modulo]}
                          onCheckedChange={(checked) => handleModuloChange(filho.modulo, !!checked)}
                        />
                        <Label htmlFor={`modulo-${filho.modulo}`} className="text-sm cursor-pointer text-muted-foreground">
                          {filho.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      <Separator />

      {/* SEÇÕES DO FINANCEIRO */}
      <div>
        <h4 className="font-medium mb-1">Seções do Financeiro</h4>
        <p className="text-xs text-muted-foreground mb-3">
          Controla quais seções o funcionário vê dentro da página Financeiro (requer módulo Financeiro ativo).
        </p>
        <div className="space-y-2">
          {SECOES_FINANCEIRO.map(({ recurso, label, descricao }) => (
            <div key={recurso} className="flex items-start space-x-2">
              <Checkbox
                id={`recurso-${recurso}`}
                checked={permissoesCompletas.recursos[recurso] ?? false}
                onCheckedChange={(checked) => handleRecursoChange(recurso, !!checked)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor={`recurso-${recurso}`} className="text-sm cursor-pointer">
                  {label}
                </Label>
                <p className="text-xs text-muted-foreground">{descricao}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* PERMISSÕES ESPECIAIS */}
      <div>
        <h4 className="font-medium mb-3">Permissões Especiais</h4>
        <div className="space-y-2">
          {RECURSOS_OUTROS.map(({ recurso, label }) => (
            <div key={recurso} className="flex items-center space-x-2">
              <Checkbox
                id={`recurso-${recurso}`}
                checked={permissoesCompletas.recursos[recurso]}
                onCheckedChange={(checked) => handleRecursoChange(recurso, !!checked)}
              />
              <Label htmlFor={`recurso-${recurso}`} className="text-sm cursor-pointer">
                {label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* SINCRONIZAÇÃO DE DADOS */}
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
        <div className="space-y-2">
          {(Object.keys(DADOS_LABELS) as (keyof PermissoesDados)[]).map((dado) => (
            <div key={dado} className="flex items-center space-x-2">
              <Checkbox
                id={`dado-${dado}`}
                checked={permissoesCompletas.dados?.[dado] ?? false}
                onCheckedChange={(checked) => handleDadosChange(dado, !!checked)}
              />
              <Label htmlFor={`dado-${dado}`} className="text-sm cursor-pointer">
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

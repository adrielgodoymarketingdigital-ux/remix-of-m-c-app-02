import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardCheck,
  Tablet,
  Package,
  WrenchIcon,
  Users,
  Receipt,
  BarChart3,
  FileText,
  Settings,
  Truck,
  BookOpen,
  ShoppingBag,
  FileSpreadsheet,
  CreditCard,
  Sparkles,
  HelpCircle,
  Video,
} from "lucide-react";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import type { PermissoesModulos } from "@/types/funcionario";

const STORAGE_KEY = "mobile-nav-items";

export const allNavOptions = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", modulo: "dashboard" as keyof PermissoesModulos },
  { id: "pdv", icon: ShoppingCart, label: "PDV", path: "/pdv", modulo: "pdv" as keyof PermissoesModulos },
  { id: "os", icon: ClipboardCheck, label: "OS", path: "/os", modulo: "ordem_servico" as keyof PermissoesModulos },
  { id: "dispositivos", icon: Tablet, label: "Dispositivos", path: "/dispositivos", modulo: "dispositivos" as keyof PermissoesModulos },
  { id: "produtos", icon: Package, label: "Produtos", path: "/produtos", modulo: "produtos_pecas" as keyof PermissoesModulos },
  { id: "servicos", icon: WrenchIcon, label: "Serviços", path: "/servicos", modulo: "servicos" as keyof PermissoesModulos },
  { id: "clientes", icon: Users, label: "Clientes", path: "/clientes", modulo: "clientes" as keyof PermissoesModulos },
  { id: "vendas", icon: BarChart3, label: "Vendas", path: "/vendas", modulo: "vendas" as keyof PermissoesModulos },
  
  { id: "financeiro", icon: FileText, label: "Financeiro", path: "/financeiro", modulo: "financeiro" as keyof PermissoesModulos },
  { id: "catalogo", icon: BookOpen, label: "Catálogo", path: "/catalogo", modulo: "catalogo" as keyof PermissoesModulos },
  { id: "origem", icon: ShoppingBag, label: "Origem", path: "/origem-dispositivos", modulo: "origem_dispositivos" as keyof PermissoesModulos },
  { id: "fornecedores", icon: Truck, label: "Fornecedores", path: "/fornecedores", modulo: "fornecedores" as keyof PermissoesModulos },
  { id: "orcamentos", icon: FileSpreadsheet, label: "Orçamentos", path: "/orcamentos", modulo: "orcamentos" as keyof PermissoesModulos },
  { id: "relatorios", icon: FileText, label: "Relatórios", path: "/relatorios", modulo: "relatorios" as keyof PermissoesModulos },
  { id: "configuracoes", icon: Settings, label: "Config", path: "/configuracoes", modulo: "configuracoes" as keyof PermissoesModulos },
  { id: "plano", icon: CreditCard, label: "Plano", path: "/plano", modulo: "plano" as keyof PermissoesModulos },
  { id: "novidades", icon: Sparkles, label: "Novidades", path: "/novidades", modulo: "novidades" as keyof PermissoesModulos },
  { id: "suporte", icon: HelpCircle, label: "Suporte", path: "/suporte", modulo: "suporte" as keyof PermissoesModulos },
  { id: "tutoriais", icon: Video, label: "Tutoriais", path: "/tutoriais", modulo: "tutoriais" as keyof PermissoesModulos },
];

const DEFAULT_NAV_IDS = ["dashboard", "pdv", "os", "dispositivos"];

export function getSelectedNavItems(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length === 4) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_NAV_IDS;
}

export function saveSelectedNavItems(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

interface MobileNavCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (selectedIds: string[]) => void;
  currentIds: string[];
}

export function MobileNavCustomizer({
  open,
  onOpenChange,
  onSave,
  currentIds,
}: MobileNavCustomizerProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(currentIds);
  const { temAcessoModulo, isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();

  useEffect(() => {
    if (open) {
      setSelectedIds(currentIds);
    }
  }, [open, currentIds]);

  // Filtrar opções visíveis baseado nas permissões do funcionário
  const opcoesVisiveis = useMemo(() => {
    if (carregandoPermissoes || !isFuncionario) return allNavOptions;

    return allNavOptions.filter((option) => {
      // Funcionários nunca veem plano/equipe
      if (["plano", "equipe"].includes(option.id)) return false;
      return temAcessoModulo(option.modulo);
    });
  }, [isFuncionario, temAcessoModulo, carregandoPermissoes]);

  const toggleItem = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 1) {
        setSelectedIds(selectedIds.filter((i) => i !== id));
      }
    } else {
      if (selectedIds.length < 4) {
        setSelectedIds([...selectedIds, id]);
      }
    }
  };

  const handleSave = () => {
    saveSelectedNavItems(selectedIds);
    onSave(selectedIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Personalizar Menu</DialogTitle>
          <DialogDescription>
            Selecione até 4 itens para a barra de navegação inferior
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="space-y-2 py-2">
            {opcoesVisiveis.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              const isDisabled = !isSelected && selectedIds.length >= 4;

              return (
                <button
                  key={option.id}
                  onClick={() => toggleItem(option.id)}
                  disabled={isDisabled}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
                    "border touch-manipulation active:scale-[0.98]",
                    isSelected
                      ? "bg-primary/10 border-primary text-primary"
                      : isDisabled
                      ? "opacity-50 cursor-not-allowed border-border"
                      : "hover:bg-muted border-border"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-muted-foreground"
                    )}
                  >
                    {isSelected && (
                      <svg
                        className="w-3 h-3 text-primary-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <option.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1 text-left text-sm font-medium">
                    {option.label}
                  </span>
                  {isSelected && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      {selectedIds.indexOf(option.id) + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={selectedIds.length === 0}
          >
            Salvar ({selectedIds.length}/4)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
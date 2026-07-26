import { useEmpresa } from "@/contexts/EmpresaContext";
import { Building2, ChevronDown, Home } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SeletorFilial({ className }: { className?: string }) {
  const { empresaAtiva, setEmpresaAtiva, isProprietario, empresas, nomeMatriz } = useEmpresa();

  if (!isProprietario) return null;

  const empresaAtual = empresas.find(e => e.id === empresaAtiva);
  const label = empresaAtual ? empresaAtual.nome : nomeMatriz;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 min-w-0 gap-0 rounded-full border-border/50 bg-card pl-1.5 pr-1 text-foreground shadow-sm hover:bg-accent max-w-[160px] ${className ?? ""}`}
        >
          <span className="truncate text-xs font-medium">{label}</span>
          <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-50 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Trocar empresa
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => setEmpresaAtiva(null)}
          className={!empresaAtiva ? "bg-blue-500/10 text-blue-400" : ""}
        >
          <Home className="h-4 w-4 mr-2" />
          <span className="truncate">{nomeMatriz}</span>
          {!empresaAtiva && <Badge className="ml-auto text-[10px]">Ativa</Badge>}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {empresas.map(empresa => (
          <DropdownMenuItem
            key={empresa.id}
            onClick={() => setEmpresaAtiva(empresa.id)}
            className={empresaAtiva === empresa.id ? "bg-blue-500/10 text-blue-400" : ""}
          >
            <Building2 className="h-4 w-4 mr-2" />
            <span className="truncate">{empresa.nome}</span>
            {empresaAtiva === empresa.id && (
              <Badge className="ml-auto text-[10px]">Ativa</Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

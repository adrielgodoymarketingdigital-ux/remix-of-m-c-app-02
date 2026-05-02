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

export function SeletorFilial() {
  const { empresaAtiva, setEmpresaAtiva, isProprietario, empresas } = useEmpresa();

  if (!isProprietario) return null;

  const empresaAtual = empresas.find(e => e.id === empresaAtiva);
  const label = empresaAtual ? empresaAtual.nome : "Minha Empresa";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 max-w-[180px]"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-xs">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
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
          Minha Empresa
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

import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Sparkles } from "lucide-react";

interface DialogLimiteAtingidoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "ordens" | "produtos" | "dispositivos";
  usados: number;
  limite: number;
}

const MENSAGENS = {
  ordens: {
    titulo: "Limite de Ordens de Serviço Atingido",
    descricao: "Você atingiu o limite mensal de ordens de serviço do seu plano Free.",
    icone: "🔧",
  },
  produtos: {
    titulo: "Limite de Produtos Atingido",
    descricao: "Você atingiu o limite mensal de produtos/peças do seu plano Free.",
    icone: "📦",
  },
  dispositivos: {
    titulo: "Limite de Dispositivos Atingido",
    descricao: "Você atingiu o limite total de dispositivos do seu plano Free.",
    icone: "📱",
  },
};

export function DialogLimiteAtingido({
  open,
  onOpenChange,
  tipo,
  usados,
  limite,
}: DialogLimiteAtingidoProps) {
  const navigate = useNavigate();
  const { titulo, descricao, icone } = MENSAGENS[tipo];

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate("/plano");
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            {icone} {titulo}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-3">
            <p>{descricao}</p>
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-2xl font-bold text-foreground">
                {usados} / {limite}
              </p>
              <p className="text-sm text-muted-foreground">
                {tipo === "dispositivos" ? "utilizados no total" : "utilizados este mês"}
              </p>
            </div>
            <p className="text-sm">
              Para continuar criando ordens de serviço, é necessário fazer upgrade.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="w-full sm:w-auto">
            Entendi
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUpgrade}
            className="w-full sm:w-auto gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Ver Planos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

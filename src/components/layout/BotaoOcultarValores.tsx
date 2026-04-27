import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";

export function BotaoOcultarValores() {
  const { valoresOcultos, toggleValores } = useOcultarValores();

  return (
    <Button
      variant="outline"
      size="icon"
      className="hidden lg:flex fixed top-4 right-4 z-50 h-9 w-9 rounded-full shadow-md bg-background/95 backdrop-blur-sm border-border hover:bg-accent"
      onClick={toggleValores}
      title={valoresOcultos ? "Mostrar valores" : "Ocultar valores"}
    >
      {valoresOcultos ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  );
}

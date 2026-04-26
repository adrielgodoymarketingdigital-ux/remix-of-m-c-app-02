import { Dispositivo } from "@/types/dispositivo";
import { CardDispositivo } from "./CardDispositivo";

interface GridDispositivosProps {
  dispositivos: Dispositivo[];
  onEditar: (dispositivo: Dispositivo) => void;
  onExcluir: (id: string) => void;
}

export function GridDispositivos({
  dispositivos,
  onEditar,
  onExcluir,
}: GridDispositivosProps) {
  if (dispositivos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">Nenhum dispositivo cadastrado</p>
        <p className="text-sm mt-2">
          Clique em "Novo Dispositivo" para começar
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {dispositivos.map((dispositivo) => (
        <CardDispositivo
          key={dispositivo.id}
          dispositivo={dispositivo}
          onEditar={onEditar}
          onExcluir={onExcluir}
        />
      ))}
    </div>
  );
}

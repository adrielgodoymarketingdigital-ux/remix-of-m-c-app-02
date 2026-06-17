import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTiposGarantia } from "@/hooks/useTiposGarantia";

const PERSONALIZADO = "personalizado";

interface Props {
  value: number | undefined;
  onChange: (meses: number | undefined) => void;
}

export function SeletorTempoGarantia({ value, onChange }: Props) {
  const { tiposGarantia } = useTiposGarantia();
  const [modo, setModo] = useState<string>(PERSONALIZADO);

  useEffect(() => {
    if (value === undefined) return;
    const tipo = tiposGarantia.find((t) => t.meses === value);
    setModo(tipo ? tipo.id : PERSONALIZADO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiposGarantia.length]);

  const handleSelecionar = (id: string) => {
    setModo(id);
    if (id === PERSONALIZADO) return;
    const tipo = tiposGarantia.find((t) => t.id === id);
    if (tipo) onChange(tipo.meses);
  };

  return (
    <div className="space-y-2">
      <Select value={modo} onValueChange={handleSelecionar}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione o tipo de garantia" />
        </SelectTrigger>
        <SelectContent>
          {tiposGarantia.map((tipo) => (
            <SelectItem key={tipo.id} value={tipo.id}>
              {tipo.nome} ({tipo.meses} {tipo.meses === 1 ? "mês" : "meses"})
            </SelectItem>
          ))}
          <SelectItem value={PERSONALIZADO}>Personalizado</SelectItem>
        </SelectContent>
      </Select>
      {modo === PERSONALIZADO && (
        <Input
          type="number"
          min="1"
          placeholder="Meses de garantia"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        />
      )}
    </div>
  );
}

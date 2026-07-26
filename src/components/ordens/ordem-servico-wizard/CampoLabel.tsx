import { Label } from "@/components/ui/label";

interface CampoLabelProps {
  htmlFor?: string;
  texto: string;
  subtexto?: string;
  obrigatorio?: boolean;
}

/** Label em negrito + subtexto explicativo cinza abaixo, padrão usado em todos os campos do wizard. */
export function CampoLabel({ htmlFor, texto, subtexto, obrigatorio }: CampoLabelProps) {
  return (
    <div className="mb-0.5">
      <Label htmlFor={htmlFor} className="text-[11px] font-semibold text-foreground">
        {texto}
        {obrigatorio && <span className="text-destructive"> *</span>}
      </Label>
      {subtexto && <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{subtexto}</p>}
    </div>
  );
}

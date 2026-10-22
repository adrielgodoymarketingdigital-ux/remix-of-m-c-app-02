import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePerfisTributariosValidados } from "@/hooks/usePerfisTributariosValidados";
import type { TipoItemFiscal } from "@/lib/fiscal/dadosFiscais";

// O Select do Radix não aceita value "" num item; esta é a opção "nenhum".
const SEM_PERFIL = "__sem_perfil__";

interface SeletorPerfilTributarioProps {
  id: string;
  tipos: TipoItemFiscal[];
  /** '' = nenhum. */
  valor: string;
  onChange: (valor: string) => void;
}

/**
 * Só perfis ativos E validados (validado_em preenchido). Começa em "Nenhum" e
 * nunca escolhe sozinho. Se o item já aponta para um perfil que deixou de ser
 * oferecido, o vínculo é mantido e aparece como "Perfil atual (indisponível)".
 */
export function SeletorPerfilTributario({ id, tipos, valor, onChange }: SeletorPerfilTributarioProps) {
  const { data: perfis = [], isLoading } = usePerfisTributariosValidados(tipos, true);
  const atualForaDaLista = valor !== "" && !perfis.some((p) => p.id === valor);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Perfil tributário</Label>
      {!isLoading && perfis.length === 0 && !atualForaDaLista ? (
        <p id={id} className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          Nenhum perfil validado ainda
        </p>
      ) : (
        <Select value={valor === "" ? SEM_PERFIL : valor} onValueChange={(v) => onChange(v === SEM_PERFIL ? "" : v)}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={isLoading ? "Carregando..." : "Nenhum"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_PERFIL}>Nenhum</SelectItem>
            {atualForaDaLista && <SelectItem value={valor}>Perfil atual (indisponível)</SelectItem>}
            {perfis.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}{p.uf ? ` · ${p.uf}` : ""} (v{p.versao})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

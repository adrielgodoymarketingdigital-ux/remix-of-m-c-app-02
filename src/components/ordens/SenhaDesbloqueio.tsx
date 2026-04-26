import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SenhaDesbloqueio as SenhaDesbloqueioType, TipoSenha } from "@/types/ordem-servico";
import { PatternLockInput } from "./PatternLockInput";

interface SenhaDesbloqueioProps {
  value: SenhaDesbloqueioType;
  onChange: (senha: SenhaDesbloqueioType) => void;
}

export const SenhaDesbloqueio = ({ value, onChange }: SenhaDesbloqueioProps) => {
  const handleTipoChange = (tipo: TipoSenha) => {
    if (tipo === 'padrao') {
      onChange({ tipo, valor: '', padrao: [] });
    } else {
      onChange({ tipo, valor: '', padrao: undefined });
    }
  };

  const handleValorChange = (valor: string) => {
    onChange({ ...value, valor });
  };

  const handlePadraoChange = (padrao: number[]) => {
    onChange({ ...value, padrao });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium mb-2 block">Tipo de Senha</label>
        <RadioGroup
          value={value.tipo}
          onValueChange={handleTipoChange}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="numero" id="numero" />
            <Label htmlFor="numero" className="font-normal cursor-pointer text-sm">
              🔢 PIN
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="letra" id="letra" />
            <Label htmlFor="letra" className="font-normal cursor-pointer text-sm">
              🔤 Texto
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="padrao" id="padrao" />
            <Label htmlFor="padrao" className="font-normal cursor-pointer text-sm">
              🔓 Padrão
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="mt-3">
        {value.tipo === 'numero' && (
          <div>
            <Label htmlFor="senha-numero" className="text-xs">Senha Numérica</Label>
            <Input
              id="senha-numero"
              type="text"
              inputMode="numeric"
              placeholder="Ex: 1234"
              value={value.valor}
              onChange={(e) => handleValorChange(e.target.value.replace(/\D/g, ''))}
              className="h-8 text-sm"
            />
          </div>
        )}

        {value.tipo === 'letra' && (
          <div>
            <Label htmlFor="senha-letra" className="text-xs">Senha Alfanumérica</Label>
            <Input
              id="senha-letra"
              type="text"
              placeholder="Ex: abc123"
              value={value.valor}
              onChange={(e) => handleValorChange(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )}

        {value.tipo === 'padrao' && (
          <div>
            <PatternLockInput
              value={value.padrao || []}
              onChange={handlePadraoChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};

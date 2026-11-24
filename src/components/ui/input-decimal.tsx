import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  CASAS_DECIMAIS_PADRAO,
  mensagemForaDaFaixa,
  normalizarTextoDecimal,
  sanitizarTextoDecimal,
  textoDoValorExterno,
  textoRepresentaValor,
  type ValorExternoDecimal,
} from "@/lib/inputDecimal";

/**
 * Campo de valor decimal (dinheiro, taxa, percentual) que funciona no
 * celular. Substitui <Input type="number" step="0.01">, que zera ao digitar
 * a vírgula no PWA. Regras em src/lib/inputDecimal.ts.
 *
 * - value: number | string | null (aceita {...field} do react-hook-form).
 * - onChange(valor): recebe a string normalizada com PONTO ("39.5"), a mesma
 *   que e.target.value do type="number" entregava. "" quando vazio.
 * - min/max: mesma validação nativa de faixa do type="number" (bloqueia o
 *   envio do <form>); não corrige o valor.
 */
export interface InputDecimalProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step"> {
  value?: ValorExternoDecimal;
  onChange?: (valor: string) => void;
  casasDecimais?: number;
  min?: number | string;
  max?: number | string;
}

const InputDecimal = React.forwardRef<HTMLInputElement, InputDecimalProps>(
  ({ value, onChange, casasDecimais = CASAS_DECIMAIS_PADRAO, min, max, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const [texto, setTexto] = React.useState(() => textoDoValorExterno(value, casasDecimais));

    // Re-sincroniza só quando o valor de fora mudou de verdade (reset do
    // formulário, edição de outro item, valor corrigido pelo pai).
    React.useEffect(() => {
      setTexto((atual) =>
        textoRepresentaValor(atual, value) ? atual : textoDoValorExterno(value, casasDecimais),
      );
    }, [value, casasDecimais]);

    React.useEffect(() => {
      inputRef.current?.setCustomValidity(mensagemForaDaFaixa(texto, min, max));
    }, [texto, min, max]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const bruto = e.target.value;
      const colado = bruto.length - texto.length > 1;
      const novo = sanitizarTextoDecimal(bruto, { casasDecimais, colado });
      if (novo === texto) return;
      setTexto(novo);
      onChange?.(normalizarTextoDecimal(novo));
    };

    return (
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={texto}
        onChange={handleChange}
      />
    );
  },
);
InputDecimal.displayName = "InputDecimal";

export { InputDecimal };

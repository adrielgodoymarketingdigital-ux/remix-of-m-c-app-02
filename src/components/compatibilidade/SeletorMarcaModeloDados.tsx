import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { OpcoesMarcaModelo } from "@/lib/compatibilidade/compatibilidade";

/**
 * Combobox com as opções vindas dos dados. Com `permitirNovo` (admin), o texto
 * digitado que não está na lista vira a opção "Usar “…”".
 */
function ComboboxDados({
  value,
  opcoes,
  placeholder,
  buscaPlaceholder,
  onChange,
  disabled,
  permitirNovo,
}: {
  value: string;
  opcoes: string[];
  placeholder: string;
  buscaPlaceholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  permitirNovo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const digitado = busca.trim();
  const mostrarNovo = permitirNovo && !!digitado && !opcoes.includes(digitado);

  const escolher = (valor: string) => {
    onChange(valor);
    setBusca("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(aberto) => { setOpen(aberto); if (!aberto) setBusca(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal h-10 rounded-xl", !value && "text-muted-foreground")}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder={buscaPlaceholder} value={busca} onValueChange={setBusca} />
          <CommandList>
            {!mostrarNovo && <CommandEmpty>{permitirNovo ? "Digite para cadastrar um novo." : "Nenhuma opção encontrada."}</CommandEmpty>}
            {mostrarNovo && (
              <CommandGroup>
                <CommandItem value={`__novo__${digitado}`} forceMount onSelect={() => escolher(digitado)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Usar “{digitado}”
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {opcoes.map((opcao) => (
                <CommandItem key={opcao} value={opcao} onSelect={() => escolher(opcao)}>
                  <Check className={cn("mr-2 h-4 w-4", value === opcao ? "opacity-100" : "opacity-0")} />
                  {opcao}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface SeletorMarcaModeloDadosProps {
  opcoes: OpcoesMarcaModelo;
  marca: string;
  modelo: string;
  onChangeMarca: (marca: string) => void;
  onChangeModelo: (modelo: string) => void;
  /** Admin: aceita marca/modelo digitados que ainda não existem nos dados. */
  permitirNovo?: boolean;
}

/**
 * Marca e modelo a partir dos pares que existem nos dados de compatibilidade
 * (não do catálogo fixo de celulares), com o texto exatamente como gravado.
 */
export function SeletorMarcaModeloDados({
  opcoes,
  marca,
  modelo,
  onChangeMarca,
  onChangeModelo,
  permitirNovo = false,
}: SeletorMarcaModeloDadosProps) {
  const modelos = marca ? opcoes.modelosPorMarca[marca] ?? [] : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <ComboboxDados
        value={marca}
        opcoes={opcoes.marcas}
        placeholder="Selecione a marca"
        buscaPlaceholder={permitirNovo ? "Buscar ou digitar marca..." : "Buscar marca..."}
        onChange={(novaMarca) => {
          onChangeMarca(novaMarca);
          onChangeModelo("");
        }}
        permitirNovo={permitirNovo}
      />
      <ComboboxDados
        value={modelo}
        opcoes={modelos}
        placeholder="Selecione o modelo"
        buscaPlaceholder={permitirNovo ? "Buscar ou digitar modelo..." : "Buscar modelo..."}
        onChange={onChangeModelo}
        disabled={!marca}
        permitirNovo={permitirNovo}
      />
    </div>
  );
}

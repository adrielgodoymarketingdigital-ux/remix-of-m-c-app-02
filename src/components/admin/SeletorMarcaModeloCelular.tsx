import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getMarcasPorTipo, getModelosPorMarca } from "@/data/catalogoDispositivos";

/**
 * Combobox de marca/modelo restrito ao catálogo padrão de Celular (sem opção
 * de texto livre) — usado onde o valor precisa bater exatamente com o que o
 * wizard de OS grava, como nos grupos de compatibilidade de película.
 */
function ComboboxCatalogo({
  value,
  opcoes,
  placeholder,
  buscaPlaceholder,
  onChange,
  disabled,
}: {
  value: string;
  opcoes: string[];
  placeholder: string;
  buscaPlaceholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <CommandInput placeholder={buscaPlaceholder} />
          <CommandList>
            <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
            <CommandGroup>
              {opcoes.map((opcao) => (
                <CommandItem
                  key={opcao}
                  value={opcao}
                  onSelect={() => {
                    onChange(opcao);
                    setOpen(false);
                  }}
                >
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

interface SeletorMarcaModeloCelularProps {
  marca: string;
  modelo: string;
  onChangeMarca: (marca: string) => void;
  onChangeModelo: (modelo: string) => void;
}

export function SeletorMarcaModeloCelular({
  marca,
  modelo,
  onChangeMarca,
  onChangeModelo,
}: SeletorMarcaModeloCelularProps) {
  const marcas = getMarcasPorTipo("Celular");
  const modelos = marca ? getModelosPorMarca("Celular", marca) : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <ComboboxCatalogo
        value={marca}
        opcoes={marcas}
        placeholder="Selecione a marca"
        buscaPlaceholder="Buscar marca..."
        onChange={(novaMarca) => {
          onChangeMarca(novaMarca);
          onChangeModelo("");
        }}
      />
      <ComboboxCatalogo
        value={modelo}
        opcoes={modelos}
        placeholder="Selecione o modelo"
        buscaPlaceholder="Buscar modelo..."
        onChange={onChangeModelo}
        disabled={!marca}
      />
    </div>
  );
}

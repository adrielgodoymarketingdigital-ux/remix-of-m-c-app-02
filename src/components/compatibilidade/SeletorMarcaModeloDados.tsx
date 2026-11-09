import { useState } from "react";
import { Check, ChevronsUpDown, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { OpcoesMarcaModelo } from "@/lib/compatibilidade/compatibilidade";

/**
 * Combobox com as opções vindas dos dados. Com `permitirNovo` (admin), o texto
 * digitado que não está na lista vira a opção "Usar “…”".
 * `icone`, `classeBotao`, `id` e `textoVazio` são só do computador
 * (CompatibilidadePeliculaDesktop): sem eles sai exatamente como antes (celular e admin).
 */
export function ComboboxDados({
  value,
  opcoes,
  placeholder,
  buscaPlaceholder,
  onChange,
  disabled,
  permitirNovo,
  icone: Icone,
  classeBotao,
  id,
  textoVazio,
}: {
  value: string;
  opcoes: string[];
  placeholder: string;
  buscaPlaceholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  permitirNovo?: boolean;
  /** Ícone à esquerda do texto do botão. */
  icone?: LucideIcon;
  /** Classes a mais no botão (somadas às de sempre). */
  classeBotao?: string;
  /** id do botão, para um <Label htmlFor>. */
  id?: string;
  /** Texto da busca sem resultado (sem `permitirNovo`); padrão "Nenhuma opção encontrada." */
  textoVazio?: string;
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
          id={id}
          className={cn("w-full justify-between font-normal h-10 rounded-xl", !value && "text-muted-foreground", classeBotao)}
        >
          {Icone ? (
            <span className="flex min-w-0 items-center gap-3">
              <Icone className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{value || placeholder}</span>
            </span>
          ) : (
            <span className="truncate">{value || placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder={buscaPlaceholder} value={busca} onValueChange={setBusca} />
          <CommandList>
            {!mostrarNovo && <CommandEmpty>{permitirNovo ? "Digite para cadastrar um novo." : textoVazio ?? "Nenhuma opção encontrada."}</CommandEmpty>}
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

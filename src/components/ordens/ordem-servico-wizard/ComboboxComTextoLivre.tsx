import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface ComboboxComTextoLivreProps {
  id?: string;
  value: string;
  opcoes: string[];
  /** Opções cadastradas pela própria loja (Configurações → catálogo de dispositivos) — exibidas num grupo separado, depois das fixas. */
  opcoesCustom?: string[];
  opcaoOutra: string;
  placeholder?: string;
  buscaPlaceholder?: string;
  onChange: (value: string) => void;
  className?: string;
  erro?: boolean;
}

/**
 * Combobox com busca (Popover + Command) cujas opções vêm de um catálogo, com
 * uma última opção "Outra" que troca para um Input de texto livre. Se o value
 * atual não bater com nenhuma opção do catálogo (ex: dado antigo salvo antes
 * do catálogo existir), nasce direto em modo texto livre com o valor
 * preenchido, sem forçar escolha.
 */
export function ComboboxComTextoLivre({
  id,
  value,
  opcoes,
  opcoesCustom = [],
  opcaoOutra,
  placeholder,
  buscaPlaceholder,
  onChange,
  className,
  erro,
}: ComboboxComTextoLivreProps) {
  const todasOpcoes = opcoesCustom.length > 0 ? [...opcoes, ...opcoesCustom] : opcoes;
  const valorBateComCatalogo = value === "" || todasOpcoes.includes(value);
  const [modoTextoLivre, setModoTextoLivre] = useState(!valorBateComCatalogo);
  const [open, setOpen] = useState(false);

  // Chave estável com o conteúdo do catálogo (não a referência das arrays).
  // O componente pai recria `opcoes`/`opcoesCustom` a cada render (.map/.filter),
  // então usar as arrays direto como dependência do efeito abaixo disparava a
  // cada re-render — inclusive logo depois de escolher "Outra", derrubando o
  // modo texto livre que acabara de ser ativado (o valor "" "batia" com o
  // catálogo e o efeito revertia modoTextoLivre para false).
  const catalogoKey = todasOpcoes.join(" ");

  // Se o catálogo realmente mudar de conteúdo (ex: troca de Marca alterando os
  // Modelos/Cores disponíveis) e o valor atual não bater mais com ele, mantém
  // em modo texto livre; se bater, volta pro combobox.
  useEffect(() => {
    setModoTextoLivre(!(value === "" || todasOpcoes.includes(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogoKey]);

  if (modoTextoLivre) {
    return (
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(className, erro && "border-destructive")}
      />
    );
  }

  const handleSelecionar = (opcao: string) => {
    if (opcao === opcaoOutra) {
      setModoTextoLivre(true);
      onChange("");
    } else {
      onChange(opcao);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
            erro && "border-destructive",
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder={buscaPlaceholder ?? "Buscar..."} />
          <CommandList>
            <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={opcaoOutra}
                onSelect={() => handleSelecionar(opcaoOutra)}
                className="font-medium text-primary"
              >
                <Check className="mr-2 h-4 w-4 opacity-0" />
                {opcaoOutra}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={opcoesCustom.length > 0 ? "Cadastradas" : undefined}>
              {opcoes.map((opcao) => (
                <CommandItem key={opcao} value={opcao} onSelect={() => handleSelecionar(opcao)}>
                  <Check className={cn("mr-2 h-4 w-4", value === opcao ? "opacity-100" : "opacity-0")} />
                  {opcao}
                </CommandItem>
              ))}
            </CommandGroup>
            {opcoesCustom.length > 0 && (
              <CommandGroup heading="Minhas (personalizadas)">
                {opcoesCustom.map((opcao) => (
                  <CommandItem key={opcao} value={opcao} onSelect={() => handleSelecionar(opcao)}>
                    <Check className={cn("mr-2 h-4 w-4", value === opcao ? "opacity-100" : "opacity-0")} />
                    {opcao}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

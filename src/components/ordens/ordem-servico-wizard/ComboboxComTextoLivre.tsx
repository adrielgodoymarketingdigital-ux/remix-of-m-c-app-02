import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  /**
   * Opcional: mostra "+ Adicionar novo" na lista, que abre um campo curto para
   * digitar o nome. Recebe o nome digitado e devolve o nome a selecionar
   * (o criado ou um que já existia) ou null para manter o campo aberto
   * (inválido ou falha ao salvar). Sem esta prop o componente é o de sempre.
   */
  onAdicionarNovo?: (nome: string) => Promise<string | null>;
  rotuloAdicionar?: string;
  /** Sem onAdicionarNovo: dica desabilitada no lugar do item (ex.: "Escolha a marca primeiro"). */
  dicaAdicionarIndisponivel?: string;
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
  onAdicionarNovo,
  rotuloAdicionar,
  dicaAdicionarIndisponivel,
}: ComboboxComTextoLivreProps) {
  const { t } = useTranslation("servicos");
  const todasOpcoes = opcoesCustom.length > 0 ? [...opcoes, ...opcoesCustom] : opcoes;
  const valorBateComCatalogo = value === "" || todasOpcoes.includes(value);
  const [modoTextoLivre, setModoTextoLivre] = useState(!valorBateComCatalogo);
  const [open, setOpen] = useState(false);
  // "+ Adicionar novo": busca digitada (vira o nome sugerido), campo aberto e salvando.
  const [busca, setBusca] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [salvando, setSalvando] = useState(false);

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

  const handleOpenChange = (aberto: boolean) => {
    if (!aberto && salvando) return;
    setOpen(aberto);
    if (!aberto) {
      setAdicionando(false);
      setBusca("");
    }
  };

  const handleSalvarNovo = async () => {
    if (!onAdicionarNovo || salvando || !nomeNovo.trim()) return;
    setSalvando(true);
    try {
      const nome = await onAdicionarNovo(nomeNovo);
      if (nome) {
        onChange(nome);
        setAdicionando(false);
        setNomeNovo("");
        setBusca("");
        setOpen(false);
      }
    } catch (error) {
      // Quem chama já avisa o erro; o campo fica aberto com o que foi digitado.
      console.error("Erro ao adicionar opção nova:", error);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
        {adicionando ? (
          <div className="space-y-2 p-2">
            <Input
              autoFocus
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleSalvarNovo();
                }
              }}
              placeholder={t("novoModeloOS.campoPlaceholder")}
              disabled={salvando}
              className="h-9"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={salvando} onClick={() => setAdicionando(false)}>
                {t("novoModeloOS.cancelar")}
              </Button>
              <Button type="button" size="sm" disabled={salvando || !nomeNovo.trim()} onClick={() => void handleSalvarNovo()}>
                {salvando ? t("novoModeloOS.salvando") : t("novoModeloOS.salvar")}
              </Button>
            </div>
          </div>
        ) : (
        <Command>
          <CommandInput
            placeholder={buscaPlaceholder ?? "Buscar..."}
            {...(onAdicionarNovo ? { value: busca, onValueChange: setBusca } : {})}
          />
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
              {onAdicionarNovo ? (
                <CommandItem
                  forceMount
                  value={`__adicionar_novo__ ${rotuloAdicionar ?? ""}`}
                  onSelect={() => {
                    setNomeNovo(busca);
                    setAdicionando(true);
                  }}
                  className="font-medium text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {rotuloAdicionar ?? t("novoModeloOS.adicionar")}
                </CommandItem>
              ) : dicaAdicionarIndisponivel ? (
                <CommandItem disabled value={`__adicionar_indisponivel__ ${dicaAdicionarIndisponivel}`} className="text-xs text-muted-foreground">
                  <Plus className="mr-2 h-4 w-4 opacity-50" />
                  {dicaAdicionarIndisponivel}
                </CommandItem>
              ) : null}
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
        )}
      </PopoverContent>
    </Popover>
  );
}

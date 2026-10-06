import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface ItemComboboxBusca {
  id: string;
  rotulo: string;
  sublinha?: string | null;
}

interface ComboboxBuscaProps<T> {
  opcoes: T[];
  /** Filtro nosso (o do cmdk fica desligado: não tira acento nem entende CPF/IMEI). */
  filtrar: (opcoes: T[], termo: string) => T[];
  paraItem: (opcao: T) => ItemComboboxBusca;
  /** id selecionado (o mesmo valor gravado no formulário). */
  valor: string;
  onChange: (id: string) => void;
  placeholder: string;
  placeholderBusca: string;
  disabled?: boolean;
  /** Mostra o botão para limpar a seleção. */
  permitirLimpar?: boolean;
  /** Texto quando há valor mas o item ainda não está na lista (nunca mostra "nada selecionado"). */
  rotuloValorSemItem?: string;
  id?: string;
}

const ALTURA_MIN_LISTA = 120;
const ALTURA_MAX_LISTA = 360;
// Campo de busca + bordas do popover + folga até a borda da tela/teclado.
const RESERVA_PX = 64;

/**
 * Seletor com busca digitável (Popover + Command), feito para funcionar dentro
 * do Dialog em tela cheia no celular: o popover vai em portal acima do
 * diálogo, a altura da lista acompanha o espaço visível (visualViewport, que
 * encolhe com o teclado virtual) e cada item tem pelo menos 44 px de altura.
 */
export function ComboboxBusca<T>({
  opcoes,
  filtrar,
  paraItem,
  valor,
  onChange,
  placeholder,
  placeholderBusca,
  disabled = false,
  permitirLimpar = false,
  rotuloValorSemItem = "Selecionado (atualizando a lista…)",
  id,
}: ComboboxBuscaProps<T>) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [alturaLista, setAlturaLista] = useState(ALTURA_MAX_LISTA);
  const gatilhoRef = useRef<HTMLButtonElement>(null);

  const itens = useMemo(() => opcoes.map(paraItem), [opcoes, paraItem]);
  const selecionado = useMemo(() => itens.find((i) => i.id === valor) ?? null, [itens, valor]);
  const filtrados = useMemo(() => filtrar(opcoes, busca).map(paraItem), [opcoes, busca, filtrar, paraItem]);

  // Espaço visível acima/abaixo do gatilho, descontando o teclado (visualViewport).
  const recalcularAltura = useCallback(() => {
    const gatilho = gatilhoRef.current;
    if (!gatilho) return;
    const vv = window.visualViewport;
    const topoVisivel = vv ? vv.offsetTop : 0;
    const baseVisivel = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const r = gatilho.getBoundingClientRect();
    const espaco = Math.max(baseVisivel - r.bottom, r.top - topoVisivel) - RESERVA_PX;
    setAlturaLista(Math.max(ALTURA_MIN_LISTA, Math.min(ALTURA_MAX_LISTA, Math.floor(espaco))));
  }, []);

  useEffect(() => {
    if (!aberto) return;
    recalcularAltura();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", recalcularAltura);
    vv?.addEventListener("scroll", recalcularAltura);
    window.addEventListener("resize", recalcularAltura);
    return () => {
      vv?.removeEventListener("resize", recalcularAltura);
      vv?.removeEventListener("scroll", recalcularAltura);
      window.removeEventListener("resize", recalcularAltura);
    };
  }, [aberto, recalcularAltura]);

  const abrirOuFechar = (abrir: boolean) => {
    setAberto(abrir);
    if (!abrir) setBusca("");
  };

  const escolher = (idItem: string) => {
    onChange(idItem);
    abrirOuFechar(false);
  };

  const textoGatilho = selecionado ? selecionado.rotulo : valor ? rotuloValorSemItem : placeholder;

  return (
    <div className="flex items-stretch gap-2">
      <Popover open={aberto} onOpenChange={abrirOuFechar}>
        <PopoverTrigger asChild>
          <Button
            ref={gatilhoRef}
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={aberto}
            disabled={disabled}
            className={cn("min-h-11 h-auto flex-1 min-w-0 justify-between font-normal py-2 text-left", !valor && "text-muted-foreground")}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate">{textoGatilho}</span>
              {selecionado?.sublinha && (
                <span className="block truncate text-xs text-muted-foreground">{selecionado.sublinha}</span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] max-w-[calc(100vw-1.5rem)] p-0"
          align="start"
          collisionPadding={12}
          onOpenAutoFocus={() => {
            // O foco vai para a busca (padrão do Radix); a altura é refeita quando o teclado abre.
            requestAnimationFrame(recalcularAltura);
          }}
        >
          <Command shouldFilter={false}>
            <div className="relative">
              <CommandInput placeholder={placeholderBusca} value={busca} onValueChange={setBusca} className="h-11 pr-9 text-base md:text-sm" />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <CommandList style={{ maxHeight: alturaLista }} className="overflow-y-auto overscroll-contain">
              {filtrados.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhum resultado</p>
              ) : (
                <CommandGroup>
                  {filtrados.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => escolher(item.id)}
                      className="min-h-11 py-2"
                    >
                      <Check className={cn("mr-2 h-4 w-4 shrink-0", item.id === valor ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.rotulo}</span>
                        {item.sublinha && <span className="block truncate text-xs text-muted-foreground">{item.sublinha}</span>}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {permitirLimpar && valor && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => onChange("")}
          aria-label="Limpar seleção"
          title="Limpar seleção"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

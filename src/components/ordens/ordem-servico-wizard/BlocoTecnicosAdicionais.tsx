import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  FuncionarioTecnico,
  MAX_TECNICOS_ADICIONAIS,
  adicionarTecnico,
  funcionariosElegiveis,
  itensTecnicosAdicionais,
  podeAdicionarMais,
  removerTecnico,
} from "@/lib/ordemServico/tecnicosAdicionaisOS";
import { CampoLabel } from "./CampoLabel";

/** Situação da lista: OS nova, lendo do banco, lida, ou leitura falhou (aí não grava nada). */
export type CargaTecnicosAdicionais = "nova" | "carregando" | "ok" | "erro";

/** O que a etapa Serviço recebe; ausente = quem não vê o bloco (freio): a tela fica como era. */
export interface TecnicosAdicionaisEtapa {
  lista: string[];
  onAlterar: (lista: string[]) => void;
  carga: CargaTecnicosAdicionais;
  onTentarCarregarDeNovo: () => void;
}

interface BlocoTecnicosAdicionaisProps extends TecnicosAdicionaisEtapa {
  principal: string | null;
  funcionarios: readonly FuncionarioTecnico[];
  campoComErro: string | null;
}

/** "Técnicos adicionais" da etapa Serviço: até 4, além do Técnico Principal. Não mexe em comissão. */
export function BlocoTecnicosAdicionais({
  lista,
  onAlterar,
  carga,
  onTentarCarregarDeNovo,
  principal,
  funcionarios,
  campoComErro,
}: BlocoTecnicosAdicionaisProps) {
  const itens = itensTecnicosAdicionais(lista, funcionarios);
  const elegiveis = funcionariosElegiveis(funcionarios, principal, lista);
  const cheio = !podeAdicionarMais(lista);
  const pronto = carga === "ok" || carga === "nova";

  let aviso: string | null = null;
  if (carga === "carregando") aviso = "Carregando técnicos adicionais…";
  else if (carga === "erro") aviso = "Não consegui carregar os técnicos adicionais desta OS.";
  else if (!principal) aviso = "Escolha o técnico principal primeiro";
  else if (cheio) aviso = `Limite de ${MAX_TECNICOS_ADICIONAIS} técnicos adicionais atingido.`;
  else if (elegiveis.length === 0) aviso = "Não há outros funcionários ativos para adicionar.";

  const desabilitado = !pronto || !principal || cheio || elegiveis.length === 0;

  return (
    <div data-testid="bloco-tecnicos-adicionais" data-desabilitado={desabilitado ? "sim" : "nao"}>
      <div className="flex items-start justify-between gap-2">
        <CampoLabel
          htmlFor="tecnicosAdicionais"
          texto="Técnicos adicionais"
          subtexto="Quem mais trabalhou nesta OS. Não altera a comissão."
        />
        <span data-testid="contador-tecnicos-adicionais" className="text-xs font-medium text-muted-foreground tabular-nums mt-0.5">
          {lista.length}/{MAX_TECNICOS_ADICIONAIS}
        </span>
      </div>

      {itens.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {itens.map((item) => (
            <li
              key={item.id}
              data-testid="tecnico-adicional"
              className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-1.5 text-sm"
            >
              <span className={cn("truncate", item.desativado && "text-muted-foreground")}>{item.rotulo}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 rounded-lg"
                aria-label={`Remover ${item.rotulo}`}
                onClick={() => onAlterar(removerTecnico(lista, item.id))}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Select
        key={lista.join(",")}
        value=""
        disabled={desabilitado}
        onValueChange={(id) => onAlterar(adicionarTecnico(lista, id, principal, funcionarios))}
      >
        <SelectTrigger
          id="tecnicosAdicionais"
          aria-label="Adicionar técnico"
          className={cn("h-10 rounded-xl", campoComErro === "tecnicosAdicionais" && "border-destructive")}
        >
          <SelectValue placeholder="Adicionar técnico" />
        </SelectTrigger>
        <SelectContent>
          {elegiveis.map((func) => (
            <SelectItem key={func.id} value={func.id}>
              {func.nome}
              {func.cargo ? ` (${func.cargo})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {aviso && (
        <p data-testid="aviso-tecnicos-adicionais" className="text-xs text-muted-foreground mt-1.5">
          {aviso}
          {carga === "erro" && (
            <Button type="button" variant="link" size="sm" className="h-auto p-0 ml-1 text-xs" onClick={onTentarCarregarDeNovo}>
              Tentar de novo
            </Button>
          )}
        </p>
      )}
    </div>
  );
}

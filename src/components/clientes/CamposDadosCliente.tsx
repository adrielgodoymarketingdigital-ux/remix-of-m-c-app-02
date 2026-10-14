import { ReactNode, RefObject } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { aplicarMascaraCEP } from "@/lib/mascaras";
import { mascararDocumento } from "@/lib/clientes/dadosCliente";
import { CampoLabel } from "@/components/ordens/ordem-servico-wizard/CampoLabel";

/** Campos do cliente — os mesmos na aba Cliente da OS e no cadastro em Clientes. */
export interface ValoresCamposCliente {
  nome: string;
  telefone: string;
  /** CPF ou CNPJ, no mesmo campo. */
  documento: string;
  cep: string;
  /** Rua / logradouro. */
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  dataNascimento: string;
}

/** Comportamento extra de um campo com busca (nome e CPF/CNPJ na OS). */
interface CampoComBusca {
  /** Substitui o tratamento padrão da digitação. */
  onChange?: (valor: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Atributo name do input (a OS usa um sufixo por montagem contra o autofill). */
  name?: string;
  wrapperRef?: RefObject<HTMLDivElement>;
  /** Lista de sugestões mostrada abaixo do campo. */
  sugestoes?: ReactNode;
}

interface CamposDadosClienteProps {
  valores: ValoresCamposCliente;
  onChange: (parcial: Partial<ValoresCamposCliente>) => void;
  /** Id do campo com erro (hoje só "clienteNome" tem destaque). */
  campoComErro?: string | null;
  buscandoCEP: boolean;
  onBuscarCEP: () => void;
  /** Máscara do telefone; ausente = sem máscara (como na OS). */
  formatarTelefone?: (valor: string) => string;
  placeholderTelefone?: string;
  nome?: CampoComBusca;
  documento?: CampoComBusca;
}

export function CamposDadosCliente({
  valores,
  onChange,
  campoComErro,
  buscandoCEP,
  onBuscarCEP,
  formatarTelefone,
  placeholderTelefone,
  nome,
  documento,
}: CamposDadosClienteProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
      <div className="relative sm:col-span-2" ref={nome?.wrapperRef}>
        <CampoLabel htmlFor="clienteNome" texto="Nome" obrigatorio />
        <Input
          id="clienteNome"
          name={nome?.name}
          value={valores.nome}
          onChange={(e) => (nome?.onChange ? nome.onChange(e.target.value) : onChange({ nome: e.target.value }))}
          onFocus={nome?.onFocus}
          onBlur={nome?.onBlur}
          autoComplete="off"
          className={cn("h-10 rounded-xl", campoComErro === "clienteNome" && "border-destructive")}
        />
        {nome?.sugestoes}
      </div>

      <div>
        <CampoLabel htmlFor="clienteTelefone" texto="Telefone" />
        <Input
          id="clienteTelefone"
          value={valores.telefone}
          placeholder={placeholderTelefone}
          onChange={(e) =>
            onChange({ telefone: formatarTelefone ? formatarTelefone(e.target.value) : e.target.value })
          }
          className="h-10 rounded-xl"
        />
      </div>

      <div className="relative" ref={documento?.wrapperRef}>
        <CampoLabel htmlFor="clienteCPF" texto="CPF / CNPJ" />
        <Input
          id="clienteCPF"
          name={documento?.name}
          value={valores.documento}
          onChange={(e) =>
            documento?.onChange
              ? documento.onChange(e.target.value)
              : onChange({ documento: mascararDocumento(e.target.value) })
          }
          onFocus={documento?.onFocus}
          onBlur={documento?.onBlur}
          autoComplete="off"
          placeholder="000.000.000-00"
          maxLength={18}
          className="h-10 rounded-xl"
        />
        {documento?.sugestoes}
      </div>

      <div>
        <CampoLabel htmlFor="clienteCEP" texto="CEP" />
        <div className="flex gap-2">
          <Input
            id="clienteCEP"
            value={valores.cep}
            placeholder="00000-000"
            maxLength={9}
            onChange={(e) => onChange({ cep: aplicarMascaraCEP(e.target.value) })}
            onBlur={() => onBuscarCEP()}
            className="h-10 rounded-xl"
          />
          <Button type="button" variant="outline" size="icon" onClick={onBuscarCEP} disabled={buscandoCEP} className="h-10 w-10 rounded-xl shrink-0">
            {buscandoCEP ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div>
        <CampoLabel htmlFor="clienteEndereco" texto="Endereço (Rua)" />
        <Input
          id="clienteEndereco"
          value={valores.endereco}
          onChange={(e) => onChange({ endereco: e.target.value })}
          className="h-10 rounded-xl"
        />
      </div>

      <div>
        <CampoLabel htmlFor="clienteNumero" texto="Número" />
        <Input
          id="clienteNumero"
          value={valores.numero}
          onChange={(e) => onChange({ numero: e.target.value })}
          className="h-10 rounded-xl"
        />
      </div>
      <div>
        <CampoLabel htmlFor="clienteBairro" texto="Bairro" />
        <Input
          id="clienteBairro"
          value={valores.bairro}
          onChange={(e) => onChange({ bairro: e.target.value })}
          className="h-10 rounded-xl"
        />
      </div>

      <div>
        <CampoLabel htmlFor="clienteCidade" texto="Cidade" />
        <Input
          id="clienteCidade"
          value={valores.cidade}
          onChange={(e) => onChange({ cidade: e.target.value })}
          className="h-10 rounded-xl"
        />
      </div>
      <div>
        <CampoLabel htmlFor="clienteEstado" texto="Estado" />
        <Input
          id="clienteEstado"
          value={valores.estado}
          placeholder="UF"
          maxLength={2}
          onChange={(e) => onChange({ estado: e.target.value.toUpperCase() })}
          className="h-10 rounded-xl"
        />
      </div>

      <div className="sm:col-span-2">
        <CampoLabel htmlFor="clienteDataNascimento" texto="Data de Nascimento" />
        <Input
          id="clienteDataNascimento"
          type="date"
          value={valores.dataNascimento}
          onChange={(e) => onChange({ dataNascimento: e.target.value })}
          className="h-10 rounded-xl sm:w-1/2"
        />
      </div>
    </div>
  );
}

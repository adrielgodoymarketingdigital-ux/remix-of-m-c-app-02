import { RefObject, useId } from "react";
import { User, Check, Contact } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Cliente } from "@/types/cliente";
import { CamposDadosCliente, ValoresCamposCliente } from "@/components/clientes/CamposDadosCliente";
import { EtapaCabecalho } from "./EtapaCabecalho";
import { FormData } from "./tipos";

/** Campo do componente compartilhado → campo do formulário da OS. */
const CAMPO_DA_OS: Record<keyof ValoresCamposCliente, keyof FormData> = {
  nome: "clienteNome",
  telefone: "clienteTelefone",
  documento: "clienteCPF",
  cep: "clienteCEP",
  endereco: "clienteEndereco",
  numero: "clienteNumero",
  bairro: "clienteBairro",
  cidade: "clienteCidade",
  estado: "clienteEstado",
  dataNascimento: "clienteDataNascimento",
};

const paraFormData = (parcial: Partial<ValoresCamposCliente>): Partial<FormData> =>
  Object.fromEntries(
    Object.entries(parcial).map(([k, v]) => [CAMPO_DA_OS[k as keyof ValoresCamposCliente], v]),
  ) as Partial<FormData>;

interface EtapaDadosClienteProps {
  formData: FormData;
  setFormData: (formData: FormData) => void;
  campoComErro: string | null;
  clienteSelecionadoId: string | null;
  clientesFiltrados: Cliente[];
  mostrarSugestoesNome: boolean;
  setMostrarSugestoesNome: (v: boolean) => void;
  mostrarSugestoesCPF: boolean;
  setMostrarSugestoesCPF: (v: boolean) => void;
  nomeInputRef: RefObject<HTMLDivElement>;
  cpfInputRef: RefObject<HTMLDivElement>;
  buscandoCEP: boolean;
  buscarClientes: (termo: string, campo: 'nome' | 'cpf') => void;
  selecionarCliente: (cliente: Cliente) => void;
  handleClienteNomeChange: (value: string) => void;
  handleClienteCPFChange: (value: string) => void;
  handleBuscarCEPOS: () => void;
}

export function EtapaDadosCliente({
  formData,
  setFormData,
  campoComErro,
  clienteSelecionadoId,
  clientesFiltrados,
  mostrarSugestoesNome,
  setMostrarSugestoesNome,
  mostrarSugestoesCPF,
  setMostrarSugestoesCPF,
  nomeInputRef,
  cpfInputRef,
  buscandoCEP,
  buscarClientes,
  selecionarCliente,
  handleClienteNomeChange,
  handleClienteCPFChange,
  handleBuscarCEPOS,
}: EtapaDadosClienteProps) {
  // Sufixo único por montagem — evita que o navegador ofereça sugestões de
  // autofill de digitações antigas (autocomplete="off" sozinho é ignorado
  // por vários navegadores/Android para esse tipo de campo)
  const instanceId = useId();
  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5">
        <EtapaCabecalho
          icone={Contact}
          titulo="Dados do Cliente"
          descricao="Preencha as informações de contato do cliente."
        />
        {clienteSelecionadoId && (
          <Badge variant="secondary" className="flex items-center gap-1 shrink-0 mt-1">
            <Check className="h-3 w-3" />
            Cliente existente
          </Badge>
        )}
      </div>

      {/* Mesmos campos do cadastro em Clientes (CamposDadosCliente); aqui com a busca de clientes. */}
      <CamposDadosCliente
        valores={{
          nome: formData.clienteNome,
          telefone: formData.clienteTelefone,
          documento: formData.clienteCPF,
          cep: formData.clienteCEP,
          endereco: formData.clienteEndereco,
          numero: formData.clienteNumero,
          bairro: formData.clienteBairro,
          cidade: formData.clienteCidade,
          estado: formData.clienteEstado,
          dataNascimento: formData.clienteDataNascimento,
        }}
        onChange={(parcial) => setFormData({ ...formData, ...paraFormData(parcial) })}
        campoComErro={campoComErro}
        buscandoCEP={buscandoCEP}
        onBuscarCEP={handleBuscarCEPOS}
        nome={{
          name: `clienteNome-${instanceId}`,
          wrapperRef: nomeInputRef,
          onChange: handleClienteNomeChange,
          onFocus: () => formData.clienteNome.length >= 2 && buscarClientes(formData.clienteNome, 'nome'),
          onBlur: () => setTimeout(() => setMostrarSugestoesNome(false), 200),
          sugestoes: (
            <>
              {mostrarSugestoesNome && clientesFiltrados.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
                  {clientesFiltrados.map((cliente) => (
                    <button
                      key={cliente.id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                      onClick={() => selecionarCliente(cliente)}
                    >
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{cliente.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {cliente.cpf && `CPF: ${cliente.cpf}`}
                          {cliente.cpf && cliente.telefone && " • "}
                          {cliente.telefone && `Tel: ${cliente.telefone}`}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ),
        }}
        documento={{
          name: `clienteCPF-${instanceId}`,
          wrapperRef: cpfInputRef,
          onChange: handleClienteCPFChange,
          onFocus: () => formData.clienteCPF.length >= 2 && buscarClientes(formData.clienteCPF, 'cpf'),
          onBlur: () => setTimeout(() => setMostrarSugestoesCPF(false), 200),
          sugestoes: (
            <>
              {mostrarSugestoesCPF && clientesFiltrados.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
                  {clientesFiltrados.map((cliente) => (
                    <button
                      key={cliente.id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                      onClick={() => selecionarCliente(cliente)}
                    >
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{cliente.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">
                        {cliente.cpf && `${cliente.cpf.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF'}: ${cliente.cpf}`}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ),
        }}
      />
    </div>
  );
}

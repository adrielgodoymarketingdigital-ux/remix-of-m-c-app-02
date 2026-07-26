import { RefObject } from "react";
import { Loader2, User, Check, Search, Contact } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { aplicarMascaraCEP } from "@/lib/mascaras";
import { Cliente } from "@/types/cliente";
import { EtapaCabecalho } from "./EtapaCabecalho";
import { CampoLabel } from "./CampoLabel";
import { FormData } from "./tipos";

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

      <div className="space-y-5">
        <div className="relative" ref={nomeInputRef}>
          <CampoLabel htmlFor="clienteNome" texto="Nome" obrigatorio />
          <Input
            id="clienteNome"
            value={formData.clienteNome}
            onChange={(e) => handleClienteNomeChange(e.target.value)}
            onFocus={() => formData.clienteNome.length >= 2 && buscarClientes(formData.clienteNome, 'nome')}
            onBlur={() => setTimeout(() => setMostrarSugestoesNome(false), 200)}
            autoComplete="off"
            className={cn("h-12 rounded-xl", campoComErro === "clienteNome" && "border-destructive")}
          />
          {mostrarSugestoesNome && clientesFiltrados.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
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
        </div>

        <div>
          <CampoLabel htmlFor="clienteTelefone" texto="Telefone" />
          <Input
            id="clienteTelefone"
            value={formData.clienteTelefone}
            onChange={(e) =>
              setFormData({ ...formData, clienteTelefone: e.target.value })
            }
            className="h-12 rounded-xl"
          />
        </div>

        <div className="relative" ref={cpfInputRef}>
          <CampoLabel htmlFor="clienteCPF" texto="CPF / CNPJ" />
          <Input
            id="clienteCPF"
            value={formData.clienteCPF}
            onChange={(e) => handleClienteCPFChange(e.target.value)}
            onFocus={() => formData.clienteCPF.length >= 2 && buscarClientes(formData.clienteCPF, 'cpf')}
            onBlur={() => setTimeout(() => setMostrarSugestoesCPF(false), 200)}
            autoComplete="off"
            placeholder="000.000.000-00"
            maxLength={18}
            className="h-12 rounded-xl"
          />
          {mostrarSugestoesCPF && clientesFiltrados.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
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
        </div>

        <div>
          <CampoLabel htmlFor="clienteCEP" texto="CEP" />
          <div className="flex gap-2">
            <Input
              id="clienteCEP"
              value={formData.clienteCEP}
              placeholder="00000-000"
              maxLength={9}
              onChange={(e) =>
                setFormData({ ...formData, clienteCEP: aplicarMascaraCEP(e.target.value) })
              }
              onBlur={() => handleBuscarCEPOS()}
              className="h-12 rounded-xl"
            />
            <Button type="button" variant="outline" size="icon" onClick={handleBuscarCEPOS} disabled={buscandoCEP} className="h-12 w-12 rounded-xl shrink-0">
              {buscandoCEP ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div>
          <CampoLabel htmlFor="clienteEndereco" texto="Endereço (Rua)" />
          <Input
            id="clienteEndereco"
            value={formData.clienteEndereco}
            onChange={(e) =>
              setFormData({ ...formData, clienteEndereco: e.target.value })
            }
            className="h-12 rounded-xl"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <CampoLabel htmlFor="clienteNumero" texto="Número" />
            <Input
              id="clienteNumero"
              value={formData.clienteNumero}
              onChange={(e) =>
                setFormData({ ...formData, clienteNumero: e.target.value })
              }
              className="h-12 rounded-xl"
            />
          </div>
          <div>
            <CampoLabel htmlFor="clienteBairro" texto="Bairro" />
            <Input
              id="clienteBairro"
              value={formData.clienteBairro}
              onChange={(e) =>
                setFormData({ ...formData, clienteBairro: e.target.value })
              }
              className="h-12 rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <CampoLabel htmlFor="clienteCidade" texto="Cidade" />
            <Input
              id="clienteCidade"
              value={formData.clienteCidade}
              onChange={(e) =>
                setFormData({ ...formData, clienteCidade: e.target.value })
              }
              className="h-12 rounded-xl"
            />
          </div>
          <div>
            <CampoLabel htmlFor="clienteEstado" texto="Estado" />
            <Input
              id="clienteEstado"
              value={formData.clienteEstado}
              placeholder="UF"
              maxLength={2}
              onChange={(e) =>
                setFormData({ ...formData, clienteEstado: e.target.value.toUpperCase() })
              }
              className="h-12 rounded-xl"
            />
          </div>
        </div>

        <div>
          <CampoLabel htmlFor="clienteDataNascimento" texto="Data de Nascimento" />
          <Input
            id="clienteDataNascimento"
            type="date"
            value={formData.clienteDataNascimento}
            onChange={(e) =>
              setFormData({ ...formData, clienteDataNascimento: e.target.value })
            }
            className="h-12 rounded-xl"
          />
        </div>
      </div>
    </div>
  );
}

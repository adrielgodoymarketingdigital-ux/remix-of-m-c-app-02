import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Plus, X, User, Phone, FileText, MapPin } from "lucide-react";
import { Cliente } from "@/types/cliente";

interface FormularioNovoCliente {
  nome: string;
  telefone: string;
  cpf: string;
  endereco: string;
}

interface SelecionadorClienteProps {
  clientes: Cliente[];
  clienteSelecionado: Cliente | null;
  onClienteChange: (cliente: Cliente | null) => void;
  onCriarCliente: (dados: FormularioNovoCliente) => Promise<Cliente | null>;
}

export const SelecionadorCliente = ({
  clientes,
  clienteSelecionado,
  onClienteChange,
  onCriarCliente,
}: SelecionadorClienteProps) => {
  const [termoBusca, setTermoBusca] = useState("");
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [dadosNovoCliente, setDadosNovoCliente] = useState<FormularioNovoCliente>({
    nome: "",
    telefone: "",
    cpf: "",
    endereco: "",
  });

  const clientesFiltrados = useMemo(() => {
    if (!termoBusca.trim()) return [];
    const termo = termoBusca.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) ||
        c.cpf?.includes(termo) ||
        c.telefone?.includes(termo)
    ).slice(0, 5);
  }, [clientes, termoBusca]);

  const handleSelecionarCliente = (cliente: Cliente) => {
    onClienteChange(cliente);
    setTermoBusca(cliente.nome);
    setMostrarSugestoes(false);
    setCriandoNovo(false);
  };

  const handleIniciarCriacao = () => {
    setCriandoNovo(true);
    setMostrarSugestoes(false);
    setDadosNovoCliente({
      nome: termoBusca,
      telefone: "",
      cpf: "",
      endereco: "",
    });
  };

  const handleCancelarCriacao = () => {
    setCriandoNovo(false);
    setDadosNovoCliente({
      nome: "",
      telefone: "",
      cpf: "",
      endereco: "",
    });
  };

  const handleSalvarNovoCliente = async () => {
    if (!dadosNovoCliente.nome.trim()) return;
    
    setSalvando(true);
    try {
      const novoCliente = await onCriarCliente({
        nome: dadosNovoCliente.nome,
        telefone: dadosNovoCliente.telefone || "",
        cpf: dadosNovoCliente.cpf || "",
        endereco: dadosNovoCliente.endereco || "",
      });
      
      if (novoCliente) {
        onClienteChange(novoCliente);
        setTermoBusca(novoCliente.nome);
        setCriandoNovo(false);
        setDadosNovoCliente({
          nome: "",
          telefone: "",
          cpf: "",
          endereco: "",
        });
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleLimparCliente = () => {
    onClienteChange(null);
    setTermoBusca("");
    setCriandoNovo(false);
  };

  const handleBuscaChange = (value: string) => {
    setTermoBusca(value);
    setMostrarSugestoes(value.length > 0);
    
    // Se o cliente selecionado não corresponder mais à busca, limpar
    if (clienteSelecionado && !clienteSelecionado.nome.toLowerCase().includes(value.toLowerCase())) {
      onClienteChange(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cliente selecionado */}
      {clienteSelecionado && !criandoNovo && (
        <Card className="p-3 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-sm">{clienteSelecionado.nome}</p>
                {clienteSelecionado.telefone && (
                  <p className="text-xs text-muted-foreground">{clienteSelecionado.telefone}</p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLimparCliente}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Campo de busca */}
      {!clienteSelecionado && !criandoNovo && (
        <div className="relative">
          <div className="space-y-2">
            <Label htmlFor="busca-cliente">Nome do Cliente *</Label>
            <Input
              id="busca-cliente"
              placeholder="Digite para buscar ou criar cliente..."
              value={termoBusca}
              onChange={(e) => handleBuscaChange(e.target.value)}
              onFocus={() => setMostrarSugestoes(termoBusca.length > 0)}
              onBlur={(e) => {
                // Verificar se o click foi em um elemento filho (sugestões)
                const relatedTarget = e.relatedTarget as HTMLElement;
                if (relatedTarget?.closest('.sugestoes-clientes')) {
                  return; // Não fechar se o click foi na lista de sugestões
                }
                setTimeout(() => setMostrarSugestoes(false), 300);
              }}
              maxLength={100}
            />
          </div>

          {/* Sugestões */}
          {mostrarSugestoes && (
            <Card className="sugestoes-clientes absolute z-50 w-full mt-1 max-h-64 overflow-auto shadow-lg">
              {clientesFiltrados.length > 0 ? (
                <div className="p-1">
                  {clientesFiltrados.map((cliente) => (
                    <button
                      key={cliente.id}
                      type="button"
                      className="w-full text-left p-2 hover:bg-muted rounded-md flex items-center gap-2"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevenir perda de foco
                        handleSelecionarCliente(cliente);
                      }}
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{cliente.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[cliente.telefone, cliente.cpf].filter(Boolean).join(" • ")}
                        </p>
                      </div>
                    </button>
                  ))}
                  <div className="border-t mt-1 pt-1">
                    <button
                      type="button"
                      className="w-full text-left p-2 hover:bg-muted rounded-md flex items-center gap-2 text-primary"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleIniciarCriacao();
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Criar cliente "{termoBusca}"
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    Nenhum cliente encontrado
                  </p>
                  <button
                    type="button"
                    className="w-full text-left p-2 hover:bg-muted rounded-md flex items-center gap-2 text-primary"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleIniciarCriacao();
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Criar cliente "{termoBusca}"
                    </span>
                  </button>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Formulário de criação inline */}
      {criandoNovo && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <Plus className="h-3 w-3 mr-1" />
              Novo Cliente
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="novo-nome" className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Nome *
              </Label>
              <Input
                id="novo-nome"
                placeholder="Nome completo"
                value={dadosNovoCliente.nome}
                onChange={(e) =>
                  setDadosNovoCliente({ ...dadosNovoCliente, nome: e.target.value })
                }
                maxLength={100}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="novo-telefone" className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Telefone
              </Label>
              <Input
                id="novo-telefone"
                placeholder="(00) 00000-0000"
                value={dadosNovoCliente.telefone}
                onChange={(e) =>
                  setDadosNovoCliente({ ...dadosNovoCliente, telefone: e.target.value })
                }
                maxLength={20}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="novo-cpf" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                CPF
              </Label>
              <Input
                id="novo-cpf"
                placeholder="000.000.000-00"
                value={dadosNovoCliente.cpf}
                onChange={(e) =>
                  setDadosNovoCliente({ ...dadosNovoCliente, cpf: e.target.value })
                }
                maxLength={14}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="novo-endereco" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Endereço
              </Label>
              <Input
                id="novo-endereco"
                placeholder="Rua, número"
                value={dadosNovoCliente.endereco}
                onChange={(e) =>
                  setDadosNovoCliente({ ...dadosNovoCliente, endereco: e.target.value })
                }
                maxLength={200}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelarCriacao}
              disabled={salvando}
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSalvarNovoCliente}
              disabled={!dadosNovoCliente.nome.trim() || salvando}
            >
              <Check className="h-4 w-4 mr-1" />
              {salvando ? "Salvando..." : "Salvar Cliente"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

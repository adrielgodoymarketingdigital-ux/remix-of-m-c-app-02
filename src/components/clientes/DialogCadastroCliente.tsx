import { FormEvent, useEffect, useState } from "react";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Cliente, FormularioCliente } from "@/types/cliente";
import { aplicarMascaraTelefone, removerMascara } from "@/lib/mascaras";
import { buscarCEP } from "@/lib/buscarCEP";
import { documentoDoCliente, documentoParaColunas } from "@/lib/clientes/dadosCliente";
import { CamposDadosCliente, ValoresCamposCliente } from "./CamposDadosCliente";

// Mesmas regras de antes deste cadastro ganhar os campos da OS.
const formSchema = z.object({
  nome: z.string().trim().min(3, "Nome deve ter no mínimo 3 caracteres").max(100, "Nome deve ter no máximo 100 caracteres"),
  documento: z.string().max(18, "CPF/CNPJ inválido"),
  telefone: z.string().max(15, "Telefone inválido"),
  endereco: z.string().max(200, "Endereço deve ter no máximo 200 caracteres"),
  numero: z.string().max(20, "Número deve ter no máximo 20 caracteres"),
  bairro: z.string().max(100, "Bairro deve ter no máximo 100 caracteres"),
  cidade: z.string().max(100, "Cidade deve ter no máximo 100 caracteres"),
  estado: z.string().max(2, "Estado deve ter 2 letras"),
  cep: z.string().max(9, "CEP inválido"),
});

const VALORES_VAZIOS: ValoresCamposCliente = {
  nome: "",
  telefone: "",
  documento: "",
  cep: "",
  endereco: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  dataNascimento: "",
};

const valoresDoCliente = (cliente: Cliente): ValoresCamposCliente => ({
  nome: cliente.nome,
  telefone: cliente.telefone || "",
  documento: documentoDoCliente(cliente),
  // Cliente antigo: só `endereco` (o texto inteiro) vem preenchido e fica em "Rua".
  cep: cliente.cep || "",
  endereco: cliente.endereco || "",
  numero: cliente.numero || "",
  bairro: cliente.bairro || "",
  cidade: cliente.cidade || "",
  estado: cliente.estado || "",
  dataNascimento: cliente.data_nascimento || "",
});

interface DialogCadastroClienteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dados: FormularioCliente) => Promise<boolean>;
  cliente?: Cliente | null;
}

export function DialogCadastroCliente({
  open,
  onOpenChange,
  onSubmit,
  cliente,
}: DialogCadastroClienteProps) {
  const [valores, setValores] = useState<ValoresCamposCliente>(VALORES_VAZIOS);
  const [erros, setErros] = useState<string[]>([]);
  const [campoComErro, setCampoComErro] = useState<string | null>(null);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setValores(cliente ? valoresDoCliente(cliente) : VALORES_VAZIOS);
    setErros([]);
    setCampoComErro(null);
  }, [cliente, open]);

  const alterar = (parcial: Partial<ValoresCamposCliente>) => setValores((v) => ({ ...v, ...parcial }));

  // Mesma busca de CEP da OS: com 8 dígitos, preenche rua, bairro, cidade e estado.
  const handleBuscarCEP = async () => {
    const cepLimpo = removerMascara(valores.cep || "");
    if (cepLimpo.length !== 8) return;
    setBuscandoCEP(true);
    const dados = await buscarCEP(cepLimpo);
    setBuscandoCEP(false);
    if (dados) {
      alterar({ endereco: dados.logradouro, bairro: dados.bairro, cidade: dados.cidade, estado: dados.estado });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validacao = formSchema.safeParse(valores);
    if (!validacao.success) {
      setErros(validacao.error.issues.map((i) => i.message));
      setCampoComErro(validacao.error.issues.some((i) => i.path[0] === "nome") ? "clienteNome" : null);
      return;
    }
    setErros([]);
    setCampoComErro(null);

    const { cpf, cnpj } = documentoParaColunas(valores.documento, cliente);
    const dados: FormularioCliente = {
      nome: valores.nome.trim(),
      cpf,
      cnpj,
      telefone: valores.telefone,
      // Cada parte do endereço na sua coluna; endereco = rua/logradouro.
      endereco: valores.endereco,
      numero: valores.numero,
      bairro: valores.bairro,
      cidade: valores.cidade,
      estado: valores.estado,
      cep: valores.cep,
      data_nascimento: valores.dataNascimento,
    };

    setSalvando(true);
    try {
      const sucesso = await onSubmit(dados);
      if (sucesso) {
        onOpenChange(false);
        setValores(VALORES_VAZIOS);
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {cliente ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <CamposDadosCliente
            valores={valores}
            onChange={alterar}
            campoComErro={campoComErro}
            buscandoCEP={buscandoCEP}
            onBuscarCEP={handleBuscarCEP}
            formatarTelefone={aplicarMascaraTelefone}
            placeholderTelefone="(00) 00000-0000"
          />

          {erros.length > 0 && (
            <div className="space-y-1">
              {erros.map((erro) => (
                <p key={erro} className="text-sm font-medium text-destructive">{erro}</p>
              ))}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="w-full sm:w-auto">
              {cliente ? "Atualizar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

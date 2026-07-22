import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, User, FileText, ClipboardCheck, Search, X, Smartphone, Wrench, Package, Info, Eye, EyeOff } from "lucide-react";
import { ChecklistOrcamento, ItemOrcamento, Orcamento } from "@/types/orcamento";
import { Checklist } from "@/types/ordem-servico";
import { useClientes } from "@/hooks/useClientes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { ChecklistDispositivo } from "@/components/ordens/ChecklistDispositivo";
import { Badge } from "@/components/ui/badge";

interface DialogCadastroOrcamentoProps {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (dados: Omit<Orcamento, "id" | "user_id" | "numero_orcamento" | "created_at" | "updated_at">) => Promise<void>;
  orcamentoEdicao?: Orcamento | null;
}

export function DialogCadastroOrcamento({
  aberto,
  onFechar,
  onSalvar,
  orcamentoEdicao,
}: DialogCadastroOrcamentoProps) {
  const { clientes } = useClientes();

  // Cliente
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");

  // Busca de cliente
  const [buscaCliente, setBuscaCliente] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const buscaRef = useRef<HTMLDivElement>(null);

  // Itens
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [validadeDias, setValidadeDias] = useState(30);
  const [observacoes, setObservacoes] = useState("");
  const [termosCondicoes, setTermosCondicoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mostrarTotal, setMostrarTotal] = useState(true);

  // Dispositivo
  const [tipoDispositivo, setTipoDispositivo] = useState("");
  const [sistemaOperacional, setSistemaOperacional] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [marcaDispositivo, setMarcaDispositivo] = useState("");
  const [modeloDispositivo, setModeloDispositivo] = useState("");
  const [corDispositivo, setCorDispositivo] = useState("");
  const [checklist, setChecklist] = useState<ChecklistOrcamento>({ entrada: {}, saida: {} });

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) {
        setMostrarSugestoes(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    try {
      if (orcamentoEdicao) {
        setClienteId(orcamentoEdicao.cliente_id || "");
        setClienteNome(orcamentoEdicao.cliente_nome || "");
        setBuscaCliente(orcamentoEdicao.cliente_nome || "");
        setClienteTelefone(orcamentoEdicao.cliente_telefone || "");
        setClienteEmail(orcamentoEdicao.cliente_email || "");
        setItens(Array.isArray(orcamentoEdicao.itens) ? orcamentoEdicao.itens : []);
        setDesconto(orcamentoEdicao.desconto || 0);
        setValidadeDias(orcamentoEdicao.validade_dias || 30);
        setObservacoes(orcamentoEdicao.observacoes || "");
        setTermosCondicoes(orcamentoEdicao.termos_condicoes || "");
        setTipoDispositivo(orcamentoEdicao.tipo_dispositivo || "");
        setSistemaOperacional(orcamentoEdicao.sistema_operacional || "");
        setFabricante(orcamentoEdicao.fabricante || "");
        setMarcaDispositivo(orcamentoEdicao.marca_dispositivo || "");
        setModeloDispositivo(orcamentoEdicao.modelo_dispositivo || "");
        setCorDispositivo(orcamentoEdicao.cor_dispositivo || "");
        setChecklist(
          orcamentoEdicao.checklist &&
            typeof orcamentoEdicao.checklist === "object" &&
            !Array.isArray(orcamentoEdicao.checklist)
            ? { entrada: {}, saida: {}, ...(orcamentoEdicao.checklist as any) }
            : { entrada: {}, saida: {} }
        );
      } else {
        limparFormulario();
      }
    } catch (error) {
      console.error('[DialogCadastroOrcamento] Erro ao carregar orçamento para edição:', error);
      limparFormulario();
    }
  }, [orcamentoEdicao, aberto]);

  const limparFormulario = () => {
    setClienteId("");
    setClienteNome("");
    setBuscaCliente("");
    setClienteTelefone("");
    setClienteEmail("");
    setItens([]);
    setDesconto(0);
    setValidadeDias(30);
    setObservacoes("");
    setTermosCondicoes("");
    setTipoDispositivo("");
    setSistemaOperacional("");
    setFabricante("");
    setMarcaDispositivo("");
    setModeloDispositivo("");
    setCorDispositivo("");
    setChecklist({ entrada: {}, saida: {} });
  };

  // Filtra clientes pela busca
  const clientesFiltrados = buscaCliente.trim().length >= 1
    ? clientes.filter((c) =>
        c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
        (c.telefone || "").includes(buscaCliente)
      ).slice(0, 6)
    : [];

  const selecionarCliente = (id: string) => {
    const cliente = clientes.find((c) => c.id === id);
    if (cliente) {
      setClienteId(cliente.id);
      setClienteNome(cliente.nome);
      setBuscaCliente(cliente.nome);
      setClienteTelefone(cliente.telefone || "");
      setClienteEmail("");
    }
    setMostrarSugestoes(false);
  };

  const limparCliente = () => {
    setClienteId("");
    setClienteNome("");
    setBuscaCliente("");
    setClienteTelefone("");
    setClienteEmail("");
  };

  const adicionarItem = () => {
    const novoItem: ItemOrcamento = {
      id: crypto.randomUUID(),
      tipo: "servico",
      descricao: "",
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0,
    };
    setItens([...itens, novoItem]);
  };

  const atualizarItem = (id: string, campo: keyof ItemOrcamento, valor: unknown) => {
    setItens(
      itens.map((item) => {
        if (item.id === id) {
          const novoItem = { ...item, [campo]: valor };
          if (campo === "quantidade" || campo === "valor_unitario") {
            novoItem.valor_total = novoItem.quantidade * novoItem.valor_unitario;
          }
          return novoItem;
        }
        return item;
      })
    );
  };

  const removerItem = (id: string) => {
    setItens(itens.filter((item) => item.id !== id));
  };

  const subtotal = itens.reduce((acc, item) => acc + item.valor_total, 0);
  const valorTotal = subtotal - desconto;

  // Converter checklist para o tipo Checklist da OS
  const checklistParaOS: Checklist = {
    entrada: checklist.entrada,
    saida: checklist.saida,
    sem_teste: checklist.sem_teste,
    peca_trocada_descricao_entrada: checklist.peca_trocada_descricao_entrada,
    peca_trocada_descricao_saida: checklist.peca_trocada_descricao_saida,
  };

  const handleChecklistChange = (novoChecklist: Checklist) => {
    setChecklist({
      entrada: novoChecklist.entrada,
      saida: novoChecklist.saida,
      sem_teste: novoChecklist.sem_teste,
      peca_trocada_descricao_entrada: novoChecklist.peca_trocada_descricao_entrada,
      peca_trocada_descricao_saida: novoChecklist.peca_trocada_descricao_saida,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itens.length === 0) return;

    setSalvando(true);
    try {
      const checklistFinal =
        tipoDispositivo &&
        (Object.keys(checklist.entrada).length > 0 || Object.keys(checklist.saida).length > 0)
          ? checklist
          : undefined;

      await onSalvar({
        cliente_id: clienteId || undefined,
        cliente_nome: clienteNome,
        cliente_telefone: clienteTelefone,
        cliente_email: clienteEmail,
        status: "pendente",
        itens,
        subtotal,
        desconto,
        valor_total: valorTotal,
        validade_dias: validadeDias,
        observacoes,
        termos_condicoes: termosCondicoes,
        tipo_dispositivo: tipoDispositivo || undefined,
        sistema_operacional: sistemaOperacional || undefined,
        fabricante: fabricante || undefined,
        marca_dispositivo: marcaDispositivo || undefined,
        modelo_dispositivo: modeloDispositivo || undefined,
        cor_dispositivo: corDispositivo || undefined,
        checklist: checklistFinal,
      });
      onFechar();
    } finally {
      setSalvando(false);
    }
  };

  const totalChecklistItens =
    Object.keys(checklist.entrada).length + Object.keys(checklist.saida).length;

  const tipoIcon = (tipo: string) => {
    if (tipo === "servico") return <Wrench className="h-3.5 w-3.5 text-blue-500" />;
    if (tipo === "produto") return <Package className="h-3.5 w-3.5 text-green-500" />;
    return <Smartphone className="h-3.5 w-3.5 text-purple-500" />;
  };

  return (
    <Dialog open={aberto} onOpenChange={onFechar}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {orcamentoEdicao ? "Editar Orçamento" : "Novo Orçamento"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dados" className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span>Dados</span>
              </TabsTrigger>
              <TabsTrigger value="itens" className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span>
                  Itens
                  {itens.length > 0 && (
                    <span className="ml-1 text-[10px] bg-primary/15 text-primary rounded-full px-1.5 py-0.5 font-semibold">
                      {itens.length}
                    </span>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger value="checklist" className="flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5" />
                <span>
                  Checklist
                  {totalChecklistItens > 0 && (
                    <span className="ml-1 text-[10px] bg-primary/15 text-primary rounded-full px-1.5 py-0.5 font-semibold">
                      {totalChecklistItens}
                    </span>
                  )}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* ABA: Dados do Cliente + Dispositivo + Configurações */}
            <TabsContent value="dados" className="space-y-6 mt-4">

              {/* Dados do Cliente */}
              <div className="space-y-4">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Dados do Cliente
                </h3>

                {/* Busca de cliente com autocomplete */}
                <div className="space-y-2" ref={buscaRef}>
                  <Label className="flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    Buscar cliente cadastrado
                  </Label>
                  <div className="relative">
                    <Input
                      value={buscaCliente}
                      onChange={(e) => {
                        setBuscaCliente(e.target.value);
                        setClienteNome(e.target.value);
                        if (clienteId) setClienteId(""); // desvincular se digitar manualmente
                        setMostrarSugestoes(true);
                      }}
                      onFocus={() => setMostrarSugestoes(true)}
                      placeholder="Digite o nome ou telefone do cliente..."
                      className={clienteId ? "pr-8 border-green-500 focus-visible:ring-green-400" : "pr-8"}
                    />
                    {clienteId && (
                      <Badge
                        variant="secondary"
                        className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] bg-green-100 text-green-700 border-green-200 px-1.5 py-0"
                      >
                        cadastrado
                      </Badge>
                    )}
                    {buscaCliente && (
                      <button
                        type="button"
                        onClick={limparCliente}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}

                    {/* Dropdown de sugestões */}
                    {mostrarSugestoes && clientesFiltrados.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg overflow-hidden">
                        {clientesFiltrados.map((cliente) => (
                          <button
                            key={cliente.id}
                            type="button"
                            onClick={() => selecionarCliente(cliente.id)}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors flex items-center justify-between gap-2 border-b last:border-b-0"
                          >
                            <div>
                              <p className="font-medium text-sm">{cliente.nome}</p>
                              {cliente.telefone && (
                                <p className="text-xs text-muted-foreground">{cliente.telefone}</p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">selecionar</Badge>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Nenhum resultado */}
                    {mostrarSugestoes && buscaCliente.trim().length >= 2 && clientesFiltrados.length === 0 && !clienteId && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg px-3 py-2.5 text-sm text-muted-foreground">
                        Nenhum cliente encontrado — o nome será salvo como cliente avulso.
                      </div>
                    )}
                  </div>
                  {clienteId && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      ✓ Cliente vinculado — telefone e e-mail preenchidos automaticamente
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={clienteTelefone}
                      onChange={(e) => setClienteTelefone(e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={clienteEmail}
                      onChange={(e) => setClienteEmail(e.target.value)}
                      placeholder="cliente@email.com"
                    />
                  </div>
                </div>
              </div>

              {/* Dados do Dispositivo */}
              <div className="space-y-4">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  Dispositivo <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Marca</Label>
                    <Input
                      value={marcaDispositivo}
                      onChange={(e) => setMarcaDispositivo(e.target.value)}
                      placeholder="Ex: Samsung, Apple, Motorola..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo</Label>
                    <Input
                      value={modeloDispositivo}
                      onChange={(e) => setModeloDispositivo(e.target.value)}
                      placeholder="Ex: Galaxy S23, iPhone 14..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <Input
                      value={corDispositivo}
                      onChange={(e) => setCorDispositivo(e.target.value)}
                      placeholder="Ex: Preto, Branco, Azul..."
                    />
                  </div>
                </div>
              </div>

              {/* Configurações */}
              <div className="space-y-4">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Configurações do Orçamento
                </h3>
                <div className="space-y-2 max-w-xs">
                  <Label>Validade (dias)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={validadeDias}
                    onChange={(e) => setValidadeDias(parseInt(e.target.value) || 30)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Observações adicionais sobre o orçamento..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Termos e Condições</Label>
                  <Textarea
                    value={termosCondicoes}
                    onChange={(e) => setTermosCondicoes(e.target.value)}
                    placeholder="Ex: Orçamento válido por 30 dias. Peças com garantia de 90 dias..."
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ABA: Itens */}
            <TabsContent value="itens" className="space-y-4 mt-4">
              {/* Explicação da aba */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2.5 text-sm text-blue-800">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                <div className="space-y-1.5">
                  <p className="font-semibold">Como funciona a aba de itens?</p>
                  <p>Cada item do orçamento tem um <strong>tipo</strong> que determina o que está sendo cobrado:</p>
                  <ul className="space-y-1 mt-1">
                    <li className="flex items-center gap-2">
                      <Wrench className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span><strong>Serviço</strong> — mão de obra, ex: troca de tela, formatação, limpeza</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <span><strong>Produto/Peça</strong> — componente usado, ex: tela, bateria, conector</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Smartphone className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                      <span><strong>Dispositivo</strong> — aparelho inteiro, ex: venda ou repasse de aparelho</span>
                    </li>
                  </ul>
                  <p className="text-xs text-blue-600 mt-1">Adicione quantos itens precisar. O total é calculado automaticamente.</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">Itens do Orçamento</h3>
                <Button type="button" variant="outline" size="sm" onClick={adicionarItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Item
                </Button>
              </div>

              {itens.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed rounded-lg text-muted-foreground gap-2">
                  <FileText className="h-8 w-8 opacity-30" />
                  <p className="text-sm font-medium">Nenhum item adicionado</p>
                  <p className="text-xs">Clique em "Adicionar Item" para incluir serviços, peças ou dispositivos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {itens.map((item, index) => (
                    <div key={item.id} className="border rounded-lg p-3 space-y-3 bg-muted/20">
                      {/* Cabeçalho do item */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          {tipoIcon(item.tipo)}
                          Item {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removerItem(item.id)}
                          className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Linha 1: Tipo + Descrição */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Tipo</Label>
                          <Select
                            value={item.tipo}
                            onValueChange={(v) => atualizarItem(item.id, "tipo", v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="servico">
                                <span className="flex items-center gap-2">
                                  <Wrench className="h-3.5 w-3.5 text-blue-500" /> Serviço
                                </span>
                              </SelectItem>
                              <SelectItem value="produto">
                                <span className="flex items-center gap-2">
                                  <Package className="h-3.5 w-3.5 text-green-500" /> Produto / Peça
                                </span>
                              </SelectItem>
                              <SelectItem value="dispositivo">
                                <span className="flex items-center gap-2">
                                  <Smartphone className="h-3.5 w-3.5 text-purple-500" /> Dispositivo
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <Label className="text-xs text-muted-foreground">Descrição</Label>
                          <Input
                            value={item.descricao}
                            onChange={(e) => atualizarItem(item.id, "descricao", e.target.value)}
                            placeholder={
                              item.tipo === "servico"
                                ? "Ex: Troca de tela, Formatação..."
                                : item.tipo === "produto"
                                ? "Ex: Tela original, Bateria..."
                                : "Ex: iPhone 13 128GB Preto"
                            }
                            required
                          />
                        </div>
                      </div>

                      {/* Linha 2: Qtd + Valor Unit. + Total */}
                      <div className="grid grid-cols-3 gap-3 items-end">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Quantidade</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantidade}
                            onChange={(e) =>
                              atualizarItem(item.id, "quantidade", parseInt(e.target.value) || 1)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Valor Unitário (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.valor_unitario}
                            onChange={(e) =>
                              atualizarItem(item.id, "valor_unitario", parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Total</Label>
                          <Input
                            value={formatCurrency(item.valor_total)}
                            disabled
                            className="bg-muted font-semibold"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Totais */}
              {itens.length > 0 && (
                <div className="space-y-3 p-4 bg-muted rounded-lg border">
                  {itens.length > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Exibição do total</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => setMostrarTotal((prev) => !prev)}
                      >
                        {mostrarTotal ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" />
                            Ocultar Total
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" />
                            Mostrar Total
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {mostrarTotal && (
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs">Subtotal</Label>
                        <Input value={formatCurrency(subtotal)} disabled className="bg-background font-medium" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs">
                        Desconto (R$)
                        <span className="ml-1 text-muted-foreground font-normal">— opcional</span>
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={desconto}
                        onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    {mostrarTotal && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Total Final</Label>
                        <Input
                          value={formatCurrency(valorTotal)}
                          disabled
                          className="bg-background font-bold text-lg text-primary"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ABA: Checklist */}
            <TabsContent value="checklist" className="space-y-4 mt-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-base">Checklist do Dispositivo</h3>
                <p className="text-sm text-muted-foreground">
                  Registre o estado do dispositivo na entrada e saída, igual ao checklist da Ordem de Serviço.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Dispositivo</Label>
                    <Select
                      value={tipoDispositivo || "none"}
                      onValueChange={(v) => {
                        const val = v === "none" ? "" : v;
                        setTipoDispositivo(val);
                        setSistemaOperacional("");
                        setFabricante("");
                        setChecklist({ entrada: {}, saida: {} });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectItem value="celular">Celular</SelectItem>
                        <SelectItem value="tablet">Tablet</SelectItem>
                        <SelectItem value="notebook">Notebook</SelectItem>
                        <SelectItem value="notebook/computador">Notebook/Computador</SelectItem>
                        <SelectItem value="computador">Computador</SelectItem>
                        <SelectItem value="relogio_smart">Relógio Smart</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {tipoDispositivo ? (
                  <ChecklistDispositivo
                    tipoDispositivo={tipoDispositivo}
                    sistema={sistemaOperacional}
                    fabricante={fabricante}
                    value={checklistParaOS}
                    onChange={handleChecklistChange}
                    onSistemaChange={setSistemaOperacional}
                    onFabricanteChange={setFabricante}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border rounded-lg">
                    <ClipboardCheck className="h-10 w-10 opacity-20 mb-2" />
                    <p className="text-sm">Selecione o tipo de dispositivo acima para ver o checklist</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Botões sempre visíveis */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || itens.length === 0}>
              {salvando ? "Salvando..." : "Salvar Orçamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

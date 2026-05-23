import { useState, useEffect } from "react";
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
import { Plus, Trash2, User, FileText, ClipboardCheck } from "lucide-react";
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
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [validadeDias, setValidadeDias] = useState(30);
  const [observacoes, setObservacoes] = useState("");
  const [termosCondicoes, setTermosCondicoes] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Checklist
  const [tipoDispositivo, setTipoDispositivo] = useState("");
  const [sistemaOperacional, setSistemaOperacional] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [checklist, setChecklist] = useState<ChecklistOrcamento>({ entrada: {}, saida: {} });

  useEffect(() => {
    if (orcamentoEdicao) {
      setClienteId(orcamentoEdicao.cliente_id || "");
      setClienteNome(orcamentoEdicao.cliente_nome || "");
      setClienteTelefone(orcamentoEdicao.cliente_telefone || "");
      setClienteEmail(orcamentoEdicao.cliente_email || "");
      setItens(orcamentoEdicao.itens || []);
      setDesconto(orcamentoEdicao.desconto || 0);
      setValidadeDias(orcamentoEdicao.validade_dias || 30);
      setObservacoes(orcamentoEdicao.observacoes || "");
      setTermosCondicoes(orcamentoEdicao.termos_condicoes || "");
      setTipoDispositivo(orcamentoEdicao.tipo_dispositivo || "");
      setSistemaOperacional(orcamentoEdicao.sistema_operacional || "");
      setFabricante(orcamentoEdicao.fabricante || "");
      setChecklist(
        orcamentoEdicao.checklist
          ? { entrada: {}, saida: {}, ...orcamentoEdicao.checklist }
          : { entrada: {}, saida: {} }
      );
    } else {
      limparFormulario();
    }
  }, [orcamentoEdicao, aberto]);

  const limparFormulario = () => {
    setClienteId("");
    setClienteNome("");
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
    setChecklist({ entrada: {}, saida: {} });
  };

  const handleClienteChange = (id: string) => {
    setClienteId(id);
    if (id) {
      const cliente = clientes.find((c) => c.id === id);
      if (cliente) {
        setClienteNome(cliente.nome);
        setClienteTelefone(cliente.telefone || "");
        setClienteEmail("");
      }
    }
  };

  const adicionarItem = () => {
    const novoItem: ItemOrcamento = {
      id: crypto.randomUUID(),
      tipo: "produto",
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

  // Converter checklist para o tipo Checklist da OS (compatível com ChecklistDispositivo)
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
      // Salvar checklist apenas se houver tipo de dispositivo selecionado
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
        checklist: checklistFinal,
      });
      onFechar();
    } finally {
      setSalvando(false);
    }
  };

  const totalChecklistItens =
    Object.keys(checklist.entrada).length + Object.keys(checklist.saida).length;

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

            {/* ABA: Dados do Cliente + Configurações */}
            <TabsContent value="dados" className="space-y-5 mt-4">
              {/* Dados do Cliente */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Dados do Cliente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cliente Cadastrado</Label>
                    <Select value={clienteId || "none"} onValueChange={(v) => handleClienteChange(v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {clientes.map((cliente) => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do Cliente *</Label>
                    <Input
                      value={clienteNome}
                      onChange={(e) => setClienteNome(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={clienteTelefone}
                      onChange={(e) => setClienteTelefone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={clienteEmail}
                      onChange={(e) => setClienteEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Configurações */}
              <div className="space-y-2">
                <Label>Validade (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  className="max-w-xs"
                  value={validadeDias}
                  onChange={(e) => setValidadeDias(parseInt(e.target.value) || 30)}
                />
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Termos e Condições</Label>
                <Textarea
                  value={termosCondicoes}
                  onChange={(e) => setTermosCondicoes(e.target.value)}
                  placeholder="Termos e condições do orçamento..."
                  rows={3}
                />
              </div>
            </TabsContent>

            {/* ABA: Itens */}
            <TabsContent value="itens" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Itens do Orçamento</h3>
                <Button type="button" variant="outline" size="sm" onClick={adicionarItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Item
                </Button>
              </div>

              {itens.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                </p>
              ) : (
                <div className="space-y-3">
                  {itens.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3 space-y-3">
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
                              <SelectItem value="produto">Produto</SelectItem>
                              <SelectItem value="servico">Serviço</SelectItem>
                              <SelectItem value="dispositivo">Dispositivo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <Label className="text-xs text-muted-foreground">Descrição</Label>
                          <Input
                            value={item.descricao}
                            onChange={(e) => atualizarItem(item.id, "descricao", e.target.value)}
                            placeholder="Descrição do item"
                            required
                          />
                        </div>
                      </div>

                      {/* Linha 2: Qtd + Valor Unit. + Total + Excluir */}
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 items-end">
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
                          <Label className="text-xs text-muted-foreground">Valor Unit. (R$)</Label>
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
                            className="bg-muted font-medium"
                          />
                        </div>
                        <div className="flex items-end justify-end sm:justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removerItem(item.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Totais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div className="space-y-2">
                  <Label>Subtotal</Label>
                  <Input value={formatCurrency(subtotal)} disabled className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Desconto (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={desconto}
                    onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Total</Label>
                  <Input
                    value={formatCurrency(valorTotal)}
                    disabled
                    className="bg-background font-bold text-lg"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ABA: Checklist */}
            <TabsContent value="checklist" className="space-y-4 mt-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Checklist do Dispositivo</h3>
                <p className="text-sm text-muted-foreground">
                  Registre o estado do dispositivo na entrada e saída, igual ao checklist da Ordem de Serviço.
                </p>

                {/* Tipo de dispositivo */}
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

                {/* Componente de checklist idêntico ao da OS */}
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

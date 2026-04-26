import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  FileText,
  Info,
  ChevronDown,
  ChevronUp,
  Eye,
  Settings,
  Palette,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import {
  TermoResponsabilidadeConfig,
  SecaoTermoResponsabilidade,
  ClausulaTermoResponsabilidade,
} from "@/types/configuracao-loja";
import {
  TERMO_RESPONSABILIDADE_PADRAO,
  VARIAVEIS_TERMO_RESPONSABILIDADE,
  gerarIdUnico,
  formatarTextoComVariaveis,
} from "@/lib/termo-responsabilidade-utils";

interface DialogConfiguracaoTermoResponsabilidadeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export function DialogConfiguracaoTermoResponsabilidade({
  open,
  onOpenChange,
  onSave,
}: DialogConfiguracaoTermoResponsabilidadeProps) {
  const { config, atualizarConfiguracao, refetch } = useConfiguracaoLoja();
  const [salvando, setSalvando] = useState(false);
  const [termo, setTermo] = useState<TermoResponsabilidadeConfig>(TERMO_RESPONSABILIDADE_PADRAO);
  const [editandoClausula, setEditandoClausula] = useState<{
    secaoId: string;
    clausulaId: string;
  } | null>(null);
  const [textoEditando, setTextoEditando] = useState("");
  const [secoesAbertas, setSecoesAbertas] = useState<string[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<string>("configuracao");

  useEffect(() => {
    if (open && config) {
      const termoConfig = config.termo_responsabilidade_config as TermoResponsabilidadeConfig | undefined;
      if (termoConfig) {
        setTermo(termoConfig);
        setSecoesAbertas(termoConfig.secoes.map((s) => s.id));
      } else {
        setTermo(TERMO_RESPONSABILIDADE_PADRAO);
        setSecoesAbertas(TERMO_RESPONSABILIDADE_PADRAO.secoes.map((s) => s.id));
      }
    }
  }, [open, config]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const sucesso = await atualizarConfiguracao({
        termo_responsabilidade_config: termo,
      });
      if (sucesso) {
        await refetch(); // Força atualização do cache
        toast.success("Termo de responsabilidade salvo com sucesso!");
        onSave?.();
        onOpenChange(false);
      } else {
        toast.error("Erro ao salvar termo de responsabilidade");
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar termo de responsabilidade");
    } finally {
      setSalvando(false);
    }
  };

  const handleRestaurarPadrao = () => {
    setTermo(TERMO_RESPONSABILIDADE_PADRAO);
    setSecoesAbertas(TERMO_RESPONSABILIDADE_PADRAO.secoes.map((s) => s.id));
    toast.info("Termo restaurado para o padrão");
  };

  const handleAdicionarSecao = () => {
    const novaSecao: SecaoTermoResponsabilidade = {
      id: gerarIdUnico(),
      titulo: "Nova Seção",
      clausulas: [],
    };
    setTermo((prev) => ({
      ...prev,
      secoes: [...prev.secoes, novaSecao],
    }));
    setSecoesAbertas((prev) => [...prev, novaSecao.id]);
  };

  const handleRemoverSecao = (secaoId: string) => {
    setTermo((prev) => ({
      ...prev,
      secoes: prev.secoes.filter((s) => s.id !== secaoId),
    }));
  };

  const handleAtualizarTituloSecao = (secaoId: string, titulo: string) => {
    setTermo((prev) => ({
      ...prev,
      secoes: prev.secoes.map((s) =>
        s.id === secaoId ? { ...s, titulo } : s
      ),
    }));
  };

  const handleAdicionarClausula = (secaoId: string) => {
    const novaClausula: ClausulaTermoResponsabilidade = {
      id: gerarIdUnico(),
      texto: "Nova cláusula",
      ativo: true,
    };
    setTermo((prev) => ({
      ...prev,
      secoes: prev.secoes.map((s) =>
        s.id === secaoId
          ? { ...s, clausulas: [...s.clausulas, novaClausula] }
          : s
      ),
    }));
    setEditandoClausula({ secaoId, clausulaId: novaClausula.id });
    setTextoEditando("Nova cláusula");
  };

  const handleRemoverClausula = (secaoId: string, clausulaId: string) => {
    setTermo((prev) => ({
      ...prev,
      secoes: prev.secoes.map((s) =>
        s.id === secaoId
          ? { ...s, clausulas: s.clausulas.filter((c) => c.id !== clausulaId) }
          : s
      ),
    }));
  };

  const handleToggleClausula = (secaoId: string, clausulaId: string) => {
    setTermo((prev) => ({
      ...prev,
      secoes: prev.secoes.map((s) =>
        s.id === secaoId
          ? {
              ...s,
              clausulas: s.clausulas.map((c) =>
                c.id === clausulaId ? { ...c, ativo: !c.ativo } : c
              ),
            }
          : s
      ),
    }));
  };

  const handleIniciarEdicao = (secaoId: string, clausula: ClausulaTermoResponsabilidade) => {
    setEditandoClausula({ secaoId, clausulaId: clausula.id });
    setTextoEditando(clausula.texto);
  };

  const handleSalvarEdicao = () => {
    if (!editandoClausula) return;
    setTermo((prev) => ({
      ...prev,
      secoes: prev.secoes.map((s) =>
        s.id === editandoClausula.secaoId
          ? {
              ...s,
              clausulas: s.clausulas.map((c) =>
                c.id === editandoClausula.clausulaId
                  ? { ...c, texto: textoEditando }
                  : c
              ),
            }
          : s
      ),
    }));
    setEditandoClausula(null);
    setTextoEditando("");
  };

  const toggleSecao = (secaoId: string) => {
    setSecoesAbertas((prev) =>
      prev.includes(secaoId)
        ? prev.filter((id) => id !== secaoId)
        : [...prev, secaoId]
    );
  };

  // Dados de exemplo para o preview
  const dadosExemplo = {
    cliente: "João da Silva",
    telefone: "(11) 99999-9999",
    dispositivo: "Celular",
    marca: "Apple",
    modelo: "iPhone 14 Pro",
    defeito: "Não carrega e a tela está quebrada",
    loja: config?.nome_loja || "Minha Loja",
    numero_os: "OS-00001",
    data: new Date().toLocaleDateString("pt-BR"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Configurar Termo de Responsabilidade
          </DialogTitle>
        </DialogHeader>

        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="configuracao" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="configuracao" className="flex-1 mt-4 min-h-0">
            <ScrollArea className="h-[calc(70vh-180px)] pr-4">
              <div className="space-y-6 pb-4">
                {/* Ativar Termo */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={termo.ativo}
                      onCheckedChange={(checked) =>
                        setTermo((prev) => ({ ...prev, ativo: checked }))
                      }
                    />
                    <div>
                      <Label className="text-base font-medium">
                        Ativar Termo de Responsabilidade
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Permite imprimir termo separado para cada OS
                      </p>
                    </div>
                  </div>
                </div>

                {termo.ativo && (
                  <>
                    {/* Título */}
                    <div className="space-y-2">
                      <Label>Título do Termo</Label>
                      <Input
                        value={termo.titulo}
                        onChange={(e) =>
                          setTermo((prev) => ({ ...prev, titulo: e.target.value }))
                        }
                        placeholder="TERMO DE ENTRADA E RESPONSABILIDADE"
                      />
                    </div>

                    {/* Introdução */}
                    <div className="space-y-2">
                      <Label>Introdução</Label>
                      <Textarea
                        value={termo.introducao || ""}
                        onChange={(e) =>
                          setTermo((prev) => ({ ...prev, introducao: e.target.value }))
                        }
                        placeholder="O cliente declara estar ciente e de acordo que:"
                        rows={2}
                      />
                    </div>

                    {/* Seções e Cláusulas */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base">Seções e Cláusulas</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAdicionarSecao}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar Seção
                        </Button>
                      </div>

                      {termo.secoes.map((secao) => (
                        <Card key={secao.id}>
                          <Collapsible
                            open={secoesAbertas.includes(secao.id)}
                            onOpenChange={() => toggleSecao(secao.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center gap-2">
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="p-1">
                                    {secoesAbertas.includes(secao.id) ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                                <Input
                                  value={secao.titulo}
                                  onChange={(e) =>
                                    handleAtualizarTituloSecao(secao.id, e.target.value)
                                  }
                                  placeholder="Título da seção (opcional)"
                                  className="flex-1 h-8"
                                />
                                <Badge variant="secondary">
                                  {secao.clausulas.filter((c) => c.ativo).length}/
                                  {secao.clausulas.length}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleRemoverSecao(secao.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardHeader>

                            <CollapsibleContent>
                              <CardContent className="pt-2 space-y-2">
                                {secao.clausulas.map((clausula) => (
                                  <div
                                    key={clausula.id}
                                    className="flex items-start gap-2 p-2 border rounded-md bg-muted/20"
                                  >
                                    <Checkbox
                                      checked={clausula.ativo}
                                      onCheckedChange={() =>
                                        handleToggleClausula(secao.id, clausula.id)
                                      }
                                      className="mt-1"
                                    />
                                    {editandoClausula?.clausulaId === clausula.id ? (
                                      <div className="flex-1 space-y-2">
                                        <Textarea
                                          value={textoEditando}
                                          onChange={(e) => setTextoEditando(e.target.value)}
                                          rows={3}
                                          autoFocus
                                        />
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={handleSalvarEdicao}
                                          >
                                            Salvar
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              setEditandoClausula(null);
                                              setTextoEditando("");
                                            }}
                                          >
                                            Cancelar
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <p
                                          className={`flex-1 text-sm ${
                                            !clausula.ativo
                                              ? "text-muted-foreground line-through"
                                              : ""
                                          }`}
                                        >
                                          {clausula.texto}
                                        </p>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          onClick={() =>
                                            handleIniciarEdicao(secao.id, clausula)
                                          }
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                          onClick={() =>
                                            handleRemoverClausula(secao.id, clausula.id)
                                          }
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                ))}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleAdicionarClausula(secao.id)}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Adicionar Cláusula
                                </Button>
                              </CardContent>
                            </CollapsibleContent>
                          </Collapsible>
                        </Card>
                      ))}
                    </div>

                    {/* Declaração Final */}
                    <div className="space-y-2">
                      <Label>Declaração Final</Label>
                      <Textarea
                        value={termo.declaracao_final || ""}
                        onChange={(e) =>
                          setTermo((prev) => ({
                            ...prev,
                            declaracao_final: e.target.value,
                          }))
                        }
                        placeholder="Declaro que li, compreendi e concordo integralmente com os termos acima."
                        rows={2}
                      />
                    </div>

                    {/* Opções de Exibição */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">
                          Opções de Exibição
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">
                            Exibir junto com a impressão da OS
                          </Label>
                          <Switch
                            checked={termo.exibir_na_impressao_os}
                            onCheckedChange={(checked) =>
                              setTermo((prev) => ({
                                ...prev,
                                exibir_na_impressao_os: checked,
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">
                            Permitir impressão separada do termo
                          </Label>
                          <Switch
                            checked={termo.imprimir_separado}
                            onCheckedChange={(checked) =>
                              setTermo((prev) => ({
                                ...prev,
                                imprimir_separado: checked,
                              }))
                            }
                          />
                        </div>
                        
                        {/* Seletor de Cor */}
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Palette className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-sm font-medium">Cor do Termo</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={termo.cor_primaria || "#6B21A8"}
                              onChange={(e) =>
                                setTermo((prev) => ({
                                  ...prev,
                                  cor_primaria: e.target.value,
                                }))
                              }
                              className="w-10 h-10 rounded cursor-pointer border-2 border-muted"
                            />
                            <Input
                              value={termo.cor_primaria || "#6B21A8"}
                              onChange={(e) =>
                                setTermo((prev) => ({
                                  ...prev,
                                  cor_primaria: e.target.value,
                                }))
                              }
                              placeholder="#6B21A8"
                              className="w-28 font-mono text-sm"
                            />
                            <div className="flex flex-wrap gap-1">
                              {[
                                // Roxos
                                "#6B21A8", "#7C3AED", "#8B5CF6", "#A855F7",
                                // Azuis
                                "#1E40AF", "#2563EB", "#3B82F6", "#0EA5E9",
                                // Verdes
                                "#047857", "#059669", "#10B981", "#14B8A6",
                                // Vermelhos/Rosas
                                "#B91C1C", "#DC2626", "#E11D48", "#DB2777",
                                // Laranjas/Amarelos
                                "#B45309", "#D97706", "#F59E0B", "#EAB308",
                                // Neutros
                                "#0F172A", "#374151", "#4B5563", "#6B7280",
                              ].map((cor) => (
                                <button
                                  key={cor}
                                  type="button"
                                  onClick={() => setTermo((prev) => ({ ...prev, cor_primaria: cor }))}
                                  className={`w-6 h-6 rounded border-2 hover:scale-110 transition-transform ${
                                    termo.cor_primaria === cor ? "border-foreground ring-2 ring-offset-1 ring-foreground/50" : "border-muted"
                                  }`}
                                  style={{ backgroundColor: cor }}
                                  title={cor}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Esta cor será usada no título, bordas e destaques do termo impresso.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Variáveis Disponíveis */}
                    <div className="p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Variáveis disponíveis
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {VARIAVEIS_TERMO_RESPONSABILIDADE.map((v) => (
                          <Badge
                            key={v.variavel}
                            variant="outline"
                            className="cursor-pointer hover:bg-muted"
                            title={v.descricao}
                          >
                            {v.variavel}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 mt-4 min-h-0">
            <ScrollArea className="h-[calc(70vh-180px)]">
              <div className="bg-white dark:bg-gray-900 border rounded-lg p-6 shadow-sm">
                {/* Preview do Termo */}
                <div className="termo-preview space-y-4">
                  {/* Cabeçalho da Loja */}
                  <div 
                    className="text-center space-y-1 pb-4 border-b-2"
                    style={{ borderColor: termo.cor_primaria || "#6B21A8" }}
                  >
                    {config?.logo_url && (
                      <img
                        src={config.logo_url}
                        alt="Logo"
                        className="h-16 mx-auto mb-2 object-contain"
                      />
                    )}
                    <h2 
                      className="text-lg font-bold"
                      style={{ color: termo.cor_primaria || "#6B21A8" }}
                    >
                      {config?.nome_loja || "Nome da Loja"}
                    </h2>
                    {config?.razao_social && (
                      <p className="text-xs text-muted-foreground">
                        {config.razao_social}
                        {config.cnpj && ` - CNPJ: ${config.cnpj}`}
                      </p>
                    )}
                    {(config?.logradouro || config?.endereco) && (
                      <p className="text-xs text-muted-foreground">
                        {config.logradouro
                          ? `${config.logradouro}${config.numero ? `, ${config.numero}` : ""}${config.bairro ? ` - ${config.bairro}` : ""}${config.cidade ? ` - ${config.cidade}/${config.estado}` : ""}`
                          : config.endereco}
                      </p>
                    )}
                    {(config?.telefone || config?.whatsapp) && (
                      <p className="text-xs text-muted-foreground">
                        {config.telefone && `Tel: ${config.telefone}`}
                        {config.telefone && config.whatsapp && " | "}
                        {config.whatsapp && `WhatsApp: ${config.whatsapp}`}
                      </p>
                    )}
                  </div>

                  {/* Título do Termo */}
                  <div className="text-center py-3">
                    <h1 
                      className="text-base font-bold uppercase tracking-wide"
                      style={{ color: termo.cor_primaria || "#6B21A8" }}
                    >
                      {termo.titulo}
                    </h1>
                  </div>

                  {/* Dados do Cliente e Dispositivo */}
                  <div className="grid grid-cols-2 gap-2 text-sm border rounded-lg p-3 bg-muted/20">
                    <div>
                      <span className="font-medium">Cliente:</span>{" "}
                      <span className="text-muted-foreground">{dadosExemplo.cliente}</span>
                    </div>
                    <div>
                      <span className="font-medium">Telefone:</span>{" "}
                      <span className="text-muted-foreground">{dadosExemplo.telefone}</span>
                    </div>
                    <div>
                      <span className="font-medium">Aparelho:</span>{" "}
                      <span className="text-muted-foreground">{dadosExemplo.dispositivo}</span>
                    </div>
                    <div>
                      <span className="font-medium">Marca/Modelo:</span>{" "}
                      <span className="text-muted-foreground">
                        {dadosExemplo.marca} {dadosExemplo.modelo}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">Defeito informado:</span>{" "}
                      <span className="text-muted-foreground">{dadosExemplo.defeito}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">OS Nº:</span>{" "}
                      <span className="text-muted-foreground">{dadosExemplo.numero_os}</span>
                    </div>
                  </div>

                  {/* Introdução */}
                  {termo.introducao && (
                    <p className="text-sm font-medium mt-4">
                      {formatarTextoComVariaveis(termo.introducao, dadosExemplo)}
                    </p>
                  )}

                  {/* Seções e Cláusulas */}
                  {termo.secoes.map((secao) => {
                    const clausulasAtivas = secao.clausulas.filter((c) => c.ativo);
                    if (clausulasAtivas.length === 0) return null;

                    return (
                      <div key={secao.id} className="space-y-2">
                        {secao.titulo && (
                          <h3 
                            className="font-bold text-sm mt-4"
                            style={{ color: termo.cor_primaria || "#6B21A8" }}
                          >
                            {secao.titulo}
                          </h3>
                        )}
                        <div className="space-y-1.5">
                          {clausulasAtivas.map((clausula) => (
                            <div
                              key={clausula.id}
                              className="flex items-start gap-2 text-sm"
                            >
                              <div 
                                className="w-3.5 h-3.5 border rounded-sm flex-shrink-0 mt-0.5" 
                                style={{ borderColor: termo.cor_primaria || "#6B21A8" }}
                              />
                              <p className="flex-1 text-muted-foreground">
                                {formatarTextoComVariaveis(clausula.texto, dadosExemplo)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Declaração Final */}
                  {termo.declaracao_final && (
                    <div className="mt-6 pt-4 border-t">
                      <p className="text-sm text-center font-medium">
                        {formatarTextoComVariaveis(termo.declaracao_final, dadosExemplo)}
                      </p>
                    </div>
                  )}

                  {/* Área de Assinatura */}
                  <div className="mt-8 pt-4 space-y-6">
                    <div className="flex justify-between items-end gap-8">
                      <div className="flex-1 text-center">
                        <p className="text-sm text-muted-foreground mb-1">
                          Data: {dadosExemplo.data}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-64 border-b border-gray-400" />
                      <p className="text-xs text-muted-foreground">
                        Assinatura do Cliente
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Aviso */}
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground text-center">
                  <Info className="h-3 w-3 inline mr-1" />
                  Este é um preview com dados de exemplo. Os valores reais serão
                  preenchidos automaticamente com os dados de cada OS.
                </p>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleRestaurarPadrao}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Restaurar Padrão
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

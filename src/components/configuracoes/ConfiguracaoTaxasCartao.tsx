import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, CreditCard, Edit2, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useTaxasCartao, TaxaCartao } from "@/hooks/useTaxasCartao";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const BANDEIRAS_SUGERIDAS = ["Visa", "Mastercard", "Elo", "Hipercard", "Amex", "Diners"];
const PARCELAS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function ConfiguracaoTaxasCartao() {
  const { taxas, loading, criarTaxa, atualizarTaxa, excluirTaxa } = useTaxasCartao();
  const [novaBandeira, setNovaBandeira] = useState("");
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    taxa_debito: number;
    taxa_credito: number;
    taxas_parcelado: Record<string, number>;
  }>({ taxa_debito: 0, taxa_credito: 0, taxas_parcelado: {} });

  const handleCriar = async () => {
    if (!novaBandeira.trim()) {
      toast.error("Informe o nome da bandeira");
      return;
    }

    setCriando(true);
    const sucesso = await criarTaxa({
      bandeira: novaBandeira.trim(),
      taxa_debito: 0,
      taxa_credito: 0,
      taxas_parcelado: {},
      ativo: true,
    });

    if (sucesso) {
      toast.success(`Bandeira "${novaBandeira.trim()}" adicionada!`);
      setNovaBandeira("");
    } else {
      toast.error("Erro ao adicionar bandeira");
    }
    setCriando(false);
  };

  const iniciarEdicao = (taxa: TaxaCartao) => {
    setEditandoId(taxa.id);
    setEditForm({
      taxa_debito: taxa.taxa_debito,
      taxa_credito: taxa.taxa_credito,
      taxas_parcelado: { ...taxa.taxas_parcelado },
    });
  };

  const salvarEdicao = async (id: string) => {
    const sucesso = await atualizarTaxa(id, editForm);
    if (sucesso) {
      toast.success("Taxas atualizadas!");
      setEditandoId(null);
    } else {
      toast.error("Erro ao atualizar taxas");
    }
  };

  const handleExcluir = async (id: string) => {
    const sucesso = await excluirTaxa(id);
    if (sucesso) {
      toast.success("Bandeira removida");
    } else {
      toast.error("Erro ao remover bandeira");
    }
  };

  const handleToggleAtivo = async (taxa: TaxaCartao) => {
    await atualizarTaxa(taxa.id, { ativo: !taxa.ativo });
  };

  if (loading) {
    return <p className="text-center text-muted-foreground py-4">Carregando...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-5 w-5" />
          Taxas de Cartão
        </CardTitle>
        <CardDescription>
          Cadastre as bandeiras e suas taxas por tipo de pagamento. As taxas serão descontadas automaticamente no financeiro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Adicionar nova bandeira */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-sm">Nova Bandeira</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Visa, Mastercard..."
                value={novaBandeira}
                onChange={(e) => setNovaBandeira(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCriar()}
                list="bandeiras-sugeridas"
              />
              <datalist id="bandeiras-sugeridas">
                {BANDEIRAS_SUGERIDAS.filter(
                  (b) => !taxas.some((t) => t.bandeira.toLowerCase() === b.toLowerCase())
                ).map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
              <Button onClick={handleCriar} disabled={criando} size="sm" className="shrink-0">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>

        {taxas.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma bandeira cadastrada</p>
            <p className="text-xs mt-1">Adicione uma bandeira para configurar as taxas</p>
          </div>
        )}

        {/* Lista de bandeiras */}
        <Accordion type="single" collapsible className="space-y-2">
          {taxas.map((taxa) => {
            const isEditando = editandoId === taxa.id;

            return (
              <AccordionItem key={taxa.id} value={taxa.id} className="border rounded-lg px-4">
                <div className="flex items-center justify-between py-3">
                  <AccordionTrigger className="flex-1 hover:no-underline p-0 [&>svg]:hidden">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{taxa.bandeira}</span>
                      {!taxa.ativo && (
                        <Badge variant="secondary" className="text-xs">Inativa</Badge>
                      )}
                      {taxa.ativo && taxa.taxa_debito > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Déb: {taxa.taxa_debito}%
                        </Badge>
                      )}
                      {taxa.ativo && taxa.taxa_credito > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Créd: {taxa.taxa_credito}%
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <div className="flex items-center gap-2 ml-2">
                    <Switch
                      checked={taxa.ativo}
                      onCheckedChange={() => handleToggleAtivo(taxa)}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir bandeira</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir a bandeira "{taxa.bandeira}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleExcluir(taxa.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    {!isEditando ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Taxa Débito</Label>
                            <p className="text-sm font-medium">{taxa.taxa_debito}%</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Taxa Crédito à Vista</Label>
                            <p className="text-sm font-medium">{taxa.taxa_credito}%</p>
                          </div>
                        </div>
                        {Object.keys(taxa.taxas_parcelado).length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground mb-2 block">Taxas Parcelado</Label>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {PARCELAS.filter((p) => taxa.taxas_parcelado[String(p)] !== undefined).map((p) => (
                                <div key={p} className="text-sm">
                                  <span className="text-muted-foreground">{p}x:</span>{" "}
                                  <span className="font-medium">{taxa.taxas_parcelado[String(p)]}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <Button variant="outline" size="sm" onClick={() => iniciarEdicao(taxa)}>
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          Editar Taxas
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Taxa Débito (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={editForm.taxa_debito}
                              onChange={(e) =>
                                setEditForm({ ...editForm, taxa_debito: Number(e.target.value) })
                              }
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Taxa Crédito à Vista (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={editForm.taxa_credito}
                              onChange={(e) =>
                                setEditForm({ ...editForm, taxa_credito: Number(e.target.value) })
                              }
                              className="h-8"
                            />
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Taxas por Parcela (%)</Label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {PARCELAS.map((p) => (
                              <div key={p} className="flex items-center gap-2">
                                <Label className="text-xs w-8 shrink-0">{p}x:</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  placeholder="0"
                                  value={editForm.taxas_parcelado[String(p)] ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const novas = { ...editForm.taxas_parcelado };
                                    if (val === "" || val === "0") {
                                      delete novas[String(p)];
                                    } else {
                                      novas[String(p)] = Number(val);
                                    }
                                    setEditForm({ ...editForm, taxas_parcelado: novas });
                                  }}
                                  className="h-8"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => salvarEdicao(taxa.id)}>
                            <Save className="h-3.5 w-3.5 mr-1" />
                            Salvar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditandoId(null)}>
                            <X className="h-3.5 w-3.5 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}

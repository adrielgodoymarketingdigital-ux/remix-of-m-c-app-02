import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { UploadFotosOS } from "../UploadFotosOS";
import { SenhaDesbloqueio } from "../SenhaDesbloqueio";
import { ChecklistDispositivo } from "../ChecklistDispositivo";
import { MarcacaoAvarias } from "../MarcacaoAvarias";
import { CampoLabel } from "./CampoLabel";
import { ComboboxComTextoLivre } from "./ComboboxComTextoLivre";
import { useCatalogoDispositivosCustom } from "@/hooks/useCatalogoDispositivosCustom";
import { OPCAO_OUTRA, OPCAO_OUTRO_MODELO, OPCAO_OUTRA_COR, TIPOS_DISPOSITIVO_OS } from "@/data/catalogoDispositivos";
import { opcoesCatalogoDispositivo } from "@/lib/ordemServico/opcoesCatalogoDispositivo";
import { DispositivoAdicionalForm, validarDispositivosAdicionais } from "@/lib/ordemServico/gravacaoDispositivosAdicionaisOS";
import { aoMudarMarcaAdicional, aoMudarTipoAdicional } from "@/lib/ordemServico/formularioDispositivosAdicionaisOS";

interface EditorDispositivoAdicionalProps {
  /** Aparelho em edição (novo já vem com o id gerado); null = fechado. */
  aparelho: DispositivoAdicionalForm | null;
  /** "Dispositivo 2" etc. */
  titulo: string;
  onSalvar: (aparelho: DispositivoAdicionalForm) => void;
  onCancelar: () => void;
}

/**
 * Formulário de UM aparelho adicional da OS, com os mesmos campos e componentes
 * do aparelho 1 (tipo, marca, modelo e cor pelo catálogo; fotos; senha;
 * checklist e avarias) mais defeito e observações próprios. Tipo, marca e
 * modelo obrigatórios; defeito opcional. Nada é gravado aqui: o aparelho volta
 * para o assistente e só vai ao banco ao salvar a OS.
 */
export function EditorDispositivoAdicional({ aparelho, titulo, onSalvar, onCancelar }: EditorDispositivoAdicionalProps) {
  const [rascunho, setRascunho] = useState<DispositivoAdicionalForm | null>(aparelho);
  const [aba, setAba] = useState("dados");
  const [camposComErro, setCamposComErro] = useState<string[]>([]);

  useEffect(() => {
    setRascunho(aparelho);
    setAba("dados");
    setCamposComErro([]);
  }, [aparelho]);

  const { getTiposCustom, getMarcasCustom, getModelosCustom, getCoresCustom } = useCatalogoDispositivosCustom();

  const d = rascunho;
  const tiposCustom = getTiposCustom();
  const opcoes = opcoesCatalogoDispositivo(d?.dispositivo_tipo ?? "", d?.dispositivo_marca ?? "", {
    marcas: d ? getMarcasCustom(d.dispositivo_tipo).map((r) => r.nome) : [],
    modelos: d ? getModelosCustom(d.dispositivo_tipo, d.dispositivo_marca).map((r) => r.nome) : [],
    cores: d ? getCoresCustom(d.dispositivo_tipo, d.dispositivo_marca).map((r) => r.nome) : [],
  });

  const alterar = (parcial: Partial<DispositivoAdicionalForm>) => setRascunho((atual) => (atual ? { ...atual, ...parcial } : atual));
  const erro = (campo: string) => camposComErro.includes(campo);

  const salvar = () => {
    if (!d) return;
    const erros = validarDispositivosAdicionais([d]).filter((e) => e.indice === 0);
    if (erros.length > 0) {
      setCamposComErro(erros.map((e) => e.campo));
      setAba("dados");
      return;
    }
    onSalvar(d);
  };

  return (
    <Dialog open={!!aparelho} onOpenChange={(aberto) => { if (!aberto) onCancelar(); }}>
      <DialogContent className="p-0 gap-0 flex flex-col overflow-hidden sm:max-w-2xl sm:h-[85vh]" data-editor-dispositivo-adicional>
        <DialogHeader className="shrink-0 px-4 pt-4 pb-3 sm:px-6 sm:pt-6 border-b text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4" />
            {titulo}
          </DialogTitle>
          <DialogDescription>Dados, fotos, senha, checklist e defeito deste aparelho.</DialogDescription>
        </DialogHeader>

        {d && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 text-sm">
            <Tabs value={aba} onValueChange={setAba}>
              <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 rounded-xl p-1">
                <TabsTrigger value="dados" className="rounded-lg">Dados</TabsTrigger>
                <TabsTrigger value="fotos" className="rounded-lg">Fotos</TabsTrigger>
                <TabsTrigger value="senha" className="rounded-lg">Senha</TabsTrigger>
                <TabsTrigger value="checklist" className="rounded-lg">Checklist e avarias</TabsTrigger>
                <TabsTrigger value="defeito" className="rounded-lg">Defeito e observações</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="mt-5">
                {camposComErro.length > 0 && (
                  <p className="mb-4 text-sm text-destructive">Informe o tipo, a marca e o modelo do aparelho.</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
                  <div>
                    <CampoLabel htmlFor="adicionalTipo" texto="Tipo" obrigatorio />
                    <Select value={d.dispositivo_tipo} onValueChange={(tipo) => setRascunho(aoMudarTipoAdicional(d, tipo))}>
                      <SelectTrigger id="adicionalTipo" className={cn("h-10 rounded-xl", erro("dispositivo_tipo") && "border-destructive")}>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {tiposCustom.length > 0 && <SelectLabel>Cadastrados</SelectLabel>}
                          {TIPOS_DISPOSITIVO_OS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectGroup>
                        {tiposCustom.length > 0 && (
                          <>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel>Minhas (personalizadas)</SelectLabel>
                              {tiposCustom.map((t) => (
                                <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>
                              ))}
                            </SelectGroup>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <CampoLabel htmlFor="adicionalMarca" texto="Marca" obrigatorio />
                    {(opcoes.marcas.length > 0 || opcoes.marcasCustom.length > 0) ? (
                      <ComboboxComTextoLivre
                        id="adicionalMarca"
                        value={d.dispositivo_marca}
                        opcoes={opcoes.marcas}
                        opcoesCustom={opcoes.marcasCustom}
                        opcaoOutra={OPCAO_OUTRA}
                        placeholder="Selecione a marca"
                        buscaPlaceholder="Buscar marca..."
                        onChange={(marca) => setRascunho(aoMudarMarcaAdicional(d, marca))}
                        className="h-10 rounded-xl"
                        erro={erro("dispositivo_marca")}
                      />
                    ) : (
                      <Input
                        id="adicionalMarca"
                        value={d.dispositivo_marca}
                        onChange={(e) => alterar({ dispositivo_marca: e.target.value })}
                        className={cn("h-10 rounded-xl", erro("dispositivo_marca") && "border-destructive")}
                      />
                    )}
                  </div>

                  <div>
                    <CampoLabel htmlFor="adicionalModelo" texto="Modelo" obrigatorio />
                    {(opcoes.modelos.length > 0 || opcoes.modelosCustom.length > 0) ? (
                      <ComboboxComTextoLivre
                        id="adicionalModelo"
                        value={d.dispositivo_modelo}
                        opcoes={opcoes.modelos}
                        opcoesCustom={opcoes.modelosCustom}
                        opcaoOutra={OPCAO_OUTRO_MODELO}
                        placeholder="Selecione o modelo"
                        buscaPlaceholder="Buscar modelo..."
                        onChange={(modelo) => alterar({ dispositivo_modelo: modelo })}
                        className="h-10 rounded-xl"
                        erro={erro("dispositivo_modelo")}
                      />
                    ) : (
                      <Input
                        id="adicionalModelo"
                        value={d.dispositivo_modelo}
                        onChange={(e) => alterar({ dispositivo_modelo: e.target.value })}
                        className={cn("h-10 rounded-xl", erro("dispositivo_modelo") && "border-destructive")}
                      />
                    )}
                  </div>

                  <div>
                    <CampoLabel htmlFor="adicionalCor" texto="Cor" />
                    {(opcoes.cores.length > 0 || opcoes.coresCustom.length > 0) ? (
                      <ComboboxComTextoLivre
                        id="adicionalCor"
                        value={d.dispositivo_cor}
                        opcoes={opcoes.cores}
                        opcoesCustom={opcoes.coresCustom}
                        opcaoOutra={OPCAO_OUTRA_COR}
                        placeholder="Selecione a cor"
                        buscaPlaceholder="Buscar cor..."
                        onChange={(cor) => alterar({ dispositivo_cor: cor })}
                        className="h-10 rounded-xl"
                      />
                    ) : (
                      <Input
                        id="adicionalCor"
                        value={d.dispositivo_cor}
                        onChange={(e) => alterar({ dispositivo_cor: e.target.value })}
                        className="h-10 rounded-xl"
                      />
                    )}
                  </div>

                  <div>
                    <CampoLabel htmlFor="adicionalNumeroSerie" texto="Número de Série" />
                    <Input
                      id="adicionalNumeroSerie"
                      value={d.dispositivo_numero_serie}
                      onChange={(e) => alterar({ dispositivo_numero_serie: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </div>

                  <div>
                    <CampoLabel htmlFor="adicionalIMEI" texto="IMEI" />
                    <Input
                      id="adicionalIMEI"
                      value={d.dispositivo_imei}
                      onChange={(e) => alterar({ dispositivo_imei: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fotos" className="mt-5">
                <UploadFotosOS
                  fotos={d.fotos_dispositivo}
                  onFotosChange={(fotos) => alterar({ fotos_dispositivo: fotos })}
                  maxFotos={10}
                  removerDoArmazenamento={false}
                />
              </TabsContent>

              <TabsContent value="senha" className="mt-5">
                <SenhaDesbloqueio
                  value={d.senha_desbloqueio}
                  onChange={(senha) => alterar({ senha_desbloqueio: senha })}
                />
              </TabsContent>

              <TabsContent value="checklist" className="mt-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Checklist de Entrada e Saída</h4>
                    <ChecklistDispositivo
                      idPrefixo="editor-adicional-"
                      tipoDispositivo={d.dispositivo_tipo}
                      sistema={d.dispositivo_sistema}
                      fabricante={d.dispositivo_fabricante}
                      subtipo={d.dispositivo_subtipo}
                      value={d.checklist}
                      onChange={(checklist) => alterar({ checklist })}
                      onSistemaChange={(sistema) => alterar({ dispositivo_sistema: sistema })}
                      onFabricanteChange={(fabricante) => alterar({ dispositivo_fabricante: fabricante })}
                      onSubtipoChange={(subtipo) => alterar({ dispositivo_subtipo: subtipo })}
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Marcação de Avarias</h4>
                    <MarcacaoAvarias
                      tipoDispositivo={d.dispositivo_tipo}
                      value={d.avarias_visuais}
                      onChange={(avarias) => alterar({ avarias_visuais: avarias })}
                      subtipoRelogio={d.dispositivo_subtipo}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="defeito" className="mt-5 space-y-5">
                <div>
                  <CampoLabel htmlFor="adicionalDefeito" texto="Defeito Relatado" subtexto="Opcional." />
                  <Textarea
                    id="adicionalDefeito"
                    value={d.defeito_relatado}
                    onChange={(e) => alterar({ defeito_relatado: e.target.value })}
                    rows={3}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <CampoLabel htmlFor="adicionalObservacoes" texto="Observações" />
                  <Textarea
                    id="adicionalObservacoes"
                    value={d.observacoes}
                    onChange={(e) => alterar({ observacoes: e.target.value })}
                    rows={3}
                    className="rounded-xl"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <div className="shrink-0 px-4 py-3 sm:px-6 border-t flex justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancelar} className="sm:h-10 sm:px-4">
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={salvar} className="sm:h-10 sm:px-4">
            Salvar aparelho
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

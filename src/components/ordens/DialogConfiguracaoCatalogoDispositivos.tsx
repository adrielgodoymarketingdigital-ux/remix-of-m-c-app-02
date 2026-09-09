import { useState } from "react";
import { Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { TIPOS_DISPOSITIVO_OS, getMarcasPorTipo, getModelosPorMarca, getCoresPorMarca } from "@/data/catalogoDispositivos";
import { useCatalogoDispositivosCustom } from "@/hooks/useCatalogoDispositivosCustom";
import { GerenciadorCatalogoCustomNivel } from "./catalogo-dispositivos-custom/GerenciadorCatalogoCustomNivel";

interface DialogConfiguracaoCatalogoDispositivosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Seletor de "Tipo" reaproveitado nas abas Marcas/Modelos/Cores: mistura os
 * tipos fixos com os personalizados da loja, igual ao Select da criação de OS.
 */
function SeletorTipoEscopo({ value, onChange, tiposCustom }: {
  value: string;
  onChange: (value: string) => void;
  tiposCustom: { id: string; nome: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9">
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
  );
}

export function DialogConfiguracaoCatalogoDispositivos({ open, onOpenChange }: DialogConfiguracaoCatalogoDispositivosProps) {
  const { getTiposCustom, getMarcasCustom } = useCatalogoDispositivosCustom();
  const tiposCustom = getTiposCustom();

  const [tipoMarcas, setTipoMarcas] = useState("");
  const [tipoModelos, setTipoModelos] = useState("");
  const [marcaModelos, setMarcaModelos] = useState("");
  const [tipoCores, setTipoCores] = useState("");
  const [marcaCores, setMarcaCores] = useState("");

  const marcasDoTipoModelos = [
    ...getMarcasPorTipo(tipoModelos),
    ...getMarcasCustom(tipoModelos).map((r) => r.nome),
  ];
  const marcasDoTipoCores = [
    ...getMarcasPorTipo(tipoCores),
    ...getMarcasCustom(tipoCores).map((r) => r.nome),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Catálogo de Dispositivos
          </DialogTitle>
          <DialogDescription>
            Cadastre Tipos, Marcas, Modelos e Cores personalizados da sua loja — eles aparecem como opção na
            criação de OS junto com o catálogo padrão, e só pra você (não aparecem pra outras lojas).
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="tipos">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tipos">Tipos</TabsTrigger>
            <TabsTrigger value="marcas">Marcas</TabsTrigger>
            <TabsTrigger value="modelos">Modelos</TabsTrigger>
            <TabsTrigger value="cores">Cores</TabsTrigger>
          </TabsList>

          <TabsContent value="tipos" className="mt-4">
            <GerenciadorCatalogoCustomNivel
              nivel="tipo"
              nomesFixos={TIPOS_DISPOSITIVO_OS.map((t) => t.label)}
              placeholder="Ex: Drone, Caixa de Som..."
            />
          </TabsContent>

          <TabsContent value="marcas" className="mt-4 space-y-4">
            <div>
              <Label className="text-xs mb-1 block">Tipo</Label>
              <SeletorTipoEscopo value={tipoMarcas} onChange={setTipoMarcas} tiposCustom={tiposCustom} />
            </div>
            {tipoMarcas ? (
              <GerenciadorCatalogoCustomNivel
                nivel="marca"
                escopo={{ tipoValor: tipoMarcas }}
                nomesFixos={getMarcasPorTipo(tipoMarcas)}
                placeholder="Ex: DJI, Positivo..."
              />
            ) : (
              <p className="text-sm text-muted-foreground">Selecione um Tipo para gerenciar as Marcas dele.</p>
            )}
          </TabsContent>

          <TabsContent value="modelos" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Tipo</Label>
                <SeletorTipoEscopo
                  value={tipoModelos}
                  onChange={(v) => { setTipoModelos(v); setMarcaModelos(""); }}
                  tiposCustom={tiposCustom}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Marca</Label>
                <Select value={marcaModelos} onValueChange={setMarcaModelos} disabled={!tipoModelos}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione a marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {marcasDoTipoModelos.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {tipoModelos && marcaModelos ? (
              <GerenciadorCatalogoCustomNivel
                nivel="modelo"
                escopo={{ tipoValor: tipoModelos, marcaNome: marcaModelos }}
                nomesFixos={getModelosPorMarca(tipoModelos, marcaModelos)}
                placeholder="Ex: iPhone 18 Pro..."
              />
            ) : (
              <p className="text-sm text-muted-foreground">Selecione Tipo e Marca para gerenciar os Modelos.</p>
            )}
          </TabsContent>

          <TabsContent value="cores" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Tipo</Label>
                <SeletorTipoEscopo
                  value={tipoCores}
                  onChange={(v) => { setTipoCores(v); setMarcaCores(""); }}
                  tiposCustom={tiposCustom}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Marca</Label>
                <Select value={marcaCores} onValueChange={setMarcaCores} disabled={!tipoCores}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione a marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {marcasDoTipoCores.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {tipoCores && marcaCores ? (
              <GerenciadorCatalogoCustomNivel
                nivel="cor"
                escopo={{ tipoValor: tipoCores, marcaNome: marcaCores }}
                nomesFixos={getCoresPorMarca(tipoCores, marcaCores)}
                placeholder="Ex: Verde-oliva..."
              />
            ) : (
              <p className="text-sm text-muted-foreground">Selecione Tipo e Marca para gerenciar as Cores.</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

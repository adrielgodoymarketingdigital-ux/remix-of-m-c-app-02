import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { UploadFotosOS } from "../UploadFotosOS";
import { SenhaDesbloqueio } from "../SenhaDesbloqueio";
import { EtapaCabecalho } from "./EtapaCabecalho";
import { CampoLabel } from "./CampoLabel";
import { FormData } from "./tipos";

const CAMPOS_ERRO_SUB_ABA_DADOS = ["dispositivoTipo", "dispositivoMarca", "dispositivoModelo"];

interface EtapaDispositivoProps {
  formData: FormData;
  setFormData: (formData: FormData) => void;
  campoComErro: string | null;
}

export function EtapaDispositivo({ formData, setFormData, campoComErro }: EtapaDispositivoProps) {
  const [subAba, setSubAba] = useState("dados");

  // Se o erro de validação for de um campo da sub-aba "Dados", troca
  // automaticamente para ela — evita o campo destacado ficar escondido
  // numa sub-aba não visível.
  useEffect(() => {
    if (campoComErro && CAMPOS_ERRO_SUB_ABA_DADOS.includes(campoComErro)) {
      setSubAba("dados");
    }
  }, [campoComErro]);

  return (
    <div>
      <EtapaCabecalho
        icone={Smartphone}
        titulo="Dados do Dispositivo"
        descricao="Informe os detalhes do aparelho, fotos e senha de desbloqueio."
      />

      <Tabs value={subAba} onValueChange={setSubAba}>
        <TabsList className="grid w-full grid-cols-3 rounded-xl h-8">
          <TabsTrigger value="dados" className="rounded-lg text-xs">Dados</TabsTrigger>
          <TabsTrigger value="fotos" className="rounded-lg text-xs">Fotos</TabsTrigger>
          <TabsTrigger value="senha" className="rounded-lg text-xs">Senha</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-2">
            <div>
              <CampoLabel htmlFor="dispositivoTipo" texto="Tipo" obrigatorio />
              <Select
                value={formData.dispositivoTipo}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    dispositivoTipo: value,
                    dispositivoSistema: "",
                    dispositivoFabricante: "",
                    dispositivoSubtipo: "",
                    checklist: { entrada: {}, saida: {} },
                    avarias: []
                  })
                }
              >
                <SelectTrigger className={cn("h-8 rounded-xl text-xs", campoComErro === "dispositivoTipo" && "border-destructive")}>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Celular">Celular</SelectItem>
                  <SelectItem value="Tablet">Tablet</SelectItem>
                  <SelectItem value="Notebook">Notebook</SelectItem>
                  <SelectItem value="Computador">Computador</SelectItem>
                  <SelectItem value="Relogio_Smart">Relógio Smart</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <CampoLabel htmlFor="dispositivoCor" texto="Cor" />
              <Input
                id="dispositivoCor"
                value={formData.dispositivoCor}
                onChange={(e) =>
                  setFormData({ ...formData, dispositivoCor: e.target.value })
                }
                className="h-8 rounded-xl text-xs"
              />
            </div>

            <div>
              <CampoLabel htmlFor="dispositivoMarca" texto="Marca" obrigatorio />
              <Input
                id="dispositivoMarca"
                value={formData.dispositivoMarca}
                onChange={(e) =>
                  setFormData({ ...formData, dispositivoMarca: e.target.value })
                }
                className={cn("h-8 rounded-xl text-xs", campoComErro === "dispositivoMarca" && "border-destructive")}
              />
            </div>

            <div>
              <CampoLabel htmlFor="dispositivoModelo" texto="Modelo" obrigatorio />
              <Input
                id="dispositivoModelo"
                value={formData.dispositivoModelo}
                onChange={(e) =>
                  setFormData({ ...formData, dispositivoModelo: e.target.value })
                }
                className={cn("h-8 rounded-xl text-xs", campoComErro === "dispositivoModelo" && "border-destructive")}
              />
            </div>

            <div>
              <CampoLabel htmlFor="dispositivoNumeroSerie" texto="Número de Série" />
              <Input
                id="dispositivoNumeroSerie"
                value={formData.dispositivoNumeroSerie}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dispositivoNumeroSerie: e.target.value,
                  })
                }
                className="h-8 rounded-xl text-xs"
              />
            </div>

            <div>
              <CampoLabel htmlFor="dispositivoIMEI" texto="IMEI" />
              <Input
                id="dispositivoIMEI"
                value={formData.dispositivoIMEI}
                onChange={(e) =>
                  setFormData({ ...formData, dispositivoIMEI: e.target.value })
                }
                className="h-8 rounded-xl text-xs"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="fotos" className="mt-3">
          <UploadFotosOS
            fotos={formData.fotosDispositivo}
            onFotosChange={(fotos) => setFormData({ ...formData, fotosDispositivo: fotos })}
            maxFotos={10}
          />
        </TabsContent>

        <TabsContent value="senha" className="mt-3">
          <SenhaDesbloqueio
            value={formData.senhaDesbloqueio}
            onChange={(senha) => setFormData({ ...formData, senhaDesbloqueio: senha })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

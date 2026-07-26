import { UserRound, MessageCircle, Image } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EtapaCabecalho } from "./EtapaCabecalho";
import { CampoLabel } from "./CampoLabel";
import { DicaBox } from "./DicaBox";
import { FormData } from "./tipos";

interface EtapaOrigemClienteProps {
  formData: FormData;
  setFormData: (formData: FormData) => void;
}

export function EtapaOrigemCliente({ formData, setFormData }: EtapaOrigemClienteProps) {
  return (
    <div>
      <EtapaCabecalho
        icone={UserRound}
        titulo="Origem do Cliente"
        descricao="Informe de onde o cliente chegou até você."
      />

      <div>
        <CampoLabel htmlFor="origemCliente" texto="Canal de origem" subtexto="Selecione o canal pelo qual o cliente entrou em contato." />
        <Select
          value={formData.origemCliente}
          onValueChange={(v) => setFormData({ ...formData, origemCliente: v })}
        >
          <SelectTrigger id="origemCliente" className="h-12 rounded-xl">
            <MessageCircle className="h-4 w-4 text-primary shrink-0 mr-1" />
            <SelectValue placeholder="Selecionar canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="indicacao">Indicação</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-5">
        <CampoLabel htmlFor="tipoMidia" texto="Tipo de mídia" subtexto="Selecione o tipo de mídia utilizado." />
        <Select
          value={formData.tipoMidia}
          onValueChange={(v) => setFormData({ ...formData, tipoMidia: v })}
        >
          <SelectTrigger id="tipoMidia" className="h-12 rounded-xl">
            <Image className="h-4 w-4 text-primary shrink-0 mr-1" />
            <SelectValue placeholder="Selecionar tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anuncio">Anúncio (pago)</SelectItem>
            <SelectItem value="organico">Orgânico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DicaBox texto="Essas informações nos ajudam a entender melhor como seus clientes chegam até você." />
    </div>
  );
}

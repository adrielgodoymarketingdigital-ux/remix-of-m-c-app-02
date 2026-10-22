import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  avisosFiscaisCliente,
  avisosFiscaisItem,
  avisosFiscaisServico,
  type CamposFiscaisCliente as ValoresCliente,
  type CamposFiscaisItem as ValoresItem,
  type CamposFiscaisServico as ValoresServico,
  type IssRetidoForm,
  type TipoItemFiscal,
} from "@/lib/fiscal/dadosFiscais";
import { AvisoCampoFiscal, SecaoDadosFiscais } from "./SecaoDadosFiscais";
import { SeletorPerfilTributario } from "./SeletorPerfilTributario";

const algumPreenchido = (valores: object) => Object.values(valores).some((v) => String(v).trim() !== "");

/** Produtos, peças e dispositivos: NCM, CEST, unidade e perfil tributário. */
export function CamposFiscaisItem({
  valores,
  onChange,
  tiposPerfil,
}: {
  valores: ValoresItem;
  onChange: (valores: ValoresItem) => void;
  tiposPerfil: TipoItemFiscal[];
}) {
  const avisos = avisosFiscaisItem(valores);
  const alterar = (parcial: Partial<ValoresItem>) => onChange({ ...valores, ...parcial });
  return (
    <SecaoDadosFiscais preenchido={algumPreenchido(valores)}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="fiscal-ncm">NCM</Label>
          <Input id="fiscal-ncm" inputMode="numeric" placeholder="8517.13.00" value={valores.ncm}
            onChange={(e) => alterar({ ncm: e.target.value })} />
          <AvisoCampoFiscal texto={avisos.ncm} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fiscal-cest">CEST</Label>
          <Input id="fiscal-cest" inputMode="numeric" placeholder="21.053.00" value={valores.cest}
            onChange={(e) => alterar({ cest: e.target.value })} />
          <AvisoCampoFiscal texto={avisos.cest} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fiscal-unidade">Unidade</Label>
          <Input id="fiscal-unidade" placeholder="UN" value={valores.unidade}
            onChange={(e) => alterar({ unidade: e.target.value.toUpperCase() })} />
          <AvisoCampoFiscal texto={avisos.unidade} />
        </div>
      </div>
      <SeletorPerfilTributario id="fiscal-perfil" tipos={tiposPerfil} valor={valores.perfil_tributario_id}
        onChange={(perfil_tributario_id) => alterar({ perfil_tributario_id })} />
    </SecaoDadosFiscais>
  );
}

const SEM_INFORMACAO = "__nao_informado__";

/** Serviços: LC 116, código municipal, alíquota de ISS, ISS retido e perfil. */
export function CamposFiscaisServico({
  valores,
  onChange,
}: {
  valores: ValoresServico;
  onChange: (valores: ValoresServico) => void;
}) {
  const avisos = avisosFiscaisServico(valores);
  const alterar = (parcial: Partial<ValoresServico>) => onChange({ ...valores, ...parcial });
  return (
    <SecaoDadosFiscais preenchido={algumPreenchido(valores)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fiscal-lc116">Item da LC 116</Label>
          <Input id="fiscal-lc116" inputMode="decimal" placeholder="14.01" value={valores.codigo_lc116}
            onChange={(e) => alterar({ codigo_lc116: e.target.value })} />
          <AvisoCampoFiscal texto={avisos.codigo_lc116} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fiscal-codigo-municipal">Código municipal</Label>
          <Input id="fiscal-codigo-municipal" value={valores.codigo_municipal}
            onChange={(e) => alterar({ codigo_municipal: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fiscal-aliquota-iss">Alíquota de ISS (%)</Label>
          <Input id="fiscal-aliquota-iss" inputMode="decimal" placeholder="5,00" value={valores.aliquota_iss}
            onChange={(e) => alterar({ aliquota_iss: e.target.value })} />
          <AvisoCampoFiscal texto={avisos.aliquota_iss} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fiscal-iss-retido">ISS retido</Label>
          <Select value={valores.iss_retido === "" ? SEM_INFORMACAO : valores.iss_retido}
            onValueChange={(v) => alterar({ iss_retido: (v === SEM_INFORMACAO ? "" : v) as IssRetidoForm })}>
            <SelectTrigger id="fiscal-iss-retido"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_INFORMACAO}>Não informado</SelectItem>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <SeletorPerfilTributario id="fiscal-perfil" tipos={["servico"]} valor={valores.perfil_tributario_id}
        onChange={(perfil_tributario_id) => alterar({ perfil_tributario_id })} />
    </SecaoDadosFiscais>
  );
}

/** Clientes (destinatário da nota): e-mail, complemento e inscrição estadual. */
export function CamposFiscaisCliente({
  valores,
  onChange,
}: {
  valores: ValoresCliente;
  onChange: (valores: ValoresCliente) => void;
}) {
  const avisos = avisosFiscaisCliente(valores);
  const alterar = (parcial: Partial<ValoresCliente>) => onChange({ ...valores, ...parcial });
  return (
    <SecaoDadosFiscais preenchido={algumPreenchido(valores)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="fiscal-email">E-mail</Label>
          {/* type="text": type="email" faria o navegador barrar o envio, e o aviso não pode impedir salvar */}
          <Input id="fiscal-email" type="text" inputMode="email" autoComplete="off" placeholder="cliente@email.com" value={valores.email}
            onChange={(e) => alterar({ email: e.target.value })} />
          <AvisoCampoFiscal texto={avisos.email} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fiscal-complemento">Complemento</Label>
          <Input id="fiscal-complemento" placeholder="Sala 2, fundos..." value={valores.complemento}
            onChange={(e) => alterar({ complemento: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fiscal-ie">Inscrição estadual</Label>
          <Input id="fiscal-ie" value={valores.inscricao_estadual}
            onChange={(e) => alterar({ inscricao_estadual: e.target.value })} />
        </div>
      </div>
    </SecaoDadosFiscais>
  );
}

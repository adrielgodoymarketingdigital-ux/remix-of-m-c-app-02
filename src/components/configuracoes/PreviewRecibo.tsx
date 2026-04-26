import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";

interface PreviewReciboProps {
  configuracao: ConfiguracaoLoja | null;
}

export function PreviewRecibo({ configuracao }: PreviewReciboProps) {
  const CampoStatus = ({ preenchido, label }: { preenchido: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {preenchido ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive" />
      )}
      <span className={preenchido ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );

  if (!configuracao) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pré-visualização do Recibo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Pré-visualização do Recibo</span>
          <Badge variant="outline">Mockup</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cabeçalho da Loja */}
        <div className="border-b pb-4">
          <div className="flex items-start gap-4">
            {configuracao.logo_url && (
              <img
                src={configuracao.logo_url}
                alt="Logo"
                className="h-16 w-16 object-contain rounded"
              />
            )}
            <div className="flex-1 space-y-1">
              <h3 className="font-bold text-lg">
                {configuracao.nome_loja || "Nome da Loja"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {configuracao.razao_social || "Razão Social não informada"}
              </p>
              <p className="text-sm text-muted-foreground">
                CNPJ: {configuracao.cnpj || "Não informado"}
              </p>
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div>
          <h4 className="font-semibold mb-2">Endereço</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              {configuracao.logradouro || "Logradouro"}, {configuracao.numero || "Nº"}{" "}
              {configuracao.complemento && `- ${configuracao.complemento}`}
            </p>
            <p>
              {configuracao.bairro || "Bairro"} - {configuracao.cidade || "Cidade"}/{configuracao.estado || "UF"}
            </p>
            <p>CEP: {configuracao.cep || "00000-000"}</p>
          </div>
        </div>

        {/* Contatos */}
        <div>
          <h4 className="font-semibold mb-2">Contatos</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Tel: {configuracao.telefone || "Não informado"}</p>
            {configuracao.whatsapp && <p>WhatsApp: {configuracao.whatsapp}</p>}
            <p>Email: {configuracao.email || "Não informado"}</p>
            {configuracao.site && <p>Site: {configuracao.site}</p>}
          </div>
        </div>

        {/* Status dos Campos */}
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3">Status dos Campos Obrigatórios</h4>
          <div className="grid grid-cols-2 gap-2">
            <CampoStatus preenchido={!!configuracao.nome_loja} label="Nome da Loja" />
            <CampoStatus preenchido={!!configuracao.razao_social} label="Razão Social" />
            <CampoStatus preenchido={!!configuracao.cnpj} label="CNPJ" />
            <CampoStatus preenchido={!!configuracao.telefone} label="Telefone" />
            <CampoStatus preenchido={!!configuracao.email} label="E-mail" />
            <CampoStatus preenchido={!!configuracao.cep} label="CEP" />
            <CampoStatus preenchido={!!configuracao.logradouro} label="Logradouro" />
            <CampoStatus preenchido={!!configuracao.numero} label="Número" />
            <CampoStatus preenchido={!!configuracao.bairro} label="Bairro" />
            <CampoStatus preenchido={!!configuracao.cidade} label="Cidade" />
            <CampoStatus preenchido={!!configuracao.estado} label="Estado" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

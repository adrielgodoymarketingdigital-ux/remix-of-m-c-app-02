import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { useTranslation } from "react-i18next";

interface PreviewReciboProps {
  configuracao: ConfiguracaoLoja | null;
}

export function PreviewRecibo({ configuracao }: PreviewReciboProps) {
  // Textos: namespace "configuracoes" (previewRecibo.*). Endereço montado com a mesma pontuação de antes.
  const { t } = useTranslation("configuracoes");
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
          <CardTitle>{t("previewRecibo.titulo")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t("previewRecibo.carregando")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t("previewRecibo.titulo")}</span>
          <Badge variant="outline">{t("previewRecibo.mockup")}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cabeçalho da Loja */}
        <div className="border-b pb-4">
          <div className="flex items-start gap-4">
            {configuracao.logo_url && (
              <img
                src={configuracao.logo_url}
                alt={t("previewRecibo.logoAlt")}
                className="h-16 w-16 object-contain rounded"
              />
            )}
            <div className="flex-1 space-y-1">
              <h3 className="font-bold text-lg">
                {configuracao.nome_loja || t("previewRecibo.nomeLoja")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {configuracao.razao_social || t("previewRecibo.razaoSocialNaoInformada")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("previewRecibo.cnpj", { valor: configuracao.cnpj || t("previewRecibo.naoInformado") })}
              </p>
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div>
          <h4 className="font-semibold mb-2">{t("previewRecibo.endereco")}</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              {configuracao.logradouro || t("previewRecibo.logradouro")}, {configuracao.numero || t("previewRecibo.numero")}{" "}
              {configuracao.complemento && `- ${configuracao.complemento}`}
            </p>
            <p>
              {configuracao.bairro || t("previewRecibo.bairro")} - {configuracao.cidade || t("previewRecibo.cidade")}/{configuracao.estado || t("previewRecibo.uf")}
            </p>
            <p>{t("previewRecibo.cep", { valor: configuracao.cep || "00000-000" })}</p>
          </div>
        </div>

        {/* Contatos */}
        <div>
          <h4 className="font-semibold mb-2">{t("previewRecibo.contatos")}</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{t("previewRecibo.tel", { valor: configuracao.telefone || t("previewRecibo.naoInformado") })}</p>
            {configuracao.whatsapp && <p>{t("previewRecibo.whatsapp", { valor: configuracao.whatsapp })}</p>}
            <p>{t("previewRecibo.email", { valor: configuracao.email || t("previewRecibo.naoInformado") })}</p>
            {configuracao.site && <p>{t("previewRecibo.site", { valor: configuracao.site })}</p>}
          </div>
        </div>

        {/* Status dos Campos */}
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3">{t("previewRecibo.statusCampos")}</h4>
          <div className="grid grid-cols-2 gap-2">
            <CampoStatus preenchido={!!configuracao.nome_loja} label={t("previewRecibo.campoNomeLoja")} />
            <CampoStatus preenchido={!!configuracao.razao_social} label={t("previewRecibo.campoRazaoSocial")} />
            <CampoStatus preenchido={!!configuracao.cnpj} label={t("previewRecibo.campoCnpj")} />
            <CampoStatus preenchido={!!configuracao.telefone} label={t("previewRecibo.campoTelefone")} />
            <CampoStatus preenchido={!!configuracao.email} label={t("previewRecibo.campoEmail")} />
            <CampoStatus preenchido={!!configuracao.cep} label={t("previewRecibo.campoCep")} />
            <CampoStatus preenchido={!!configuracao.logradouro} label={t("previewRecibo.campoLogradouro")} />
            <CampoStatus preenchido={!!configuracao.numero} label={t("previewRecibo.campoNumero")} />
            <CampoStatus preenchido={!!configuracao.bairro} label={t("previewRecibo.campoBairro")} />
            <CampoStatus preenchido={!!configuracao.cidade} label={t("previewRecibo.campoCidade")} />
            <CampoStatus preenchido={!!configuracao.estado} label={t("previewRecibo.campoEstado")} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

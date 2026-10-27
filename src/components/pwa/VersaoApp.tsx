import { useTranslation } from "react-i18next";
import { APP_BUILD_ID } from "@/lib/build";

// Rodapé discreto com a versão do build: o suporte pergunta "qual a versão em
// Configurações?" para saber se o aparelho já tem uma correção.
export function VersaoApp() {
  const { t } = useTranslation("comum");
  return (
    <p className="text-center text-xs text-muted-foreground/70 select-all">
      {t("versaoApp", { versao: APP_BUILD_ID })}
    </p>
  );
}

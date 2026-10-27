import { usePushNotifications } from "@/hooks/usePushNotifications";
import { usePWA } from "@/hooks/usePWA";
import { useNotificationPreferences, EVENT_TYPE_LABELS, EventType, OS_STATUS_LABELS, ALL_OS_STATUSES } from "@/hooks/useNotificationPreferences";
import { useAssinatura } from "@/hooks/useAssinatura";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Bell, BellOff, Loader2, AlertCircle, Smartphone, Share, Plus, Info, ShoppingCart, ClipboardList, PackageCheck, RefreshCw, CreditCard, BellRing, ChevronDown, Crown } from "lucide-react";
import { useState, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";

const EVENT_ICONS: Record<EventType, React.ReactNode> = {
  SALE_CREATED: <ShoppingCart className="h-4 w-4" />,
  SERVICE_ORDER_CREATED: <ClipboardList className="h-4 w-4" />,
  SERVICE_ORDER_DELIVERED: <PackageCheck className="h-4 w-4" />,
  SERVICE_ORDER_UPDATED: <RefreshCw className="h-4 w-4" />,
  PAYMENT_CONFIRMED: <CreditCard className="h-4 w-4" />,
};

export function NotificationSettings() {
  const { 
    isSupported, 
    permission, 
    isSubscribed, 
    isLoading,
    activationError,
    activationStep,
    requestPermissionAndSubscribe,
    unsubscribe 
  } = usePushNotifications();

  const { isIOS, isInstalled } = usePWA();
  const {
    preferences,
    isLoading: prefsLoading,
    togglePreference,
    setAllPreferences,
    allEnabled,
  } = useNotificationPreferences();

  const { assinatura } = useAssinatura();
  const [osStatusOpen, setOsStatusOpen] = useState(false);
  // Textos: namespace "configuracoes" (notificacoes.*). activationStep/activationError vêm do hook, em pt-BR.
  const { t } = useTranslation("configuracoes");

  const temPlanoProfissional = useMemo(() => {
    if (!assinatura) return false;
    const planosPermitidos = ['profissional_mensal', 'profissional_anual', 'profissional_ultra_mensal', 'profissional_ultra_anual', 'admin', 'trial'];
    return planosPermitidos.includes(assinatura.plano_tipo);
  }, [assinatura]);

  const handleToggle = (checked: boolean) => {
    if (checked) {
      requestPermissionAndSubscribe();
    } else {
      unsubscribe();
    }
  };

  // iOS que não está instalado como PWA
  if (isIOS && !isInstalled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {t("notificacoes.iphoneTitulo")}
          </CardTitle>
          <CardDescription>
            {t("notificacoes.iphoneDescricao")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t("notificacoes.instalacaoNecessaria")}</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">
                {t("notificacoes.iphoneSoInstalado")}
              </p>
              <div className="space-y-2 text-sm">
                <p className="font-medium">{t("notificacoes.paraInstalar")}</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li className="flex items-center gap-1">
                    <Trans t={t} i18nKey="notificacoes.passoCompartilhar" components={{ icone: <Share className="inline h-4 w-4 mx-1" />, destaque: <span className="font-medium" /> }} />
                  </li>
                  <li className="flex items-center gap-1">
                    <Trans t={t} i18nKey="notificacoes.passoAdicionar" components={{ icone: <Plus className="inline h-4 w-4 mx-1" />, destaque: <span className="font-medium" /> }} />
                  </li>
                  <li><Trans t={t} i18nKey="notificacoes.passoConfirmar" components={{ destaque: <span className="font-medium" /> }} /></li>
                  <li>{t("notificacoes.passoAbrir")}</li>
                </ol>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                <Trans t={t} i18nKey="notificacoes.importante" components={{ negrito: <strong /> }} />
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const renderPushCard = () => {
    // Navegador não suporta push notifications
    if (!isSupported) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t("notificacoes.pushTitulo")}
            </CardTitle>
            <CardDescription>
              {t("notificacoes.pushDescricao")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t("notificacoes.naoSuportado")}</AlertTitle>
              <AlertDescription>
                {isIOS ? (
                  <>{t("notificacoes.naoSuportadoIphone")}</>
                ) : (
                  <>{t("notificacoes.naoSuportadoNavegador")}</>
                )}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t("notificacoes.pushTitulo")}
          </CardTitle>
          <CardDescription>
            {t("notificacoes.pushDescricao")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="push-notifications" className="flex items-center gap-2">
              {isSubscribed ? (
                <Bell className="h-4 w-4 text-primary" />
              ) : (
                <BellOff className="h-4 w-4 text-muted-foreground" />
              )}
              {t("notificacoes.ativar")}
            </Label>
            <Switch
              id="push-notifications"
              checked={isSubscribed}
              onCheckedChange={handleToggle}
              disabled={isLoading || permission === "denied"}
            />
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {activationStep ?? t("notificacoes.finalizando")}
            </div>
          )}

          {activationError && !isLoading && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t("notificacoes.naoFoiPossivelAtivar")}</AlertTitle>
              <AlertDescription>{activationError}</AlertDescription>
            </Alert>
          )}

          {permission === "denied" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t("notificacoes.bloqueadas")}</AlertTitle>
              <AlertDescription>
                {isIOS ? t("notificacoes.bloqueadasApp") : t("notificacoes.bloqueadasNavegador")}
              </AlertDescription>
            </Alert>
          )}

          {isSubscribed && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium text-primary mb-1">{t("notificacoes.ativas")}</p>
              <p className="text-muted-foreground text-xs">
                {t("notificacoes.escolhaAbaixo")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const mainEventTypes: EventType[] = ["SALE_CREATED", "SERVICE_ORDER_CREATED", "SERVICE_ORDER_DELIVERED", "PAYMENT_CONFIRMED"];

  return (
    <div className="space-y-4">
      {renderPushCard()}

      {!temPlanoProfissional ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="h-5 w-5" />
              {t("notificacoes.automaticasTitulo")}
            </CardTitle>
            <CardDescription>
              {t("notificacoes.automaticasDescricao")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Crown className="h-4 w-4" />
              <AlertTitle>{t("notificacoes.recursoProfissional")}</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{t("notificacoes.soProfissional")}</p>
                <Button variant="link" className="px-0 h-auto" onClick={() => window.location.href = "/plano"}>
                  {t("notificacoes.upgrade")}
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-5 w-5" />
            {t("notificacoes.tiposTitulo")}
          </CardTitle>
          <CardDescription>
            {t("notificacoes.tiposDescricao")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle all */}
          <div className="flex items-center justify-between">
            <Label htmlFor="all-notifications" className="flex items-center gap-2 font-medium">
              <Bell className="h-4 w-4 text-primary" />
              {t("notificacoes.todas")}
            </Label>
            {prefsLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Switch
                id="all-notifications"
                checked={allEnabled}
                onCheckedChange={(checked) => setAllPreferences(checked)}
              />
            )}
          </div>

          <Separator />

          {/* Main event toggles (without SERVICE_ORDER_UPDATED) */}
          <div className="space-y-3">
            {mainEventTypes.map((eventType) => (
              <div key={eventType} className="flex items-center justify-between">
                <Label
                  htmlFor={`notif-${eventType}`}
                  className="flex items-center gap-2 text-sm font-normal"
                >
                  <span className="text-muted-foreground">{EVENT_ICONS[eventType]}</span>
                  {t(`notificacoes.eventos.${eventType}`, { defaultValue: EVENT_TYPE_LABELS[eventType] })}
                </Label>
                {prefsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Switch
                    id={`notif-${eventType}`}
                    checked={preferences[eventType]}
                    onCheckedChange={(checked) => togglePreference(eventType, checked)}
                  />
                )}
              </div>
            ))}
          </div>

          <Separator />

          {/* Per-status OS toggles */}
          <Collapsible open={osStatusOpen} onOpenChange={setOsStatusOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground"><RefreshCw className="h-4 w-4" /></span>
                <span className="text-sm font-medium">{t("notificacoes.mudancaStatus")}</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${osStatusOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-3 pl-6 border-l-2 border-muted ml-2">
                {ALL_OS_STATUSES.map((status) => (
                  <div key={status} className="flex items-center justify-between">
                    <Label
                      htmlFor={`notif-os-${status}`}
                      className="text-sm font-normal text-muted-foreground"
                    >
                      {t(`notificacoes.status.${status}`, { defaultValue: OS_STATUS_LABELS[status] })}
                    </Label>
                    {prefsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Switch
                        id={`notif-os-${status}`}
                        checked={preferences[`SERVICE_ORDER_STATUS_${status}`] !== false}
                        onCheckedChange={(checked) => togglePreference(`SERVICE_ORDER_STATUS_${status}`, checked)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
      )}
    </div>
  );
}

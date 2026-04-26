import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, ShoppingCart, ClipboardList, Package, CreditCard, ChevronDown, Save, Zap, Eye, Volume2, VolumeX, Smile, Play } from "lucide-react";
import { useNotificationRules, type NotificationRule } from "@/hooks/useNotificationRules";
import { NOTIFICATION_SOUNDS, playNotificationSound } from "@/lib/notification-sounds";

const EVENT_CONFIG: Record<string, {
  label: string;
  icon: React.ReactNode;
  variables: string[];
  mockData: Record<string, string>;
}> = {
  SUBSCRIPTION_CREATED: {
    label: "Nova assinatura realizada",
    icon: <CreditCard className="h-4 w-4" />,
    variables: ["valor", "plano_nome", "payment_method"],
    mockData: { valor: "39,90", plano_nome: "Intermediário Mensal", payment_method: "pix" },
  },
  SUBSCRIPTION_RENEWED: {
    label: "Assinatura renovada",
    icon: <CreditCard className="h-4 w-4" />,
    variables: ["valor", "plano_nome", "payment_method"],
    mockData: { valor: "39,90", plano_nome: "Intermediário Mensal", payment_method: "cartao" },
  },
  SALE_CREATED: {
    label: "Nova venda realizada",
    icon: <ShoppingCart className="h-4 w-4" />,
    variables: ["total", "clienteNome", "grupoVendaId"],
    mockData: { total: "299,00", clienteNome: "João Silva", grupoVendaId: "abc-123" },
  },
  SERVICE_ORDER_CREATED: {
    label: "Nova OS cadastrada",
    icon: <ClipboardList className="h-4 w-4" />,
    variables: ["numero_os", "clienteNome"],
    mockData: { numero_os: "OS-0042", clienteNome: "Maria" },
  },
  SERVICE_ORDER_UPDATED: {
    label: "OS atualizada",
    icon: <ClipboardList className="h-4 w-4" />,
    variables: ["numero_os", "status"],
    mockData: { numero_os: "OS-0042", status: "Em andamento" },
  },
  SERVICE_ORDER_DELIVERED: {
    label: "OS entregue",
    icon: <Package className="h-4 w-4" />,
    variables: ["numero_os"],
    mockData: { numero_os: "OS-0042" },
  },
  PAYMENT_CONFIRMED: {
    label: "Pagamento confirmado",
    icon: <CreditCard className="h-4 w-4" />,
    variables: ["total"],
    mockData: { total: "150,00" },
  },
};

const SOUND_OPTIONS = NOTIFICATION_SOUNDS;

const EMOJI_SUGGESTIONS = ["🎉", "💰", "💸", "🤑", "🛒", "✅", "🚀", "🔔", "📦", "🧾", "💳", "🟢"];

function hydrateTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`);
}

function NotificationPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs flex items-center gap-1 mb-2">
          <Eye className="h-3 w-3" />
          Preview — Android
        </Label>
        <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1">
            <span>9:41</span>
            <div className="flex gap-1 items-center">
              <div className="w-4 h-2 border border-zinc-500 rounded-sm">
                <div className="w-3 h-1.5 bg-zinc-400 rounded-sm" />
              </div>
            </div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-3 shadow-lg border border-zinc-700">
            <div className="flex gap-2.5 items-start">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/pwa-192x192.png" alt="icon" className="w-6 h-6 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-zinc-400 font-medium">Méc</span>
                  <span className="text-[9px] text-zinc-500">agora</span>
                </div>
                <p className="text-xs font-semibold text-zinc-100 leading-tight mt-0.5 truncate">
                  {title || "Título da notificação"}
                </p>
                <p className="text-[11px] text-zinc-400 leading-snug mt-0.5 line-clamp-3">
                  {body || "Corpo da mensagem aparecerá aqui..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <Label className="text-xs flex items-center gap-1 mb-2">
          <Eye className="h-3 w-3" />
          Preview — iOS
        </Label>
        <div className="bg-gradient-to-b from-sky-100 to-sky-200 dark:from-zinc-800 dark:to-zinc-900 rounded-2xl p-4 space-y-3">
          <div className="bg-white/90 dark:bg-zinc-700/90 rounded-2xl p-3 shadow-sm backdrop-blur">
            <div className="flex gap-2.5 items-start">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/pwa-192x192.png" alt="icon" className="w-7 h-7 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">MÉC</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">agora</span>
                </div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-tight mt-0.5 truncate">
                  {title || "Título da notificação"}
                </p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug mt-0.5 line-clamp-3">
                  {body || "Corpo da mensagem aparecerá aqui..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleEditor({ rule, onSave, onToggle }: {
  rule: NotificationRule;
  onSave: (id: string, fields: Partial<NotificationRule>) => Promise<void>;
  onToggle: (id: string, active: boolean) => Promise<void>;
}) {
  const config = EVENT_CONFIG[rule.event_type];
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(rule.title_template);
  const [body, setBody] = useState(rule.body_template);
  const [url, setUrl] = useState(rule.url_template || "");
  const [target, setTarget] = useState(rule.target);
  const [sound, setSound] = useState(rule.sound || "default");
  const [saving, setSaving] = useState(false);

  if (!config) return null;

  const previewTitle = hydrateTemplate(title, config.mockData);
  const previewBody = hydrateTemplate(body, config.mockData);

  const displayLabel = rule.condition_label
    ? `${config.label} — ${rule.condition_label}`
    : config.label;

  const handleSave = async () => {
    setSaving(true);
    await onSave(rule.id, {
      title_template: title,
      body_template: body,
      url_template: url || null,
      target,
      sound,
    });
    setSaving(false);
  };

  const hasChanges =
    title !== rule.title_template ||
    body !== rule.body_template ||
    (url || "") !== (rule.url_template || "") ||
    target !== rule.target ||
    sound !== (rule.sound || "default");

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 p-3 bg-muted/30">
          <Switch
            checked={rule.active}
            onCheckedChange={(val) => onToggle(rule.id, val)}
          />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-muted-foreground">{config.icon}</span>
            <span className="font-medium text-sm truncate">{displayLabel}</span>
            {rule.condition_label && (
              <Badge variant="outline" className="text-[10px] shrink-0 bg-primary/10 text-primary border-primary/20">
                {rule.condition_label}
              </Badge>
            )}
          </div>
          <Badge variant={rule.active ? "default" : "secondary"} className="text-[10px] shrink-0">
            {rule.active ? "Ativa" : "Inativa"}
          </Badge>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="shrink-0">
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="p-4 border-t space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1fr,280px]">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Título</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da notificação" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Corpo da notificação" rows={3} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">URL de destino</Label>
                    <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/vendas" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Destinatário</Label>
                    <Select value={target} onValueChange={setTarget}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Dono da loja</SelectItem>
                        <SelectItem value="admin">Administradores</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    {sound === "silent" ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                    Som da notificação
                  </Label>
                  <div className="flex gap-2">
                    <Select value={sound} onValueChange={setSound}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SOUND_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      disabled={sound === "default" || sound === "silent"}
                      onClick={() => playNotificationSound(sound)}
                      title="Ouvir prévia do som"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    "Padrão do sistema" usa o som configurado no celular. "Silenciosa" não emite som nem vibração. Sons customizados tocam quando o app está aberto ou em background — caso o app esteja totalmente fechado, o sistema usa o som padrão.
                  </p>
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1 text-muted-foreground">
                    <Smile className="h-3 w-3" /> Emojis sugeridos (clique para adicionar ao título)
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {EMOJI_SUGGESTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setTitle((prev) => emoji + " " + prev.replace(/^[\p{Emoji}\s]+/u, ""))}
                        className="text-lg hover:scale-125 transition-transform px-1"
                        aria-label={`Inserir ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Variáveis disponíveis</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {config.variables.map((v) => (
                      <Badge key={v} variant="secondary" className="text-[11px] cursor-pointer font-mono"
                        onClick={() => setBody((prev) => prev + `{{${v}}}`)}>{`{{${v}}}`}</Badge>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Clique para inserir no corpo</p>
                </div>
                <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm" className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar alterações
                </Button>
              </div>
              <NotificationPreview title={previewTitle} body={previewBody} />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function NotificacoesAutomaticasAdmin() {
  const { rules, loading, updateRule, toggleRule } = useNotificationRules();

  // Group rules: non-conditional first, then group SERVICE_ORDER_UPDATED by condition
  const generalRules = rules.filter((r) => r.event_type !== "SERVICE_ORDER_UPDATED");
  const statusRules = rules.filter((r) => r.event_type === "SERVICE_ORDER_UPDATED");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Notificações Automáticas
        </CardTitle>
        <CardDescription>
          Personalize o título, mensagem e destino das notificações enviadas automaticamente pelo sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>Nenhuma regra de notificação configurada</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* General rules */}
            <div className="space-y-3">
              {generalRules.map((rule) => (
                <RuleEditor key={rule.id} rule={rule} onSave={updateRule} onToggle={toggleRule} />
              ))}
            </div>

            {/* Per-status OS rules */}
            {statusRules.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pt-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground">Notificações por Status da OS</h3>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  Personalize a notificação para cada mudança de status da ordem de serviço
                </p>
                {statusRules.map((rule) => (
                  <RuleEditor key={rule.id} rule={rule} onSave={updateRule} onToggle={toggleRule} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

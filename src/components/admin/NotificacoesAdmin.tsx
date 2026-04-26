import { Bell, Check, CheckCheck, UserPlus, CreditCard, XCircle, AlertTriangle, ArrowRightLeft, HelpCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAdminNotifications, AdminNotification } from '@/hooks/useAdminNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const tipoIcone: Record<string, typeof Bell> = {
  novo_trial: UserPlus,
  nova_assinatura: CreditCard,
  nova_assinatura_ticto: CreditCard,
  mudanca_plano: ArrowRightLeft,
  cancelamento: XCircle,
  cancelamento_ticto: XCircle,
  trial_cancelado: XCircle,
  pagamento_falhou: AlertTriangle,
  reembolso_ticto: RefreshCw,
  ticto_usuario_nao_encontrado: HelpCircle,
};

const tipoCor: Record<string, string> = {
  novo_trial: 'text-blue-500',
  nova_assinatura: 'text-green-500',
  nova_assinatura_ticto: 'text-green-500',
  mudanca_plano: 'text-purple-500',
  cancelamento: 'text-red-500',
  cancelamento_ticto: 'text-red-500',
  trial_cancelado: 'text-orange-500',
  pagamento_falhou: 'text-yellow-500',
  reembolso_ticto: 'text-red-600',
  ticto_usuario_nao_encontrado: 'text-yellow-600',
};

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: AdminNotification;
  onMarkAsRead: (id: string) => void;
}) {
  const Icone = tipoIcone[notification.tipo] || Bell;
  const cor = tipoCor[notification.tipo] || 'text-muted-foreground';

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors',
        !notification.lida && 'bg-muted/30'
      )}
      onClick={() => !notification.lida && onMarkAsRead(notification.id)}
    >
      <div className={cn('mt-0.5', cor)}>
        <Icone className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn('text-sm font-medium truncate', !notification.lida && 'font-semibold')}>
            {notification.titulo}
          </p>
          {!notification.lida && (
            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{notification.mensagem}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </p>
      </div>
    </div>
  );
}

export function NotificacoesAdmin() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useAdminNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs"
              onClick={(e) => {
                e.preventDefault();
                markAllAsRead();
              }}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
              />
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

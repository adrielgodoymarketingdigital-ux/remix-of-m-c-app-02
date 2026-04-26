import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageCircle, Send, User, Clock, CheckCircle2 } from 'lucide-react';
import { useChatSuporte } from '@/hooks/useChatSuporte';
import { ConversaSuporteComUsuario, StatusConversaSuporte } from '@/types/chat-suporte';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AdminChatSuporte = () => {
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [novaMensagem, setNovaMensagem] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    conversas,
    mensagens,
    conversaAtiva,
    setConversaAtiva,
    carregarMensagens,
    enviarMensagem,
    atualizarStatusConversa,
    carregarConversas,
  } = useChatSuporte(true);

  useEffect(() => {
    if (conversaAtiva) {
      carregarMensagens(conversaAtiva.id);
    }
  }, [conversaAtiva, carregarMensagens]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  const conversasFiltradas = conversas.filter((c) => {
    if (filtroStatus === 'todos') return true;
    return c.status === filtroStatus;
  });

  const handleEnviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaAtiva) return;
    await enviarMensagem(conversaAtiva.id, novaMensagem);
    setNovaMensagem('');
  };

  const handleMudarStatus = async (status: StatusConversaSuporte) => {
    if (!conversaAtiva) return;
    await atualizarStatusConversa(conversaAtiva.id, status);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string; className?: string }> = {
      aberta: { variant: 'default', label: 'Aberta', className: 'bg-blue-500' },
      em_atendimento: { variant: 'secondary', label: 'Em Atendimento' },
      resolvida: { variant: 'outline', label: 'Resolvida', className: 'border-green-500 text-green-500' },
      fechada: { variant: 'outline', label: 'Fechada' },
    };
    const info = variants[status] || variants.aberta;
    return <Badge variant={info.variant} className={info.className}>{info.label}</Badge>;
  };

  const estatisticas = {
    total: conversas.length,
    abertas: conversas.filter((c) => c.status === 'aberta').length,
    emAtendimento: conversas.filter((c) => c.status === 'em_atendimento').length,
    resolvidas: conversas.filter((c) => c.status === 'resolvida').length,
  };

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Chat de Suporte</h1>
          <p className="text-muted-foreground">Gerencie conversas de suporte dos usuários</p>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{estatisticas.total}</div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Abertas</CardTitle>
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-blue-500">{estatisticas.abertas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Atendimento</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{estatisticas.emAtendimento}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Resolvidas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-green-500">{estatisticas.resolvidas}</div>
            </CardContent>
          </Card>
        </div>

        {/* Layout de chat - responsivo */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 min-h-[400px] lg:h-[calc(100vh-380px)]">
          {/* Lista de conversas */}
          <Card className="lg:col-span-1 flex flex-col max-h-[300px] lg:max-h-none">
            <CardHeader className="pb-3 flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-base sm:text-lg">Conversas</CardTitle>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="aberta">Abertas</SelectItem>
                    <SelectItem value="em_atendimento">Atendimento</SelectItem>
                    <SelectItem value="resolvida">Resolvidas</SelectItem>
                    <SelectItem value="fechada">Fechadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                {conversasFiltradas.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhuma conversa encontrada
                  </div>
                ) : (
                  <div className="divide-y">
                    {conversasFiltradas.map((conversa) => (
                      <button
                        key={conversa.id}
                        onClick={() => setConversaAtiva(conversa)}
                        className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                          conversaAtiva?.id === conversa.id ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">
                              {conversa.usuario?.nome || 'Usuário'}
                            </span>
                          </div>
                          {(conversa.mensagens_nao_lidas || 0) > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {conversa.mensagens_nao_lidas}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate mb-1">{conversa.assunto}</p>
                        {conversa.ultima_mensagem && (
                          <p className="text-xs text-muted-foreground truncate mb-2">
                            {conversa.ultima_mensagem}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          {getStatusBadge(conversa.status)}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conversa.updated_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Janela de chat */}
          <Card className="lg:col-span-2 flex flex-col min-h-[350px]">
            {conversaAtiva ? (
              <>
                {/* Header da conversa */}
                <CardHeader className="pb-3 border-b flex-shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg truncate">{conversaAtiva.assunto}</CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {(conversaAtiva as ConversaSuporteComUsuario).usuario?.nome} • {(conversaAtiva as ConversaSuporteComUsuario).usuario?.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getStatusBadge(conversaAtiva.status)}
                      <Select
                        value={conversaAtiva.status}
                        onValueChange={(v) => handleMudarStatus(v as StatusConversaSuporte)}
                      >
                        <SelectTrigger className="w-[130px] sm:w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aberta">Aberta</SelectItem>
                          <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                          <SelectItem value="resolvida">Resolvida</SelectItem>
                          <SelectItem value="fechada">Fechada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>

                {/* Mensagens */}
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full p-4" ref={scrollRef}>
                    <div className="space-y-4">
                      {mensagens.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.is_admin ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              msg.is_admin
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm">{msg.mensagem}</p>
                            <p className={`text-xs mt-1 ${msg.is_admin ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>

                {/* Input */}
                {conversaAtiva.status !== 'fechada' && (
                  <div className="p-4 border-t flex gap-2">
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={novaMensagem}
                      onChange={(e) => setNovaMensagem(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleEnviarMensagem()}
                    />
                    <Button onClick={handleEnviarMensagem}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione uma conversa para visualizar</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>
    </AppLayout>
  );
};

export default AdminChatSuporte;

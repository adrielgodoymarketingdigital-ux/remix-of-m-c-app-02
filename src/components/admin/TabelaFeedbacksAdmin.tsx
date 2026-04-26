import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Reply, Lightbulb, AlertCircle, TrendingUp, Search, Loader2 } from 'lucide-react';
import { FeedbackComUsuario, StatusFeedback, TipoFeedback } from '@/types/feedback';
import { useFeedbacks } from '@/hooks/useFeedbacks';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TabelaFeedbacksAdminProps {
  feedbacks: FeedbackComUsuario[];
  loading: boolean;
  onAtualizar: () => void;
}

export const TabelaFeedbacksAdmin = ({
  feedbacks,
  loading,
  onAtualizar,
}: TabelaFeedbacksAdminProps) => {
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [feedbackSelecionado, setFeedbackSelecionado] = useState<FeedbackComUsuario | null>(null);
  const [resposta, setResposta] = useState('');
  const [dialogAberto, setDialogAberto] = useState(false);

  const { responderFeedback, atualizarStatus, loading: loadingAcao } = useFeedbacks();

  const feedbacksFiltrados = feedbacks.filter((f) => {
    const matchBusca =
      f.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      f.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      f.usuario?.nome?.toLowerCase().includes(busca.toLowerCase());
    const matchTipo = filtroTipo === 'todos' || f.tipo === filtroTipo;
    const matchStatus = filtroStatus === 'todos' || f.status === filtroStatus;
    return matchBusca && matchTipo && matchStatus;
  });

  const getTipoBadge = (tipo: TipoFeedback) => {
    const config = {
      sugestao: { icon: Lightbulb, className: 'bg-blue-500/10 text-blue-500 border-blue-500/20', label: 'Sugestão' },
      reclamacao: { icon: AlertCircle, className: 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Reclamação' },
      melhoria: { icon: TrendingUp, className: 'bg-green-500/10 text-green-500 border-green-500/20', label: 'Melhoria' },
    };
    const { icon: Icon, className, label } = config[tipo];
    return (
      <Badge variant="outline" className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const getStatusBadge = (status: StatusFeedback) => {
    const config = {
      pendente: { variant: 'default' as const, label: 'Pendente', className: 'bg-orange-500' },
      em_analise: { variant: 'secondary' as const, label: 'Em Análise', className: '' },
      resolvido: { variant: 'outline' as const, label: 'Resolvido', className: 'border-green-500 text-green-500' },
      arquivado: { variant: 'outline' as const, label: 'Arquivado', className: '' },
    };
    const { variant, label, className } = config[status];
    return <Badge variant={variant} className={className}>{label}</Badge>;
  };

  const handleAbrirDetalhes = (feedback: FeedbackComUsuario) => {
    setFeedbackSelecionado(feedback);
    setResposta(feedback.resposta_admin || '');
    setDialogAberto(true);
  };

  const handleResponder = async () => {
    if (!feedbackSelecionado || !resposta.trim()) return;
    const sucesso = await responderFeedback(feedbackSelecionado.id, resposta);
    if (sucesso) {
      setDialogAberto(false);
      onAtualizar();
    }
  };

  const handleMudarStatus = async (id: string, status: StatusFeedback) => {
    await atualizarStatus(id, status);
    onAtualizar();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, descrição ou usuário..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="sugestao">Sugestões</SelectItem>
            <SelectItem value="reclamacao">Reclamações</SelectItem>
            <SelectItem value="melhoria">Melhorias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_analise">Em Análise</SelectItem>
            <SelectItem value="resolvido">Resolvido</SelectItem>
            <SelectItem value="arquivado">Arquivado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedbacksFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum feedback encontrado
                </TableCell>
              </TableRow>
            ) : (
              feedbacksFiltrados.map((feedback) => (
                <TableRow key={feedback.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(feedback.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{feedback.usuario?.nome || 'Usuário'}</p>
                      <p className="text-xs text-muted-foreground">{feedback.usuario?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getTipoBadge(feedback.tipo)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{feedback.titulo}</TableCell>
                  <TableCell>{getStatusBadge(feedback.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAbrirDetalhes(feedback)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {feedback.status === 'pendente' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMudarStatus(feedback.id, 'em_analise')}
                        >
                          <Reply className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog de detalhes */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {feedbackSelecionado && getTipoBadge(feedbackSelecionado.tipo)}
              Detalhes do Feedback
            </DialogTitle>
          </DialogHeader>

          {feedbackSelecionado && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Usuário</Label>
                  <p className="font-medium">{feedbackSelecionado.usuario?.nome}</p>
                  <p className="text-xs text-muted-foreground">{feedbackSelecionado.usuario?.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data</Label>
                  <p className="font-medium">
                    {format(new Date(feedbackSelecionado.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Título</Label>
                <p className="font-medium">{feedbackSelecionado.titulo}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Descrição</Label>
                <p className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">
                  {feedbackSelecionado.descricao}
                </p>
              </div>

              <div>
                <Label className="text-muted-foreground">Status Atual</Label>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge(feedbackSelecionado.status)}
                  <Select
                    value={feedbackSelecionado.status}
                    onValueChange={(v) => handleMudarStatus(feedbackSelecionado.id, v as StatusFeedback)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_analise">Em Análise</SelectItem>
                      <SelectItem value="resolvido">Resolvido</SelectItem>
                      <SelectItem value="arquivado">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="resposta">Resposta ao Usuário</Label>
                <Textarea
                  id="resposta"
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  placeholder="Digite sua resposta..."
                  rows={4}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Fechar
            </Button>
            <Button onClick={handleResponder} disabled={loadingAcao || !resposta.trim()}>
              {loadingAcao && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Resposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

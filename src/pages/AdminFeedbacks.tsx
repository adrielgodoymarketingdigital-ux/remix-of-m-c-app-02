import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabelaFeedbacksAdmin } from '@/components/admin/TabelaFeedbacksAdmin';
import { useFeedbacks } from '@/hooks/useFeedbacks';
import { FeedbackComUsuario } from '@/types/feedback';
import { Lightbulb, AlertCircle, TrendingUp, MessageSquare } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

const AdminFeedbacks = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackComUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const { listarTodosFeedbacks } = useFeedbacks();

  const carregarFeedbacks = async () => {
    setLoading(true);
    const dados = await listarTodosFeedbacks();
    setFeedbacks(dados);
    setLoading(false);
  };

  useEffect(() => {
    carregarFeedbacks();
  }, []);

  const estatisticas = {
    total: feedbacks.length,
    sugestoes: feedbacks.filter((f) => f.tipo === 'sugestao').length,
    reclamacoes: feedbacks.filter((f) => f.tipo === 'reclamacao').length,
    melhorias: feedbacks.filter((f) => f.tipo === 'melhoria').length,
    pendentes: feedbacks.filter((f) => f.status === 'pendente').length,
  };

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold">Feedbacks dos Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie sugestões e reclamações</p>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{estatisticas.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Sugestões</CardTitle>
              <Lightbulb className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-blue-500">
                {estatisticas.sugestoes}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Reclamações</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-red-500">
                {estatisticas.reclamacoes}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Melhorias</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-green-500">
                {estatisticas.melhorias}
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-500/50 col-span-2 sm:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Pendentes</CardTitle>
              <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-orange-500">
                {estatisticas.pendentes}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de feedbacks */}
        <Card>
          <CardHeader>
            <CardTitle>Todos os Feedbacks</CardTitle>
          </CardHeader>
          <CardContent>
            <TabelaFeedbacksAdmin
              feedbacks={feedbacks}
              loading={loading}
              onAtualizar={carregarFeedbacks}
            />
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
};

export default AdminFeedbacks;

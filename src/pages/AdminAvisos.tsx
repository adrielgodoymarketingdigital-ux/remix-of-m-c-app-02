import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Megaphone, Plus, Search, Loader2 } from 'lucide-react';
import { useAvisosSistemaAdmin } from '@/hooks/useAvisosSistema';
import { TabelaAvisosAdmin } from '@/components/admin/TabelaAvisosAdmin';
import { DialogCadastroAviso } from '@/components/admin/DialogCadastroAviso';
import type { AvisoSistemaInsert } from '@/types/aviso';
import { AppLayout } from '@/components/layout/AppLayout';

interface AvisoSistemaDB {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  icone: string | null;
  link_url: string | null;
  link_texto: string | null;
  publico_alvo: string[];
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
  prioridade: number;
  cor_fundo: string | null;
  cor_texto: string | null;
  cor_icone: string | null;
  cor_botao: string | null;
  imagem_url: string | null;
  imagem_posicao: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export default function AdminAvisos() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [avisoParaEditar, setAvisoParaEditar] = useState<AvisoSistemaDB | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  const { avisos, loading, criarAviso, atualizarAviso, excluirAviso, toggleAtivo } = useAvisosSistemaAdmin();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      if (!data) { navigate('/dashboard'); return; }
      setIsAdmin(true);
    };
    checkAdmin();
  }, [navigate]);

  const handleEditar = (aviso: AvisoSistemaDB) => { setAvisoParaEditar(aviso); setDialogOpen(true); };
  const handleDuplicar = (aviso: AvisoSistemaDB) => { setAvisoParaEditar({ ...aviso, id: '', titulo: `${aviso.titulo} (cópia)` } as AvisoSistemaDB); setDialogOpen(true); };
  const handleNovoAviso = () => { setAvisoParaEditar(null); setDialogOpen(true); };
  const handleSalvar = async (aviso: AvisoSistemaInsert) => avisoParaEditar?.id ? atualizarAviso(avisoParaEditar.id, aviso) : criarAviso(aviso);

  const avisosFiltrados = avisos.filter((aviso) => {
    if (busca && !aviso.titulo.toLowerCase().includes(busca.toLowerCase()) && !aviso.mensagem.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtroStatus !== 'todos') {
      const agora = new Date(), inicio = new Date(aviso.data_inicio), fim = aviso.data_fim ? new Date(aviso.data_fim) : null;
      if (filtroStatus === 'ativo' && (!aviso.ativo || inicio > agora || (fim && fim < agora))) return false;
      if (filtroStatus === 'inativo' && aviso.ativo) return false;
      if (filtroStatus === 'expirado' && (!fim || fim >= agora)) return false;
      if (filtroStatus === 'agendado' && inicio <= agora) return false;
    }
    return true;
  });

  if (isAdmin === null) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Megaphone className="h-5 w-5 text-primary" /></div>
            <div><h1 className="text-2xl sm:text-3xl font-semibold">Avisos do Sistema</h1><p className="text-muted-foreground text-sm">Gerencie os avisos exibidos na dashboard</p></div>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <CardTitle className="text-lg">Avisos Cadastrados</CardTitle>
              <Button onClick={handleNovoAviso}><Plus className="h-4 w-4 mr-2" />Novo Aviso</Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" /></div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="ativo">Ativos</SelectItem><SelectItem value="inativo">Inativos</SelectItem><SelectItem value="agendado">Agendados</SelectItem><SelectItem value="expirado">Expirados</SelectItem></SelectContent></Select>
            </div>
          </CardHeader>
          <CardContent>{loading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : <TabelaAvisosAdmin avisos={avisosFiltrados} onEditar={handleEditar} onDuplicar={handleDuplicar} onExcluir={excluirAviso} onToggleAtivo={toggleAtivo} />}</CardContent>
        </Card>
      </main>
      <DialogCadastroAviso open={dialogOpen} onOpenChange={setDialogOpen} avisoParaEditar={avisoParaEditar} onSalvar={handleSalvar} onAtualizar={atualizarAviso} />
    </AppLayout>
  );
}

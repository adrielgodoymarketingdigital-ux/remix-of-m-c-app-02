import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Construction, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

export default function AdminMarketing() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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

  if (isAdmin === null) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-primary" /></div>
          <div><h1 className="text-2xl sm:text-3xl font-semibold">Marketing</h1><p className="text-muted-foreground text-sm">Cadastros, conversão e cancelamentos</p></div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Construction className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Indicadores em construção</p>
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
}

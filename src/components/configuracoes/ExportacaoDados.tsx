import { useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download } from "lucide-react";

export const ExportacaoDados = () => {
  const [exportando, setExportando] = useState(false);

  const exportarDados = async () => {
    setExportando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const wb = XLSX.utils.book_new();

      // Clientes
      const { data: clientes } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at');
      if (clientes?.length) {
        const ws = XLSX.utils.json_to_sheet(clientes);
        XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
      }

      // Ordens de Serviço
      const { data: os } = await supabase
        .from('ordens_servico')
        .select('*, clientes(nome)')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at');
      if (os?.length) {
        const osFormatado = os.map(o => ({ ...o, cliente_nome: (o.clientes as any)?.nome, clientes: undefined }));
        const ws = XLSX.utils.json_to_sheet(osFormatado);
        XLSX.utils.book_append_sheet(wb, ws, 'Ordens de Servico');
      }

      // Dispositivos
      const { data: dispositivos } = await supabase
        .from('dispositivos')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at');
      if (dispositivos?.length) {
        const ws = XLSX.utils.json_to_sheet(dispositivos);
        XLSX.utils.book_append_sheet(wb, ws, 'Dispositivos');
      }

      // Vendas
      const { data: vendas } = await supabase
        .from('vendas')
        .select('*, clientes(nome)')
        .eq('user_id', user.id)
        .or('cancelada.is.null,cancelada.eq.false')
        .order('data');
      if (vendas?.length) {
        const vendasFormatado = vendas.map(v => ({ ...v, cliente_nome: (v.clientes as any)?.nome, clientes: undefined }));
        const ws = XLSX.utils.json_to_sheet(vendasFormatado);
        XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
      }

      // Produtos
      const { data: produtos } = await supabase
        .from('produtos')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at');
      if (produtos?.length) {
        const ws = XLSX.utils.json_to_sheet(produtos);
        XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
      }

      // Pecas
      const { data: pecas } = await supabase
        .from('pecas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at');
      if (pecas?.length) {
        const ws = XLSX.utils.json_to_sheet(pecas);
        XLSX.utils.book_append_sheet(wb, ws, 'Pecas');
      }

      // Contas
      const { data: contas } = await supabase
        .from('contas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at');
      if (contas?.length) {
        const ws = XLSX.utils.json_to_sheet(contas);
        XLSX.utils.book_append_sheet(wb, ws, 'Contas');
      }

      // Gerar e baixar o arquivo
      const data = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `mecapp-dados-${data}.xlsx`);
      toast.success('Exportação concluída!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar dados');
    } finally {
      setExportando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Exportação de Dados
        </CardTitle>
        <CardDescription>
          Exporte todos os dados da sua loja (clientes, ordens de serviço, dispositivos, vendas, produtos, peças e contas) em uma única planilha Excel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={exportarDados} disabled={exportando}>
          <Download className="h-4 w-4 mr-2" />
          {exportando ? "Exportando..." : "Exportar todos os dados"}
        </Button>
      </CardContent>
    </Card>
  );
};

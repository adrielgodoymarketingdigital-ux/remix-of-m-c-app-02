import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const log = (msg: string) => console.log(`[BACKUP] ${msg}`);
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0 = domingo
  const diaMes = hoje.getDate(); // 1-31

  const tabelas = [
    'clientes',
    'ordens_servico',
    'vendas',
    'produtos',
    'dispositivos',
    'pecas',
    'orcamentos',
    'fornecedores',
  ];

  try {
    // BACKUP DIÁRIO — sempre
    log("Iniciando backup diário...");
    for (const tabela of tabelas) {
      const { data } = await supabase.from(tabela).select('*');
      await supabase.from('backups').insert({
        tipo: 'diario',
        tabela,
        dados: data || [],
      });
    }

    // Deletar backups diários com mais de 7 dias
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    await supabase.from('backups')
      .delete()
      .eq('tipo', 'diario')
      .lt('created_at', seteDiasAtras.toISOString());
    log("Backup diário concluído — mantidos últimos 7 dias");

    // BACKUP SEMANAL — toda domingo
    if (diaSemana === 0) {
      log("Iniciando backup semanal...");
      for (const tabela of tabelas) {
        const { data } = await supabase.from(tabela).select('*');
        await supabase.from('backups').insert({
          tipo: 'semanal',
          tabela,
          dados: data || [],
        });
      }
      // Deletar backups semanais com mais de 28 dias
      const vinteOitoDiasAtras = new Date();
      vinteOitoDiasAtras.setDate(vinteOitoDiasAtras.getDate() - 28);
      await supabase.from('backups')
        .delete()
        .eq('tipo', 'semanal')
        .lt('created_at', vinteOitoDiasAtras.toISOString());
      log("Backup semanal concluído — mantidas últimas 4 semanas");
    }

    // BACKUP MENSAL — todo dia 1
    if (diaMes === 1) {
      log("Iniciando backup mensal...");
      for (const tabela of tabelas) {
        const { data } = await supabase.from(tabela).select('*');
        await supabase.from('backups').insert({
          tipo: 'mensal',
          tabela,
          dados: data || [],
        });
      }
      // Deletar backups mensais com mais de 365 dias
      const trezentoseSessentaCincoDiasAtras = new Date();
      trezentoseSessentaCincoDiasAtras.setDate(trezentoseSessentaCincoDiasAtras.getDate() - 365);
      await supabase.from('backups')
        .delete()
        .eq('tipo', 'mensal')
        .lt('created_at', trezentoseSessentaCincoDiasAtras.toISOString());
      log("Backup mensal concluído — mantidos últimos 12 meses");
    }

    return new Response(JSON.stringify({ sucesso: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO: " + msg);
    return new Response(JSON.stringify({ erro: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

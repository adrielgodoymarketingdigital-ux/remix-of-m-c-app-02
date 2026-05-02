import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMultiEmpresas } from "@/hooks/useMultiEmpresas";
import { useAssinatura } from "@/hooks/useAssinatura";
import { supabase } from "@/integrations/supabase/client";
import { EmpresaDashboard, EmpresaUsuario } from "@/types/multiempresas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Lock, Plus, Building2, TrendingUp, Target, Bell } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const CORES = ['#3b82f6', '#10b981', '#8b5cf6'];

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

// ─── Dialog Nova Filial ──────────────────────────────────────────────────────

interface DialogNovaFilialProps {
  open: boolean;
  onClose: () => void;
  onCriar: (dados: Record<string, string>) => Promise<void>;
  salvando: boolean;
}

function DialogNovaFilial({ open, onClose, onCriar, salvando }: DialogNovaFilialProps) {
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    telefone: "",
    endereco: "",
    cidade: "",
    estado: "",
    email_gerente: "",
    senha_gerente: "",
    confirmar_senha: "",
  });
  const [erros, setErros] = useState<Record<string, string>>({});

  const set = (campo: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [campo]: e.target.value }));

  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    if (!form.email_gerente.trim()) e.email_gerente = "Email obrigatório";
    if (!form.senha_gerente) e.senha_gerente = "Senha obrigatória";
    if (form.senha_gerente.length < 6) e.senha_gerente = "Mínimo 6 caracteres";
    if (form.senha_gerente !== form.confirmar_senha) e.confirmar_senha = "Senhas não conferem";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    const { confirmar_senha, ...dados } = form;
    await onCriar(dados);
    setForm({ nome: "", cnpj: "", telefone: "", endereco: "", cidade: "", estado: "", email_gerente: "", senha_gerente: "", confirmar_senha: "" });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Filial</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da filial *</Label>
            <Input id="nome" value={form.nome} onChange={set("nome")} placeholder="Ex: Filial Centro" />
            {erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={form.cnpj} onChange={set("cnpj")} placeholder="00.000.000/0001-00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" value={form.telefone} onChange={set("telefone")} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" value={form.endereco} onChange={set("endereco")} placeholder="Rua, número" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" value={form.cidade} onChange={set("cidade")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Input id="estado" value={form.estado} onChange={set("estado")} placeholder="SP" maxLength={2} />
            </div>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Acesso da Filial</p>
          <div className="space-y-2">
            <Label htmlFor="email_gerente">Email de login *</Label>
            <Input id="email_gerente" type="email" value={form.email_gerente} onChange={set("email_gerente")} placeholder="gerente@filial.com" />
            {erros.email_gerente && <p className="text-xs text-destructive">{erros.email_gerente}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha_gerente">Senha *</Label>
            <Input id="senha_gerente" type="password" value={form.senha_gerente} onChange={set("senha_gerente")} placeholder="Mínimo 6 caracteres" />
            {erros.senha_gerente && <p className="text-xs text-destructive">{erros.senha_gerente}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmar_senha">Confirmar senha *</Label>
            <Input id="confirmar_senha" type="password" value={form.confirmar_senha} onChange={set("confirmar_senha")} />
            {erros.confirmar_senha && <p className="text-xs text-destructive">{erros.confirmar_senha}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>{salvando ? "Criando..." : "Criar Filial"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card de Empresa ─────────────────────────────────────────────────────────

interface CardEmpresaProps {
  empresa: EmpresaDashboard;
  onMetas: () => void;
  onPermissoes: () => void;
  onNotificacoes: () => void;
}

function CardEmpresa({ empresa, onMetas, onPermissoes, onNotificacoes }: CardEmpresaProps) {
  const metaFaturamento = empresa.metas.find(m => m.tipo === 'faturamento');
  const pctFaturamento = metaFaturamento && metaFaturamento.valor > 0
    ? Math.min(100, (empresa.metricas.faturamento_mes / metaFaturamento.valor) * 100)
    : null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-400" />
            {empresa.nome}
          </CardTitle>
          <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Ativa</Badge>
        </div>
        {empresa.cidade && (
          <p className="text-xs text-muted-foreground">{empresa.cidade}{empresa.estado ? ` — ${empresa.estado}` : ""}</p>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-[10px] text-muted-foreground">Faturamento</p>
            <p className="text-sm font-semibold text-emerald-400">
              R$ {empresa.metricas.faturamento_mes.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-[10px] text-muted-foreground">OS</p>
            <p className="text-sm font-semibold text-blue-400">{empresa.metricas.os_mes}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-[10px] text-muted-foreground">Vendas</p>
            <p className="text-sm font-semibold text-violet-400">{empresa.metricas.vendas_mes}</p>
          </div>
        </div>

        {pctFaturamento !== null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Meta faturamento</span>
              <span>{pctFaturamento.toFixed(0)}%</span>
            </div>
            <Progress value={pctFaturamento} className="h-1.5" />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1 text-xs h-8" onClick={onMetas}>
            Metas
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={onPermissoes}>
            Permissões
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-8 px-2" onClick={onNotificacoes}>
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

const PERMISSOES_PADRAO: EmpresaUsuario['permissoes'] = {
  pdv: true, os: true, clientes: true, produtos: true, financeiro: false,
  relatorios: false, funcionarios: false, configuracoes: false, metas: false,
};

export default function MultiEmpresas() {
  const navigate = useNavigate();
  const { assinatura, carregando: carregandoAssinatura } = useAssinatura();
  const { empresas, isLoading, criarEmpresa, salvarMeta, atualizarPermissoes } = useMultiEmpresas();
  const [isAdmin, setIsAdmin] = useState(false);

  // Dialog Nova Filial
  const [dialogNova, setDialogNova] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Dialog Metas
  const [dialogMetasAberto, setDialogMetasAberto] = useState(false);
  const [empresaMetas, setEmpresaMetas] = useState<EmpresaDashboard | null>(null);
  const [metasForm, setMetasForm] = useState({
    faturamento: '',
    os: '',
    vendas: '',
    clientes: '',
    periodo: 'mensal' as 'mensal' | 'semanal',
  });

  // Dialog Permissões
  const [dialogPermissoesAberto, setDialogPermissoesAberto] = useState(false);
  const [empresaPermissoes, setEmpresaPermissoes] = useState<EmpresaDashboard | null>(null);
  const [permissoesForm, setPermissoesForm] = useState<EmpresaUsuario['permissoes']>(PERMISSOES_PADRAO);

  // Dialog Notificações
  const [dialogNotifAberto, setDialogNotifAberto] = useState(false);
  const [empresaNotif, setEmpresaNotif] = useState<EmpresaDashboard | null>(null);
  const [notifForm, setNotifForm] = useState({
    nova_os: true,
    os_entregue: true,
    nova_venda: true,
    meta_atingida: true,
    estoque_baixo: false,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.from('user_roles').select('role')
        .eq('user_id', data.user.id).eq('role', 'admin').maybeSingle()
        .then(({ data: r }) => setIsAdmin(!!r));
    });
  }, []);

  const isUltra = ['profissional_ultra_mensal', 'profissional_ultra_anual'].includes(assinatura?.plano_tipo ?? '');
  const semAcesso = !carregandoAssinatura && assinatura !== null && !isAdmin && !isUltra;

  const handleCriar = async (dados: Record<string, string>) => {
    setSalvando(true);
    await criarEmpresa(dados);
    setSalvando(false);
    setDialogNova(false);
  };

  const abrirMetas = (empresa: EmpresaDashboard) => {
    setEmpresaMetas(empresa);
    setMetasForm({
      faturamento: empresa.metas.find(m => m.tipo === 'faturamento')?.valor.toString() || '',
      os: empresa.metas.find(m => m.tipo === 'os')?.valor.toString() || '',
      vendas: empresa.metas.find(m => m.tipo === 'vendas')?.valor.toString() || '',
      clientes: empresa.metas.find(m => m.tipo === 'clientes')?.valor.toString() || '',
      periodo: empresa.metas[0]?.periodo || 'mensal',
    });
    setDialogMetasAberto(true);
  };

  const salvarTodasMetas = async () => {
    if (!empresaMetas) return;
    const tipos = ['faturamento', 'os', 'vendas', 'clientes'] as const;
    for (const tipo of tipos) {
      const valor = parseFloat(metasForm[tipo]);
      if (isNaN(valor) || valor <= 0) continue;
      const metaExistente = empresaMetas.metas.find(m => m.tipo === tipo);
      await salvarMeta({
        id: metaExistente?.id,
        empresa_id: empresaMetas.id,
        tipo,
        valor,
        periodo: metasForm.periodo,
      });
    }
    setDialogMetasAberto(false);
  };

  const abrirPermissoes = (empresa: EmpresaDashboard) => {
    setEmpresaPermissoes(empresa);
    if (empresa.gerentes[0]?.permissoes) {
      setPermissoesForm(empresa.gerentes[0].permissoes);
    } else {
      setPermissoesForm(PERMISSOES_PADRAO);
    }
    setDialogPermissoesAberto(true);
  };

  const salvarPermissoes = async () => {
    if (!empresaPermissoes?.gerentes[0]) return;
    await atualizarPermissoes(empresaPermissoes.gerentes[0].id, permissoesForm);
    setDialogPermissoesAberto(false);
  };

  const abrirNotificacoes = async (empresa: EmpresaDashboard) => {
    setEmpresaNotif(empresa);
    const { data } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('empresa_id', empresa.id)
      .maybeSingle();
    if (data?.preferences) {
      setNotifForm(data.preferences as typeof notifForm);
    }
    setDialogNotifAberto(true);
  };

  const salvarNotificacoes = async () => {
    if (!empresaNotif) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('user_notification_preferences')
      .upsert({
        user_id: user.id,
        empresa_id: empresaNotif.id,
        preferences: notifForm,
      });
    toast.success("Preferências de notificação salvas!");
    setDialogNotifAberto(false);
  };

  if (carregandoAssinatura) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Skeleton className="h-12 w-48" />
        </div>
      </AppLayout>
    );
  }

  if (semAcesso) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold">Funcionalidade Exclusiva</h2>
          <p className="text-muted-foreground max-w-md">
            O Multi Empresas está disponível apenas no plano <strong>Profissional Ultra</strong>.
            Faça upgrade para gerenciar múltiplas filiais em um único lugar.
          </p>
          <Button onClick={() => navigate('/plano')}>Ver Planos</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Multi Empresas</h1>
              <Badge variant="outline" className="text-xs">
                {isLoading ? "..." : empresas.length}/3 filiais
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie todas as suas filiais em um único lugar.
              Clique em uma filial para acessar seus dados ou
              configure permissões e metas individualmente.
            </p>
          </div>
          <Button
            onClick={() => setDialogNova(true)}
            disabled={isLoading || empresas.length >= 3}
            className="shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Filial
          </Button>
        </div>

        {/* KPIs consolidados */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Faturamento Total</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatarMoeda(empresas.reduce((sum, e) => sum + e.metricas.faturamento_mes, 0))}
              </div>
              <div className="text-xs text-muted-foreground">Todas as filiais este mês</div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">OS este mês</div>
              <div className="text-2xl font-bold text-emerald-600">
                {empresas.reduce((sum, e) => sum + e.metricas.os_mes, 0)}
              </div>
              <div className="text-xs text-muted-foreground">Ordens de serviço</div>
            </CardContent>
          </Card>

          <Card className="border-violet-200 dark:border-violet-800">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Vendas este mês</div>
              <div className="text-2xl font-bold text-violet-600">
                {empresas.reduce((sum, e) => sum + e.metricas.vendas_mes, 0)}
              </div>
              <div className="text-xs text-muted-foreground">Produtos vendidos</div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total de Filiais</div>
              <div className="text-2xl font-bold text-amber-600">{empresas.length}/3</div>
              <div className="text-xs text-muted-foreground">Filiais ativas</div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico comparativo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Comparativo de Faturamento por Filial
            </CardTitle>
          </CardHeader>
          <CardContent>
            {empresas.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                Cadastre filiais para ver o comparativo
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={empresas.map(e => ({
                  nome: e.nome.length > 12 ? e.nome.substring(0, 12) + '...' : e.nome,
                  faturamento: e.metricas.faturamento_mes,
                }))}>
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${v}`} />
                  <Tooltip formatter={value => [formatarMoeda(Number(value)), 'Faturamento']} />
                  <Bar dataKey="faturamento" radius={[4, 4, 0, 0]}>
                    {empresas.map((_, index) => (
                      <Cell key={index} fill={CORES[index % CORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Progresso de metas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-violet-500" />
              Progresso de Metas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {empresas.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">
                Cadastre filiais e defina metas para acompanhar o progresso
              </p>
            ) : (
              <div className="space-y-4">
                {empresas.map((empresa, i) => {
                  const metaFaturamento = empresa.metas.find(m => m.tipo === 'faturamento');
                  const percentual = metaFaturamento
                    ? Math.min(100, Math.round((empresa.metricas.faturamento_mes / metaFaturamento.valor) * 100))
                    : null;
                  return (
                    <div key={empresa.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CORES[i % CORES.length] }} />
                          <span className="text-sm font-medium">{empresa.nome}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium">{formatarMoeda(empresa.metricas.faturamento_mes)}</span>
                          {metaFaturamento && (
                            <span className="text-xs text-muted-foreground ml-1">
                              / {formatarMoeda(metaFaturamento.valor)}
                            </span>
                          )}
                        </div>
                      </div>
                      {percentual !== null ? (
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{ width: `${percentual}%`, backgroundColor: CORES[i % CORES.length] }}
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Sem meta definida —{" "}
                          <button className="underline ml-1" onClick={() => abrirMetas(empresa)}>
                            definir meta
                          </button>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grid de cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {empresas.map(empresa => (
              <CardEmpresa
                key={empresa.id}
                empresa={empresa}
                onMetas={() => abrirMetas(empresa)}
                onPermissoes={() => abrirPermissoes(empresa)}
                onNotificacoes={() => abrirNotificacoes(empresa)}
              />
            ))}

            {empresas.length < 3 && (
              <button
                onClick={() => setDialogNova(true)}
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all min-h-[200px] text-muted-foreground hover:text-blue-400"
              >
                <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center">
                  <Plus className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium">Adicionar Filial</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dialog Nova Filial */}
      <DialogNovaFilial
        open={dialogNova}
        onClose={() => setDialogNova(false)}
        onCriar={handleCriar}
        salvando={salvando}
      />

      {/* Dialog Metas */}
      <Dialog open={dialogMetasAberto} onOpenChange={setDialogMetasAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🎯 Metas — {empresaMetas?.nome}</DialogTitle>
            <DialogDescription>
              Defina as metas mensais para esta filial
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium">Período:</label>
              <select
                value={metasForm.periodo}
                onChange={e => setMetasForm(f => ({ ...f, periodo: e.target.value as 'mensal' | 'semanal' }))}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="mensal">Mensal</option>
                <option value="semanal">Semanal</option>
              </select>
            </div>

            {([
              { key: 'faturamento', label: '💰 Meta de Faturamento (R$)', prefix: 'R$' },
              { key: 'os', label: '🔧 Meta de OS', prefix: '' },
              { key: 'vendas', label: '🛒 Meta de Vendas', prefix: '' },
              { key: 'clientes', label: '👥 Meta de Clientes Novos', prefix: '' },
            ] as const).map(({ key, label, prefix }) => {
              const metaAtual = empresaMetas?.metas.find(m => m.tipo === key);
              const valorAtual = key === 'faturamento'
                ? (empresaMetas?.metricas.faturamento_mes ?? 0)
                : key === 'os' ? (empresaMetas?.metricas.os_mes ?? 0)
                : key === 'vendas' ? (empresaMetas?.metricas.vendas_mes ?? 0)
                : 0;
              const pct = metaAtual ? Math.min(100, Math.round((valorAtual / metaAtual.valor) * 100)) : null;

              return (
                <div key={key}>
                  <label className="text-sm font-medium">{label}</label>
                  <div className="flex items-center gap-2 mt-1">
                    {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
                    <Input
                      type="number"
                      placeholder="0"
                      value={metasForm[key]}
                      onChange={e => setMetasForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                  {metaAtual && pct !== null && (
                    <div className="mt-1">
                      <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                        <span>Atual: {key === 'faturamento' ? `R$ ${valorAtual.toFixed(2)}` : valorAtual}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMetasAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarTodasMetas}>
              Salvar Metas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Notificações */}
      <Dialog open={dialogNotifAberto} onOpenChange={setDialogNotifAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔔 Notificações — {empresaNotif?.nome}</DialogTitle>
            <DialogDescription>
              Escolha quais eventos desta filial você quer receber notificações
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {([
              { key: 'nova_os', label: 'Nova OS cadastrada', icon: '🔧' },
              { key: 'os_entregue', label: 'OS entregue', icon: '📦' },
              { key: 'nova_venda', label: 'Nova venda realizada', icon: '🛒' },
              { key: 'meta_atingida', label: 'Meta atingida', icon: '🎯' },
              { key: 'estoque_baixo', label: 'Estoque baixo', icon: '⚠️' },
            ] as const).map(({ key, label, icon }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <span>{icon}</span>
                  <p className="text-sm font-medium">{label}</p>
                </div>
                <Switch
                  checked={notifForm[key]}
                  onCheckedChange={v => setNotifForm(f => ({ ...f, [key]: v }))}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNotifAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarNotificacoes}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Permissões */}
      <Dialog open={dialogPermissoesAberto} onOpenChange={setDialogPermissoesAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔐 Permissões — {empresaPermissoes?.nome}</DialogTitle>
            <DialogDescription>
              Defina o que o gerente desta filial pode acessar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {([
              { key: 'pdv', label: 'PDV', desc: 'Registrar vendas no caixa' },
              { key: 'os', label: 'Ordens de Serviço', desc: 'Criar e gerenciar OS' },
              { key: 'clientes', label: 'Clientes', desc: 'Ver e cadastrar clientes' },
              { key: 'produtos', label: 'Produtos e Estoque', desc: 'Gerenciar produtos' },
              { key: 'financeiro', label: 'Financeiro', desc: 'Ver relatórios financeiros' },
              { key: 'relatorios', label: 'Relatórios', desc: 'Acessar relatórios' },
              { key: 'funcionarios', label: 'Funcionários', desc: 'Gerenciar equipe' },
              { key: 'configuracoes', label: 'Configurações', desc: 'Alterar configurações da loja' },
              { key: 'metas', label: 'Metas', desc: 'Ver e definir metas' },
            ] as const).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={permissoesForm[key]}
                  onCheckedChange={v => setPermissoesForm(f => ({ ...f, [key]: v }))}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogPermissoesAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarPermissoes} disabled={!empresaPermissoes?.gerentes[0]}>
              Salvar Permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

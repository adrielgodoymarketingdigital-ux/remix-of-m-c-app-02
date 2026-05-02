import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useFidelidade } from "@/hooks/useFidelidade";
import { ClienteFidelidade, FidelidadeNivel } from "@/types/fidelidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Settings, Trophy, Star, Users, Search, Trash2, Plus, Award, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAssinatura } from "@/hooks/useAssinatura";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string | null) {
  if (!data) return "—";
  try {
    return format(new Date(data), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function NivelBadge({ nivel }: { nivel: FidelidadeNivel | null }) {
  if (!nivel) return <Badge variant="secondary">Sem nível</Badge>;
  return (
    <Badge style={{ backgroundColor: nivel.cor, color: "#fff" }}>
      {nivel.nome}
    </Badge>
  );
}

// ─── Dialog de Resgate ───────────────────────────────────────────────────────

interface DialogResgateProps {
  cliente: ClienteFidelidade | null;
  open: boolean;
  onClose: () => void;
  onConfirmar: (
    clienteId: string,
    pontos: number,
    tipo: 'cupom' | 'valor' | 'manual',
    valorDesconto?: number,
    descricao?: string
  ) => Promise<string | false | null | undefined>;
}

function DialogResgate({ cliente, open, onClose, onConfirmar }: DialogResgateProps) {
  const [pontos, setPontos] = useState("");
  const [tipo, setTipo] = useState<'cupom' | 'valor' | 'manual'>("cupom");
  const [valorDesconto, setValorDesconto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleConfirmar = async () => {
    if (!cliente || !pontos) return;
    const qtd = Number(pontos);
    if (qtd <= 0 || qtd > cliente.total_pontos) return;
    setSalvando(true);
    await onConfirmar(
      cliente.cliente_id,
      qtd,
      tipo,
      tipo === 'valor' ? Number(valorDesconto) : undefined,
      tipo === 'manual' ? descricao : undefined
    );
    setSalvando(false);
    setPontos("");
    setValorDesconto("");
    setDescricao("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Resgatar Pontos
          </DialogTitle>
        </DialogHeader>
        {cliente && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{cliente.nome}</span> —{" "}
              <span className="font-semibold text-primary">{cliente.total_pontos} pts disponíveis</span>
            </p>
            <div className="space-y-1">
              <Label>Pontos a resgatar</Label>
              <Input
                type="number"
                min={1}
                max={cliente.total_pontos}
                value={pontos}
                onChange={e => setPontos(e.target.value)}
                placeholder="Ex: 100"
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo de resgate</Label>
              <Select value={tipo} onValueChange={v => setTipo(v as typeof tipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cupom">Gerar cupom de desconto</SelectItem>
                  <SelectItem value="valor">Desconto em R$</SelectItem>
                  <SelectItem value="manual">Benefício manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tipo === 'valor' && (
              <div className="space-y-1">
                <Label>Valor do desconto (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={valorDesconto}
                  onChange={e => setValorDesconto(e.target.value)}
                  placeholder="Ex: 15.00"
                />
              </div>
            )}
            {tipo === 'manual' && (
              <div className="space-y-1">
                <Label>Descrição do benefício</Label>
                <Input
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Ex: Brinde especial"
                />
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirmar} disabled={salvando || !pontos}>
            {salvando ? "Processando..." : "Confirmar resgate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog de Configurações ─────────────────────────────────────────────────

interface DialogConfigProps {
  open: boolean;
  onClose: () => void;
  config: ReturnType<typeof useFidelidade>['config'];
  niveis: FidelidadeNivel[];
  onSalvarConfig: ReturnType<typeof useFidelidade>['salvarConfig'];
  onSalvarNivel: ReturnType<typeof useFidelidade>['salvarNivel'];
  onDeletarNivel: ReturnType<typeof useFidelidade>['deletarNivel'];
}

function DialogConfig({ open, onClose, config, niveis, onSalvarConfig, onSalvarNivel, onDeletarNivel }: DialogConfigProps) {
  const [ativo, setAtivo] = useState(config?.ativo ?? false);
  const [pontosPorRealVenda, setPontosPorRealVenda] = useState(String(config?.pontos_por_real_venda ?? 1));
  const [pontosPorRealOS, setPontosPorRealOS] = useState(String(config?.pontos_por_real_os ?? 1));
  const [validadeDias, setValidadeDias] = useState(String(config?.validade_pontos_dias ?? ""));
  const [tipoResgate, setTipoResgate] = useState<'cupom' | 'valor' | 'manual'>(config?.tipo_resgate ?? 'cupom');
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const [nivelDialog, setNivelDialog] = useState(false);
  const [nivelEditando, setNivelEditando] = useState<Partial<FidelidadeNivel>>({});
  const [salvandoNivel, setSalvandoNivel] = useState(false);

  const handleSalvarConfig = async () => {
    setSalvandoConfig(true);
    await onSalvarConfig({
      ...(config?.id ? { id: config.id } : {}),
      ativo,
      pontos_por_real_venda: Number(pontosPorRealVenda),
      pontos_por_real_os: Number(pontosPorRealOS),
      validade_pontos_dias: validadeDias ? Number(validadeDias) : null,
      tipo_resgate: tipoResgate,
    });
    setSalvandoConfig(false);
  };

  const handleSalvarNivel = async () => {
    setSalvandoNivel(true);
    await onSalvarNivel(nivelEditando);
    setSalvandoNivel(false);
    setNivelDialog(false);
    setNivelEditando({});
  };

  const abrirNovoNivel = () => {
    setNivelEditando({ nome: "", pontos_minimos: 0, cor: "#6366f1", beneficio: "", ordem: niveis.length + 1 });
    setNivelDialog(true);
  };

  const abrirEditarNivel = (n: FidelidadeNivel) => {
    setNivelEditando({ ...n });
    setNivelDialog(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configurações de Fidelidade
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="pontuacao">
            <TabsList className="w-full">
              <TabsTrigger value="pontuacao" className="flex-1">Pontuação</TabsTrigger>
              <TabsTrigger value="niveis" className="flex-1">Níveis</TabsTrigger>
            </TabsList>

            <TabsContent value="pontuacao" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <Label>Programa ativo</Label>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>
              <div className="space-y-1">
                <Label>Pontos por R$1 em vendas</Label>
                <Input type="number" min={0} step={0.1} value={pontosPorRealVenda} onChange={e => setPontosPorRealVenda(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Pontos por R$1 em OS</Label>
                <Input type="number" min={0} step={0.1} value={pontosPorRealOS} onChange={e => setPontosPorRealOS(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Validade dos pontos</Label>
                <Select value={validadeDias || "sem_validade"} onValueChange={v => setValidadeDias(v === "sem_validade" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_validade">Sem validade</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                    <SelectItem value="180">180 dias</SelectItem>
                    <SelectItem value="365">365 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo de resgate padrão</Label>
                <Select value={tipoResgate} onValueChange={v => setTipoResgate(v as typeof tipoResgate)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cupom">Cupom de desconto</SelectItem>
                    <SelectItem value="valor">Desconto em R$</SelectItem>
                    <SelectItem value="manual">Benefício manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleSalvarConfig} disabled={salvandoConfig}>
                {salvandoConfig ? "Salvando..." : "Salvar configuração"}
              </Button>
            </TabsContent>

            <TabsContent value="niveis" className="space-y-3 mt-4">
              <Button size="sm" className="w-full" onClick={abrirNovoNivel}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar Nível
              </Button>
              {niveis.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-4">Nenhum nível criado ainda.</p>
              )}
              {niveis.map(n => (
                <div key={n.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: n.cor }} />
                    <div>
                      <p className="font-medium text-sm">{n.nome}</p>
                      <p className="text-xs text-muted-foreground">{n.pontos_minimos} pts mínimos{n.beneficio ? ` · ${n.beneficio}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => abrirEditarNivel(n)}>
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDeletarNivel(n.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={nivelDialog} onOpenChange={v => { if (!v) { setNivelDialog(false); setNivelEditando({}); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{nivelEditando.id ? "Editar Nível" : "Novo Nível"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={nivelEditando.nome ?? ""} onChange={e => setNivelEditando(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Bronze" />
            </div>
            <div className="space-y-1">
              <Label>Pontos mínimos</Label>
              <Input type="number" min={0} value={nivelEditando.pontos_minimos ?? 0} onChange={e => setNivelEditando(p => ({ ...p, pontos_minimos: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={nivelEditando.cor ?? "#6366f1"} onChange={e => setNivelEditando(p => ({ ...p, cor: e.target.value }))} className="w-10 h-10 rounded border cursor-pointer" />
                <span className="text-sm text-muted-foreground">{nivelEditando.cor ?? "#6366f1"}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Benefício (opcional)</Label>
              <Input value={nivelEditando.beneficio ?? ""} onChange={e => setNivelEditando(p => ({ ...p, beneficio: e.target.value }))} placeholder="Ex: 5% de desconto" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNivelDialog(false); setNivelEditando({}); }}>Cancelar</Button>
            <Button onClick={handleSalvarNivel} disabled={salvandoNivel || !nivelEditando.nome}>
              {salvandoNivel ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Fidelidade() {
  const { assinatura, carregando: carregandoAssinatura } = useAssinatura();
  const navigate = useNavigate();
  const { config, niveis, clientes, isLoading, salvarConfig, salvarNivel, deletarNivel, resgatar } = useFidelidade();
  const [busca, setBusca] = useState("");
  const [clienteResgate, setClienteResgate] = useState<ClienteFidelidade | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .eq('role', 'admin')
        .maybeSingle()
        .then(({ data: roleData }) => setIsAdmin(!!roleData));
    });
  }, []);

  console.log("Fidelidade page loaded", { config, niveis, clientes, isLoading });

  useEffect(() => {
    if (isLoading || config !== null) return;
    const configPadrao = {
      ativo: true,
      pontos_por_real_venda: 1,
      pontos_por_real_os: 2,
      validade_pontos_dias: 365,
      tipo_resgate: 'manual' as const,
    };
    salvarConfig(configPadrao);
  }, [isLoading, config]);

  useEffect(() => {
    if (isLoading || niveis.length !== 0) return;
    const niveisPadrao = [
      { nome: "Bronze", pontos_minimos: 0, cor: "#CD7F32", beneficio: "Cliente fiel", ordem: 1 },
      { nome: "Prata", pontos_minimos: 500, cor: "#C0C0C0", beneficio: "5% de desconto", ordem: 2 },
      { nome: "Ouro", pontos_minimos: 1500, cor: "#FFD700", beneficio: "10% de desconto", ordem: 3 },
    ];
    niveisPadrao.forEach(n => salvarNivel(n));
  }, [isLoading, niveis.length]);

  const isProfissional = ['profissional_mensal', 'profissional_anual', 'profissional_ultra_mensal', 'profissional_ultra_anual'].includes(assinatura?.plano_tipo ?? '');
  const semAcesso = !carregandoAssinatura && assinatura !== null && !isAdmin && !isProfissional;

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
          <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
            <Lock className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold">Funcionalidade Exclusiva</h2>
          <p className="text-muted-foreground max-w-md">
            O programa de Fidelidade de Clientes está disponível apenas
            no plano <strong>Profissional</strong>. Faça upgrade para
            desbloquear esta e outras funcionalidades avançadas.
          </p>
          <Button onClick={() => navigate('/plano')}>
            Ver Planos
          </Button>
        </div>
      </AppLayout>
    );
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const totalPontosDistribuidos = clientes.reduce((s, c) => s + Math.max(c.total_pontos, 0), 0);

  const contagemNiveis = niveis.map(n => ({
    ...n,
    count: clientes.filter(c => c.nivel?.id === n.id).length,
  }));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-7 h-7 text-yellow-500" />
            <div>
              <h1 className="text-2xl font-bold">Fidelidade de Clientes</h1>
              <p className="text-sm text-muted-foreground">Gerencie pontos e recompensas</p>
              <p className="text-sm text-muted-foreground mt-1">
                💡 O programa já vem configurado com um modelo de pontuação padrão.
                Clique em <strong>Configurações</strong> para personalizar pontos,
                níveis e tipo de resgate conforme sua loja.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setConfigOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Configurações
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" /> Clientes no programa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <p className="text-3xl font-bold">{clientes.length}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Star className="w-4 h-4" /> Total de pontos distribuídos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <p className="text-3xl font-bold">{totalPontosDistribuidos.toLocaleString("pt-BR")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Award className="w-4 h-4" /> Clientes por nível
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-32" /> : (
                <div className="flex flex-wrap gap-2">
                  {contagemNiveis.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Sem níveis criados</span>
                  ) : contagemNiveis.map(n => (
                    <Badge key={n.id} style={{ backgroundColor: n.cor, color: "#fff" }}>
                      {n.nome}: {n.count}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {/* Grid de clientes */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum cliente no programa ainda</p>
            <p className="text-sm mt-1">Os clientes aparecerão aqui conforme acumulam pontos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clientesFiltrados.map(c => (
              <Card key={c.cliente_id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-base leading-tight">{c.nome}</p>
                      {c.celular && <p className="text-xs text-muted-foreground">{c.celular}</p>}
                    </div>
                    <NivelBadge nivel={c.nivel} />
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-primary">{c.total_pontos.toLocaleString("pt-BR")}</span>
                    <span className="text-sm text-muted-foreground">pts</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground border rounded-lg p-2">
                    <div>
                      <p className="font-semibold text-foreground">{c.total_vendas + c.total_os}</p>
                      <p>compras</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{formatarMoeda(c.valor_total_gasto)}</p>
                      <p>gasto total</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{formatarData(c.ultima_compra)}</p>
                      <p>última compra</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="w-full"
                    variant="outline"
                    disabled={c.total_pontos <= 0}
                    onClick={() => setClienteResgate(c)}
                  >
                    <Gift className="w-4 h-4 mr-2" />
                    Resgatar Pontos
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <DialogResgate
        cliente={clienteResgate}
        open={!!clienteResgate}
        onClose={() => setClienteResgate(null)}
        onConfirmar={resgatar}
      />

      <DialogConfig
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        config={config}
        niveis={niveis}
        onSalvarConfig={salvarConfig}
        onSalvarNivel={salvarNivel}
        onDeletarNivel={deletarNivel}
      />
    </AppLayout>
  );
}

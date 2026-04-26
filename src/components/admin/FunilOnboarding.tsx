import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useOnboardingFunnel, PeriodoFiltro, FunnelStep } from '@/hooks/useOnboardingFunnel';
import { Users, CheckCircle, XCircle, Clock, TrendingDown, Calendar } from 'lucide-react';

function FunnelBar({ step, maxCount }: { step: FunnelStep; maxCount: number }) {
  const width = step.percentage;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">{step.label}</span>
        <span className="font-medium">{step.count}</span>
      </div>
      <div className="h-8 bg-muted rounded-md overflow-hidden">
        <div 
          className="h-full bg-primary/80 rounded-md transition-all duration-500 flex items-center justify-end pr-2"
          style={{ width: `${width}%` }}
        >
          {width > 15 && (
            <span className="text-xs text-primary-foreground font-medium">
              {step.percentage}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function FunnelColumn({ title, steps, color }: { title: string; steps: FunnelStep[]; color: string }) {
  const maxCount = steps[0]?.count || 1;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          {title}
          <Badge variant="outline" className="ml-auto">
            {steps[0]?.count || 0} usuários
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.length === 0 || steps[0]?.count === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum usuário neste fluxo
          </p>
        ) : (
          steps.map((step) => (
            <FunnelBar key={step.id} step={step} maxCount={maxCount} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  subvalue,
  color = 'text-foreground'
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number; 
  subvalue?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className={`p-2 rounded-md bg-background ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
        {subvalue && <p className="text-xs text-muted-foreground">{subvalue}</p>}
      </div>
    </div>
  );
}

export function FunilOnboarding() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('30d');
  const { funnelData, metrics, loading } = useOnboardingFunnel(periodo);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com filtro */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Funil de Conversão</h3>
          <p className="text-sm text-muted-foreground">
            Acompanhe a jornada dos usuários no onboarding
          </p>
        </div>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Métricas resumidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Users}
          label="Total de Usuários"
          value={metrics.total}
        />
        <MetricCard
          icon={CheckCircle}
          label="Completaram"
          value={metrics.completaram}
          subvalue={`${metrics.taxaCompletacao}%`}
          color="text-green-600"
        />
        <MetricCard
          icon={XCircle}
          label="Pularam"
          value={metrics.pularam}
          subvalue={`${metrics.taxaPulou}%`}
          color="text-orange-600"
        />
        <MetricCard
          icon={Clock}
          label="Em Andamento"
          value={metrics.emAndamento}
        />
      </div>

      {/* Funis lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FunnelColumn
          title="Assistência Técnica"
          steps={funnelData.assistencia}
          color="bg-blue-500"
        />
        <FunnelColumn
          title="Venda de Dispositivos"
          steps={funnelData.vendas}
          color="bg-green-500"
        />
      </div>

      {/* Métricas detalhadas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Métricas Detalhadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Taxa de Conclusão</span>
              </div>
              <p className="text-2xl font-bold">{metrics.taxaCompletacao}%</p>
            </div>
            
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Tempo Médio</span>
              </div>
              <p className="text-2xl font-bold">
                {metrics.tempoMedioCompletacao !== null 
                  ? `${metrics.tempoMedioCompletacao.toFixed(1)} dias`
                  : 'N/A'
                }
              </p>
            </div>
            
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingDown className="h-4 w-4" />
                <span className="text-sm">Maior Abandono</span>
              </div>
              <p className="text-2xl font-bold">
                {metrics.etapaMaiorAbandono || 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

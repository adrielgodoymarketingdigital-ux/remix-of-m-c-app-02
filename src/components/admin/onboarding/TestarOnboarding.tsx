import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  RefreshCw, 
  ExternalLink,
  User,
  CreditCard,
  Clock,
  AlertTriangle
} from "lucide-react";
import { OnboardingSimulator } from './OnboardingSimulator';

type PerfilSimulacao = 'trial_novo' | 'trial_ativo' | 'basico' | 'intermediario';

interface PerfilInfo {
  id: PerfilSimulacao;
  nome: string;
  descricao: string;
  icon: React.ReactNode;
  plano: string;
  status: string;
}

const PERFIS: PerfilInfo[] = [
  {
    id: 'trial_novo',
    nome: 'Trial Novo',
    descricao: 'Usuário em trial que nunca usou o sistema',
    icon: <Clock className="h-4 w-4" />,
    plano: 'trial',
    status: 'trialing'
  },
  {
    id: 'trial_ativo',
    nome: 'Trial Ativo',
    descricao: 'Usuário em trial que já fez algumas ações',
    icon: <User className="h-4 w-4" />,
    plano: 'trial',
    status: 'trialing'
  },
  {
    id: 'basico',
    nome: 'Básico',
    descricao: 'Usuário com plano Básico Mensal',
    icon: <CreditCard className="h-4 w-4" />,
    plano: 'basico_mensal',
    status: 'active'
  },
  {
    id: 'intermediario',
    nome: 'Intermediário',
    descricao: 'Usuário com plano Intermediário',
    icon: <CreditCard className="h-4 w-4" />,
    plano: 'intermediario_mensal',
    status: 'active'
  }
];

export function TestarOnboarding() {
  const [perfilSelecionado, setPerfilSelecionado] = useState<PerfilSimulacao>('trial_novo');
  const [testando, setTestando] = useState(false);
  const [key, setKey] = useState(0); // Para forçar re-render do simulador

  const perfilAtual = PERFIS.find(p => p.id === perfilSelecionado)!;

  const handleReiniciar = () => {
    setKey(prev => prev + 1);
  };

  const handleAbrirNovaJanela = () => {
    // Abrir em uma nova janela (simulação)
    window.open(`${window.location.origin}/dashboard?simulate_onboarding=true&perfil=${perfilSelecionado}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Escolha um Perfil para Simular
          </CardTitle>
          <CardDescription>
            Teste como o onboarding aparecerá para diferentes tipos de usuários
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PERFIS.map(perfil => (
              <button
                key={perfil.id}
                onClick={() => {
                  setPerfilSelecionado(perfil.id);
                  setKey(prev => prev + 1);
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  perfilSelecionado === perfil.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {perfil.icon}
                  <span className="font-medium text-sm">{perfil.nome}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {perfil.descricao}
                </p>
              </button>
            ))}
          </div>
          
          {/* Info do perfil selecionado */}
          <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Plano: </span>
                <Badge variant="outline">{perfilAtual.plano}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Status: </span>
                <Badge variant="outline">{perfilAtual.status}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleReiniciar}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reiniciar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simulador */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Play className="h-5 w-5" />
              Simulação do Onboarding
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              Perfil: {perfilAtual.nome}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Aviso */}
          <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Esta é uma simulação. Ações como navegação e cliques em botões são simulados e não afetam dados reais.
            </p>
          </div>

          {/* Container do Simulador */}
          <div className="border-2 border-dashed rounded-xl p-4 bg-muted/30 min-h-[500px] flex items-center justify-center">
            <OnboardingSimulator 
              key={key}
              perfil={perfilAtual}
              onReiniciar={handleReiniciar}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

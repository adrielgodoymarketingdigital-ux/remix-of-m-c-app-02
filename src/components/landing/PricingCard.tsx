import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

export const TODAS_FUNCIONALIDADES = [
  "Dashboard",
  "PDV",
  "Vendas",
  "Dispositivos",
  "Produtos e Peças",
  "Ordem de Serviço",
  "Orçamentos",
  "Serviços",
  "Fornecedores",
  "Clientes",
  "Contas",
  "Financeiro",
  "Catálogo Online",
  "Assinatura Digital do Cliente na O.S",
  "Funcionários e Comissões ilimitados",
  "Notificações Automáticas no Celular",
  "Aniversariantes do Mês com WhatsApp",
  "Consulta de IMEI pela Anatel",
  "Verificação de garantia Apple",
  "📡 Acompanhamento de OS (10/mês)",
  "📡 Acompanhamento de OS (50/mês)",
  "📡 Acompanhamento de OS (Ilimitado)",
  "Suporte por email",
  "Suporte via WhatsApp",
  "Suporte prioritário por WhatsApp",
];

export const FUNCIONALIDADES_POR_PLANO: Record<string, string[]> = {
  free: [
    "Dashboard", "PDV", "Dispositivos", "Produtos e Peças",
    "Ordem de Serviço", "Serviços", "Suporte por email",
  ],
  basico_mensal: [
    "Dashboard", "PDV", "Vendas", "Dispositivos", "Produtos e Peças",
    "Ordem de Serviço", "Orçamentos", "Serviços",
    "Suporte por email",
  ],
  basico_anual: [
    "Dashboard", "PDV", "Vendas", "Dispositivos", "Produtos e Peças",
    "Ordem de Serviço", "Orçamentos", "Serviços",
    "Suporte por email",
  ],
  intermediario_mensal: [
    "Dashboard", "PDV", "Vendas", "Dispositivos", "Produtos e Peças",
    "Ordem de Serviço", "Orçamentos", "Serviços", "Fornecedores", "Clientes",
    "Contas", "Financeiro", "Catálogo Online", "Assinatura Digital do Cliente na O.S",
    "📡 Acompanhamento de OS (10/mês)",
    "Suporte por email", "Suporte via WhatsApp",
  ],
  intermediario_anual: [
    "Dashboard", "PDV", "Vendas", "Dispositivos", "Produtos e Peças",
    "Ordem de Serviço", "Orçamentos", "Serviços", "Fornecedores", "Clientes",
    "Contas", "Financeiro", "Catálogo Online", "Assinatura Digital do Cliente na O.S",
    "📡 Acompanhamento de OS (10/mês)",
    "Suporte por email", "Suporte via WhatsApp",
  ],
  profissional_mensal: [
    "Dashboard", "PDV", "Vendas", "Dispositivos", "Produtos e Peças",
    "Ordem de Serviço", "Orçamentos", "Serviços", "Fornecedores", "Clientes",
    "Contas", "Financeiro", "Catálogo Online", "Assinatura Digital do Cliente na O.S",
    "Funcionários e Comissões ilimitados", "Notificações Automáticas no Celular",
    "Aniversariantes do Mês com WhatsApp", "Consulta de IMEI pela Anatel",
    "Verificação de garantia Apple",
    "📡 Acompanhamento de OS (50/mês)",
    "Suporte por email", "Suporte via WhatsApp",
    "Suporte prioritário por WhatsApp",
  ],
  profissional_anual: [
    "Dashboard", "PDV", "Vendas", "Dispositivos", "Produtos e Peças",
    "Ordem de Serviço", "Orçamentos", "Serviços", "Fornecedores", "Clientes",
    "Contas", "Financeiro", "Catálogo Online", "Assinatura Digital do Cliente na O.S",
    "Funcionários e Comissões ilimitados", "Notificações Automáticas no Celular",
    "Aniversariantes do Mês com WhatsApp", "Consulta de IMEI pela Anatel",
    "Verificação de garantia Apple",
    "📡 Acompanhamento de OS (50/mês)",
    "Suporte por email", "Suporte via WhatsApp",
    "Suporte prioritário por WhatsApp",
  ],
};

interface PricingCardProps {
  nome: string;
  preco: number;
  periodo: string;
  limites?: string[];
  popular?: boolean;
  planoKey: string;
  precoAnual?: number;
  isAnual: boolean;
  isFree?: boolean;
  precoOriginal?: number;
}

export function PricingCard({ 
  nome, preco, periodo, limites, popular, planoKey,
  precoAnual, isAnual, isFree, precoOriginal
}: PricingCardProps) {
  const navigate = useNavigate();

  const precoExibido = isAnual && precoAnual ? precoAnual : preco;
  const economia = isAnual && precoAnual ? Math.round(((preco * 12 - precoAnual) / (preco * 12)) * 100) : 0;
  const periodoExibido = isAnual ? "/ano" : periodo;
  const funcionalidadesDisponiveis = FUNCIONALIDADES_POR_PLANO[planoKey] || [];

  const handleCheckout = () => {
    if (isFree) {
      navigate('/auth?tab=signup');
    } else {
      navigate(`/cadastro-plano?plan=${planoKey}`);
    }
  };

  const getThemeClasses = () => {
    if (isFree) {
      return {
        gradient: "from-slate-50 via-slate-100 to-slate-50",
        border: "border-slate-200",
        accent: "text-slate-500",
        glow: "",
        iconBg: "bg-slate-100",
        iconColor: "text-slate-500",
        buttonClass: "bg-slate-700 hover:bg-slate-800 text-white",
        dividerBg: "from-slate-100 to-slate-50",
        Icon: Zap,
      };
    }
    if (popular) {
      return {
        gradient: "from-blue-50 via-white to-blue-50",
        border: "border-blue-300",
        accent: "text-blue-600",
        glow: "shadow-lg shadow-blue-500/15",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
        buttonClass: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25",
        dividerBg: "from-blue-50 to-white",
        Icon: Crown,
      };
    }
    if (planoKey.includes("profissional")) {
      return {
        gradient: "from-violet-50 via-white to-violet-50",
        border: "border-violet-300",
        accent: "text-violet-600",
        glow: "shadow-lg shadow-violet-500/10",
        iconBg: "bg-violet-100",
        iconColor: "text-violet-600",
        buttonClass: "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25",
        dividerBg: "from-violet-50 to-white",
        Icon: Rocket,
      };
    }
    return {
      gradient: "from-cyan-50 via-white to-cyan-50",
      border: "border-cyan-200",
      accent: "text-cyan-600",
      glow: "",
      iconBg: "bg-cyan-100",
      iconColor: "text-cyan-600",
      buttonClass: "bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white",
      dividerBg: "from-cyan-50 to-white",
      Icon: Zap,
    };
  };

  const theme = getThemeClasses();

  return (
    <div className={cn(
      "relative group rounded-2xl overflow-hidden flex flex-col",
      popular && "lg:scale-105 z-10"
    )}>
      <div className={cn(
        "absolute -inset-0.5 rounded-2xl bg-gradient-to-b opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm",
        popular ? "from-blue-500/20 to-indigo-500/20" : "from-slate-300/50 to-slate-200/30"
      )} />
      
      <div className={cn(
        "relative flex-1 flex flex-col rounded-2xl border p-6 transition-all duration-300",
        `bg-gradient-to-b ${theme.gradient}`,
        theme.border,
        theme.glow
      )}>
        {popular && (
          <div className="absolute -top-px left-1/2 -translate-x-1/2">
            <div className="px-4 py-1 rounded-b-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider">
              ⚡ Mais Popular
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4 mt-2">
          <div className={cn("p-2 rounded-lg", theme.iconBg)}>
            <theme.Icon className={cn("h-5 w-5", theme.iconColor)} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{nome}</h3>
            {isAnual && economia > 0 && !isFree && (
              <Badge className="mt-1 bg-green-100 text-green-600 border-green-200 text-[10px]">
                Economia de {economia}%
              </Badge>
            )}
          </div>
        </div>

        <div className="mb-4">
          {precoOriginal && !isFree && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-slate-400 line-through">
                R$ {precoOriginal.toFixed(2).replace('.', ',')}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold border border-red-200 uppercase">
                Desconto
              </span>
            </div>
          )}
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-slate-900">
              {isFree ? "R$ 0" : `R$ ${precoExibido.toFixed(2).replace('.', ',')}`}
            </span>
            <span className="text-slate-500 text-sm">{periodoExibido}</span>
          </div>
          {isAnual && precoAnual && !isFree && (
            <p className="text-xs text-slate-500 mt-1">
              = R$ {(precoAnual / 12).toFixed(2).replace('.', ',')}/mês
            </p>
          )}
        </div>

        {limites && limites.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-medium">Limites do Plano</p>
            <div className="space-y-1">
              {limites.map((limite, index) => (
                <p key={index} className="text-xs text-slate-700">• {limite}</p>
              ))}
            </div>
          </div>
        )}

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center">
            <span className={cn("px-3 text-[10px] uppercase tracking-wider text-slate-500 bg-gradient-to-b", theme.dividerBg)}>
              Funcionalidades
            </span>
          </div>
        </div>

        <ul className="space-y-2 flex-1 mb-6">
          {funcionalidadesDisponiveis.map((funcionalidade, index) => {
            const indisponivel = funcionalidade.startsWith("❌");
            return (
              <li key={index} className="flex items-start gap-2">
                {indisponivel ? (
                  <div className="p-0.5 rounded-full bg-slate-100 shrink-0">
                    <Check className="h-3 w-3 text-slate-300" />
                  </div>
                ) : (
                  <div className={cn("p-0.5 rounded-full shrink-0", theme.iconBg)}>
                    <Check className={cn("h-3 w-3", theme.iconColor)} />
                  </div>
                )}
                <span className={cn("text-xs leading-relaxed", indisponivel ? "text-slate-400" : "text-slate-700")}>
                  {funcionalidade}
                </span>
              </li>
            );
          })}
        </ul>

        <Button 
          className={cn("w-full h-11 font-semibold transition-all", theme.buttonClass)}
          onClick={handleCheckout}
        >
          {isFree ? "Testar Grátis por 24h" : "Assinar Agora"}
        </Button>

        <p className="text-center text-[10px] text-slate-500 mt-3">
          {isFree ? "⭐ 24h com acesso Premium completo · Sem cartão" : "🔒 Pagamento seguro via Stripe"}
        </p>
      </div>
    </div>
  );
}

import { ChevronRight, LayoutDashboard, ShoppingCart, ClipboardCheck, Package, Wrench, Smartphone, BookOpen, Truck, Users, FileSpreadsheet, Receipt, BarChart3, FileText, Settings, HelpCircle, CreditCard, Video, Folder, Sparkles, type LucideIcon } from "lucide-react";

type IconLike = LucideIcon | React.FC<{ className?: string }>;

// Ícone composto: Smartphone com engrenagem sobreposta (usado para "Ordem de Serviço")
const SmartphoneWithGear: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`relative inline-flex ${className ?? ""}`}>
    <Smartphone className="h-full w-full" />
    <Settings
      className="absolute -bottom-1 -right-1 h-[60%] w-[60%] bg-card rounded-full p-[1px]"
      strokeWidth={2.5}
    />
  </div>
);

const categoriaIconMap: Record<string, IconLike> = {
  "dashboard": LayoutDashboard,
  "pdv": ShoppingCart,
  "ordem de serviço": SmartphoneWithGear,
  "ordem de servico": SmartphoneWithGear,
  "produtos e peças": Package,
  "produtos": Package,
  "serviços": Wrench,
  "dispositivos": Smartphone,
  "dispositivos e origem de dispositivos": Smartphone,
  "catálogo": BookOpen,
  "origem de dispositivos": Smartphone,
  "fornecedores": Truck,
  "clientes": Users,
  "orçamentos": FileSpreadsheet,
  "contas": Receipt,
  "vendas": BarChart3,
  "relatórios": FileText,
  "financeiro": FileText,
  "equipe": Users,
  "configurações": Settings,
  "suporte": HelpCircle,
  "plano": CreditCard,
  "tutoriais": Video,
  "novidades": Sparkles,
};

function getIconForCategoria(categoria: string): IconLike {
  return categoriaIconMap[categoria.toLowerCase().trim()] || Folder;
}

// Cor de acento de cada categoria (identidade da pasta, não muda com o tema)
const categoriaCorMap: Record<string, string> = {
  "catálogo": "#096bff",
  "clientes": "#096bff",
  "configurações": "#8000f7",
  "contas": "#00ad85",
  "dashboard": "#fc8a00",
  "dispositivos e origem de dispositivos": "#ed3c8b",
  "dispositivos": "#ed3c8b",
  "origem de dispositivos": "#ed3c8b",
  "equipe": "#8500eb",
  "financeiro": "#00a6ba",
  "fornecedores": "#fa4545",
  "novidades": "#096bff",
  "ordem de serviço": "#8a00ee",
  "ordem de servico": "#8a00ee",
};

const categoriaDescricaoMap: Record<string, string> = {
  "catálogo": "Aprenda a gerenciar produtos, marcas e modelos.",
  "clientes": "Cadastro, histórico e gerenciamento de clientes.",
  "configurações": "Personalize o sistema conforme sua necessidade.",
  "contas": "Controle de contas a pagar e a receber.",
  "dashboard": "Entenda seus indicadores e relatórios.",
  "dispositivos e origem de dispositivos": "Gerencie dispositivos e suas origens.",
  "equipe": "Cadastre e gerencie sua equipe de trabalho.",
  "financeiro": "Acompanhe o fluxo financeiro da sua empresa.",
  "fornecedores": "Gerencie seus fornecedores e compras.",
  "novidades": "Fique por dentro das atualizações do sistema.",
  "ordem de serviço": "Criação, acompanhamento e finalização de OS.",
  "ordem de servico": "Criação, acompanhamento e finalização de OS.",
};

// Nome exibido quando o salvo no banco difere da grafia correta (o dado não muda)
const categoriaNomeMap: Record<string, string> = {
  "ordem de servico": "Ordem de Serviço",
};

export function getNomeCategoria(categoria: string): string {
  return categoriaNomeMap[categoria.toLowerCase().trim()] ?? categoria;
}

export function getDescricaoCategoria(categoria: string): string | null {
  return categoriaDescricaoMap[categoria.toLowerCase().trim()] ?? null;
}

// Mistura a cor com branco: no tema escuro os acentos fortes (roxos) somem no fundo
function clarear(hex: string, quanto: number): string {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * quanto).toString(16).padStart(2, "0");
  };
  return `#${canal(1)}${canal(3)}${canal(5)}`;
}

/**
 * Variáveis CSS do acento: cor cheia (mais clara no escuro) e fundos translúcidos (12% claro, 18% escuro).
 * Sem cor mapeada, usa o primary do tema.
 */
export function getEstiloAcento(categoria: string): React.CSSProperties {
  const cor = categoriaCorMap[categoria.toLowerCase().trim()];
  const vars = cor
    ? {
        "--acento": cor,
        "--acento-escuro": clarear(cor, 0.35),
        "--acento-suave": `${cor}1f`,
        "--acento-suave-escuro": `${cor}2e`,
        "--acento-borda": `${cor}66`,
      }
    : {
        "--acento": "hsl(var(--primary))",
        "--acento-escuro": "hsl(var(--primary))",
        "--acento-suave": "hsl(var(--primary) / 0.12)",
        "--acento-suave-escuro": "hsl(var(--primary) / 0.18)",
        "--acento-borda": "hsl(var(--primary) / 0.4)",
      };
  return vars as React.CSSProperties;
}

interface CardCategoriaTutorialProps {
  categoria: string;
  quantidadeVideos: number;
  onClick: () => void;
}

export function CardCategoriaTutorial({ categoria, quantidadeVideos, onClick }: CardCategoriaTutorialProps) {
  const Icon = getIconForCategoria(categoria);

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-border transition-all text-left w-full"
    >
      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-foreground truncate">{getNomeCategoria(categoria)}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {quantidadeVideos} {quantidadeVideos === 1 ? "vídeo" : "vídeos"}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
    </button>
  );
}

export function CardCategoriaTutorialDesktop({ categoria, quantidadeVideos, onClick }: CardCategoriaTutorialProps) {
  const Icon = getIconForCategoria(categoria);
  const descricao = getDescricaoCategoria(categoria);

  return (
    <button
      onClick={onClick}
      style={getEstiloAcento(categoria)}
      className="group flex min-h-[93px] w-full items-center gap-5 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[color:var(--acento-borda)] hover:shadow-md"
    >
      <div className="grid h-[70px] w-[70px] shrink-0 place-items-center rounded-2xl bg-[var(--acento-suave)] text-[color:var(--acento)] dark:bg-[var(--acento-suave-escuro)] dark:text-[color:var(--acento-escuro)]">
        <Icon className="h-[31px] w-[31px]" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold tracking-tight text-foreground">
          {getNomeCategoria(categoria)}
        </h3>
        {descricao && (
          <p className="mb-2 line-clamp-2 text-xs leading-snug text-muted-foreground">{descricao}</p>
        )}
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Video className="h-3.5 w-3.5" />
          {quantidadeVideos} {quantidadeVideos === 1 ? "vídeo" : "vídeos"}
        </span>
      </div>
      <div className="grid h-[39px] w-[39px] shrink-0 place-items-center rounded-full bg-[var(--acento-suave)] text-[color:var(--acento)] transition-transform group-hover:translate-x-0.5 dark:bg-[var(--acento-suave-escuro)] dark:text-[color:var(--acento-escuro)]">
        <ChevronRight className="h-[18px] w-[18px]" />
      </div>
    </button>
  );
}

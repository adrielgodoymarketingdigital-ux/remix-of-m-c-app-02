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
        <h3 className="text-sm font-medium text-foreground truncate">{categoria}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {quantidadeVideos} {quantidadeVideos === 1 ? "vídeo" : "vídeos"}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
    </button>
  );
}

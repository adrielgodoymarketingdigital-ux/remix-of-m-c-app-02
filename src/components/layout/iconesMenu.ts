/**
 * Ícones do menu principal e do menu de administração, por rota — os mesmos
 * na barra lateral (desktop) e no menu do celular/PWA. Itens e regras de
 * visibilidade ficam em src/lib/menu/menuPrincipal.ts.
 */
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Gift,
  HelpCircle,
  Layers,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Package,
  PackageCheck,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tablet,
  Ticket,
  Truck,
  Users,
  Video,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { ADMIN_MENU, MENU_PRINCIPAL, type ItemMenu } from "@/lib/menu/menuPrincipal";

export const ICONES_MENU: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/pdv": ShoppingCart,
  "/os": ClipboardCheck,
  "/produtos": Package,
  "/compatibilidade-pelicula": ShieldCheck,
  "/servicos": WrenchIcon,
  "/dispositivos": Tablet,
  "/remessas": PackageCheck,
  "/catalogo": BookOpen,
  "/origem-dispositivos": ShoppingBag,
  "/fornecedores": Truck,
  "/clientes": Users,
  "/fidelidade": Gift,
  "/orcamentos": FileSpreadsheet,
  "/pedidos": ClipboardList,
  "/contas": Receipt,
  "/vendas": BarChart3,
  "/financeiro": FileText,
  "/extrato": ScrollText,
  "/relatorios": FileText,
  "/equipe": Users,
  "/configuracoes": Settings,
  "/suporte": HelpCircle,
  "/plano": CreditCard,
  "/tutoriais": Video,
  "/baixar-app": Smartphone,
  "/multi-empresas": Building2,
  "/precificador": Calculator,
};

export const ICONES_ADMIN: Record<string, LucideIcon> = {
  "/admin/usuarios": Users,
  "/admin/financeiro": DollarSign,
  "/admin/cupons": Ticket,
  "/admin/novidades": Sparkles,
  "/admin/onboarding": ClipboardCheck,
  "/admin/push": Bell,
  "/admin/feedbacks": Megaphone,
  "/admin/chat": MessageCircle,
  "/admin/avisos": Megaphone,
  "/admin/notificacoes": Bell,
  "/admin/alteracoes-correcoes": ClipboardList,
  "/admin/compatibilidade-pelicula": Layers,
};

export type ItemMenuComIcone = ItemMenu & { icon: LucideIcon };

/** MENU_PRINCIPAL com o ícone de cada item (rota sem ícone mapeado cai em FileText). */
export const MENU_PRINCIPAL_COM_ICONE: ItemMenuComIcone[] = MENU_PRINCIPAL.map((item) => ({
  ...item,
  icon: ICONES_MENU[item.url] ?? FileText,
}));

export const ADMIN_MENU_COM_ICONE = ADMIN_MENU.map((item) => ({ ...item, icon: ICONES_ADMIN[item.url] ?? FileText }));

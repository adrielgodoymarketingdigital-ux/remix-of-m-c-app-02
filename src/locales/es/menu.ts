// Namespace "menu" en español neutro latinoamericano (glosario: docs/i18n/glosario-es.md).
// Baixado só quando o idioma "es" é aplicado (chunk próprio).
import type menuPtBR from "../pt-BR/menu";
import type { Traducao } from "../tipos";

const menu: Traducao<typeof menuPtBR> = {
  itens: {
    dashboard: "Panel",
    pdv: "Punto de venta",
    os: "Orden de servicio",
    produtos: "Productos y repuestos",
    "compatibilidade-pelicula": "Comp. Mica/Vidrio",
    servicos: "Servicios",
    dispositivos: "Equipos",
    remessas: "Envíos corporativos",
    catalogo: "Catálogo",
    "origem-dispositivos": "Origen de equipos",
    fornecedores: "Proveedores",
    clientes: "Clientes",
    orcamentos: "Presupuestos",
    pedidos: "Pedidos/Encargos",
    contas: "Cuentas",
    vendas: "Ventas",
    financeiro: "Finanzas",
    equipe: "Personal",
    configuracoes: "Configuración",
    configuracoes_fiscal: "Fiscal",
    "configuracoes_fiscal_xml-compra": "Importar XML de compra",
    suporte: "Soporte",
    plano: "Plan",
    tutoriais: "Tutoriales",
    "baixar-app": "Descargar app",
    "multi-empresas": "Multiempresa",
    precificador: "Calculadora de precios",
  },
  subitens: {
    clientes: "👥 Clientes",
    fidelidade: "🏆 Fidelización",
    financeiro: "💰 Cuentas por pagar/cobrar",
    extrato: "📒 Movimientos",
    relatorios: "📊 Reportes",
  },
  grupos: {
    atendimento: "Atención",
    estoque: "Inventario",
    pessoas: "Personas",
    administrativo: "Administración",
    "conta-suporte": "Cuenta y soporte",
  },
  admin: {
    mostrarMenu: "Mostrar menú admin",
    verComoUsuario: "Ver como usuario",
    itens: {
      admin_usuarios: "Usuarios",
      admin_financeiro: "Finanzas",
      admin_marketing: "Marketing",
      admin_cupons: "Cupones",
      admin_novidades: "Novedades",
      admin_onboarding: "Onboarding",
      admin_push: "Notificaciones push",
      admin_feedbacks: "Comentarios",
      admin_chat: "Chat de soporte",
      admin_avisos: "Avisos",
      admin_notificacoes: "Notificaciones",
      "admin_alteracoes-correcoes": "Cambios/Correcciones",
      "admin_compatibilidade-pelicula": "Compatibilidad de mica y vidrio",
    },
  },
  ajuda: "Ayuda",
  sair: "Salir",
};

export default menu;

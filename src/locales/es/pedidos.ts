// Namespace "pedidos" en español neutro latinoamericano (glosario: docs/i18n/glosario-es.md).
import type pedidosPtBR from "../pt-BR/pedidos";
import type { Traducao } from "../tipos";

const pedidos: Traducao<typeof pedidosPtBR> = {
  telaDesktop: {
    titulo: "Pedidos / Encargos",
    subtitulo: "Gestione los pedidos y encargos de sus clientes",
    novoPedido: "Nuevo pedido",
    abasRotulo: "Secciones de Pedidos / Encargos",
    abas: {
      pedidos: "Pedidos",
      listaCompras: "Lista de compras",
    },
    indicadores: {
      total: "Total de pedidos",
      totalLegenda: "pedidos registrados",
      aguardando: "En espera",
      aguardandoLegenda: "con estado En espera",
      chegaram: "Llegaron",
      chegaramLegenda: "con estado Llegó",
      aReceber: "Pedidos por cobrar",
      aReceberLegenda: "sin pagar y en curso",
    },
  },
};

export default pedidos;

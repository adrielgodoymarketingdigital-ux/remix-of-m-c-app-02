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
    status: {
      aguardando: "En espera",
      confirmado: "Confirmado",
      chegou: "Llegó",
      entregue: "Entregado",
      cancelado: "Cancelado",
    },
    filtros: {
      busca: "Buscar por cliente, descripción o teléfono...",
      buscaRotulo: "Buscar pedidos",
      statusRotulo: "Filtrar por estado",
      todosStatus: "Todos los estados",
      limpar: "Limpiar filtros",
      encontrados_zero: "Ningún pedido encontrado",
      encontrados_one: "{{count}} pedido encontrado",
      encontrados_other: "{{count}} pedidos encontrados",
    },
    tabela: {
      colunas: {
        cliente: "Cliente",
        descricao: "Descripción",
        previsao: "Previsión",
        data: "Fecha",
        valor: "Valor",
        status: "Estado",
        pagamento: "Pago",
        acoes: "Acciones",
      },
      previsaoDica: "Fecha prevista de llegada",
      dataDica: "Fecha en que se registró el pedido",
      pago: "Pagado",
      naoPago: "Sin pagar",
      editar: "Editar pedido",
      excluir: "Eliminar pedido",
      vazioTitulo: "Aún no hay pedidos registrados.",
      vazioTexto: "Comience agregando un nuevo pedido o encargo de un cliente.",
      semResultadoTitulo: "Ningún pedido encontrado",
      semResultadoTexto: "Pruebe otra búsqueda o limpie los filtros.",
      exibindo_zero: "Ningún pedido para mostrar",
      exibindo_one: "Mostrando {{inicio}} a {{fim}} de {{count}} pedido",
      exibindo_other: "Mostrando {{inicio}} a {{fim}} de {{count}} pedidos",
      paginacao: "Páginas de la lista de pedidos",
      anterior: "Página anterior",
      proxima: "Página siguiente",
      pagina: "Página {{numero}}",
      porPagina: "{{quantidade}} por página",
      porPaginaRotulo: "Pedidos por página",
    },
  },
};

export default pedidos;

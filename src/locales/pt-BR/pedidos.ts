// Namespace "pedidos" em pt-BR: vai embutido no pacote principal (src/lib/i18n/instancia.ts).
const pedidos = {
  // Tela Pedidos / Encomendas no computador (>= 1024px): cabeçalho, abas e indicadores
  // (components/pedidos/TopoPedidosDesktop). Celular e tablet seguem com o texto fixo de antes;
  // os diálogos Novo/Editar/Excluir ficam em pt-BR, como estão.
  telaDesktop: {
    titulo: "Pedidos / Encomendas",
    subtitulo: "Gerencie pedidos e encomendas de clientes",
    novoPedido: "Novo Pedido",
    abasRotulo: "Seções de Pedidos / Encomendas",
    abas: {
      pedidos: "Pedidos",
      listaCompras: "Lista de Compras",
    },
    indicadores: {
      total: "Total de Pedidos",
      totalLegenda: "pedidos cadastrados",
      aguardando: "Aguardando",
      aguardandoLegenda: "com status Aguardando",
      chegaram: "Chegaram",
      chegaramLegenda: "com status Chegou",
      // Quantidade de pedidos, não valor em dinheiro. "Em aberto" = nem entregue nem cancelado.
      aReceber: "Pedidos a Receber",
      aReceberLegenda: "não pagos e em aberto",
    },
    // Mesmos nomes do Select de status de sempre (STATUS_LABELS do usePedidos).
    status: {
      aguardando: "Aguardando",
      confirmado: "Confirmado",
      chegou: "Chegou",
      entregue: "Entregue",
      cancelado: "Cancelado",
    },
    filtros: {
      busca: "Buscar por cliente, descrição ou telefone...",
      buscaRotulo: "Buscar pedidos",
      statusRotulo: "Filtrar por status",
      todosStatus: "Todos os status",
      limpar: "Limpar filtros",
      encontrados_zero: "Nenhum pedido encontrado",
      encontrados_one: "{{count}} pedido encontrado",
      encontrados_other: "{{count}} pedidos encontrados",
    },
  },
};

export default pedidos;

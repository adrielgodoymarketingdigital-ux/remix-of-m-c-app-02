// Namespace "servicos" em pt-BR: vai embutido no pacote principal (src/lib/i18n/instancia.ts).
const servicos = {
  // Tela Serviços no computador (>= 1024px): cabeçalho, indicadores e filtros
  // (components/servicos/TopoServicosDesktop). Celular e tablet seguem com o texto fixo de antes.
  telaDesktop: {
    titulo: "Serviços",
    subtitulo: "Gerencie os serviços oferecidos na sua assistência técnica",
    vincularTipos: "Vincular tipos automaticamente",
    novoServico: "Novo Serviço",
    indicadores: {
      total: "Total de Serviços",
      totalLegenda: "serviços cadastrados",
      comPeca: "Com Peça Vinculada",
      semPeca: "Sem Peça Vinculada",
      percentualDosServicos: "{{percentual}}% dos serviços",
      lucro: "Lucro Total (Estimado)",
      lucroLegenda: "soma de preço − custo de cada serviço",
    },
    busca: "Buscar por nome ou código...",
    buscaRotulo: "Buscar serviços",
    soSemTipo: "Somente sem tipo vinculado ({{quantidade}})",
    tipoRotulo: "Tipo de serviço",
    todosTipos: "Todos os tipos",
    filtros: "Filtros",
    filtroPrecoAtivo: "(filtro de preço ativo)",
    precoTitulo: "Preço de venda",
    precoMinimo: "Preço mínimo",
    precoMaximo: "Preço máximo",
    limparFiltros: "Limpar filtros",
    encontrados_zero: "Nenhum serviço encontrado",
    encontrados_one: "{{count}} serviço encontrado",
    encontrados_other: "{{count}} serviços encontrados",
  },
  exclusao: {
    // hooks/useServicos.ts
    servicoTitulo: "Não é possível excluir este serviço",
    servicoEmUso_zero: "Este serviço não está sendo usado em nenhuma ordem de serviço.",
    servicoEmUso_one: "Este serviço está sendo usado em {{count}} ordem de serviço (OS {{numeros}}) e não pode ser excluído. Remova-o dessa OS ou mantenha-o no catálogo.",
    servicoEmUso_other: "Este serviço está sendo usado em {{count}} ordens de serviço (OS {{numeros}}) e não pode ser excluído. Remova-o dessas OS ou mantenha-o no catálogo.",
    // hooks/useTiposServico.ts — tipoSoServicos é LETRA POR LETRA o texto de antes
    tipoTitulo: "Não é possível excluir este tipo de serviço",
    tipoSoServicos: "Está vinculado a {{servicos}} serviço(s) do catálogo. Use \"Mesclar tipos duplicados\" para transferir os vínculos ou desvincule antes.",
    tipoSoOs: "Está vinculado a {{os}} ordem(ns) de serviço (OS {{numeros}}). Use \"Mesclar tipos duplicados\" para transferir os vínculos ou desvincule antes.",
    tipoServicosEOs: "Está vinculado a {{servicos}} serviço(s) do catálogo e {{os}} ordem(ns) de serviço (OS {{numeros}}). Use \"Mesclar tipos duplicados\" para transferir os vínculos ou desvincule antes.",
    // lista de números longa: os 10 primeiros e quantos faltam
    numerosComMais: "{{lista}} e mais {{restantes}}",
  },
  // Recibo A4 PERSONALIZADO da OS (ImpressaoA4Personalizado). Títulos novos do
  // desenho; o recibo inteiro ainda é impresso em pt-BR (lido daqui direto),
  // até a impressão da OS ser traduzida por completo.
  reciboOS: {
    dadosCliente: "Dados do Cliente",
    dadosAparelho: "Dados do Aparelho",
    // Impressão no iPhone com o app instalado (PDF do recibo personalizado).
    preparandoPdf: "Preparando PDF…",
    avisoFalhaPersonalizado: "Não foi possível gerar o layout personalizado; foi gerado o padrão.",
  },
  // Tela "Layout da OS" (DialogConfiguracaoLayoutOS): escolha do modelo do recibo A4.
  layoutOS: {
    modeloTitulo: "Modelo do recibo A4",
    modeloPadrao: "Padrão",
    modeloPadraoDescricao: "O recibo de sempre, na versão escolhida abaixo.",
    modeloPersonalizado: "Personalizado",
    modeloPersonalizadoDescricao: "Novo visual: cabeçalho azul-marinho, informações em cartões e checklist em duas colunas.",
    soPadraoTitulo: "Continuam sempre no Padrão:",
    // Uma chave por item de CAMINHOS_SO_PADRAO (src/lib/ordemServico/modeloReciboOS.ts).
    soPadrao: {
      cupom80mm: "Cupom 80 mm",
      duasOsPorFolha: "2 OS por folha A4",
      pdfWhatsapp: "PDF enviado pelo WhatsApp",
    },
    versaoTitulo: "Versão do Layout A4",
    versaoDescricao: "Usada no modelo Padrão e onde o Personalizado não se aplica.",
    versaoTech: "Tech",
  },
} as const;

export default servicos;

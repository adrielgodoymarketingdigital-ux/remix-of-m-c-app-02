// Namespace "comum" em pt-BR: vai embutido no pacote principal (src/lib/i18n/instancia.ts).
const comum = {
  idioma: {
    titulo: "Idioma",
    descricao: "Idioma do sistema nesta conta. Por enquanto só o menu lateral está traduzido.",
    salvo: "Idioma atualizado",
    erroSalvar: "Não foi possível salvar o idioma",
  },
  // AssinaturaDigital (Configurações › Logo e OS). Rótulo e termo continuam vindo de quem usa.
  assinaturaDigital: {
    ajuda: "Use o dedo ou mouse para assinar no campo acima",
    limpar: "Limpar",
    atualizar: "Atualizar",
    confirmar: "Confirmar",
  },
  // DialogDismissCard (cartões que o usuário pode esconder por um tempo).
  fecharCard: {
    titulo: "Fechar por quanto tempo?",
    descricao: "Escolha por quanto tempo deseja ocultar este card.",
    opcoes: {
      forever: "Sem prazo",
      month: "Por 1 mês",
      week: "Por 1 semana",
      hours: "Por 24 horas",
    },
  },
  // Formas de pagamento: tabela ÚNICA. Cada tela usa hoje um nome um pouco
  // diferente; as variantes ficam como chaves próprias para o pt-BR continuar
  // letra por letra igual. O que vai para o banco e para o recibo continua em
  // pt-BR fixo (lib/formaPagamento.ts lê este mesmo arquivo).
  formaPagamento: {
    // PDV, pagamento duplo, filtro de Vendas, formas padrão e Financeiro.
    curto: {
      dinheiro: "Dinheiro",
      pix: "PIX",
      debito: "Débito",
      credito: "Crédito",
      credito_parcelado: "Crédito Parcelado",
      a_receber: "A Receber",
      a_prazo: "A Receber",
    },
    // Lista de Vendas (TabelaVendas).
    longo: {
      dinheiro: "Dinheiro",
      pix: "PIX",
      debito: "Cartão de Débito",
      credito: "Cartão de Crédito",
      credito_parcelado: "Cartão Parcelado",
      a_receber: "A Receber",
      a_prazo: "A Prazo",
    },
    // Editar venda.
    aReceberAPrazo: "A Receber (A Prazo)",
    // Venda avulsa.
    pixAvulsa: "Pix",
    transferencia: "Transferência",
    naoInformada: "Não informada",
  },
  // Data e hora por extenso ("26/10/2026 às 18:55"); data e hora já formatadas.
  dataHora: "{{data}} às {{hora}}",
  // Rodapé de Configurações. {{versao}}: "AAAA-MM-DD HH:mm · <commit>", gerada no build.
  versaoApp: "Versão {{versao}}",
  // Aviso de versão nova do app (PWAUpdateBanner).
  novaVersao: {
    titulo: "Nova versão disponível",
    atualizar: "Atualizar agora",
    depois: "Depois",
  },
  // Teste grátis do cadastro (FreeTrialTimer e DialogFreeTrialExpirado).
  testeGratis: {
    contador: {
      titulo: "⭐ Teste todas as funcionalidades Premium por mais:",
      // Só aparece com mais de 48h restantes, então {{dias}} é sempre 2 ou mais.
      dias: "{{dias}} dias",
      diasEHoras: "{{dias}} dias e {{horas}}h",
      verPlanos: "Ver Planos",
    },
    // Sem citar a duração: vale para o teste de 24h e para o de 14 dias.
    expirado: {
      titulo: "Seu período Premium expirou!",
      descricao: "Seu período de teste terminou. Agora você está no plano gratuito com funcionalidades limitadas. Assine para continuar aproveitando tudo!",
      assinar: "Assinar um plano",
      continuarFree: "Continuar com plano gratuito",
      atualizando: "Atualizando...",
      erroTitulo: "Erro",
      erroDescricao: "Não foi possível atualizar seu plano. Tente novamente.",
    },
  },
  // Compatibilidade de Películas e Vidros, layout de COMPUTADOR
  // (components/compatibilidade/CompatibilidadePeliculaDesktop). Os textos que
  // já existiam são letra por letra os da página (o celular ainda usa os dele,
  // fixos em pages/CompatibilidadePelicula.tsx e no seletor compartilhado).
  compatibilidade: {
    titulo: "Compatibilidade de Películas e Vidros",
    subtitulo: "Descubra quais outros modelos usam a mesma película ou o mesmo vidro de tela",
    abaPeliculas: "Películas",
    abaVidros: "Vidros",
    carregando: "Carregando compatibilidade...",
    erro: "Não foi possível carregar a compatibilidade agora. Tente novamente em instantes.",
    buscarModelo: "Buscar modelo",
    selecioneMarca: "Selecione a marca",
    selecioneModelo: "Selecione o modelo",
    buscaMarca: "Buscar marca...",
    buscaModelo: "Buscar modelo...",
    semCadastro: "Ainda não temos dados de compatibilidade para esse modelo",
    nenhumaOpcao: "Nenhuma opção encontrada.",
    // Por tipo: os mesmos do TEXTOS da página (o celular segue lendo de lá).
    // usaOMesmo = "{marca} {modelo} " + TEXTOS.usaOMesmo + ":" do celular.
    porTipo: {
      pelicula: {
        descricaoBusca: "Selecione a marca e o modelo do celular para ver quais outros modelos usam a mesma película",
        tituloResultado: "Películas compatíveis",
        usaOMesmo: "{{marca}} {{modelo}} usa a mesma película que:",
        semDados: "Ainda não há dados de compatibilidade de películas.",
      },
      vidro: {
        descricaoBusca: "Selecione a marca e o modelo do celular para ver quais outros modelos usam o mesmo vidro na troca de vidro da tela",
        tituloResultado: "Vidros compatíveis (troca de vidro da tela)",
        usaOMesmo: "{{marca}} {{modelo}} usa o mesmo vidro de tela que:",
        semDados: "Ainda não há dados de compatibilidade de vidros. Em breve esta lista estará disponível aqui.",
      },
    },
    // Novos do layout de computador.
    rotuloMarca: "Marca",
    rotuloModelo: "Modelo",
    encontrados_zero: "Nenhum modelo encontrado",
    encontrados_one: "{{count}} modelo encontrado",
    encontrados_other: "{{count}} modelos encontrados",
    nenhumaEquivalencia: "Nenhuma equivalência cadastrada para este modelo.",
    // {{nomes}} = nomes dos grupos separados por " · "
    grupos_zero: "Sem grupo",
    grupos_one: "Grupo: {{nomes}}",
    grupos_other: "Grupos: {{nomes}}",
  },
} as const;

export default comum;

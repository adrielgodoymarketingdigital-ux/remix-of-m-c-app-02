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
} as const;

export default comum;

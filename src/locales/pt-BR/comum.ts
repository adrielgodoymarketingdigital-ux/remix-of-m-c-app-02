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
} as const;

export default comum;

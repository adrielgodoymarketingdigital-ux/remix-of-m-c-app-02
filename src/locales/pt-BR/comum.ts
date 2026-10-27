// Namespace "comum" em pt-BR: vai embutido no pacote principal (src/lib/i18n/instancia.ts).
const comum = {
  idioma: {
    titulo: "Idioma",
    descricao: "Idioma do sistema nesta conta. Por enquanto só o menu lateral está traduzido.",
    salvo: "Idioma atualizado",
    erroSalvar: "Não foi possível salvar o idioma",
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

// Namespace "comum" en español neutro latinoamericano (glosario: docs/i18n/glosario-es.md).
import type comumPtBR from "../pt-BR/comum";
import type { Traducao } from "../tipos";

const comum: Traducao<typeof comumPtBR> = {
  idioma: {
    titulo: "Idioma",
    descricao: "Idioma del sistema en esta cuenta. Por ahora solo el menú lateral está traducido.",
    salvo: "Idioma actualizado",
    erroSalvar: "No se pudo guardar el idioma",
  },
  fecharCard: {
    titulo: "¿Cerrar por cuánto tiempo?",
    descricao: "Elija por cuánto tiempo quiere ocultar esta tarjeta.",
    opcoes: {
      forever: "Sin plazo",
      month: "Por 1 mes",
      week: "Por 1 semana",
      hours: "Por 24 horas",
    },
  },
};

export default comum;

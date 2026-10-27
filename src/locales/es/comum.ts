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
  assinaturaDigital: {
    ajuda: "Use el dedo o el mouse para firmar en el campo de arriba",
    limpar: "Borrar",
    atualizar: "Actualizar",
    confirmar: "Confirmar",
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
  // Un solo nombre por forma en todas las pantallas (en pt-BR hay variantes).
  formaPagamento: {
    curto: {
      dinheiro: "Efectivo",
      pix: "Pix",
      debito: "Débito",
      credito: "Crédito",
      credito_parcelado: "Crédito en cuotas",
      a_receber: "Por cobrar",
      a_prazo: "Por cobrar",
    },
    longo: {
      dinheiro: "Efectivo",
      pix: "Pix",
      debito: "Débito",
      credito: "Crédito",
      credito_parcelado: "Crédito en cuotas",
      a_receber: "Por cobrar",
      a_prazo: "Por cobrar",
    },
    aReceberAPrazo: "Por cobrar",
    pixAvulsa: "Pix",
    transferencia: "Transferencia",
    naoInformada: "No informada",
  },
  dataHora: "{{data}} a las {{hora}}",
  versaoApp: "Versión {{versao}}",
};

export default comum;

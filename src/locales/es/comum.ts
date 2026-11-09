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
  novaVersao: {
    titulo: "Nueva versión disponible",
    atualizar: "Actualizar ahora",
    depois: "Después",
  },
  testeGratis: {
    contador: {
      titulo: "⭐ Prueba todas las funciones Premium por:",
      dias: "{{dias}} días",
      diasEHoras: "{{dias}} días y {{horas}} h",
      verPlanos: "Ver planes",
    },
    expirado: {
      titulo: "¡Tu período Premium terminó!",
      descricao: "Tu período de prueba terminó. Ahora estás en el plan gratuito con funciones limitadas. ¡Suscríbete para seguir aprovechando todo!",
      assinar: "Suscribirme a un plan",
      continuarFree: "Continuar con el plan gratuito",
      atualizando: "Actualizando...",
      erroTitulo: "Error",
      erroDescricao: "No se pudo actualizar tu plan. Inténtalo de nuevo.",
    },
  },
  compatibilidade: {
    titulo: "Compatibilidad de protectores y vidrios",
    subtitulo: "Descubra qué otros modelos usan el mismo protector de pantalla o el mismo vidrio de pantalla",
    abaPeliculas: "Protectores",
    abaVidros: "Vidrios",
    carregando: "Cargando compatibilidad...",
    erro: "No se pudo cargar la compatibilidad en este momento. Inténtelo de nuevo en unos instantes.",
    buscarModelo: "Buscar modelo",
    selecioneMarca: "Seleccione la marca",
    selecioneModelo: "Seleccione el modelo",
    buscaMarca: "Buscar marca...",
    buscaModelo: "Buscar modelo...",
    semCadastro: "Todavía no tenemos datos de compatibilidad para este modelo",
    nenhumaOpcao: "No se encontró ninguna opción.",
    porTipo: {
      pelicula: {
        descricaoBusca: "Seleccione la marca y el modelo del celular para ver qué otros modelos usan el mismo protector de pantalla",
        tituloResultado: "Protectores de pantalla compatibles",
        usaOMesmo: "{{marca}} {{modelo}} usa el mismo protector de pantalla que:",
        semDados: "Todavía no hay datos de compatibilidad de protectores de pantalla.",
      },
      vidro: {
        descricaoBusca: "Seleccione la marca y el modelo del celular para ver qué otros modelos usan el mismo vidrio en el cambio de vidrio de la pantalla",
        tituloResultado: "Vidrios compatibles (cambio de vidrio de la pantalla)",
        usaOMesmo: "{{marca}} {{modelo}} usa el mismo vidrio de pantalla que:",
        semDados: "Todavía no hay datos de compatibilidad de vidrios. Pronto esta lista estará disponible aquí.",
      },
    },
    rotuloMarca: "Marca",
    rotuloModelo: "Modelo",
    encontrados_zero: "Ningún modelo encontrado",
    encontrados_one: "{{count}} modelo encontrado",
    encontrados_other: "{{count}} modelos encontrados",
    nenhumaEquivalencia: "No hay equivalencias registradas para este modelo.",
    grupos_zero: "Sin grupo",
    grupos_one: "Grupo: {{nomes}}",
    grupos_other: "Grupos: {{nomes}}",
  },
};

export default comum;

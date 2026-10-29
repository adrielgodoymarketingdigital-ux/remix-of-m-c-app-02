// Namespace "servicos" en español neutro latinoamericano (glosario: docs/i18n/glosario-es.md).
// "Mesclar tipos duplicados" queda igual: es el nombre del botón, que esa pantalla aún muestra en portugués.
import type servicosPtBR from "../pt-BR/servicos";
import type { Traducao } from "../tipos";

const servicos: Traducao<typeof servicosPtBR> = {
  exclusao: {
    servicoTitulo: "No es posible eliminar este servicio",
    servicoEmUso_zero: "Este servicio no se usa en ninguna orden de servicio.",
    servicoEmUso_one: "Este servicio se usa en {{count}} orden de servicio (OS {{numeros}}) y no se puede eliminar. Quítelo de esa OS o manténgalo en el catálogo.",
    servicoEmUso_other: "Este servicio se usa en {{count}} órdenes de servicio (OS {{numeros}}) y no se puede eliminar. Quítelo de esas OS o manténgalo en el catálogo.",
    tipoTitulo: "No es posible eliminar este tipo de servicio",
    tipoSoServicos: "Está vinculado a {{servicos}} servicio(s) del catálogo. Use \"Mesclar tipos duplicados\" para transferir los vínculos o desvincúlelo antes.",
    tipoSoOs: "Está vinculado a {{os}} orden(es) de servicio (OS {{numeros}}). Use \"Mesclar tipos duplicados\" para transferir los vínculos o desvincúlelo antes.",
    tipoServicosEOs: "Está vinculado a {{servicos}} servicio(s) del catálogo y {{os}} orden(es) de servicio (OS {{numeros}}). Use \"Mesclar tipos duplicados\" para transferir los vínculos o desvincúlelo antes.",
    numerosComMais: "{{lista}} y {{restantes}} más",
  },
  reciboOS: {
    dadosCliente: "Datos del cliente",
    dadosAparelho: "Datos del equipo",
    preparandoPdf: "Preparando PDF…",
    avisoFalhaPersonalizado: "No fue posible generar el diseño personalizado; se generó el estándar.",
  },
  layoutOS: {
    modeloTitulo: "Modelo del recibo A4",
    modeloPadrao: "Estándar",
    modeloPadraoDescricao: "El recibo de siempre, en la versión elegida abajo.",
    modeloPersonalizado: "Personalizado",
    modeloPersonalizadoDescricao: "Nuevo diseño: encabezado azul marino, información en tarjetas y checklist en dos columnas.",
    soPadraoTitulo: "Siempre quedan en Estándar:",
    soPadrao: {
      cupom80mm: "Recibo térmico de 80 mm",
      duasOsPorFolha: "2 OS por hoja A4",
      pdfIphoneInstalado: "Impresión desde la app instalada en iPhone (sale en PDF)",
      pdfWhatsapp: "PDF enviado por WhatsApp",
    },
    versaoTitulo: "Versión del diseño A4",
    versaoDescricao: "Se usa en el modelo Estándar y donde el Personalizado no aplica.",
    versaoTech: "Tech",
  },
};

export default servicos;

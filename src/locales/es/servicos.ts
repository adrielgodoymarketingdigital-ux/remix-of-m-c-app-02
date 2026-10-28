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
};

export default servicos;

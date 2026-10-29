// Namespace "servicos" em pt-BR: vai embutido no pacote principal (src/lib/i18n/instancia.ts).
const servicos = {
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
  },
} as const;

export default servicos;

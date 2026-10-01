import { Venda } from "@/types/venda";

/** Select de `vendas` com o cliente e o item vendido (dispositivo, produto ou peça). */
export const SELECT_VENDA_COM_ITENS = `
          *,
          clientes!vendas_cliente_fkey (nome, telefone),
          dispositivos (tipo, marca, modelo),
          produtos (nome, sku),
          pecas (nome)
        ` as const;

/** Nome do item de uma linha de venda (dispositivo, produto, peça, OS ou avulsa). */
export function getNomeItem(venda: Venda): string {
  if (venda.tipo === "dispositivo") {
    if (venda.dispositivos) {
      return `${venda.dispositivos.marca} ${venda.dispositivos.modelo}`;
    }
    // Fallback: nome salvo em observacoes pelo PDV (quando join RLS bloqueia)
    if (venda.observacoes && venda.observacoes !== "pagamento_duplo_secundario") {
      return venda.observacoes;
    }
  }
  if (venda.tipo === "servico" && venda.ordens_servico) {
    return `OS ${venda.ordens_servico.numero_os}`;
  }
  if (venda.tipo === "avulsa") {
    return venda.produtos?.nome || "Venda Avulsa";
  }
  if (venda.tipo === "produto") {
    if (venda.produtos?.nome) return venda.produtos.nome;
    if (venda.observacoes && venda.observacoes !== "pagamento_duplo_secundario") return venda.observacoes;
  }
  return venda.produtos?.nome || venda.pecas?.nome || "-";
}

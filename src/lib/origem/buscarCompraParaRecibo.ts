// Lê do banco, na hora de gerar, a compra ATUAL (fotos, documentos, assinaturas,
// vendedor) e o dispositivo dela. Nunca usa o objeto em memória da lista: depois
// de "Editar compra" a lista pode estar velha, e o recibo tem de sair com o que
// está gravado agora.
import { supabase } from "@/integrations/supabase/client";
import type { CompraDispositivo, OrigemPessoa } from "@/types/origem";
import { ErroReciboLegal } from "./erroReciboLegal";

export interface DispositivoParaRecibo {
  id: string;
  empresa_id?: string | null;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  cor?: string | null;
  imei?: string | null;
  numero_serie?: string | null;
  capacidade_gb?: number | null;
  condicao: string | null;
  checklist?: unknown;
}

export type CompraParaRecibo = CompraDispositivo & {
  origem_pessoas?: (Partial<OrigemPessoa> & { nome?: string }) | null;
  fornecedores?: { nome?: string | null } | null;
};

export interface DadosCompraParaRecibo {
  compra: CompraParaRecibo;
  dispositivo: DispositivoParaRecibo;
}

type Cliente = Pick<typeof supabase, "from">;

export async function buscarCompraParaRecibo(compraId: string, cliente: Cliente = supabase): Promise<DadosCompraParaRecibo> {
  if (!compraId) throw new ErroReciboLegal("compra_nao_encontrada");

  const { data: compra, error: erroCompra } = await cliente
    .from("compras_dispositivos")
    .select("*, origem_pessoas(*), fornecedores(nome)")
    .eq("id", compraId)
    .maybeSingle();
  if (erroCompra) throw erroCompra;
  if (!compra) throw new ErroReciboLegal("compra_nao_encontrada");

  const dispositivoId = (compra as { dispositivo_id?: string | null }).dispositivo_id;
  if (!dispositivoId) throw new ErroReciboLegal("dispositivo_nao_encontrado");

  const { data: dispositivo, error: erroDispositivo } = await cliente
    .from("dispositivos")
    .select("*")
    .eq("id", dispositivoId)
    .maybeSingle();
  if (erroDispositivo) throw erroDispositivo;
  if (!dispositivo) throw new ErroReciboLegal("dispositivo_nao_encontrado");

  return {
    compra: compra as unknown as CompraParaRecibo,
    dispositivo: dispositivo as unknown as DispositivoParaRecibo,
  };
}

// Dependências REAIS do orquestrador do Recibo Legal (Supabase, storage, canvas).
// Separadas de gerarEBaixarReciboLegal.ts para os testes Deno usarem falsos.
import { supabase } from "@/integrations/supabase/client";
import { gerarReciboLegalPDF, salvarReciboStorage } from "@/lib/gerarReciboLegalPDF";
import { buscarConfiguracaoLojaPorEmpresa } from "@/hooks/useConfiguracaoLoja";
import { buscarCompraParaRecibo } from "./buscarCompraParaRecibo";
import { carregarImagensRecibo } from "./carregarImagensRecibo";
import type { DependenciasReciboLegal } from "./gerarEBaixarReciboLegal";

async function atualizarTermo(compraId: string, url: string): Promise<number> {
  const { data, error } = await supabase
    .from("compras_dispositivos")
    .update({ termo_pdf_url: url })
    .eq("id", compraId)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export function dependenciasReciboLegal(): DependenciasReciboLegal {
  return {
    buscarCompra: (compraId) => buscarCompraParaRecibo(compraId),
    buscarLoja: (empresaId) => buscarConfiguracaoLojaPorEmpresa(empresaId),
    carregarImagens: (entrada) => carregarImagensRecibo(entrada),
    gerarPdf: gerarReciboLegalPDF,
    salvar: salvarReciboStorage,
    atualizarTermo,
  };
}

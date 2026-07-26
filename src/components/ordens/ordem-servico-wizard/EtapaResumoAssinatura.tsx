import { Receipt } from "lucide-react";
import { ResumoFinanceiro } from "../ResumoFinanceiro";
import { AssinaturaDigital } from "../AssinaturaDigital";
import { TaxaCartao } from "@/hooks/useTaxasCartao";
import { EtapaCabecalho } from "./EtapaCabecalho";
import { FormData } from "./tipos";

interface EtapaResumoAssinaturaProps {
  formData: FormData;
  setFormData: (formData: FormData) => void;
  taxasAtivas: TaxaCartao[];
  bandeiraSelecionada: string;
  setBandeiraSelecionada: (id: string) => void;
  calcularTaxa: (
    taxa: TaxaCartao,
    formaPagamento: string,
    numeroParcelas?: number,
    valorTotal?: number
  ) => { percentual: number; valor: number };
  /** Assinatura de saída só aparece na edição de uma OS já existente. */
  temAssinaturaSaida: boolean;
}

export function EtapaResumoAssinatura({
  formData,
  setFormData,
  taxasAtivas,
  bandeiraSelecionada,
  setBandeiraSelecionada,
  calcularTaxa,
  temAssinaturaSaida,
}: EtapaResumoAssinaturaProps) {
  return (
    <div>
      <EtapaCabecalho
        icone={Receipt}
        titulo="Resumo Financeiro"
        descricao="Confira os valores e colete a assinatura do cliente."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:items-start">
      <ResumoFinanceiro
        servicos={formData.servicos}
        produtos={formData.produtos}
        custosAdicionais={formData.custosAdicionais}
        onCustosAdicionaisChange={(custos) => setFormData({ ...formData, custosAdicionais: custos })}
        formaPagamento={formData.formaPagamento}
        onFormaPagamentoChange={(forma) => setFormData({ ...formData, formaPagamento: forma })}
        desconto={formData.desconto}
        onDescontoChange={(desconto) => setFormData({ ...formData, desconto })}
        valorEntrada={formData.valorEntrada}
        onValorEntradaChange={(valor) => setFormData({ ...formData, valorEntrada: valor })}
        numeroParcelas={formData.numeroParcelas}
        onNumeroParcelasChange={(parcelas) => setFormData({ ...formData, numeroParcelas: parcelas })}
        mostrarEntrada={formData.mostrarEntrada}
        onMostrarEntradaChange={(mostrar) => setFormData({ ...formData, mostrarEntrada: mostrar })}
        formaPagamentoEntrada={formData.formaPagamentoEntrada}
        onFormaPagamentoEntradaChange={(forma) => setFormData({ ...formData, formaPagamentoEntrada: forma })}
        dataVencimentoPrazo={formData.dataVencimentoPrazo}
        onDataVencimentoPrazoChange={(data) => setFormData({ ...formData, dataVencimentoPrazo: data })}
        semDataDefinida={formData.semDataDefinida}
        onSemDataDefinidaChange={(sem) => setFormData({ ...formData, semDataDefinida: sem, dataVencimentoPrazo: sem ? undefined : formData.dataVencimentoPrazo })}
        taxasAtivas={taxasAtivas}
        bandeiraSelecionada={bandeiraSelecionada}
        onBandeiraChange={setBandeiraSelecionada}
        taxaCalculada={(() => {
          const taxaSel = taxasAtivas.find(t => t.id === bandeiraSelecionada);
          if (!taxaSel) return { percentual: 0, valor: 0 };
          const totalServicos = formData.servicos.reduce((sum, s) => sum + s.preco, 0);
          const totalProdutos = formData.produtos.reduce((sum, p) => sum + p.preco_total, 0);
          const totalCustosRep = formData.custosAdicionais.filter(c => c.repassar_cliente).reduce((sum, c) => sum + c.valor, 0);
          const subtotal = totalServicos + totalProdutos + totalCustosRep;
          const total = Math.max(0, subtotal - formData.desconto);
          return calcularTaxa(taxaSel, formData.formaPagamento, formData.numeroParcelas, total);
        })()}
      />

      <div className="space-y-3">
        {/* Assinatura Digital do Cliente - Entrada */}
        <AssinaturaDigital
          label="Assinatura do Cliente (Entrada)"
          textoAceite="Declaro estar ciente das condições do dispositivo conforme checklist e avarias registradas neste documento. Autorizo a execução dos serviços descritos."
          onSave={(assinatura) => setFormData({ ...formData, assinaturaEntrada: assinatura })}
          onClear={() => setFormData({ ...formData, assinaturaEntrada: "" })}
          onTipoChange={(tipo) => setFormData({ ...formData, tipoAssinaturaEntrada: tipo, assinaturaEntrada: tipo === 'fisica' ? "" : formData.assinaturaEntrada })}
          assinaturaExistente={formData.assinaturaEntrada}
          tipoAssinatura={formData.tipoAssinaturaEntrada}
          mostrarCheckbox={true}
          mostrarSeletorTipo={true}
        />

        {/* Assinatura Digital do Cliente - Saída (somente na edição) */}
        {temAssinaturaSaida && (
          <AssinaturaDigital
            label="Assinatura do Cliente (Saída / Recebimento)"
            textoAceite="Declaro ter recebido o dispositivo nas condições descritas nesta ordem de serviço. Confirmo que o serviço foi realizado conforme acordado."
            onSave={(assinatura) => setFormData({ ...formData, assinaturaSaida: assinatura })}
            onClear={() => setFormData({ ...formData, assinaturaSaida: "" })}
            onTipoChange={(tipo) => setFormData({ ...formData, tipoAssinaturaSaida: tipo, assinaturaSaida: tipo === 'fisica' ? "" : formData.assinaturaSaida })}
            assinaturaExistente={formData.assinaturaSaida}
            tipoAssinatura={formData.tipoAssinaturaSaida}
            mostrarCheckbox={true}
            mostrarSeletorTipo={true}
          />
        )}
      </div>
      </div>
    </div>
  );
}

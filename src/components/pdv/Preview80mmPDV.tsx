import { Layout80mmPDVConfig } from "@/types/configuracao-loja";

interface Preview80mmPDVProps {
  config: Layout80mmPDVConfig;
  nomeLoja?: string;
}

export function Preview80mmPDV({ config, nomeLoja = "Minha Loja" }: Preview80mmPDVProps) {
  return (
    <div className="border rounded-lg bg-white p-0 overflow-hidden" style={{ width: "220px" }}>
      <div className="bg-muted/50 px-2 py-1 text-[9px] text-muted-foreground text-center font-medium border-b">
        Preview 80mm - PDV
      </div>
      <div
        className="mx-auto text-black font-mono leading-tight p-2 overflow-hidden"
        style={{ width: "200px", fontSize: "7px" }}
      >
        {/* Logo */}
        {config.mostrar_logo && (
          <div className="flex justify-center mb-1">
            <div className="w-10 h-4 bg-gray-300 rounded-sm flex items-center justify-center text-[5px] text-gray-500">
              LOGO
            </div>
          </div>
        )}

        {/* Dados da Loja */}
        {config.mostrar_dados_loja && (
          <div className="text-center mb-1 border-b border-dashed border-gray-400 pb-1">
            <div className="font-bold text-[8px]">{nomeLoja}</div>
            <div className="text-gray-500 text-[5px]">CNPJ: 00.000.000/0001-00</div>
            <div className="text-gray-500 text-[5px]">Tel: (00) 0000-0000</div>
          </div>
        )}

        {/* Título */}
        <div className="text-center font-bold text-[8px] mb-1">
          RECIBO DE VENDA
        </div>

        {/* Dados do Cliente */}
        {config.mostrar_dados_cliente && (
          <div className="mb-1 border-b border-dashed border-gray-400 pb-1">
            <div className="font-bold text-[6px] uppercase text-gray-600 mb-0.5">Cliente</div>
            <div>Nome: João Silva</div>
            <div>Tel: (11) 99999-0000</div>
          </div>
        )}

        {/* Itens */}
        {config.mostrar_itens && (
          <div className="mb-1 border-b border-dashed border-gray-400 pb-1">
            <div className="font-bold text-[6px] uppercase text-gray-600 mb-0.5">Itens (2)</div>
            <div className="flex justify-between">
              <span>1x iPhone 14 Pro</span>
              <span>R$ 4.500,00</span>
            </div>
            <div className="flex justify-between">
              <span>1x Capinha</span>
              <span>R$ 50,00</span>
            </div>
          </div>
        )}

        {/* Subtotal */}
        {config.mostrar_subtotal && (
          <div className="flex justify-between mb-0.5">
            <span>Subtotal:</span>
            <span>R$ 4.550,00</span>
          </div>
        )}

        {/* Descontos */}
        {config.mostrar_descontos && (
          <div className="flex justify-between mb-0.5 text-red-600">
            <span>Desconto:</span>
            <span>- R$ 50,00</span>
          </div>
        )}

        {/* Total */}
        {config.mostrar_total && (
          <div className="text-center font-bold text-[10px] my-1 py-1 border-y border-dashed border-gray-400">
            TOTAL: R$ 4.500,00
          </div>
        )}

        {/* Forma de Pagamento */}
        {config.mostrar_forma_pagamento && (
          <div className="mb-1 border-b border-dashed border-gray-400 pb-1">
            <div className="flex justify-between">
              <span className="font-bold text-[6px] uppercase text-gray-600">Pagamento</span>
              <span>PIX</span>
            </div>
          </div>
        )}

        {/* Assinaturas */}
        {config.mostrar_assinaturas && (
          <div className="mt-1 pt-1 border-t border-dashed border-gray-400">
            <div className="text-center mb-2">
              <div className="border-b border-gray-400 mx-4 mb-0.5 mt-3" />
              <div className="text-[5px] text-gray-500">Assinatura do Vendedor</div>
            </div>
            <div className="text-center">
              <div className="border-b border-gray-400 mx-4 mb-0.5 mt-3" />
              <div className="text-[5px] text-gray-500">Assinatura do Comprador</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

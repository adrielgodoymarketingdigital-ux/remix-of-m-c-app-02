import { Layout80mmConfig } from "@/types/configuracao-loja";

interface Preview80mmProps {
  config: Layout80mmConfig;
  nomeLoja?: string;
}

export function Preview80mm({ config, nomeLoja = "Minha Loja" }: Preview80mmProps) {
  return (
    <div className="border rounded-lg bg-white p-0 overflow-hidden" style={{ width: "220px" }}>
      <div className="bg-muted/50 px-2 py-1 text-[9px] text-muted-foreground text-center font-medium border-b">
        Preview 80mm
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

        {/* Número OS */}
        <div className="text-center font-bold text-[8px] mb-1">
          OS #0001
        </div>

        {/* Dados do Cliente */}
        {config.mostrar_dados_cliente && (
          <div className="mb-1 border-b border-dashed border-gray-400 pb-1">
            <div className="font-bold text-[6px] uppercase text-gray-600 mb-0.5">Cliente</div>
            <div>Nome: João Silva</div>
            <div>Tel: (11) 99999-0000</div>
          </div>
        )}

        {/* Dados do Dispositivo */}
        {config.mostrar_dados_dispositivo && (
          <div className="mb-1 border-b border-dashed border-gray-400 pb-1">
            <div className="font-bold text-[6px] uppercase text-gray-600 mb-0.5">Dispositivo</div>
            <div>iPhone 14 Pro</div>
            <div>IMEI: 000000000000000</div>
          </div>
        )}

        {/* Defeito */}
        {config.mostrar_defeito && (
          <div className="mb-1 border-b border-dashed border-gray-400 pb-1">
            <div className="font-bold text-[6px] uppercase text-gray-600 mb-0.5">Defeito</div>
            <div>Tela quebrada, não liga</div>
          </div>
        )}

        {/* Serviços */}
        {config.mostrar_servicos && (
          <div className="mb-1 border-b border-dashed border-gray-400 pb-1">
            <div className="font-bold text-[6px] uppercase text-gray-600 mb-0.5">Serviços</div>
            <div className="flex justify-between">
              <span>Troca de tela</span>
              <span>R$ 250,00</span>
            </div>
          </div>
        )}

        {/* Checklist */}
        {config.mostrar_checklist && (
          <div className="mb-1 border-b border-dashed border-gray-400 pb-1">
            <div className="font-bold text-[6px] uppercase text-gray-600 mb-0.5">Checklist</div>
            <div className="grid grid-cols-1 gap-0">
              <div className="flex items-center gap-0.5">
                <span className="text-green-600">✓</span> Tela
              </div>
              <div className="flex items-center gap-0.5">
                <span className="text-red-500">✗</span> Bateria
              </div>
            </div>
          </div>
        )}

        {/* Avarias */}
        {config.mostrar_avarias && (
          <div className="mb-1 border-b border-dashed border-gray-400 pb-1">
            <div className="font-bold text-[6px] uppercase text-gray-600 mb-0.5">Avarias</div>
            <div className="text-center text-gray-400 text-[5px]">[Silhueta do dispositivo]</div>
          </div>
        )}

        {/* Senha */}
        {config.mostrar_senha && (
          <div className="mb-1 border-b border-dashed border-gray-400 pb-1">
            <div className="font-bold text-[6px] uppercase text-gray-600 mb-0.5">Senha</div>
            <div className="font-mono">1234</div>
          </div>
        )}

        {/* Custos Adicionais */}
        {config.mostrar_custos_adicionais && (
          <div className="mb-1 border-b border-dashed border-gray-400 pb-1">
            <div className="font-bold text-[6px] uppercase text-gray-600 mb-0.5">Custos Adicionais</div>
            <div className="flex justify-between">
              <span>Frete (Cliente)</span>
              <span>R$ 30,00</span>
            </div>
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

        {/* Valor Total */}
        {config.mostrar_valor && (
          <div className="text-center font-bold text-[10px] my-1 py-1 border-y border-dashed border-gray-400">
            TOTAL: R$ 250,00
          </div>
        )}

        {/* Termos */}
        {config.mostrar_termos_condicoes && (
          <div className="mb-1 text-[5px] text-gray-500 text-center">
            Garantia de 90 dias para o serviço realizado conforme CDC.
          </div>
        )}

        {/* Assinaturas */}
        {config.mostrar_assinaturas && (
          <div className="mt-1 pt-1 border-t border-dashed border-gray-400">
            <div className="text-center mb-2">
              <div className="border-b border-gray-400 mx-4 mb-0.5 mt-3" />
              <div className="text-[5px] text-gray-500">Assinatura do Cliente</div>
            </div>
            <div className="text-center">
              <div className="border-b border-gray-400 mx-4 mb-0.5 mt-3" />
              <div className="text-[5px] text-gray-500">Assinatura da Loja</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

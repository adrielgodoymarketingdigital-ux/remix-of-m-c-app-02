import { OrdemServico } from "@/hooks/useOrdensServico";
import { formatCurrency, formatDate, formatPhone, formatCPF } from "@/lib/formatters";
import { AvariasOS, AvariaVisual, ProdutoUtilizado, ServicoRealizado, CustoAdicional } from "@/types/ordem-servico";
import { ConfiguracaoLoja, LayoutOSConfig } from "@/types/configuracao-loja";
import { SilhuetaComAvarias } from "./SilhuetaComAvarias";
import { PatternLockVisualizacao } from "./PatternLockVisualizacao";
import { checklistIcons } from "@/lib/checklist-icons";
import { CheckCircle2, XCircle, User, Smartphone, Lock, FileText, DollarSign, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { decryptSenhaDesbloqueio } from "@/lib/password-encryption";

interface Props {
  ordem: OrdemServico;
  configuracaoLoja?: ConfiguracaoLoja;
  layoutConfig: LayoutOSConfig;
  termoGarantia: string;
}

export function ImpressaoA4Padrao({ ordem, configuracaoLoja, layoutConfig, termoGarantia }: Props) {
  const avariasData = ordem.avarias as AvariasOS | null;
  const checklistEntrada = avariasData?.checklist?.entrada || {};
  const checklistSaida = avariasData?.checklist?.saida || {};
  const avariasVisuais = (avariasData?.avarias_visuais || []) as AvariaVisual[];
  const senhaDesbloqueio = decryptSenhaDesbloqueio(avariasData?.senha_desbloqueio);
  const assinaturas = avariasData?.assinaturas;

  let servicosRealizados: ServicoRealizado[] = (avariasData?.servicos_realizados || []) as ServicoRealizado[];
  if (servicosRealizados.length === 0 && (avariasData as any)?.servicos_inline?.length > 0) {
    servicosRealizados = ((avariasData as any).servicos_inline as any[]).map((s: any, i: number) => ({
      id: `inline-${i}`,
      nome: s.nome,
      preco: s.valor || 0,
      custo: 0,
      lucro: s.valor || 0,
    }));
  }
  const produtosUtilizados = (avariasData?.produtos_utilizados || []) as ProdutoUtilizado[];
  const custosAdicionais = (avariasData?.custos_adicionais || []) as CustoAdicional[];
  const desconto = avariasData?.dados_pagamento?.desconto || 0;
  const subtotalPagamento = avariasData?.dados_pagamento?.subtotal ?? (desconto > 0 ? (ordem.total || 0) + desconto : undefined);

  return (
    <div className="impressao-ordem-container impressao-a4-padrao">
      {/* Header */}
      <div className="impressao-header">
        <div className="impressao-header-content">
          {layoutConfig.mostrar_logo_impressao && configuracaoLoja?.logo_url && (
            <img src={configuracaoLoja.logo_url} alt="Logo" className="impressao-logo" />
          )}
          <div className="impressao-header-info">
            <h1 className="impressao-titulo">ORDEM DE SERVIÇO</h1>
            <div className="impressao-numero-os">#{ordem.numero_os}</div>
            <div className="impressao-data-status">
              <span>{formatDate(ordem.created_at)}</span>
              <Badge className="impressao-badge">{ordem.status}</Badge>
            </div>
          </div>
        </div>
        {configuracaoLoja && (
          <div className="impressao-loja-info">
            <div className="text-sm">
              <strong>{configuracaoLoja.nome_loja}</strong>
            </div>
            {configuracaoLoja.cnpj && <div className="text-xs">CNPJ: {configuracaoLoja.cnpj}</div>}
            {configuracaoLoja.endereco && <div className="text-xs">{configuracaoLoja.endereco}</div>}
            {configuracaoLoja.telefone && (
              <div className="text-xs">Tel: {formatPhone(configuracaoLoja.telefone)}</div>
            )}
          </div>
        )}
      </div>

      {/* Cliente + Dispositivo */}
      <div className="impressao-grid-2">
        <div className="impressao-block impressao-block-minimal">
          <div className="impressao-block-header-minimal">
            <User className="impressao-icon" />
          </div>
          <div className="impressao-block-content">
            <div className="impressao-field">
              <span className="impressao-label">Nome:</span>
              <span className="impressao-value">{ordem.cliente?.nome || "N/A"}</span>
            </div>
            <div className="impressao-field">
              <span className="impressao-label">Tel:</span>
              <span className="impressao-value">
                {ordem.cliente?.telefone ? formatPhone(ordem.cliente.telefone) : "N/A"}
              </span>
            </div>
            <div className="impressao-field">
              <span className="impressao-label">CPF:</span>
              <span className="impressao-value">
                {ordem.cliente?.cpf ? formatCPF(ordem.cliente.cpf) : "N/A"}
              </span>
            </div>
          </div>
        </div>

        <div className="impressao-block impressao-block-minimal">
          <div className="impressao-block-header-minimal">
            <Smartphone className="impressao-icon" />
          </div>
          <div className="impressao-block-content">
            <div className="impressao-field">
              <span className="impressao-label">Tipo/Marca:</span>
              <span className="impressao-value">
                {ordem.dispositivo_tipo} {ordem.dispositivo_marca}
              </span>
            </div>
            <div className="impressao-field">
              <span className="impressao-label">Modelo/Cor:</span>
              <span className="impressao-value">
                {ordem.dispositivo_modelo} ({ordem.dispositivo_cor || "N/A"})
              </span>
            </div>
            <div className="impressao-field">
              <span className="impressao-label">IMEI/Série:</span>
              <span className="impressao-value">
                {ordem.dispositivo_imei || ordem.dispositivo_numero_serie || "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Defeito + Valor */}
      <div className="impressao-grid-defeito-valor">
        <div className="impressao-block impressao-defeito-block">
          <div className="impressao-block-header">
            <FileText className="impressao-icon" />
            <h2 className="impressao-block-title">Defeito Relatado</h2>
          </div>
          <div className="impressao-block-content">
            <p className="impressao-defeito">{ordem.defeito_relatado}</p>
          </div>
        </div>

        <div className="impressao-block impressao-valor-block">
          <div className="impressao-block-header">
            <DollarSign className="impressao-icon" />
            <h2 className="impressao-block-title">Valor do Serviço</h2>
          </div>
          <div className="impressao-block-content">
            {desconto > 0 && subtotalPagamento !== undefined && (
              <div style={{ fontSize: "7pt", marginBottom: "1mm" }}>
                <div className="impressao-item-linha">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotalPagamento)}</span>
                </div>
                <div className="impressao-item-linha" style={{ color: "#c00" }}>
                  <span>Desconto</span>
                  <span>- {formatCurrency(desconto)}</span>
                </div>
              </div>
            )}
            <div className="impressao-valor-total">{formatCurrency(ordem.total || 0)}</div>
          </div>
        </div>
      </div>

      {/* Itens do Serviço */}
      {(servicosRealizados.length > 0 || produtosUtilizados.length > 0) && (
        <div className="impressao-block">
          <div className="impressao-block-header">
            <Package className="impressao-icon" />
            <h2 className="impressao-block-title">Itens do Serviço</h2>
          </div>
          <div className="impressao-block-content">
            {servicosRealizados.length > 0 && (
              <div className="impressao-itens-lista">
                <div className="impressao-itens-titulo">Serviços:</div>
                {servicosRealizados.map((servico) => (
                  <div key={servico.id} className="impressao-item-linha">
                    <span className="impressao-item-nome">• {servico.nome}</span>
                    <span className="impressao-item-valor">{formatCurrency(servico.preco)}</span>
                  </div>
                ))}
              </div>
            )}
            {produtosUtilizados.length > 0 && (
              <div className="impressao-itens-lista">
                <div className="impressao-itens-titulo">Produtos/Peças:</div>
                {produtosUtilizados.map((produto) => (
                  <div key={produto.id} className="impressao-item-linha">
                    <span className="impressao-item-nome">• {produto.quantidade}x {produto.nome}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custos Adicionais */}
      {custosAdicionais.length > 0 && (
        <div className="impressao-block">
          <div className="impressao-block-header">
            <Package className="impressao-icon" />
            <h2 className="impressao-block-title">Custos Adicionais</h2>
          </div>
          <div className="impressao-block-content">
            <div className="impressao-itens-lista">
              {custosAdicionais.map((custo) => (
                <div key={custo.id} className="impressao-item-linha">
                  <span className="impressao-item-nome">
                    • {custo.tipo === 'frete' ? 'Frete' : custo.tipo === 'brinde' ? 'Brinde' : custo.descricao}
                    {custo.descricao && custo.tipo !== 'outro' ? ` - ${custo.descricao}` : ''}
                    <span style={{ fontSize: '0.7em', color: '#666', marginLeft: '4px' }}>
                      ({custo.repassar_cliente ? 'Cliente paga' : 'Loja assume'})
                    </span>
                  </span>
                  <span className="impressao-item-valor">{formatCurrency(custo.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Forma de Pagamento */}
      {(ordem as any).forma_pagamento && (
        <div className="impressao-block">
          <div className="impressao-block-header">
            <DollarSign className="impressao-icon" />
            <h2 className="impressao-block-title">Forma de Pagamento</h2>
          </div>
          <div className="impressao-block-content">
            <p>{(ordem as any).forma_pagamento}</p>
          </div>
        </div>
      )}

      {/* Senha + Checklist + Avarias */}
      <div className="impressao-grid-adaptativo">
        {layoutConfig.mostrar_senha && senhaDesbloqueio && (
          <div className="impressao-block">
            <div className="impressao-block-header">
              <Lock className="impressao-icon" />
              <h2 className="impressao-block-title">Senha de Desbloqueio</h2>
            </div>
            <div className="impressao-block-content impressao-senha-content">
              <div className="impressao-senha-info">
                <div className="impressao-field">
                  <span className="impressao-label">Tipo:</span>
                  <span className="impressao-value">
                    {senhaDesbloqueio.tipo === "numero" && "PIN"}
                    {senhaDesbloqueio.tipo === "letra" && "Texto"}
                    {senhaDesbloqueio.tipo === "padrao" && "Padrão Android"}
                  </span>
                </div>
                {senhaDesbloqueio.tipo !== "padrao" && (
                  <div className="impressao-field">
                    <span className="impressao-label">Senha:</span>
                    <span className="impressao-value impressao-senha-valor">
                      {senhaDesbloqueio.valor || "N/A"}
                    </span>
                  </div>
                )}
                {senhaDesbloqueio.tipo === "padrao" && senhaDesbloqueio.padrao && (
                  <div className="impressao-field">
                    <PatternLockVisualizacao pattern={senhaDesbloqueio.padrao} size={80} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {layoutConfig.mostrar_checklist && avariasData?.checklist?.sem_teste && (
          <div className="impressao-block">
            <div className="impressao-block-header">
              <CheckCircle2 className="impressao-icon" />
              <h2 className="impressao-block-title">Checklist de Entrada</h2>
            </div>
            <div className="impressao-block-content">
              <p style={{ fontSize: '9pt', fontStyle: 'italic', margin: '4px 0' }}>
                ⚠️ Sem teste: Não foi possível realizar os testes porque o aparelho chegou desligado.
              </p>
            </div>
          </div>
        )}

        {layoutConfig.mostrar_checklist && Object.keys(checklistEntrada).length > 0 && (
          <div className="impressao-block">
            {!avariasData?.checklist?.sem_teste && (
              <div className="impressao-block-header">
                <CheckCircle2 className="impressao-icon" />
                <h2 className="impressao-block-title">Checklist de Entrada</h2>
              </div>
            )}
            <div className="impressao-block-content">
              <div className="impressao-checklist">
                {Object.entries(checklistEntrada).map(([item, status]) => {
                  const Icon = checklistIcons[item] || Smartphone;
                  return (
                    <div key={item}>
                      <div className="impressao-checklist-item">
                        <Icon className="impressao-checklist-icon" />
                        <span className="impressao-checklist-label">{item.replace(/_/g, " ")}</span>
                        {status ? (
                          <CheckCircle2 className="impressao-check-ok" />
                        ) : (
                          <XCircle className="impressao-check-erro" />
                        )}
                      </div>
                      {item === 'peca_trocada' && status && avariasData?.checklist?.peca_trocada_descricao_entrada && (
                        <div style={{ fontSize: '8pt', paddingLeft: '20px', fontStyle: 'italic', marginBottom: '4px' }}>
                          Peça: {avariasData.checklist.peca_trocada_descricao_entrada}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {layoutConfig.mostrar_checklist && Object.keys(checklistSaida).length > 0 && (
          <div className="impressao-block">
            <div className="impressao-block-header">
              <CheckCircle2 className="impressao-icon" />
              <h2 className="impressao-block-title">Checklist de Saída</h2>
            </div>
            <div className="impressao-block-content">
              <div className="impressao-checklist">
                {Object.entries(checklistSaida).map(([item, status]) => {
                  const Icon = checklistIcons[item] || Smartphone;
                  return (
                    <div key={item}>
                      <div className="impressao-checklist-item">
                        <Icon className="impressao-checklist-icon" />
                        <span className="impressao-checklist-label">{item.replace(/_/g, " ")}</span>
                        {status ? (
                          <CheckCircle2 className="impressao-check-ok" />
                        ) : (
                          <XCircle className="impressao-check-erro" />
                        )}
                      </div>
                      {item === 'peca_trocada' && status && avariasData?.checklist?.peca_trocada_descricao_saida && (
                        <div style={{ fontSize: '8pt', paddingLeft: '20px', fontStyle: 'italic', marginBottom: '4px' }}>
                          Peça: {avariasData.checklist.peca_trocada_descricao_saida}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {layoutConfig.mostrar_avarias && avariasVisuais.length > 0 && (
          <div className="impressao-block">
            <div className="impressao-block-header">
              <Smartphone className="impressao-icon" />
              <h2 className="impressao-block-title">Avarias Visuais</h2>
            </div>
            <div className="impressao-block-content">
              <div className="impressao-avarias-container">
                {avariasVisuais.filter((a) => a.lado === "frente").length > 0 && (
                  <div className="impressao-silhueta">
                    <div className="impressao-silhueta-label">Frente</div>
                    <SilhuetaComAvarias
                      tipoDispositivo={ordem.dispositivo_tipo}
                      subtipoRelogio={(avariasData as any)?.dispositivo_subtipo}
                      lado="frente"
                      avarias={avariasVisuais.filter((a) => a.lado === "frente")}
                      printMode={true}
                    />
                  </div>
                )}
                {avariasVisuais.filter((a) => a.lado === "traseira").length > 0 && (
                  <div className="impressao-silhueta">
                    <div className="impressao-silhueta-label">Traseira</div>
                    <SilhuetaComAvarias
                      tipoDispositivo={ordem.dispositivo_tipo}
                      subtipoRelogio={(avariasData as any)?.dispositivo_subtipo}
                      lado="traseira"
                      avarias={avariasVisuais.filter((a) => a.lado === "traseira")}
                      printMode={true}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Observações Internas (quando marcado para imprimir) */}
      {avariasData?.observacoes_internas && avariasData?.mostrar_obs_internas_impressao && (
        <div className="impressao-block" style={{ marginTop: "4mm" }}>
          <div className="impressao-block-header">
            <FileText className="impressao-icon" />
            <h2 className="impressao-block-title">Observações Internas</h2>
          </div>
          <div className="impressao-block-content">
            <p style={{ whiteSpace: "pre-wrap" }}>{avariasData.observacoes_internas}</p>
          </div>
        </div>
      )}

      {/* Termo de Garantia */}
      {layoutConfig.mostrar_termos_condicoes && (
        <div className="impressao-termo-garantia">
          <div className="impressao-termo-title">Termo de Garantia do Serviço</div>
          <p className="impressao-termo-text">{termoGarantia}</p>
        </div>
      )}

      {/* Assinaturas */}
      {layoutConfig.mostrar_assinaturas && (
        <div className="impressao-footer">
          <div className="impressao-assinatura">
            {assinaturas?.tipo_assinatura_entrada === "digital" && assinaturas?.cliente_entrada ? (
              <div className="impressao-assinatura-digital">
                <img src={assinaturas.cliente_entrada} alt="Assinatura do Cliente" className="impressao-assinatura-imagem" />
              </div>
            ) : (
              <div className="impressao-linha-assinatura"></div>
            )}
            <span className="impressao-assinatura-label">Assinatura do Cliente (Entrada)</span>
            <span className="impressao-assinatura-data">
              {assinaturas?.tipo_assinatura_entrada === "digital" && assinaturas?.data_assinatura_entrada
                ? formatDate(assinaturas.data_assinatura_entrada)
                : `${configuracaoLoja?.endereco?.split(",")[1]?.trim() || "________"}, ${formatDate(new Date())}`}
            </span>
          </div>
          <div className="impressao-assinatura">
            {assinaturas?.tipo_assinatura_saida === "digital" && assinaturas?.cliente_saida ? (
              <div className="impressao-assinatura-digital">
                <img src={assinaturas.cliente_saida} alt="Assinatura de Recebimento" className="impressao-assinatura-imagem" />
              </div>
            ) : (
              <div className="impressao-linha-assinatura"></div>
            )}
            <span className="impressao-assinatura-label">Assinatura do Cliente (Saída)</span>
            <span className="impressao-assinatura-data">
              {assinaturas?.tipo_assinatura_saida === "digital" && assinaturas?.data_assinatura_saida
                ? formatDate(assinaturas.data_assinatura_saida)
                : `${configuracaoLoja?.endereco?.split(",")[1]?.trim() || "________"}, ___/___/______`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

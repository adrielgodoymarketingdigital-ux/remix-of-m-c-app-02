import { useState } from "react";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { formatCurrency, formatDate, formatPhone, formatCPF } from "@/lib/formatters";
import { AvariasOS, AvariaVisual, ProdutoUtilizado, ServicoRealizado, CustoAdicional } from "@/types/ordem-servico";
import { ConfiguracaoLoja, Layout80mmConfig } from "@/types/configuracao-loja";
import { SilhuetaComAvarias } from "./SilhuetaComAvarias";
import { PatternLockVisualizacao } from "./PatternLockVisualizacao";
import { checklistIcons } from "@/lib/checklist-icons";
import { CheckCircle2, XCircle, Smartphone } from "lucide-react";
import { decryptSenhaDesbloqueio } from "@/lib/password-encryption";
import { obterTermoGarantia } from "@/lib/termo-garantia-utils";
import { assinaturaLojaAtiva } from "@/lib/assinaturaLoja";
import { valorLinhaServico } from "@/lib/ordemServico/totaisPecasOS";
import { chaveLinhaServico } from "@/lib/ordemServico/linhaServicoOS";
import {
  imeiOuSerie,
  juntarDispositivos,
  nomeLinhaServicoComDispositivo,
  numeroAdicional,
  tituloDispositivo,
  type DispositivoAdicionalOS,
} from "@/lib/ordemServico/dispositivosAdicionaisOS";

const CONFIG_80MM_PADRAO: Layout80mmConfig = {
  mostrar_logo: true,
  mostrar_dados_loja: true,
  mostrar_dados_cliente: true,
  mostrar_dados_dispositivo: true,
  mostrar_defeito: true,
  mostrar_servicos: true,
  mostrar_valor: true,
  mostrar_checklist: false,
  mostrar_avarias: false,
  mostrar_senha: true,
  mostrar_assinaturas: true,
  mostrar_termos_condicoes: false,
  mostrar_forma_pagamento: true,
  mostrar_custos_adicionais: true,
};

interface ImpressaoCupom80mmProps {
  ordem: OrdemServico;
  configuracaoLoja?: ConfiguracaoLoja;
  config80mm?: Layout80mmConfig;
  /** Dispositivos adicionais da OS. Ausente/vazio = cupom de sempre. */
  adicionais?: DispositivoAdicionalOS[];
}

const SEM_ADICIONAIS: DispositivoAdicionalOS[] = [];

export function ImpressaoCupom80mm({ ordem, configuracaoLoja, config80mm, adicionais = SEM_ADICIONAIS }: ImpressaoCupom80mmProps) {
  const c: Layout80mmConfig = { ...CONFIG_80MM_PADRAO, ...config80mm };
  const temAdicionais = adicionais.length > 0;

  const avariasData = ordem.avarias as AvariasOS | null;
  const checklistEntrada = avariasData?.checklist?.entrada || {};
  const checklistSaida = avariasData?.checklist?.saida || {};
  const avariasVisuais = (avariasData?.avarias_visuais || []) as AvariaVisual[];
  const senhaDesbloqueio = decryptSenhaDesbloqueio(avariasData?.senha_desbloqueio);
  const assinaturas = avariasData?.assinaturas;
  const assinaturaLoja = assinaturaLojaAtiva(configuracaoLoja);
  // Suportar ambos os formatos: servicos_realizados (novo) e servicos_inline (onboarding)
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
  const subtotal = avariasData?.dados_pagamento?.subtotal ?? (desconto > 0 ? (ordem.total || 0) + desconto : undefined);

  const termoGarantia = obterTermoGarantia({
    tempoGarantia: ordem.tempo_garantia,
    termoConfig: configuracaoLoja?.termo_garantia_config,
    nomeLoja: configuracaoLoja?.nome_loja,
    nomeCliente: ordem.cliente?.nome,
    dispositivo: juntarDispositivos(`${ordem.dispositivo_marca} ${ordem.dispositivo_modelo}`, adicionais),
  });

  return (
    <div className="cupom-80mm-container">
      {/* Logo */}
      {c.mostrar_logo && configuracaoLoja?.logo_url && (
        <div className="cupom-section cupom-center">
          <img
            src={configuracaoLoja.logo_url}
            alt="Logo"
            className="cupom-logo"
            crossOrigin="anonymous"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}

      {/* Dados da Loja */}
      {c.mostrar_dados_loja && configuracaoLoja && (
        <div className="cupom-section cupom-center cupom-border-bottom">
          <div className="cupom-loja-nome">{configuracaoLoja.nome_loja}</div>
          {configuracaoLoja.cnpj && <div className="cupom-small">CNPJ: {configuracaoLoja.cnpj}</div>}
          {configuracaoLoja.endereco && <div className="cupom-small">{configuracaoLoja.endereco}</div>}
          {configuracaoLoja.telefone && <div className="cupom-small">Tel: {formatPhone(configuracaoLoja.telefone)}</div>}
        </div>
      )}

      {/* Número OS */}
      <div className="cupom-section cupom-center">
        <div className="cupom-os-numero">OS #{ordem.numero_os}</div>
        <div className="cupom-small">{formatDate(ordem.created_at)} — {ordem.status}</div>
      </div>

      {/* Cliente */}
      {c.mostrar_dados_cliente && (
        <div className="cupom-section cupom-border-bottom">
          <div className="cupom-section-title">CLIENTE</div>
          <div>Nome: {ordem.cliente?.nome || "N/A"}</div>
          <div>Tel: {ordem.cliente?.telefone ? formatPhone(ordem.cliente.telefone) : "N/A"}</div>
          {ordem.cliente?.cpf && <div>CPF: {formatCPF(ordem.cliente.cpf)}</div>}
        </div>
      )}

      {/* Dispositivo */}
      {c.mostrar_dados_dispositivo && (
        <div className="cupom-section cupom-border-bottom">
          <div className="cupom-section-title">{temAdicionais ? tituloDispositivo(1).toUpperCase() : "DISPOSITIVO"}</div>
          <div>{ordem.dispositivo_tipo} {ordem.dispositivo_marca} {ordem.dispositivo_modelo}</div>
          {ordem.dispositivo_cor && <div>Cor: {ordem.dispositivo_cor}</div>}
          {(ordem.dispositivo_imei || ordem.dispositivo_numero_serie) && (
            <div>IMEI/Série: {ordem.dispositivo_imei || ordem.dispositivo_numero_serie}</div>
          )}
        </div>
      )}

      {/* Defeito */}
      {c.mostrar_defeito && (
        <div className="cupom-section cupom-border-bottom">
          <div className="cupom-section-title">{temAdicionais ? `DEFEITO — ${tituloDispositivo(1).toUpperCase()}` : "DEFEITO"}</div>
          <div>{ordem.defeito_relatado}</div>
        </div>
      )}

      {/* Dispositivos adicionais */}
      {adicionais.map((a, i) => (
        <SecaoDispositivoAdicional80mm key={a.id} adicional={a} numero={numeroAdicional(i)} c={c} />
      ))}

      {/* Serviços + Produtos */}
      {c.mostrar_servicos && (servicosRealizados.length > 0 || produtosUtilizados.length > 0) && (
        <div className="cupom-section cupom-border-bottom">
          {servicosRealizados.length > 0 && (
            <>
              <div className="cupom-section-title">SERVIÇOS</div>
              {servicosRealizados.map((s, i) => (
                <div key={chaveLinhaServico(s, i)} className="cupom-line-between">
                  <span>{nomeLinhaServicoComDispositivo(s, adicionais)}</span>
                  <span>{formatCurrency(valorLinhaServico(s))}</span>
                </div>
              ))}
            </>
          )}
          {produtosUtilizados.length > 0 && (
            <>
              <div className="cupom-section-title" style={{ marginTop: "1mm" }}>PEÇAS</div>
              {produtosUtilizados.map((p) => (
                <div key={p.id}>
                  <span>{p.quantidade}x {p.nome}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Sem Teste */}
      {c.mostrar_checklist && avariasData?.checklist?.sem_teste && (
        <div className="cupom-section cupom-border-bottom">
          <div className="cupom-section-title">CHECKLIST ENTRADA</div>
          <div style={{ fontSize: "7pt", fontStyle: "italic", padding: "2px 0" }}>
            ⚠️ Sem teste: aparelho chegou desligado.
          </div>
        </div>
      )}

      {/* Checklist */}
      {c.mostrar_checklist && Object.keys(checklistEntrada).length > 0 && (
        <div className="cupom-section cupom-border-bottom">
          {!avariasData?.checklist?.sem_teste && (
            <div className="cupom-section-title">CHECKLIST</div>
          )}
          {Object.entries(checklistEntrada).map(([item, status]) => {
            const Icon = checklistIcons[item] || Smartphone;
            return (
              <div key={item}>
                <div className="cupom-checklist-item">
                  {status ? (
                    <CheckCircle2 style={{ width: "8px", height: "8px", color: "green" }} />
                  ) : (
                    <XCircle style={{ width: "8px", height: "8px", color: "red" }} />
                  )}
                  <span>{item.replace(/_/g, " ")}</span>
                </div>
                {item === 'peca_trocada' && status && avariasData?.checklist?.peca_trocada_descricao_entrada && (
                  <div style={{ fontSize: "6pt", paddingLeft: "12px", fontStyle: "italic" }}>
                    Peça: {avariasData.checklist.peca_trocada_descricao_entrada}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Checklist de Saída */}
      {c.mostrar_checklist && Object.keys(checklistSaida).length > 0 && (
        <div className="cupom-section cupom-border-bottom">
          <div className="cupom-section-title">CHECKLIST SAÍDA</div>
          {Object.entries(checklistSaida).map(([item, status]) => {
            const Icon = checklistIcons[item] || Smartphone;
            return (
              <div key={item}>
                <div className="cupom-checklist-item">
                  {status ? (
                    <CheckCircle2 style={{ width: "8px", height: "8px", color: "green" }} />
                  ) : (
                    <XCircle style={{ width: "8px", height: "8px", color: "red" }} />
                  )}
                  <span>{item.replace(/_/g, " ")}</span>
                </div>
                {item === 'peca_trocada' && status && avariasData?.checklist?.peca_trocada_descricao_saida && (
                  <div style={{ fontSize: "6pt", paddingLeft: "12px", fontStyle: "italic" }}>
                    Peça: {avariasData.checklist.peca_trocada_descricao_saida}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Avarias */}
      {c.mostrar_avarias && avariasVisuais.length > 0 && (
        <div className="cupom-section cupom-border-bottom">
          <div className="cupom-section-title">AVARIAS</div>
          <div className="cupom-center">
            {avariasVisuais.filter((a) => a.lado === "frente").length > 0 && (
              <div style={{ marginBottom: "2mm" }}>
                <div className="cupom-small cupom-center">Frente</div>
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
              <div>
                <div className="cupom-small cupom-center">Traseira</div>
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
      )}

      {/* Senha */}
      {c.mostrar_senha && senhaDesbloqueio && (
        <div className="cupom-section cupom-border-bottom">
          <div className="cupom-section-title">SENHA</div>
          {senhaDesbloqueio.nao_informada ? (
            <div>Cliente não quis passar a senha</div>
          ) : senhaDesbloqueio.tipo === "padrao" && senhaDesbloqueio.padrao ? (
            <div className="cupom-center">
              <PatternLockVisualizacao pattern={senhaDesbloqueio.padrao} size={60} />
            </div>
          ) : (
            <div>
              {senhaDesbloqueio.tipo === "numero" ? "PIN" : "Texto"}: {senhaDesbloqueio.valor || "N/A"}
            </div>
          )}
        </div>
      )}

      {/* Custos Adicionais */}
      {c.mostrar_custos_adicionais && custosAdicionais.length > 0 && (
        <div className="cupom-section cupom-border-bottom">
          <div className="cupom-section-title">CUSTOS ADICIONAIS</div>
          {custosAdicionais.map((custo) => (
            <div key={custo.id} className="cupom-line-between">
              <span>
                {custo.tipo === 'frete' ? 'Frete' : custo.tipo === 'brinde' ? 'Brinde' : custo.descricao}
                <span style={{ fontSize: '0.8em', color: '#666' }}>
                  {' '}({custo.repassar_cliente ? 'Cliente' : 'Loja'})
                </span>
              </span>
              <span>{formatCurrency(custo.valor)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Forma de Pagamento */}
      {c.mostrar_forma_pagamento && (ordem as any).forma_pagamento && (
        <div className="cupom-section cupom-border-bottom">
          <div className="cupom-line-between">
            <span className="cupom-section-title" style={{ marginBottom: 0 }}>PAGAMENTO</span>
            <span>{(ordem as any).forma_pagamento}</span>
          </div>
        </div>
      )}

      {/* Desconto + Valor Total */}
      {c.mostrar_valor && (
        <div className="cupom-section">
          {desconto > 0 && subtotal !== undefined && (
            <>
              <div className="cupom-line-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="cupom-line-between" style={{ color: "#c00" }}>
                <span>Desconto</span>
                <span>- {formatCurrency(desconto)}</span>
              </div>
            </>
          )}
          <div className="cupom-total">
            TOTAL: {formatCurrency(ordem.total || 0)}
          </div>
        </div>
      )}

      {/* Observações Internas (quando marcado para imprimir) */}
      {avariasData?.observacoes_internas && avariasData?.mostrar_obs_internas_impressao && (
        <div className="cupom-section cupom-border-bottom">
          <div className="cupom-section-title">OBSERVAÇÕES INTERNAS</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{avariasData.observacoes_internas}</div>
        </div>
      )}

      {/* Termo de Garantia */}
      {c.mostrar_termos_condicoes && (
        <div className="cupom-section cupom-termo">
          {termoGarantia}
        </div>
      )}

      {/* Assinaturas */}
      {c.mostrar_assinaturas && (
        <div className="cupom-section cupom-assinaturas">
          <div className="cupom-assinatura-bloco">
            {assinaturas?.tipo_assinatura_entrada === "digital" && assinaturas?.cliente_entrada ? (
              <img src={assinaturas.cliente_entrada} alt="Assinatura" className="cupom-assinatura-img" />
            ) : (
              <div className="cupom-linha-assinatura" />
            )}
            <div className="cupom-small">Assinatura do Cliente (Entrada)</div>
          </div>
          <div className="cupom-assinatura-bloco">
            {assinaturas?.tipo_assinatura_saida === "digital" && assinaturas?.cliente_saida ? (
              <img src={assinaturas.cliente_saida} alt="Assinatura" className="cupom-assinatura-img" />
            ) : (
              <div className="cupom-linha-assinatura" />
            )}
            <div className="cupom-small">Assinatura do Cliente (Saída)</div>
          </div>
          {assinaturaLoja && (
            <div className="cupom-assinatura-bloco">
              <img src={assinaturaLoja} alt="Assinatura da Loja" className="cupom-assinatura-img" />
              <div className="cupom-small">Assinatura da Loja</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** "DISPOSITIVO 2" no cupom: dados, defeito, checklist e senha (mesmas chaves do 1º); avarias em texto. */
function SecaoDispositivoAdicional80mm({ adicional: a, numero, c }: { adicional: DispositivoAdicionalOS; numero: number; c: Layout80mmConfig }) {
  const senha = decryptSenhaDesbloqueio(a.senha_desbloqueio ?? undefined);
  const entrada = Object.entries(a.checklist?.entrada || {});
  const mostrarSenha = c.mostrar_senha && !!senha;
  const mostrarChecklist = c.mostrar_checklist && (entrada.length > 0 || !!a.checklist?.sem_teste);
  const mostrarAvarias = c.mostrar_avarias && a.avarias_visuais.length > 0;
  const mostrarDefeito = c.mostrar_defeito && !!a.defeito_relatado;
  if (!c.mostrar_dados_dispositivo && !mostrarDefeito && !mostrarChecklist && !mostrarAvarias && !mostrarSenha) return null;
  return (
    <div className="cupom-section cupom-border-bottom">
      <div className="cupom-section-title">{tituloDispositivo(numero).toUpperCase()}</div>
      {c.mostrar_dados_dispositivo && (
        <>
          <div>{a.dispositivo_tipo} {a.dispositivo_marca} {a.dispositivo_modelo}</div>
          {a.dispositivo_cor && <div>Cor: {a.dispositivo_cor}</div>}
          {imeiOuSerie(a) && <div>IMEI/Série: {imeiOuSerie(a)}</div>}
        </>
      )}
      {mostrarDefeito && <div>Defeito: {a.defeito_relatado}</div>}
      {mostrarChecklist && (
        <>
          {a.checklist?.sem_teste && (
            <div style={{ fontSize: "7pt", fontStyle: "italic", padding: "2px 0" }}>⚠️ Sem teste: aparelho chegou desligado.</div>
          )}
          {entrada.map(([item, status]) => (
            <div key={item} className="cupom-checklist-item">
              {status ? (
                <CheckCircle2 style={{ width: "8px", height: "8px", color: "green" }} />
              ) : (
                <XCircle style={{ width: "8px", height: "8px", color: "red" }} />
              )}
              <span>{item.replace(/_/g, " ")}</span>
            </div>
          ))}
        </>
      )}
      {mostrarAvarias && (
        <div>Avarias: {a.avarias_visuais.map((v) => `${v.tipo} (${v.lado})`).join(", ")}</div>
      )}
      {mostrarSenha && senha && (
        senha.nao_informada ? (
          <div>Senha: Cliente não quis passar a senha</div>
        ) : senha.tipo === "padrao" && senha.padrao ? (
          <>
            <div>Senha: Padrão Android</div>
            <div className="cupom-center">
              <PatternLockVisualizacao pattern={senha.padrao} size={60} />
            </div>
          </>
        ) : (
          <div>{senha.tipo === "numero" ? "PIN" : "Texto"}: {senha.valor || "N/A"}</div>
        )
      )}
    </div>
  );
}

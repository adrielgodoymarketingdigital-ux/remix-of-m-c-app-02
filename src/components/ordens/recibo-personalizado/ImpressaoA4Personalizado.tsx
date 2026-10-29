import { useState } from "react";
import {
  Check,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileText,
  Image as IconeImagem,
  Lock,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Smartphone,
  User,
  Wrench,
  X,
} from "lucide-react";
import type { OrdemServico } from "@/hooks/useOrdensServico";
import type { AvariasOS } from "@/types/ordem-servico";
import type { ConfiguracaoLoja, LayoutOSConfig } from "@/types/configuracao-loja";
import { formatCurrency, formatDate, formatPhone, formatCPF, formatarEndereco } from "@/lib/formatters";
import { decryptSenhaDesbloqueio } from "@/lib/password-encryption";
import { assinaturaLojaAtiva } from "@/lib/assinaturaLoja";
import { checklistIcons } from "@/lib/checklist-icons";
import { valorLinhaServico } from "@/lib/ordemServico/totaisPecasOS";
import { chaveLinhaServico } from "@/lib/ordemServico/linhaServicoOS";
import { nomeLinhaServicoComDispositivo, tituloDispositivo, type DispositivoAdicionalOS } from "@/lib/ordemServico/dispositivosAdicionaisOS";
import { TITULO_FOTOS, textoExcedentes, type FotoImpressao } from "@/lib/os/fotosImpressaoOS";
import {
  colunasFotosRecibo,
  montarDadosReciboOSPersonalizado,
  type ChecklistRecibo,
} from "@/lib/ordemServico/reciboOSPersonalizadoModelo";
import servicosPtBR from "@/locales/pt-BR/servicos";
import { SilhuetaComAvarias } from "../SilhuetaComAvarias";
import { PatternLockVisualizacao } from "../PatternLockVisualizacao";
import { DispositivosAdicionaisImpressao } from "../DispositivosAdicionaisImpressao";
import { CSS_RECIBO_PERSONALIZADO } from "./cssReciboPersonalizado";

/**
 * Recibo A4 PERSONALIZADO da OS (layout_os_config.modelo_recibo_a4 = 'personalizado').
 * Mesmas props, mesmos campos e mesmas condições de ImpressaoA4Padrao/Tech —
 * muda só o desenho. Os textos são os do recibo de sempre (pt-BR, como ele);
 * os dois títulos novos vêm das chaves servicos.reciboOS (pt-BR e es).
 */
interface Props {
  ordem: OrdemServico;
  configuracaoLoja?: ConfiguracaoLoja;
  layoutConfig: LayoutOSConfig;
  termoGarantia: string;
  fotosImpressao?: FotoImpressao[];
  fotosExcedentes?: number;
  adicionais?: DispositivoAdicionalOS[];
}

const SEM_ADICIONAIS: DispositivoAdicionalOS[] = [];
const TEXTOS = servicosPtBR.reciboOS;

export function ImpressaoA4Personalizado({
  ordem,
  configuracaoLoja,
  layoutConfig,
  termoGarantia,
  fotosImpressao,
  fotosExcedentes,
  adicionais = SEM_ADICIONAIS,
}: Props) {
  const [logoFalhou, setLogoFalhou] = useState(false);
  const temAdicionais = adicionais.length > 0;
  const doDispositivo1 = (titulo: string) => (temAdicionais ? `${titulo} — ${tituloDispositivo(1)}` : titulo);
  const avariasData = ordem.avarias as AvariasOS | null;
  const dados = montarDadosReciboOSPersonalizado(ordem, layoutConfig);
  const senha = decryptSenhaDesbloqueio(avariasData?.senha_desbloqueio);
  const mostrarSenha = !!layoutConfig.mostrar_senha && !!senha;
  const assinaturas = avariasData?.assinaturas;
  const assinaturaLoja = assinaturaLojaAtiva(configuracaoLoja);
  const formaPagamento = (ordem as OrdemServico & { forma_pagamento?: string | null }).forma_pagamento;
  const endereco = configuracaoLoja ? formatarEndereco(configuracaoLoja) : "";
  const cidadeAssinatura = configuracaoLoja?.endereco?.split(",")[1]?.trim() || "________";

  const mostrarLogo = !!(layoutConfig.mostrar_logo_impressao && configuracaoLoja?.logo_url && !logoFalhou);
  const temChecklistEntrada = dados.checklistSemTeste || !!dados.checklistEntrada;
  const temItens = dados.servicos.length > 0 || dados.produtos.length > 0;
  const fotos = fotosImpressao ?? [];

  const cardSenha = mostrarSenha && senha && (
    <div className="osr-card osr-card-senha">
      <div className="osr-card-header">
        <Lock />
        <h2 className="osr-card-titulo">{doDispositivo1("Senha de Desbloqueio")}</h2>
      </div>
      <div className="osr-card-body">
        {senha.nao_informada ? (
          <div className="osr-campo"><span className="osr-valor">Cliente não quis passar a senha</span></div>
        ) : (
          <>
            <div className="osr-campo">
              <span className="osr-rotulo">Tipo:</span>
              <span className="osr-valor">
                {senha.tipo === "numero" && "PIN"}
                {senha.tipo === "letra" && "Texto"}
                {senha.tipo === "padrao" && "Padrão Android"}
              </span>
            </div>
            {senha.tipo !== "padrao" && (
              <div className="osr-campo">
                <span className="osr-rotulo">Senha:</span>
                <span className="osr-valor osr-senha-valor">{senha.valor || "N/A"}</span>
              </div>
            )}
            {senha.tipo === "padrao" && senha.padrao && (
              <div className="osr-campo osr-campo-cheio">
                <PatternLockVisualizacao pattern={senha.padrao} size={80} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const cardChecklistEntrada = temChecklistEntrada && (
    <div className="osr-card">
      <div className="osr-card-header">
        <ClipboardList />
        <h2 className="osr-card-titulo">{doDispositivo1("Checklist de Entrada")}</h2>
      </div>
      <div className="osr-card-body">
        {dados.checklistSemTeste && (
          <p className="osr-aviso">⚠️ Sem teste: Não foi possível realizar os testes porque o aparelho chegou desligado.</p>
        )}
        {dados.checklistEntrada && <ListaChecklist checklist={dados.checklistEntrada} />}
      </div>
    </div>
  );

  const cardChecklistSaida = dados.checklistSaida && (
    <div className="osr-card">
      <div className="osr-card-header">
        <ClipboardCheck />
        <h2 className="osr-card-titulo">{doDispositivo1("Checklist de Saída")}</h2>
      </div>
      <div className="osr-card-body">
        <ListaChecklist checklist={dados.checklistSaida} />
      </div>
    </div>
  );

  const cardAvarias = dados.avarias && (
    <div className="osr-card osr-avarias">
      <div className="osr-card-header">
        <Smartphone />
        <h2 className="osr-card-titulo">{doDispositivo1("Avarias Visuais")}</h2>
      </div>
      <div className="osr-card-body">
        <div className="impressao-avarias-container">
          {dados.avarias.frente.length > 0 && (
            <div className="impressao-silhueta">
              <div className="impressao-silhueta-label">Frente</div>
              <SilhuetaComAvarias
                tipoDispositivo={ordem.dispositivo_tipo}
                subtipoRelogio={avariasData?.dispositivo_subtipo}
                lado="frente"
                avarias={dados.avarias.frente}
                printMode={true}
              />
            </div>
          )}
          {dados.avarias.traseira.length > 0 && (
            <div className="impressao-silhueta">
              <div className="impressao-silhueta-label">Traseira</div>
              <SilhuetaComAvarias
                tipoDispositivo={ordem.dispositivo_tipo}
                subtipoRelogio={avariasData?.dispositivo_subtipo}
                lado="traseira"
                avarias={dados.avarias.traseira}
                printMode={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="impressao-ordem-container os-recibo-personalizado">
      <style>{CSS_RECIBO_PERSONALIZADO}</style>

      {/* Cabeçalho */}
      <div className="osr-header">
        {(mostrarLogo || configuracaoLoja?.nome_loja) && (
          <div className="osr-logo-box">
            {mostrarLogo ? (
              <img
                src={configuracaoLoja?.logo_url}
                alt="Logo"
                crossOrigin="anonymous"
                onError={() => setLogoFalhou(true)}
              />
            ) : (
              <span className="osr-logo-nome">{configuracaoLoja?.nome_loja}</span>
            )}
          </div>
        )}
        <div className="osr-titulo-area">
          <h1 className="osr-titulo">ORDEM DE SERVIÇO</h1>
          <div className="osr-numero">#{ordem.numero_os}</div>
          <div className="osr-data-status">
            <span>{formatDate(ordem.created_at)}</span>
            <span className="osr-status"><span className="osr-status-ponto" />{ordem.status}</span>
          </div>
        </div>
        {configuracaoLoja && (
          <div className="osr-loja">
            {mostrarLogo && <div className="osr-loja-nome">{configuracaoLoja.nome_loja}</div>}
            {configuracaoLoja.cnpj && <div>CNPJ: {configuracaoLoja.cnpj}</div>}
            {endereco && (
              <div className="osr-loja-linha"><MapPin /><span>{endereco}</span></div>
            )}
            {configuracaoLoja.telefone && (
              <div className="osr-loja-linha"><Phone /><span>Tel: {formatPhone(configuracaoLoja.telefone)}</span></div>
            )}
          </div>
        )}
      </div>

      {/* Cliente + Aparelho */}
      <div className="osr-linha-2">
        <div className="osr-card">
          <div className="osr-card-header">
            <User />
            <h2 className="osr-card-titulo">{TEXTOS.dadosCliente}</h2>
          </div>
          <div className="osr-card-body">
            <Campo rotulo="Nome:" valor={ordem.cliente?.nome || "N/A"} />
            <Campo rotulo="Tel:" valor={ordem.cliente?.telefone ? formatPhone(ordem.cliente.telefone) : "N/A"} />
            <Campo rotulo="CPF:" valor={ordem.cliente?.cpf ? formatCPF(ordem.cliente.cpf) : "N/A"} />
          </div>
        </div>
        <div className="osr-card">
          <div className="osr-card-header">
            <Smartphone />
            <h2 className="osr-card-titulo">{doDispositivo1(TEXTOS.dadosAparelho)}</h2>
          </div>
          <div className="osr-card-body">
            <Campo rotulo="Tipo/Marca:" valor={`${ordem.dispositivo_tipo} ${ordem.dispositivo_marca}`} />
            <Campo rotulo="Modelo/Cor:" valor={`${ordem.dispositivo_modelo} (${ordem.dispositivo_cor || "N/A"})`} />
            <Campo rotulo="IMEI/Série:" valor={ordem.dispositivo_imei || ordem.dispositivo_numero_serie || "N/A"} />
          </div>
        </div>
      </div>

      {/* Defeito + Valor */}
      <div className="osr-linha-defeito">
        <div className="osr-card">
          <div className="osr-card-header">
            <Wrench />
            <h2 className="osr-card-titulo">{doDispositivo1("Defeito Relatado")}</h2>
          </div>
          <div className="osr-card-body">
            <p className="osr-texto">{ordem.defeito_relatado}</p>
          </div>
        </div>
        <div className="osr-card osr-card-valor">
          <div className="osr-card-header">
            <DollarSign />
            <h2 className="osr-card-titulo">Valor do Serviço</h2>
          </div>
          <div className="osr-card-body osr-valor-body">
            {dados.desconto > 0 && dados.subtotal !== undefined && (
              <>
                <div className="osr-valor-linha"><span>Subtotal</span><span>{formatCurrency(dados.subtotal)}</span></div>
                <div className="osr-valor-linha osr-valor-linha-desconto"><span>Desconto</span><span>- {formatCurrency(dados.desconto)}</span></div>
              </>
            )}
            <div className="osr-valor-total">{formatCurrency(ordem.total || 0)}</div>
          </div>
        </div>
      </div>

      <DispositivosAdicionaisImpressao adicionais={adicionais} layoutConfig={layoutConfig} />

      {/* Itens do Serviço */}
      {temItens && (
        <div className="osr-card">
          <div className="osr-card-header">
            <Package />
            <h2 className="osr-card-titulo">Itens do Serviço</h2>
          </div>
          <div className="osr-card-body">
            {dados.servicos.length > 0 && (
              <div className="osr-itens">
                <div className="osr-itens-titulo">Serviços:</div>
                {dados.servicos.map((servico, i) => (
                  <div key={chaveLinhaServico(servico, i)} className="osr-item">
                    <span className="osr-item-nome">• {nomeLinhaServicoComDispositivo(servico, adicionais)}</span>
                    <span className="osr-item-valor">{formatCurrency(valorLinhaServico(servico))}</span>
                  </div>
                ))}
              </div>
            )}
            {dados.produtos.length > 0 && (
              <div className="osr-itens">
                <div className="osr-itens-titulo">Produtos/Peças:</div>
                {dados.produtos.map((produto) => (
                  <div key={produto.id} className="osr-item">
                    <span className="osr-item-nome">• {produto.quantidade}x {produto.nome}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custos Adicionais */}
      {dados.custos.length > 0 && (
        <div className="osr-card">
          <div className="osr-card-header">
            <Package />
            <h2 className="osr-card-titulo">Custos Adicionais</h2>
          </div>
          <div className="osr-card-body">
            {dados.custos.map((custo) => (
              <div key={custo.id} className="osr-item">
                <span className="osr-item-nome">
                  • {custo.tipo === "frete" ? "Frete" : custo.tipo === "brinde" ? "Brinde" : custo.descricao}
                  {custo.descricao && custo.tipo !== "outro" ? ` - ${custo.descricao}` : ""}
                  <span className="osr-item-obs">({custo.repassar_cliente ? "Cliente paga" : "Loja assume"})</span>
                </span>
                <span className="osr-item-valor">{formatCurrency(custo.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forma de Pagamento */}
      {formaPagamento && (
        <div className="osr-card">
          <div className="osr-card-header">
            <CreditCard />
            <h2 className="osr-card-titulo">Forma de Pagamento</h2>
          </div>
          <div className="osr-card-body">
            <p>{formaPagamento}</p>
          </div>
        </div>
      )}

      {/* Senha + Checklist de entrada */}
      {cardSenha && cardChecklistEntrada ? (
        <div className="osr-linha-senha">
          {cardSenha}
          {cardChecklistEntrada}
        </div>
      ) : (
        cardSenha || cardChecklistEntrada
      )}

      {/* Checklist de saída + Avarias */}
      {cardChecklistSaida && cardAvarias ? (
        <div className="osr-linha-2">
          {cardChecklistSaida}
          {cardAvarias}
        </div>
      ) : (
        cardChecklistSaida || cardAvarias
      )}

      {/* Observações internas (só quando a OS manda imprimir) */}
      {dados.observacoesInternas && (
        <div className="osr-card">
          <div className="osr-card-header">
            <FileText />
            <h2 className="osr-card-titulo">Observações Internas</h2>
          </div>
          <div className="osr-card-body">
            <p className="osr-texto">{dados.observacoesInternas}</p>
          </div>
        </div>
      )}

      {/* Fotos do aparelho (as mesmas miniaturas e o mesmo limite do recibo de sempre) */}
      {fotos.length > 0 && (
        <div className="osr-card">
          <div className="osr-card-header">
            <IconeImagem />
            <h2 className="osr-card-titulo">{TITULO_FOTOS}</h2>
          </div>
          <div className="osr-card-body">
            <div className={`osr-fotos osr-fotos-${colunasFotosRecibo(fotos.length)}`}>
              {fotos.map((foto, i) => (
                <figure key={`${i}-${foto.legenda}`} className="osr-foto">
                  <div className="osr-foto-caixa"><img src={foto.src} alt={foto.legenda} /></div>
                  <figcaption>{foto.legenda}</figcaption>
                </figure>
              ))}
            </div>
            {(fotosExcedentes ?? 0) > 0 && <div className="osr-fotos-excedentes">{textoExcedentes(fotosExcedentes ?? 0)}</div>}
          </div>
        </div>
      )}

      {/* Termo de Garantia */}
      {layoutConfig.mostrar_termos_condicoes && (
        <div className="osr-card">
          <div className="osr-card-header">
            <ShieldCheck />
            <h2 className="osr-card-titulo">Termo de Garantia do Serviço</h2>
          </div>
          <div className="osr-card-body">
            <p className="osr-termo">{termoGarantia}</p>
          </div>
        </div>
      )}

      {/* Assinaturas */}
      {layoutConfig.mostrar_assinaturas && (
        <div className="osr-assinaturas">
          <div className="osr-assinatura">
            {assinaturas?.tipo_assinatura_entrada === "digital" && assinaturas?.cliente_entrada ? (
              <img src={assinaturas.cliente_entrada} alt="Assinatura do Cliente" className="osr-assinatura-imagem" />
            ) : (
              <div className="osr-assinatura-linha" />
            )}
            <span className="osr-assinatura-rotulo">Assinatura do Cliente (Entrada)</span>
            <span className="osr-assinatura-data">
              {assinaturas?.tipo_assinatura_entrada === "digital" && assinaturas?.data_assinatura_entrada
                ? formatDate(assinaturas.data_assinatura_entrada)
                : `${cidadeAssinatura}, ${formatDate(new Date())}`}
            </span>
          </div>
          <div className="osr-assinatura">
            {assinaturas?.tipo_assinatura_saida === "digital" && assinaturas?.cliente_saida ? (
              <img src={assinaturas.cliente_saida} alt="Assinatura de Recebimento" className="osr-assinatura-imagem" />
            ) : (
              <div className="osr-assinatura-linha" />
            )}
            <span className="osr-assinatura-rotulo">Assinatura do Cliente (Saída)</span>
            <span className="osr-assinatura-data">
              {assinaturas?.tipo_assinatura_saida === "digital" && assinaturas?.data_assinatura_saida
                ? formatDate(assinaturas.data_assinatura_saida)
                : `${cidadeAssinatura}, ___/___/______`}
            </span>
          </div>
          {assinaturaLoja && (
            <div className="osr-assinatura">
              <img src={assinaturaLoja} alt="Assinatura da Loja" className="osr-assinatura-imagem" />
              <span className="osr-assinatura-rotulo">Assinatura da Loja</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="osr-campo">
      <span className="osr-rotulo">{rotulo}</span>
      <span className="osr-valor">{valor}</span>
    </div>
  );
}

function ListaChecklist({ checklist }: { checklist: ChecklistRecibo }) {
  return (
    <div className="osr-checklist">
      {checklist.itens.map((item) => {
        const Icone = checklistIcons[item.chave] || Smartphone;
        return (
          <div key={item.chave}>
            <div className="osr-check-item">
              <Icone className="osr-check-icone" />
              <span className="osr-check-rotulo">{item.rotulo}</span>
              <span className={`osr-marca ${item.ok ? "osr-marca-ok" : "osr-marca-erro"}`}>
                {item.ok ? <Check /> : <X />}
              </span>
            </div>
            {item.detalhe && <div className="osr-check-detalhe">Peça: {item.detalhe}</div>}
          </div>
        );
      })}
    </div>
  );
}

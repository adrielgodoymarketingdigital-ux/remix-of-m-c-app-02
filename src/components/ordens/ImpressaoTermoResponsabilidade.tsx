import { useEffect } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { ConfiguracaoLoja, TermoResponsabilidadeConfig } from "@/types/configuracao-loja";
import {
  formatarTextoComVariaveis,
  TERMO_RESPONSABILIDADE_PADRAO,
} from "@/lib/termo-responsabilidade-utils";

interface ImpressaoTermoResponsabilidadeProps {
  ordem: OrdemServico;
  configuracaoLoja?: ConfiguracaoLoja;
  onFecharImpressao: () => void;
}

export function ImpressaoTermoResponsabilidade({
  ordem,
  configuracaoLoja,
  onFecharImpressao,
}: ImpressaoTermoResponsabilidadeProps) {
  const termo = (configuracaoLoja?.termo_responsabilidade_config as TermoResponsabilidadeConfig) ||
    TERMO_RESPONSABILIDADE_PADRAO;
  
  const corPrimaria = termo.cor_primaria || "#6B21A8";

  const dadosSubstituicao = {
    cliente: ordem.cliente?.nome || "",
    telefone: ordem.cliente?.telefone || "",
    dispositivo: ordem.dispositivo_tipo || "",
    marca: ordem.dispositivo_marca || "",
    modelo: ordem.dispositivo_modelo || "",
    defeito: ordem.defeito_relatado || "",
    loja: configuracaoLoja?.nome_loja || "",
    numero_os: ordem.numero_os || "",
    data: format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
  };

  const formatarEndereco = () => {
    if (!configuracaoLoja) return "";
    const partes = [];
    if (configuracaoLoja.logradouro) {
      partes.push(configuracaoLoja.logradouro);
      if (configuracaoLoja.numero) partes.push(`, ${configuracaoLoja.numero}`);
    }
    if (configuracaoLoja.bairro) partes.push(` - ${configuracaoLoja.bairro}`);
    if (configuracaoLoja.cidade && configuracaoLoja.estado) {
      partes.push(` - ${configuracaoLoja.cidade}/${configuracaoLoja.estado}`);
    }
    return partes.join("");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onFecharImpressao();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onFecharImpressao]);

  const handlePrint = () => {
    window.print();
  };

  let printRoot = document.getElementById("print-root");
  if (!printRoot) {
    printRoot = document.createElement("div");
    printRoot.id = "print-root";
    document.body.appendChild(printRoot);
  }

  return createPortal(
    <div className="print-root">
      {/* CSS dinâmico para a cor personalizada */}
      <style>
        {`
          .termo-cor-primaria {
            color: ${corPrimaria} !important;
          }
          .termo-borda-primaria {
            border-color: ${corPrimaria} !important;
          }
          .termo-bg-primaria {
            background-color: ${corPrimaria} !important;
          }
          @media print {
            .termo-cor-primaria {
              color: ${corPrimaria} !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .termo-borda-primaria {
              border-color: ${corPrimaria} !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>

      {/* Botões de ação */}
      <div className="print-trigger-container">
        <button className="print-trigger-button" onClick={handlePrint}>
          Imprimir Termo
        </button>
        <button className="print-close-button" onClick={onFecharImpressao}>
          Fechar
        </button>
      </div>

      {/* Conteúdo do Termo */}
      <div className="termo-responsabilidade-container">
        {/* Cabeçalho */}
        <div className="termo-header termo-borda-primaria" style={{ borderBottomColor: corPrimaria }}>
          <div className="termo-header-content">
            {configuracaoLoja?.logo_url && (
              <img
                src={configuracaoLoja.logo_url}
                alt="Logo"
                className="termo-logo"
              />
            )}
            <div className="termo-header-info">
              <h1 className="termo-nome-loja termo-cor-primaria" style={{ color: corPrimaria }}>
                {configuracaoLoja?.nome_loja || "ASSISTÊNCIA TÉCNICA"}
              </h1>
              {formatarEndereco() && (
                <p className="termo-endereco">{formatarEndereco()}</p>
              )}
              <div className="termo-contatos">
                {configuracaoLoja?.whatsapp && (
                  <span>WhatsApp: {configuracaoLoja.whatsapp}</span>
                )}
                {configuracaoLoja?.telefone && (
                  <span>Tel: {configuracaoLoja.telefone}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Título do Termo */}
        <div 
          className="termo-titulo-container" 
          style={{ borderTop: `2px solid ${corPrimaria}`, borderBottom: `2px solid ${corPrimaria}` }}
        >
          <h2 className="termo-titulo" style={{ color: corPrimaria }}>
            {termo.titulo}
          </h2>
        </div>

        {/* Dados do Cliente e Dispositivo */}
        <div className="termo-dados">
          <div className="termo-campo">
            <span className="termo-campo-label">Cliente:</span>
            <span className="termo-campo-valor">{ordem.cliente?.nome || "_____________"}</span>
          </div>
          <div className="termo-campo">
            <span className="termo-campo-label">Telefone:</span>
            <span className="termo-campo-valor">{ordem.cliente?.telefone || "_____________"}</span>
          </div>
          <div className="termo-campo">
            <span className="termo-campo-label">Aparelho:</span>
            <span className="termo-campo-valor">{ordem.dispositivo_tipo || "_____________"}</span>
          </div>
          <div className="termo-campo">
            <span className="termo-campo-label">Marca/Modelo:</span>
            <span className="termo-campo-valor">
              {ordem.dispositivo_marca} {ordem.dispositivo_modelo}
            </span>
          </div>
          <div className="termo-campo termo-campo-full">
            <span className="termo-campo-label">Defeito informado pelo cliente:</span>
            <span className="termo-campo-valor">{ordem.defeito_relatado || "_____________"}</span>
          </div>
        </div>

        {/* Introdução */}
        {termo.introducao && (
          <p className="termo-introducao">
            {formatarTextoComVariaveis(termo.introducao, dadosSubstituicao)}
          </p>
        )}

        {/* Seções e Cláusulas */}
        <div className="termo-secoes">
          {termo.secoes.map((secao) => (
            <div key={secao.id} className="termo-secao">
              {secao.titulo && (
                <h3 className="termo-secao-titulo termo-cor-primaria" style={{ color: corPrimaria }}>
                  {secao.titulo}
                </h3>
              )}
              <div className="termo-clausulas">
                {secao.clausulas
                  .filter((c) => c.ativo)
                  .map((clausula) => (
                    <div key={clausula.id} className="termo-clausula">
                      <span 
                        className="termo-checkbox termo-borda-primaria" 
                        style={{ borderColor: corPrimaria }}
                      >
                        □
                      </span>
                      <p className="termo-clausula-texto">
                        {formatarTextoComVariaveis(clausula.texto, dadosSubstituicao)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Declaração Final */}
        {termo.declaracao_final && (
          <div className="termo-declaracao" style={{ borderColor: corPrimaria }}>
            <p>{formatarTextoComVariaveis(termo.declaracao_final, dadosSubstituicao)}</p>
          </div>
        )}

        {/* Área de Assinatura */}
        <div className="termo-assinatura-area">
          <div className="termo-data">
            <span>Data: ______/______/____________</span>
          </div>
          <div className="termo-assinatura">
            <div className="termo-linha-assinatura"></div>
            <span>Assinatura do Cliente</span>
          </div>
        </div>

        {/* Rodapé com número da OS */}
        <div className="termo-rodape">
          <span>OS: {ordem.numero_os}</span>
          <span>Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
        </div>
      </div>
    </div>,
    printRoot
  );
}
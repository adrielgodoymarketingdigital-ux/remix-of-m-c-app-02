import { OrdemServico } from "@/hooks/useOrdensServico";
import { ConfiguracaoLoja, LayoutOSConfig } from "@/types/configuracao-loja";
import { AvariasOS, ProdutoUtilizado, ServicoRealizado, CustoAdicional } from "@/types/ordem-servico";
import { formatCurrency, formatDate, formatPhone, formatCPF } from "@/lib/formatters";
import { decryptSenhaDesbloqueio } from "@/lib/password-encryption";

interface Props {
  ordem: OrdemServico;
  configuracaoLoja?: ConfiguracaoLoja;
  layoutConfig: LayoutOSConfig;
  termoGarantia: string;
  // largura em px da coluna — definido pelo container A4 (794px ÷ 2 colunas − gap)
  larguraPx?: number;
}

// Layout minimalista preto-no-branco para captura com html2canvas.
// Sem gradientes, sombras ou cores escuras de fundo — garante fidelidade no canvas.
export function OSPrintLayout({ ordem, configuracaoLoja, layoutConfig, termoGarantia, larguraPx = 377 }: Props) {
  const avariasData = ordem.avarias as AvariasOS | null;

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
  const senhaDesbloqueio = decryptSenhaDesbloqueio(avariasData?.senha_desbloqueio);

  const s: Record<string, React.CSSProperties> = {
    root: {
      width: `${larguraPx}px`,
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "9px",
      color: "#000",
      backgroundColor: "#fff",
      padding: "8px",
      boxSizing: "border-box",
      lineHeight: 1.4,
    },
    header: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      borderBottom: "1.5px solid #000",
      paddingBottom: "5px",
      marginBottom: "5px",
    },
    logo: {
      width: "32px",
      height: "32px",
      objectFit: "contain" as const,
    },
    headerInfo: { flex: 1 },
    titulo: { fontSize: "11px", fontWeight: 900, margin: 0, textTransform: "uppercase" as const },
    subtitulo: { fontSize: "8px", color: "#444", margin: "1px 0 0" },
    osNum: { fontSize: "13px", fontWeight: 900, textAlign: "right" as const, whiteSpace: "nowrap" as const },
    secao: {
      marginBottom: "4px",
      border: "0.5px solid #ccc",
      borderRadius: "2px",
      overflow: "hidden",
    },
    secaoTitulo: {
      backgroundColor: "#e8e8e8",
      padding: "2px 5px",
      fontSize: "7.5px",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "0.3px",
      borderBottom: "0.5px solid #ccc",
    },
    secaoBody: { padding: "3px 5px" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "4px" },
    campo: { display: "flex", gap: "3px", marginBottom: "1.5px", fontSize: "8.5px" },
    label: { fontWeight: 700, whiteSpace: "nowrap" as const, color: "#333", flexShrink: 0 },
    valor: { color: "#000" },
    itemLinha: { display: "flex", justifyContent: "space-between", fontSize: "8px", borderBottom: "0.3px solid #eee", padding: "1px 0" },
    totalBox: {
      border: "1.5px solid #000",
      borderRadius: "2px",
      padding: "4px 6px",
      textAlign: "center" as const,
      marginBottom: "4px",
    },
    totalValor: { fontSize: "14px", fontWeight: 900 },
    totalLabel: { fontSize: "7px", color: "#555", marginBottom: "2px" },
    assinaturaBloco: { marginTop: "8px", display: "flex", justifyContent: "space-around", gap: "8px" },
    assinaturaItem: { flex: 1, textAlign: "center" as const },
    assinaturaLinha: { borderBottom: "1px solid #000", marginBottom: "2px", minHeight: "18px" },
    assinaturaLabel: { fontSize: "7px", color: "#555" },
    termo: {
      fontSize: "6.5px",
      color: "#555",
      borderTop: "0.5px solid #ccc",
      paddingTop: "3px",
      marginTop: "4px",
      whiteSpace: "pre-line" as const,
    },
  };

  return (
    <div style={s.root}>
      {/* Cabeçalho */}
      <div style={s.header}>
        {layoutConfig.mostrar_logo_impressao && configuracaoLoja?.logo_url && (
          <img src={configuracaoLoja.logo_url} alt="Logo" style={s.logo} crossOrigin="anonymous" />
        )}
        <div style={s.headerInfo}>
          <div style={s.titulo}>{configuracaoLoja?.nome_loja || "Assistência Técnica"}</div>
          {configuracaoLoja?.telefone && (
            <div style={s.subtitulo}>Tel: {formatPhone(configuracaoLoja.telefone)}</div>
          )}
          {configuracaoLoja?.endereco && (
            <div style={s.subtitulo}>{configuracaoLoja.endereco}</div>
          )}
        </div>
        <div style={s.osNum}>OS #{ordem.numero_os}</div>
      </div>

      {/* Data e Status */}
      <div style={{ fontSize: "7.5px", color: "#555", marginBottom: "4px" }}>
        Data: {formatDate(ordem.created_at)} &nbsp;|&nbsp; Status: {ordem.status}
      </div>

      {/* Cliente + Dispositivo */}
      <div style={s.grid2}>
        <div style={s.secao}>
          <div style={s.secaoTitulo}>Cliente</div>
          <div style={s.secaoBody}>
            <div style={s.campo}><span style={s.label}>Nome:</span><span style={s.valor}>{ordem.cliente?.nome || "N/A"}</span></div>
            <div style={s.campo}><span style={s.label}>Tel:</span><span style={s.valor}>{ordem.cliente?.telefone ? formatPhone(ordem.cliente.telefone) : "N/A"}</span></div>
            {ordem.cliente?.cpf && (
              <div style={s.campo}><span style={s.label}>CPF:</span><span style={s.valor}>{formatCPF(ordem.cliente.cpf)}</span></div>
            )}
          </div>
        </div>

        <div style={s.secao}>
          <div style={s.secaoTitulo}>Dispositivo</div>
          <div style={s.secaoBody}>
            <div style={s.campo}><span style={s.label}>Tipo:</span><span style={s.valor}>{ordem.dispositivo_tipo} {ordem.dispositivo_marca}</span></div>
            <div style={s.campo}><span style={s.label}>Modelo:</span><span style={s.valor}>{ordem.dispositivo_modelo}</span></div>
            {(ordem.dispositivo_imei || ordem.dispositivo_numero_serie) && (
              <div style={s.campo}><span style={s.label}>IMEI:</span><span style={s.valor}>{ordem.dispositivo_imei || ordem.dispositivo_numero_serie}</span></div>
            )}
            {ordem.dispositivo_cor && (
              <div style={s.campo}><span style={s.label}>Cor:</span><span style={s.valor}>{ordem.dispositivo_cor}</span></div>
            )}
          </div>
        </div>
      </div>

      {/* Defeito */}
      <div style={s.secao}>
        <div style={s.secaoTitulo}>Defeito Relatado</div>
        <div style={{ ...s.secaoBody, fontSize: "8.5px" }}>{ordem.defeito_relatado}</div>
      </div>

      {/* Senha de desbloqueio */}
      {layoutConfig.mostrar_senha && senhaDesbloqueio && senhaDesbloqueio.tipo !== "padrao" && (
        <div style={s.secao}>
          <div style={s.secaoTitulo}>Senha de Desbloqueio</div>
          <div style={s.secaoBody}>
            <div style={s.campo}><span style={s.label}>Tipo:</span><span style={s.valor}>{senhaDesbloqueio.tipo === "numero" ? "PIN" : "Texto"}</span></div>
            <div style={s.campo}><span style={s.label}>Senha:</span><span style={s.valor}>{senhaDesbloqueio.valor || "N/A"}</span></div>
          </div>
        </div>
      )}

      {/* Serviços e Peças */}
      {(servicosRealizados.length > 0 || produtosUtilizados.length > 0) && (
        <div style={s.secao}>
          <div style={s.secaoTitulo}>Serviços / Peças</div>
          <div style={s.secaoBody}>
            {servicosRealizados.map((sv) => (
              <div key={sv.id} style={s.itemLinha}>
                <span>• {sv.nome}</span>
                <span style={{ fontWeight: 700 }}>{formatCurrency(sv.preco)}</span>
              </div>
            ))}
            {produtosUtilizados.map((p) => (
              <div key={p.id} style={s.itemLinha}>
                <span>• {p.quantidade}x {p.nome}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custos adicionais */}
      {custosAdicionais.length > 0 && (
        <div style={s.secao}>
          <div style={s.secaoTitulo}>Custos Adicionais</div>
          <div style={s.secaoBody}>
            {custosAdicionais.map((c) => (
              <div key={c.id} style={s.itemLinha}>
                <span>• {c.tipo === "frete" ? "Frete" : c.tipo === "brinde" ? "Brinde" : c.descricao}</span>
                <span style={{ fontWeight: 700 }}>{formatCurrency(c.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Valor total */}
      <div style={s.totalBox}>
        {desconto > 0 && subtotalPagamento !== undefined && (
          <div style={{ fontSize: "7px", color: "#666", textDecoration: "line-through", marginBottom: "1px" }}>
            Subtotal: {formatCurrency(subtotalPagamento)}
          </div>
        )}
        {desconto > 0 && (
          <div style={{ fontSize: "7px", color: "#c00", marginBottom: "1px" }}>
            Desconto: - {formatCurrency(desconto)}
          </div>
        )}
        <div style={s.totalLabel}>TOTAL</div>
        <div style={s.totalValor}>{formatCurrency(ordem.total || 0)}</div>
        {(ordem as any).forma_pagamento && (
          <div style={{ fontSize: "7.5px", color: "#555", marginTop: "2px" }}>{(ordem as any).forma_pagamento}</div>
        )}
      </div>

      {/* Linha de corte / Assinaturas */}
      {layoutConfig.mostrar_assinaturas && (
        <div style={s.assinaturaBloco}>
          <div style={s.assinaturaItem}>
            <div style={s.assinaturaLinha} />
            <div style={s.assinaturaLabel}>Assinatura do Cliente</div>
          </div>
          <div style={s.assinaturaItem}>
            <div style={s.assinaturaLinha} />
            <div style={s.assinaturaLabel}>Assinatura do Técnico</div>
          </div>
        </div>
      )}

      {/* Termo de garantia */}
      {termoGarantia && (
        <div style={s.termo}>{termoGarantia}</div>
      )}
    </div>
  );
}

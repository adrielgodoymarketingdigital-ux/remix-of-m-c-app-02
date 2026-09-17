import { useEffect, useState } from "react";
import { resolvePaperSize, getThermalPrintCSS } from "@/lib/paper-size-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { checklistLabels } from "@/lib/checklist-templates";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarTermoDispositivo, resolverTextoTermoDispositivo } from "@/lib/termo-garantia-utils";
import {
  FormatoPapel,
  salvarUltimoFormatoPapel,
} from "@/components/recibo/SeletorFormatoPapelDialog";
import { detectarContextoImpressaoMobile, printViaIframe, printViaPrintRoot, urlParaBase64 } from "@/lib/printMobile";
import { gerarReciboVendaPDF } from "@/lib/gerarReciboVendaPDF";
import { toast } from "sonner";

function formatarGarantia(meses: number): string {
  const m = meses >= 360 ? Math.round(meses / 30) : meses;
  if (m % 12 === 0 && m >= 12) {
    const anos = m / 12;
    return anos === 1 ? "1 ano" : `${anos} anos`;
  }
  return `${m} ${m === 1 ? "mês" : "meses"}`;
}

interface VendaDispositivo {
  id: string;
  quantidade: number;
  total: number;
  forma_pagamento: string;
  data: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  cliente_cpf?: string;
  cliente_endereco?: string;
  dispositivo_marca?: string;
  dispositivo_modelo?: string;
  dispositivo_tipo?: string;
  dispositivo_imei?: string;
  dispositivo_numero_serie?: string;
  dispositivo_cor?: string;
  dispositivo_capacidade_gb?: number;
  dispositivo_condicao?: string;
  dispositivo_garantia?: boolean;
  dispositivo_tempo_garantia?: number;
  dispositivo_checklist?: any;
  empresa_id?: string | null;
}

interface DispositivoDoGrupo {
  id: string;
  total: number;
  dispositivo_imei?: string;
  dispositivo_marca?: string;
  dispositivo_modelo?: string;
  dispositivo_cor?: string;
  dispositivo_capacidade_gb?: number;
  dispositivo_condicao?: string;
  dispositivo_tempo_garantia?: number;
}

const FORMAS_PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
  credito_parcelado: "Crédito Parcelado",
  a_prazo: "A Prazo",
};

const CONDICAO_LABEL: Record<string, string> = {
  novo: "Novo",
  semi_novo: "Semi Novo",
  usado: "Usado",
};

const TERMOS_GARANTIA_PADRAO = {
  termo_com_garantia: `TERMO DE GARANTIA

Loja: {{loja}}
CNPJ: {{loja_cnpj}}
Endereço: {{loja_endereco}}
Telefone: {{loja_telefone}}

COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}
Telefone: {{telefone}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Nº Série: {{numero_serie}}
Cor: {{cor}}  |  Capacidade: {{capacidade}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor pago: {{valor}}

1. GARANTIA LEGAL (CDC - Lei 8.078/90)
   • Garantia legal de 90 (noventa) dias, conforme Art. 26, II do CDC.
   • Cobre defeitos de fabricação ou vícios que comprometam o funcionamento.

2. GARANTIA CONTRATUAL ({{garantia_meses}} meses)
   • Garantia de {{garantia_meses}} meses a partir da data desta venda, já incluindo o prazo mínimo de garantia legal previsto no CDC (Art. 26, II).
   • Cobre defeitos de fabricação, excluindo mau uso, quedas ou oxidação.

3. DIREITOS DO CONSUMIDOR
   • Vício do produto: substituição, devolução ou abatimento (Art. 18 CDC).
   • Prazo suspenso durante reparo (Art. 26, §2º CDC).
   • Conserve este documento como comprovante.

4. EXCLUSÕES
   • Quedas, impactos, contato com líquidos, uso inadequado.
   • Violação de lacres ou reparo por terceiros não autorizados.
   • Desgaste natural de uso.

Para acionamento da garantia, apresente este termo na loja.`,

  termo_sem_garantia: `DECLARAÇÃO DE VENDA SEM GARANTIA CONTRATUAL

Loja: {{loja}}
CNPJ: {{loja_cnpj}}

COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor pago: {{valor}}

AVISO: Este produto é vendido sem garantia contratual adicional.
A garantia legal de 90 dias prevista no CDC (Art. 26, II) se aplica conforme a legislação.
O cliente declara estar ciente das condições do equipamento.`,
};

interface DialogReimprimirReciboVendaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda: VendaDispositivo | null;
  modo?: "recibo" | "garantia";
  grupoVendaId?: string | null;
}

export function DialogReimprimirReciboVenda({
  open,
  onOpenChange,
  venda,
  modo = "recibo",
  grupoVendaId,
}: DialogReimprimirReciboVendaProps) {
  const { config: configLoja, refetch } = useConfiguracaoLoja(venda?.empresa_id);

  useEffect(() => {
    if (open) refetch();
  }, [open]);

  // Pré-busca os dados do grupo ao abrir o diálogo (em vez de no clique do
  // botão de impressão) — elimina o gap de rede entre o toque do usuário e a
  // chamada de window.print() no caminho iOS, onde esse atraso pode ser a
  // causa do print() ser silenciosamente ignorado em standalone.
  const [dispositivosGrupo, setDispositivosGrupo] = useState<DispositivoDoGrupo[]>([]);
  const [carregandoGrupo, setCarregandoGrupo] = useState(false);

  useEffect(() => {
    if (!open || !venda) return;
    setDispositivosGrupo([
      { id: venda.id, total: venda.total, dispositivo_imei: venda.dispositivo_imei, dispositivo_marca: venda.dispositivo_marca, dispositivo_modelo: venda.dispositivo_modelo },
    ]);
    if (!grupoVendaId) return;

    let cancelado = false;
    setCarregandoGrupo(true);
    (async () => {
      const { data: grupoData } = await supabase
        .from("vendas")
        .select("id, dispositivo_id, total, imei_dispositivo, tempo_garantia")
        .eq("grupo_venda", grupoVendaId)
        .is("deleted_at", null);

      if (cancelado) return;
      if (!grupoData || grupoData.length <= 1) {
        setCarregandoGrupo(false);
        return;
      }

      const dispIds = grupoData.map((g) => g.dispositivo_id).filter(Boolean);
      const { data: disps } = await supabase
        .from("dispositivos")
        .select("id, marca, modelo, imei, cor, capacidade_gb, condicao")
        .in("id", dispIds);
      if (cancelado) return;

      const dispMap = new Map((disps || []).map((d: any) => [d.id, d]));
      setDispositivosGrupo(grupoData.map((g: any) => {
        const disp = dispMap.get(g.dispositivo_id);
        return {
          id: g.id,
          total: Number(g.total || 0),
          dispositivo_imei: g.imei_dispositivo || disp?.imei,
          dispositivo_marca: disp?.marca || venda.dispositivo_marca,
          dispositivo_modelo: disp?.modelo || venda.dispositivo_modelo,
          dispositivo_cor: disp?.cor,
          dispositivo_capacidade_gb: disp?.capacidade_gb,
          dispositivo_condicao: disp?.condicao,
          dispositivo_tempo_garantia: g.tempo_garantia,
        };
      }));
      setCarregandoGrupo(false);
    })();

    return () => { cancelado = true; };
  }, [open, grupoVendaId, venda?.id]);

  // Pré-codifica o logo em base64 também, pelo mesmo motivo — era o último
  // await que sobrava no caminho iOS antes da chamada de print().
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !configLoja?.logo_url) {
      setLogoBase64(null);
      return;
    }
    let cancelado = false;
    urlParaBase64(configLoja.logo_url).then((b64) => {
      if (!cancelado) setLogoBase64(b64);
    });
    return () => { cancelado = true; };
  }, [open, configLoja?.logo_url]);

  if (!venda) return null;

  const dispConfig = configLoja?.layout_dispositivos_config as any;
  const formatoPapel = dispConfig?.formato_papel || 'a4';
  const is80mm = formatoPapel !== 'a4';
  const showLogo = dispConfig?.mostrar_logo !== false;
  const showDadosLoja = dispConfig?.mostrar_dados_loja !== false;
  const showDadosCliente = dispConfig?.mostrar_dados_cliente !== false;
  const showDadosDispositivo = dispConfig?.mostrar_dados_dispositivo !== false;
  const showChecklist = dispConfig?.mostrar_checklist !== false;
  const showGarantia = dispConfig?.mostrar_garantia !== false;
  const showAssinaturas = dispConfig?.mostrar_assinaturas !== false;
  const showValor = dispConfig?.mostrar_valor !== false;
  const showFormaPagamento = dispConfig?.mostrar_forma_pagamento !== false;

  const dataVenda = format(new Date(venda.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const dataVendaCurta = format(new Date(venda.data), "dd/MM/yyyy", { locale: ptBR });
  const valorUnitario = venda.quantidade > 0 ? venda.total / venda.quantidade : venda.total;

  // Variáveis dinâmicas para substituição no termo
  const varsTermos = {
    cliente: venda.cliente_nome,
    cpf: venda.cliente_cpf,
    telefone: venda.cliente_telefone,
    dispositivo: [venda.dispositivo_marca, venda.dispositivo_modelo].filter(Boolean).join(' '),
    imei: venda.dispositivo_imei,
    numero_serie: venda.dispositivo_numero_serie,
    cor: venda.dispositivo_cor,
    capacidade: venda.dispositivo_capacidade_gb ? `${venda.dispositivo_capacidade_gb} GB` : undefined,
    condicao: CONDICAO_LABEL[venda.dispositivo_condicao || ''] || venda.dispositivo_condicao,
    garantia_meses: venda.dispositivo_tempo_garantia != null ? formatarGarantia(venda.dispositivo_tempo_garantia) : undefined,
    valor: formatCurrency(venda.total),
    data_venda: dataVendaCurta,
    loja: configLoja?.nome_loja,
    loja_telefone: configLoja?.telefone,
    loja_cnpj: configLoja?.cnpj,
    loja_endereco: configLoja?.endereco,
  };

  const obterTextoTermo = (dispositivoGrupo?: DispositivoDoGrupo): string => {
    const termoConfig = configLoja?.termo_garantia_dispositivo_config as any;
    const tempoGarantia = dispositivoGrupo ? dispositivoGrupo.dispositivo_tempo_garantia : venda.dispositivo_tempo_garantia;
    const temGarantia = (tempoGarantia != null && tempoGarantia > 0) || (!dispositivoGrupo && !!venda.dispositivo_garantia);
    const textoBase = resolverTextoTermoDispositivo(
      termoConfig,
      temGarantia,
      TERMOS_GARANTIA_PADRAO.termo_com_garantia,
      TERMOS_GARANTIA_PADRAO.termo_sem_garantia
    );
    const vars = dispositivoGrupo
      ? {
          ...varsTermos,
          dispositivo: [dispositivoGrupo.dispositivo_marca, dispositivoGrupo.dispositivo_modelo].filter(Boolean).join(' '),
          imei: dispositivoGrupo.dispositivo_imei,
          cor: dispositivoGrupo.dispositivo_cor,
          capacidade: dispositivoGrupo.dispositivo_capacidade_gb ? `${dispositivoGrupo.dispositivo_capacidade_gb} GB` : undefined,
          condicao: CONDICAO_LABEL[dispositivoGrupo.dispositivo_condicao || ''] || dispositivoGrupo.dispositivo_condicao,
          garantia_meses: tempoGarantia != null ? formatarGarantia(tempoGarantia) : undefined,
          valor: formatCurrency(dispositivoGrupo.total),
        }
      : varsTermos;
    return formatarTermoDispositivo(textoBase, vars);
  };

  // Gera o Recibo/Termo de Garantia como PDF e compartilha via Web Share API
  // — usado só no caminho iOS standalone (ver imprimirRecibo). Cai pra
  // download direto se o device não suportar compartilhar arquivo.
  const imprimirViaPDFShare = async () => {
    try {
      const textoTermoAtual = obterTextoTermo();
      const multiplos = dispositivosGrupo.length > 1;
      const dispositivosPDF = dispositivosGrupo.map((disp) => ({
        marca: disp.dispositivo_marca,
        modelo: disp.dispositivo_modelo,
        imei: disp.dispositivo_imei,
        cor: disp.dispositivo_cor,
        capacidadeGb: disp.dispositivo_capacidade_gb,
        condicaoLabel: CONDICAO_LABEL[disp.dispositivo_condicao || ''] || disp.dispositivo_condicao,
        garantiaLabel: disp.dispositivo_tempo_garantia != null ? formatarGarantia(disp.dispositivo_tempo_garantia) : undefined,
        total: disp.total,
        textoTermo: multiplos ? obterTextoTermo(disp) : textoTermoAtual,
      }));

      const pdfBlob = await gerarReciboVendaPDF({
        modo,
        configLoja,
        dataVenda,
        formaPagamentoLabel: FORMAS_PAGAMENTO_LABEL[venda.forma_pagamento] || venda.forma_pagamento,
        valorTotal: venda.total,
        clienteNome: venda.cliente_nome,
        clienteCpf: venda.cliente_cpf,
        clienteTelefone: venda.cliente_telefone,
        dispositivos: dispositivosPDF,
      });

      const nomeArquivo = `${modo === 'garantia' ? 'Termo-Garantia' : 'Recibo-Venda'}-${
        [venda.dispositivo_marca, venda.dispositivo_modelo].filter(Boolean).join('-') || venda.id
      }.pdf`;
      const pdfFile = new File([pdfBlob], nomeArquivo, { type: 'application/pdf' });

      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({ files: [pdfFile], title: nomeArquivo });
        return;
      }

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 200);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return; // usuário cancelou o compartilhamento
      console.error('Erro ao gerar/compartilhar PDF do recibo:', error);
      toast.error('Não foi possível gerar o PDF. Tente novamente.');
    }
  };

  const imprimirRecibo = async (formato: FormatoPapel) => {
    salvarUltimoFormatoPapel(formato);

    const { isMobile, isStandalone, isIOS } = detectarContextoImpressaoMobile();

    // iOS standalone (PWA instalada na tela inicial): window.print() é
    // bloqueado pela própria plataforma — confirmado em device real (Safari
    // 27, iOS 27, set/2026): funciona normalmente numa aba comum do Safari,
    // falha SÓ dentro do app instalado, mesmo com a chamada 100% síncrona.
    // Não existe workaround de JS pra isso (há precedente da mesma limitação
    // desde o iOS 9 em web apps fullscreen). Caminho: gera PDF e usa a Web
    // Share API (navigator.share), mesmo padrão já comprovado em produção no
    // envio de OS por WhatsApp (DialogEnviarWhatsApp.tsx).
    if (isIOS && isStandalone) {
      await imprimirViaPDFShare();
      return;
    }

    // "Mecanismo mobile" = não usa window.open(). Dentro dele, iOS mobile
    // Safari (não-standalone, já descartado acima) vai por #print-root —
    // confirmado funcionando numa aba comum; Android continua no iframe
    // (window.print() no documento principal trava no Chrome Android).
    const usarMecanismoMobile = isMobile || isStandalone;
    const usarPrintRoot = usarMecanismoMobile && isIOS;
    const usarIframe = usarMecanismoMobile && !isIOS;

    // window.open precisa ser chamado de forma síncrona, no mesmo tick do
    // clique — qualquer await antes dele arrisca o navegador não reconhecer
    // como originado de gesto do usuário (bloqueio de popup). Só abrimos a
    // janela em branco agora; o conteúdo (htmlDoc) é escrito nela mais abaixo.
    // No caminho mobile pulamos isso inteiro.
    const janelaImpressao = usarMecanismoMobile ? null : window.open("", "_blank");
    if (!usarMecanismoMobile && !janelaImpressao) return;

    // dispositivosGrupo (useEffect acima) e o logo em base64 (logoBase64,
    // useEffect abaixo) já foram pré-buscados ao abrir o diálogo — o caminho
    // iOS (mais abaixo) não faz NENHUM await antes de chamar print(). Isso não
    // é só otimização: pesquisa confirma que o Safari iOS consome a "ativação
    // transitória" do usuário (a permissão implícita que libera print()/
    // window.open()/etc.) muito mais rápido que outros engines — a ordem de
    // grandeza é ~meio segundo. Qualquer await antes do print(), mesmo um
    // fetch rápido, já é suficiente pra essa janela expirar e o navegador
    // ignorar print() silenciosamente (sem erro, sem UI nenhuma) — foi
    // exatamente isso que os alerts de diagnóstico anteriores capturaram.

    const paper = resolvePaperSize(formato);
    const cssTermico = paper.isThermal ? `
    @page { size: ${paper.pageSize}; margin: 2mm; }
    body { width: ${paper.bodyWidth} !important; max-width: ${paper.bodyMaxWidth} !important; font-size: 9px !important; }
    .recibo-print-header { flex-direction: column; align-items: flex-start; gap: 6px; border-radius: 0; }
    .recibo-print-header-titulo { text-align: left; }
    .recibo-print-grid-2col { grid-template-columns: 1fr !important; }
    .recibo-print-assinaturas { grid-template-columns: 1fr !important; gap: 10px; }
    .recibo-print-faixa-data { flex-direction: column; align-items: flex-start; gap: 2px; border-radius: 0; }
    ` : '';

    const textoTermoAtual = obterTextoTermo();

    const cabecalho = `
      <div class="recibo-header">
        <div class="recibo-header-left">
          ${configLoja?.logo_url ? `<img src="${configLoja.logo_url}" class="logo-loja" />` : ''}
          <div>
            <h1>${configLoja?.nome_loja || ''}</h1>
            <div class="dados-loja">
              ${configLoja?.cnpj ? `CNPJ: ${configLoja.cnpj}<br>` : ''}
              ${configLoja?.telefone ? `Tel: ${configLoja.telefone}` : ''}
            </div>
          </div>
        </div>
        <div class="recibo-header-right">
          <h2>${modo === 'garantia' ? 'TERMO DE GARANTIA' : 'RECIBO DE VENDA'}</h2>
          <p>Data da venda: ${dataVenda}</p>
        </div>
      </div>`;

    const secaoComprador = `
      <div class="recibo-section">
        <h3>Comprador</h3>
        <div class="grid-2">
          <div class="recibo-info"><span>Nome:</span><span>${venda.cliente_nome || '—'}</span></div>
          ${venda.cliente_cpf ? `<div class="recibo-info"><span>CPF:</span><span>${venda.cliente_cpf}</span></div>` : ''}
          ${venda.cliente_telefone ? `<div class="recibo-info"><span>Telefone:</span><span>${venda.cliente_telefone}</span></div>` : ''}
        </div>
      </div>`;

    const secaoProduto = `
      <div class="recibo-section">
        <h3>Produto</h3>
        <div class="grid-2">
          <div class="recibo-info"><span>Aparelho:</span><span>${venda.dispositivo_marca} ${venda.dispositivo_modelo}</span></div>
          ${venda.dispositivo_imei ? `<div class="recibo-info"><span>IMEI:</span><span>${venda.dispositivo_imei}</span></div>` : ''}
          ${venda.dispositivo_numero_serie ? `<div class="recibo-info"><span>Nº Série:</span><span>${venda.dispositivo_numero_serie}</span></div>` : ''}
          ${venda.dispositivo_cor ? `<div class="recibo-info"><span>Cor:</span><span>${venda.dispositivo_cor}</span></div>` : ''}
          ${venda.dispositivo_capacidade_gb ? `<div class="recibo-info"><span>Capacidade:</span><span>${venda.dispositivo_capacidade_gb} GB</span></div>` : ''}
          ${venda.dispositivo_condicao ? `<div class="recibo-info"><span>Condição:</span><span>${CONDICAO_LABEL[venda.dispositivo_condicao] || venda.dispositivo_condicao}</span></div>` : ''}
          <div class="recibo-info"><span>Valor:</span><span>${formatCurrency(venda.total)}</span></div>
          ${venda.dispositivo_tempo_garantia ? `<div class="recibo-info"><span>Garantia:</span><span>${formatarGarantia(venda.dispositivo_tempo_garantia)}</span></div>` : ''}
        </div>
      </div>`;

    const secaoDispositivosGrupo = dispositivosGrupo.length > 1 ? `
  <!-- DISPOSITIVOS DO GRUPO -->
  <div class="recibo-print-card" style="margin-bottom: 8px;">
    <div class="recibo-print-card-header">Dispositivos (${dispositivosGrupo.length})</div>
    <div class="recibo-print-card-body">
      <table class="recibo-print-tabela-dispositivos">
        <thead>
          <tr><th>Aparelho</th><th>IMEI</th><th>Valor</th></tr>
        </thead>
        <tbody>
          ${dispositivosGrupo.map((d) => `
          <tr>
            <td>${[d.dispositivo_marca, d.dispositivo_modelo].filter(Boolean).join(' ') || '—'}</td>
            <td>${d.dispositivo_imei || '—'}</td>
            <td>${formatCurrency(d.total)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>` : '';

    const secaoTermo = dispositivosGrupo.length > 1
      ? dispositivosGrupo.map((disp) => {
          const textoTermoDisp = obterTextoTermo(disp);
          return `
      <div class="recibo-section">
        <h3>Termo de Garantia — ${[disp.dispositivo_marca, disp.dispositivo_modelo].filter(Boolean).join(' ')}${disp.dispositivo_imei ? ` (IMEI: ${disp.dispositivo_imei})` : ''}</h3>
        <div class="termos-garantia">${textoTermoDisp.replace(/\n/g, '<br>')}</div>
      </div>`;
        }).join('')
      : `
      <div class="recibo-section">
        <h3>Termo de Garantia</h3>
        <div class="termos-garantia">${textoTermoAtual.replace(/\n/g, '<br>')}</div>
      </div>`;

    const secaoTermoBox = dispositivosGrupo.length > 1
      ? dispositivosGrupo.map((disp) => {
          const textoTermoDisp = obterTextoTermo(disp);
          return `
        <div class="recibo-print-termo-box" style="margin-bottom: 12px;">
          <div class="recibo-print-termo-header">
            Termo de Garantia — ${disp.dispositivo_marca || ''} ${disp.dispositivo_modelo || ''}
            ${disp.dispositivo_imei ? `(IMEI: ${disp.dispositivo_imei})` : ''}
          </div>
          <div class="recibo-print-termo-body">${textoTermoDisp.replace(/\n/g, '<br>')}</div>
        </div>`;
        }).join('')
      : `
    <div class="recibo-print-termo-box">
      <div class="recibo-print-termo-header">Termo de Garantia e Direitos do Consumidor</div>
      <div class="recibo-print-termo-body">${textoTermoAtual.replace(/\n/g, '<br>')}</div>
    </div>`;

    const secaoAssinaturas = `
      <div class="assinaturas-container">
        <div class="assinatura-bloco">
          <div class="assinatura-linha"></div>
          <p class="assinatura-label">Assinatura do Vendedor</p>
        </div>
        <div class="assinatura-bloco">
          <div class="assinatura-linha"></div>
          <p class="assinatura-label">Assinatura do Comprador — ${venda.cliente_nome || ''}</p>
        </div>
      </div>`;

    const conteudo = modo === 'garantia'
      ? `${cabecalho}${secaoComprador}${secaoProduto}${secaoTermo}${secaoAssinaturas}`
      : `${cabecalho}${secaoComprador}${secaoProduto}${secaoTermo}<div class="recibo-total">VALOR TOTAL: ${formatCurrency(venda.total)}</div>${secaoAssinaturas}`;

    // cssRecibo/bodyRecibo são reaproveitados nos três caminhos (desktop via
    // window.open, Android via iframe, iOS via #print-root) — só a "casca"
    // ao redor muda. Todo seletor vem prefixado com recibo-print- porque o
    // caminho iOS injeta esse <style> direto na página viva (sem isolamento
    // de documento), então um nome genérico tipo .card ou .field colidiria
    // com qualquer outro elemento do app que use essas classes.
    const cssRecibo = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 10mm 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; background: white; line-height: 1.5; }

    /* HEADER */
    .recibo-print-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #1a1a2e;
      color: white;
      padding: 10px 14px;
      border-radius: 6px 6px 0 0;
      margin-bottom: 0;
    }
    .recibo-print-header-logo { display: flex; align-items: center; gap: 10px; }
    /* Chip branco atrás do logo — sem isso, um logo sem transparência (jpg,
       ou png achatado com fundo branco) some por inteiro com o filtro de
       inversão antigo. O chip garante contraste com o fundo escuro
       independente do arquivo. */
    .recibo-print-logo-chip { background: #ffffff; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .recibo-print-logo-chip img { max-height: 44px; max-width: 96px; object-fit: contain; display: block; }
    .recibo-print-header-loja h1 { font-size: 14px; font-weight: 900; letter-spacing: 0.03em; }
    .recibo-print-header-loja p { font-size: 8px; color: #adb5bd; margin-top: 1px; }
    .recibo-print-dados-loja { font-size: 9px; color: #111; margin-top: 2px; line-height: 1.6; font-weight: 600; font-style: normal; }
    .recibo-print-header-titulo { text-align: right; }
    .recibo-print-header-titulo h2 { font-size: 13px; font-weight: 800; letter-spacing: 0.06em; color: #4cc9f0; }
    .recibo-print-header-titulo p { font-size: 8px; color: #adb5bd; margin-top: 2px; }

    /* FAIXA NÚMERO */
    .recibo-print-faixa-data {
      background: #f0f4ff;
      border: 1px solid #d0d9f0;
      border-top: none;
      padding: 4px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #444;
      margin-bottom: 8px;
      border-radius: 0 0 4px 4px;
    }
    .recibo-print-faixa-data strong { color: #1a1a2e; }

    /* GRID PRINCIPAL */
    .recibo-print-grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }

    /* CARDS */
    .recibo-print-card {
      border: 1px solid #dee2e6;
      border-radius: 6px;
      overflow: hidden;
    }
    .recibo-print-card-header {
      background: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
      padding: 4px 10px;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #6c757d;
    }
    .recibo-print-card-body { padding: 8px 10px; }
    .recibo-print-tabela-dispositivos { width: 100%; border-collapse: collapse; font-size: 9px; }
    .recibo-print-tabela-dispositivos th { text-align: left; padding: 3px 6px; border-bottom: 1px solid #dee2e6; color: #6c757d; text-transform: uppercase; font-size: 8px; letter-spacing: 0.06em; }
    .recibo-print-tabela-dispositivos td { padding: 3px 6px; border-bottom: 1px solid #f0f0f0; }
    .recibo-print-field { margin-bottom: 5px; }
    .recibo-print-field-label { font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 1px; }
    .recibo-print-field-value { font-size: 11px; font-weight: 600; color: #1a1a1a; border-bottom: 1px solid #e9ecef; padding-bottom: 2px; }
    .recibo-print-field-value.recibo-print-destaque { font-size: 13px; color: #1a1a2e; font-weight: 900; }

    /* TERMO */
    .recibo-print-termo-box {
      border: 1px solid #dee2e6;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .recibo-print-termo-header {
      background: #1a1a2e;
      color: white;
      padding: 5px 10px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .recibo-print-termo-body {
      padding: 8px 10px;
      font-size: 9px;
      line-height: 1.6;
      color: #333;
      background: #fafafa;
    }

    /* ASSINATURAS */
    .recibo-print-assinaturas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 2px solid #1a1a2e;
    }
    .recibo-print-assinatura-bloco { text-align: center; }
    .recibo-print-assinatura-linha {
      border-bottom: 1.5px solid #333;
      height: 28px;
      margin-bottom: 4px;
    }
    .recibo-print-assinatura-nome { font-size: 9px; font-weight: 700; color: #1a1a1a; }
    .recibo-print-assinatura-label { font-size: 8px; color: #888; }

    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { margin: 0 !important; }
      .recibo-print-assinaturas { page-break-inside: avoid; break-inside: avoid; }
    }
    /* Sobrescreve @page e body para térmica (deve vir por último) */
    ${cssTermico}
    `;

    // Função em vez de string direta — precisa ser chamada duas vezes com
    // logoSrc diferente: uma vez de forma síncrona pro caminho iOS (logo já
    // pré-buscado em base64, ver logoBase64 acima) e outra depois do await
    // de logo pro caminho desktop/Android.
    const montarBodyRecibo = (logoSrc: string | null) => `
  <!-- HEADER -->
  <div class="recibo-print-header">
    <div class="recibo-print-header-logo">
      ${logoSrc ? `<div class="recibo-print-logo-chip"><img src="${logoSrc}" alt="Logo" /></div>` : ''}
      <div class="recibo-print-header-loja">
        <h1>${configLoja?.nome_loja || ''}</h1>
        <p>${configLoja?.cnpj ? `CNPJ: ${configLoja.cnpj}` : ''} ${configLoja?.telefone ? `• Tel: ${configLoja.telefone}` : ''}</p>
      </div>
    </div>
    <div class="recibo-print-header-titulo">
      <h2>${modo === 'garantia' ? 'TERMO DE GARANTIA' : 'RECIBO DE VENDA'}</h2>
      <p>${configLoja?.endereco || ''}</p>
    </div>
  </div>

  <!-- FAIXA DATA -->
  <div class="recibo-print-faixa-data">
    <span>Data da venda: <strong>${dataVenda}</strong></span>
    <span>Forma de pagamento: <strong>${FORMAS_PAGAMENTO_LABEL[venda.forma_pagamento] || venda.forma_pagamento}</strong></span>
    <span>Valor total: <strong>${formatCurrency(venda.total)}</strong></span>
  </div>

  <!-- GRID COMPRADOR + PRODUTO -->
  <div class="recibo-print-grid-2col">
    <div class="recibo-print-card">
      <div class="recibo-print-card-header">Comprador</div>
      <div class="recibo-print-card-body">
        <div class="recibo-print-field">
          <div class="recibo-print-field-label">Nome</div>
          <div class="recibo-print-field-value">${venda.cliente_nome || '—'}</div>
        </div>
        <div class="recibo-print-field">
          <div class="recibo-print-field-label">CPF</div>
          <div class="recibo-print-field-value">${venda.cliente_cpf || '—'}</div>
        </div>
        <div class="recibo-print-field">
          <div class="recibo-print-field-label">Telefone</div>
          <div class="recibo-print-field-value">${venda.cliente_telefone || '—'}</div>
        </div>
      </div>
    </div>

    <div class="recibo-print-card">
      <div class="recibo-print-card-header">Produto</div>
      <div class="recibo-print-card-body">
        <div class="recibo-print-field">
          <div class="recibo-print-field-label">Aparelho</div>
          <div class="recibo-print-field-value recibo-print-destaque">${venda.dispositivo_marca} ${venda.dispositivo_modelo}</div>
        </div>
        <div class="recibo-print-field">
          <div class="recibo-print-field-label">IMEI</div>
          <div class="recibo-print-field-value">${venda.dispositivo_imei || '—'}</div>
        </div>
        <div class="recibo-print-field">
          <div class="recibo-print-field-label">Cor / Capacidade / Condição</div>
          <div class="recibo-print-field-value">${[venda.dispositivo_cor, venda.dispositivo_capacidade_gb ? venda.dispositivo_capacidade_gb + ' GB' : '', CONDICAO_LABEL[venda.dispositivo_condicao || ''] || venda.dispositivo_condicao].filter(Boolean).join(' • ') || '—'}</div>
        </div>
        ${venda.dispositivo_tempo_garantia ? `
        <div class="recibo-print-field">
          <div class="recibo-print-field-label">Garantia</div>
          <div class="recibo-print-field-value recibo-print-destaque" style="color:#1a1a2e">${formatarGarantia(venda.dispositivo_tempo_garantia)}</div>
        </div>` : ''}
      </div>
    </div>
  </div>
  ${secaoDispositivosGrupo}

  <!-- TERMO -->
  ${secaoTermoBox}

  <!-- ASSINATURAS -->
  <div class="recibo-print-assinaturas">
    <div class="recibo-print-assinatura-bloco">
      <div class="recibo-print-assinatura-linha"></div>
      <div class="recibo-print-assinatura-nome">${configLoja?.nome_loja || 'Vendedor'}</div>
      <div class="recibo-print-assinatura-label">Assinatura do Vendedor</div>
    </div>
    <div class="recibo-print-assinatura-bloco">
      <div class="recibo-print-assinatura-linha"></div>
      <div class="recibo-print-assinatura-nome">${venda.cliente_nome || 'Comprador'}</div>
      <div class="recibo-print-assinatura-label">Assinatura do Comprador</div>
    </div>
  </div>`;

    // iOS: zero await até aqui — nada de fetch de logo nem de documento
    // isolado, chamamos window.print() nós mesmos, direto no documento
    // principal, o mais perto possível do tick síncrono do clique. Usa o
    // logo já pré-buscado (logoBase64, useEffect acima); se ainda não tiver
    // resolvido (diálogo aberto há poucos ms), cai pra URL direta — melhor
    // arriscar um logo sem cache de rede do que perder a janela de ativação
    // esperando o base64.
    if (usarPrintRoot) {
      const bodyRecibo = montarBodyRecibo(logoBase64 ?? configLoja?.logo_url ?? null);
      printViaPrintRoot(bodyRecibo, cssRecibo);
      return;
    }

    // Logo em base64 só no caminho Android/iframe — evita depender de rede
    // pra carregar o logo no documento isolado (mesma técnica de
    // ImpressaoOrdemServico.tsx). Desktop mantém a URL direta, sem mudança
    // de comportamento.
    let logoSrc = configLoja?.logo_url || null;
    if (usarIframe && logoSrc) {
      const logoBase64Fetched = await urlParaBase64(logoSrc);
      if (logoBase64Fetched) logoSrc = logoBase64Fetched;
    }
    const bodyRecibo = montarBodyRecibo(logoSrc);

    // Desktop e Android continuam com o documento isolado completo
    // (DOCTYPE + head + script de auto-print), sem mudança de comportamento.
    const htmlDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="icon" type="image/png" href="/pwa-192x192.png">
  <title>Termo de Garantia - ${venda.dispositivo_marca} ${venda.dispositivo_modelo}</title>
  <style>${cssRecibo}</style>
</head>
<body>
${bodyRecibo}

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.__printed = true;
        try {
          window.print();
        } catch (e) { /* ignore — reforço do printViaIframe cobre o fallback no Android */ }
        window.onafterprint = function() {
          window.close();
        };
      }, 500);
    };
  </script>
</body>
</html>`;

    if (usarIframe) {
      printViaIframe(htmlDoc, isIOS);
      return;
    }

    janelaImpressao!.document.write(htmlDoc);
    janelaImpressao!.document.close();
  };

  const textoTermo = obterTextoTermo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-h-[90vh] overflow-y-auto" data-print-hide="true">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {modo === "garantia" ? "Imprimir Termo de Garantia" : "Reimprimir Recibo de Venda"}
          </DialogTitle>
        </DialogHeader>

        {/* Preview resumido */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg">
                {venda.dispositivo_marca} {venda.dispositivo_modelo}
              </h3>
              <p className="text-sm text-muted-foreground">{venda.dispositivo_tipo}</p>
            </div>
            <p className="text-lg font-bold">{formatCurrency(venda.total)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Cliente:</span>
              <p className="font-medium">{venda.cliente_nome || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Data da venda:</span>
              <p className="font-medium">{dataVenda}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Pagamento:</span>
              <p className="font-medium">{FORMAS_PAGAMENTO_LABEL[venda.forma_pagamento] || venda.forma_pagamento}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Garantia:</span>
              <p className="font-medium">
                {venda.dispositivo_garantia
                  ? (venda.dispositivo_tempo_garantia != null ? formatarGarantia(venda.dispositivo_tempo_garantia) : '—')
                  : 'Sem garantia contratual'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button variant="outline" disabled={carregandoGrupo} onClick={() => imprimirRecibo('a4')} className="gap-1.5">
            <Printer className="h-4 w-4" />
            A4
          </Button>
          <Button variant="outline" disabled={carregandoGrupo} onClick={() => imprimirRecibo('80mm')} className="gap-1.5">
            <Printer className="h-4 w-4" />
            80mm
          </Button>
          <Button disabled={carregandoGrupo} onClick={() => imprimirRecibo('58mm')} className="gap-1.5">
            <Printer className="h-4 w-4" />
            58mm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

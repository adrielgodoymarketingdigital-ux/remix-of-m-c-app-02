import { formatCurrency, formatDate, formatPhone, formatCPF } from "./formatters";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { toast } from "@/hooks/use-toast";
import { decryptSenhaDesbloqueio } from "./password-encryption";

interface ChecklistItem {
  [key: string]: boolean;
}

interface Checklist {
  entrada?: ChecklistItem;
  saida?: ChecklistItem;
}

interface AvariaVisual {
  tipo: string;
  lado: string;
  descricao?: string;
}

// Formata checklist para texto
export const formatarChecklist = (checklist?: ChecklistItem): string => {
  if (!checklist || Object.keys(checklist).length === 0) {
    return "Nenhum item verificado";
  }

  return Object.entries(checklist)
    .map(([item, valor]) => {
      const emoji = valor ? "✅" : "❌";
      const itemFormatado = item
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      return `${emoji} ${itemFormatado}`;
    })
    .join("\n");
};

// Formata avarias para texto
export const formatarAvarias = (avarias?: AvariaVisual[]): string => {
  if (!avarias || avarias.length === 0) {
    return "Nenhuma avaria identificada";
  }

  return avarias
    .map((avaria, index) => {
      const tipo = avaria.tipo.replace(/_/g, " ").toUpperCase();
      const lado = avaria.lado === "frente" ? "Frente" : "Traseira";
      const desc = avaria.descricao ? ` - ${avaria.descricao}` : "";
      return `⚠️ ${index + 1}. ${tipo} (${lado})${desc}`;
    })
    .join("\n");
};

// Formata dados da loja
const formatarDadosLoja = (loja?: ConfiguracaoLoja): string => {
  if (!loja) return "";

  let texto = `🏪 *${loja.nome_loja.toUpperCase()}*\n`;
  
  if (loja.cnpj) texto += `CNPJ: ${loja.cnpj}\n`;
  if (loja.razao_social) texto += `Razão Social: ${loja.razao_social}\n`;
  
  if (loja.logradouro && loja.numero) {
    texto += `📍 ${loja.logradouro}, ${loja.numero}`;
    if (loja.complemento) texto += ` - ${loja.complemento}`;
    texto += "\n";
    if (loja.bairro) texto += `${loja.bairro}`;
    if (loja.cidade && loja.estado) texto += ` - ${loja.cidade}/${loja.estado}`;
    if (loja.cep) texto += ` - CEP: ${loja.cep}`;
    texto += "\n";
  } else if (loja.endereco) {
    texto += `📍 ${loja.endereco}\n`;
  }
  
  if (loja.telefone) texto += `📞 ${loja.telefone}\n`;
  if (loja.whatsapp) texto += `📱 WhatsApp: ${loja.whatsapp}\n`;
  if (loja.email) texto += `📧 ${loja.email}\n`;

  return texto;
};

// Gera mensagem de venda
export const formatarMensagemVenda = (
  venda: any,
  cliente: any,
  loja?: ConfiguracaoLoja,
  dispositivo?: any,
  produto?: any
): string => {
  let mensagem = "📱 *RECIBO DE VENDA*\n";
  mensagem += "━━━━━━━━━━━━━━━━━━━━\n\n";

  // Dados da loja
  if (loja) {
    mensagem += formatarDadosLoja(loja);
    mensagem += "\n";
  }

  // Dados do cliente
  mensagem += "👤 *CLIENTE*\n";
  mensagem += `Nome: ${cliente?.nome || "N/A"}\n`;
  if (cliente?.cpf) mensagem += `CPF: ${formatCPF(cliente.cpf)}\n`;
  if (cliente?.telefone) mensagem += `Tel: ${formatPhone(cliente.telefone)}\n`;
  if (cliente?.endereco) mensagem += `Endereço: ${cliente.endereco}\n`;
  mensagem += "\n";

  // Dados do produto/dispositivo
  if (venda.tipo === "dispositivo" && dispositivo) {
    mensagem += "📱 *DISPOSITIVO VENDIDO*\n";
    mensagem += `${dispositivo.marca} ${dispositivo.modelo}\n`;
    if (dispositivo.cor) mensagem += `Cor: ${dispositivo.cor}\n`;
    if (dispositivo.capacidade_gb) mensagem += `Capacidade: ${dispositivo.capacidade_gb}GB\n`;
    if (dispositivo.imei) mensagem += `IMEI: ${dispositivo.imei}\n`;
    if (dispositivo.numero_serie) mensagem += `N° Série: ${dispositivo.numero_serie}\n`;
    if (dispositivo.condicao) mensagem += `Condição: ${dispositivo.condicao}\n`;

    // Checklist do dispositivo
    if (dispositivo.checklist) {
      mensagem += "\n✅ *CHECKLIST*\n";
      mensagem += formatarChecklist(dispositivo.checklist);
      mensagem += "\n";
    }

    // Garantia
    if (dispositivo.garantia && dispositivo.tempo_garantia) {
      mensagem += `\n🛡️ *GARANTIA: ${dispositivo.tempo_garantia} dias*\n`;
    }
  } else if (venda.tipo === "produto" && produto) {
    mensagem += "📦 *PRODUTO VENDIDO*\n";
    mensagem += `${produto.nome}\n`;
    if (produto.sku) mensagem += `SKU: ${produto.sku}\n`;
    if (venda.quantidade && venda.quantidade > 1) {
      mensagem += `Quantidade: ${venda.quantidade}\n`;
    }
  }
  mensagem += "\n";

  // Valores
  mensagem += "💰 *VALORES*\n";
  mensagem += `Total: ${formatCurrency(venda.total)}\n`;
  if (venda.valor_desconto_cupom && venda.valor_desconto_cupom > 0) {
    mensagem += `Desconto (Cupom ${venda.cupom_codigo}): ${formatCurrency(venda.valor_desconto_cupom)}\n`;
  }
  
  const formasPagamento: { [key: string]: string } = {
    dinheiro: "Dinheiro",
    pix: "PIX",
    debito: "Cartão de Débito",
    credito: "Cartão de Crédito",
    credito_parcelado: "Cartão de Crédito Parcelado",
    a_receber: "A Receber",
  };
  mensagem += `Forma de Pagamento: ${formasPagamento[venda.forma_pagamento] || venda.forma_pagamento}\n`;
  mensagem += "\n";

  // Data
  mensagem += `📅 *Data da Venda:* ${formatDate(venda.data || new Date().toISOString())}\n\n`;

  // Termos legais CDC
  if (dispositivo?.garantia) {
    mensagem += "⚖️ *TERMOS DE GARANTIA (CDC)*\n\n";
    mensagem += "O consumidor poderá exigir, à sua escolha, uma das seguintes alternativas:\n";
    mensagem += "I - Substituição do produto por outro da mesma espécie;\n";
    mensagem += "II - Restituição da quantia paga;\n";
    mensagem += "III - Abatimento proporcional do preço.\n\n";
    mensagem += "A garantia legal de 90 dias é complementar à garantia contratual.\n";
  }

  mensagem += "\n━━━━━━━━━━━━━━━━━━━━\n";
  mensagem += "_Obrigado pela preferência!_";

  return mensagem;
};

// Gera mensagem de ordem de serviço
export const formatarMensagemOS = (
  ordem: any,
  cliente: any,
  loja?: ConfiguracaoLoja
): string => {
  let mensagem = "🔧 *ORDEM DE SERVIÇO*\n";
  mensagem += "━━━━━━━━━━━━━━━━━━━━\n\n";

  // Dados da OS
  mensagem += `📋 *OS #${ordem.numero_os}*\n`;
  mensagem += `Data: ${formatDate(ordem.created_at)}\n`;
  
  const statusMap: { [key: string]: string } = {
    pendente: "⏳ Pendente",
    em_andamento: "🔨 Em Andamento",
    concluida: "✅ Concluída",
    aguardando_aprovacao: "⏸️ Aguardando Aprovação",
    finalizado: "✅ Finalizado",
    entregue: "📦 Entregue",
    aguardando_retirada: "⏰ Aguardando Retirada",
    cancelada: "❌ Cancelada",
  };
  mensagem += `Status: ${statusMap[ordem.status] || ordem.status}\n\n`;

  // Dados da loja
  if (loja) {
    mensagem += formatarDadosLoja(loja);
    mensagem += "\n";
  }

  // Dados do cliente
  mensagem += "👤 *CLIENTE*\n";
  mensagem += `Nome: ${cliente?.nome || "N/A"}\n`;
  if (cliente?.telefone) mensagem += `Tel: ${formatPhone(cliente.telefone)}\n`;
  if (cliente?.cpf) mensagem += `CPF: ${formatCPF(cliente.cpf)}\n`;
  if (cliente?.endereco) mensagem += `Endereço: ${cliente.endereco}\n`;
  mensagem += "\n";

  // Dados do dispositivo
  mensagem += "📱 *DISPOSITIVO*\n";
  mensagem += `Tipo: ${ordem.dispositivo_tipo}\n`;
  mensagem += `Marca: ${ordem.dispositivo_marca}\n`;
  mensagem += `Modelo: ${ordem.dispositivo_modelo}\n`;
  if (ordem.dispositivo_cor) mensagem += `Cor: ${ordem.dispositivo_cor}\n`;
  if (ordem.dispositivo_imei) mensagem += `IMEI: ${ordem.dispositivo_imei}\n`;
  if (ordem.dispositivo_numero_serie) mensagem += `N° Série: ${ordem.dispositivo_numero_serie}\n`;
  mensagem += "\n";

  // Defeito relatado
  mensagem += "🔍 *DEFEITO RELATADO*\n";
  mensagem += `${ordem.defeito_relatado}\n\n`;

  // Checklist de entrada
  const avariasData = ordem.avarias || {};
  if (avariasData.checklist?.entrada) {
    mensagem += "✅ *CHECKLIST DE ENTRADA*\n";
    mensagem += formatarChecklist(avariasData.checklist.entrada);
    mensagem += "\n\n";
  }

  // Avarias visuais
  if (avariasData.avarias_visuais && avariasData.avarias_visuais.length > 0) {
    mensagem += "⚠️ *AVARIAS IDENTIFICADAS*\n";
    mensagem += formatarAvarias(avariasData.avarias_visuais);
    mensagem += "\n\n";
  }

  // Senha de desbloqueio (descriptografada)
  if (avariasData.senha_desbloqueio) {
    mensagem += "🔒 *SENHA DE DESBLOQUEIO*\n";
    const senha = decryptSenhaDesbloqueio(avariasData.senha_desbloqueio);
    if (senha?.tipo === "padrao" && senha.padrao) {
      mensagem += `Tipo: Padrão de Desenho\n`;
      mensagem += `Sequência: ${senha.padrao.join(" → ")}\n`;
    } else if (senha) {
      mensagem += `Tipo: ${senha.tipo === "numero" ? "Numérica" : "Alfanumérica"}\n`;
      mensagem += `Senha: ${senha.valor}\n`;
    }
    mensagem += "\n";
  }

  // Serviço e valores
  if (ordem.servico_nome) {
    mensagem += "🛠️ *SERVIÇO*\n";
    mensagem += `${ordem.servico_nome}\n`;
    if (ordem.total) mensagem += `Valor: ${formatCurrency(ordem.total)}\n`;
    mensagem += "\n";
  }

  // Forma de pagamento
  if (ordem.forma_pagamento) {
    mensagem += "💰 *FORMA DE PAGAMENTO*\n";
    const formasPagamento: { [key: string]: string } = {
      dinheiro: "Dinheiro",
      pix: "PIX",
      debito: "Cartão de Débito",
      credito: "Cartão de Crédito",
      credito_parcelado: "Cartão de Crédito Parcelado",
      a_receber: "A Receber",
    };
    mensagem += `${formasPagamento[ordem.forma_pagamento] || ordem.forma_pagamento}\n\n`;
  }

  // Checklist de saída (se houver)
  if (avariasData.checklist?.saida && Object.keys(avariasData.checklist.saida).length > 0) {
    mensagem += "✅ *CHECKLIST DE SAÍDA*\n";
    mensagem += formatarChecklist(avariasData.checklist.saida);
    mensagem += "\n\n";
  }

  // Termos e condições
  mensagem += "⚖️ *TERMOS E CONDIÇÕES*\n\n";
  mensagem += "• O prazo de garantia é de 90 dias para defeitos de fabricação.\n";
  mensagem += "• A garantia não cobre danos causados por mau uso ou acidentes.\n";
  mensagem += "• O cliente é responsável por backup de seus dados.\n";
  mensagem += "• A assistência não se responsabiliza por perda de dados.\n\n";

  mensagem += "━━━━━━━━━━━━━━━━━━━━\n";
  mensagem += "_Qualquer dúvida, entre em contato!_";

  return mensagem;
};

// Abre janela do WhatsApp IMEDIATAMENTE (síncrono - no clique do usuário)
export const abrirJanelaWhatsApp = (): Window | null => {
  try {
    // Abrir janela em branco sem escrever nada (mais compatível)
    const janela = window.open("", "_blank");
    console.log("[WhatsApp] Janela aberta:", janela ? "✅ Sucesso" : "❌ Bloqueada");
    return janela;
  } catch (error) {
    console.error("[WhatsApp] Erro ao abrir janela:", error);
    return null;
  }
};

// Envia mensagem para janela já aberta (assíncrono - após carregar dados)
export const enviarMensagemWhatsApp = async (
  janela: Window | null,
  telefone: string,
  mensagem: string
): Promise<void> => {
  console.log("[WhatsApp] Enviando mensagem...");
  console.log("[WhatsApp] Telefone:", telefone || "⚠️ VAZIO");
  console.log("[WhatsApp] Janela:", janela ? "✅ Aberta" : "❌ Fechada");
  
  // Validar telefone
  const telefoneFormatado = telefone?.replace(/\D/g, "") || "";
  
  if (!telefoneFormatado) {
    console.warn("[WhatsApp] ⚠️ Telefone não fornecido, usando fallback");
    if (janela && !janela.closed) janela.close();
    
    await copiarParaClipboard(mensagem);
    toast({
      title: "Telefone não cadastrado",
      description: "Mensagem copiada. Envie manualmente pelo WhatsApp.",
      variant: "default",
    });
    return;
  }
  
  // Se janela não existe ou foi fechada, usar fallback
  if (!janela || janela.closed) {
    console.error("[WhatsApp] ❌ Janela bloqueada ou fechada");
    await copiarParaClipboard(mensagem);
    toast({
      title: "Popup bloqueado!",
      description: "Mensagem copiada. Cole no WhatsApp manualmente.",
    });
    return;
  }

  try {
    const mensagemCodificada = encodeURIComponent(mensagem);
    const url = `https://wa.me/55${telefoneFormatado}?text=${mensagemCodificada}`;
    
    console.log("[WhatsApp] URL:", url.substring(0, 100) + "...");
    console.log("[WhatsApp] Tamanho URL:", url.length);
    
    // Verificar tamanho da URL (limite seguro do navegador)
    if (url.length > 2000) {
      console.warn("[WhatsApp] ⚠️ URL muito longa:", url.length);
      janela.close();
      await copiarParaClipboard(mensagem);
      toast({
        title: "Mensagem muito longa",
        description: "Texto copiado. Abra o WhatsApp e cole manualmente.",
      });
      return;
    }

    // Redirecionar janela já aberta para WhatsApp
    janela.location.href = url;
    console.log("[WhatsApp] ✅ Redirecionamento realizado");
    
    toast({
      title: "WhatsApp aberto!",
      description: "Verifique a nova aba e envie a mensagem.",
    });
  } catch (error) {
    console.error("[WhatsApp] ❌ Erro ao redirecionar:", error);
    if (janela && !janela.closed) janela.close();
    
    await copiarParaClipboard(mensagem);
    toast({
      variant: "destructive",
      title: "Erro ao abrir WhatsApp",
      description: "Mensagem copiada para área de transferência.",
    });
  }
};

// Mantém função legada para compatibilidade (usa nova estratégia)
export const enviarWhatsApp = async (telefone: string, mensagem: string): Promise<void> => {
  const janela = abrirJanelaWhatsApp();
  await enviarMensagemWhatsApp(janela, telefone, mensagem);
};

// Copia texto para clipboard
export const copiarParaClipboard = async (texto: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(texto);
    toast({
      title: "Texto copiado!",
      description: "O texto foi copiado para a área de transferência.",
    });
  } catch (error) {
    toast({
      variant: "destructive",
      title: "Erro ao copiar",
      description: "Não foi possível copiar o texto.",
    });
  }
};

import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardCheck,
  Package,
  WrenchIcon,
  Tablet,
  BookOpen,
  ShoppingBag,
  Truck,
  Users,
  FileSpreadsheet,
  ClipboardList,
  BarChart3,
  FileText,
  CreditCard,
  Settings,
  Building2,
  Calculator,
  Gift,
  type LucideIcon,
} from "lucide-react";

import imgDashboard from "@/assets/ajuda/dashboard.png";
import imgPdv from "@/assets/ajuda/pdv.png";
import imgOrdemServico from "@/assets/ajuda/ordem-servico.png";
import imgProdutosPecas from "@/assets/ajuda/produtos-pecas.png";
import imgServicos from "@/assets/ajuda/servicos.png";
import imgDispositivos from "@/assets/ajuda/dispositivos.png";
import imgCatalogo from "@/assets/ajuda/catalogo.png";
import imgOrigemDispositivos from "@/assets/ajuda/origem-dispositivos.png";
import imgOrcamentos from "@/assets/ajuda/orcamentos.png";
import imgPedidos from "@/assets/ajuda/pedidos.png";
import imgVendas from "@/assets/ajuda/vendas.png";
import imgFinanceiro from "@/assets/ajuda/financeiro.png";
import imgPlano from "@/assets/ajuda/plano.png";
import imgMultiEmpresas from "@/assets/ajuda/multi-empresas.png";
import imgPrecificador from "@/assets/ajuda/precificador.png";
import imgFidelidade from "@/assets/ajuda/fidelidade.png";

export interface AjudaModulo {
  slug: string;
  title: string;
  icon: LucideIcon;
  resumo: string;
  imagem?: string;
  conteudo: string[];
  passos: string[];
}

export const ajudaModulos: AjudaModulo[] = [
  {
    slug: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    resumo: "Visão geral do seu negócio em um só lugar.",
    imagem: imgDashboard,
    conteudo: [
      "O Dashboard reúne os principais indicadores da sua loja: vendas do período, ordens de serviço em andamento, contas a pagar/receber e atalhos rápidos para as funções mais usadas.",
      "É a primeira tela que você vê ao entrar no sistema, pensada para dar um raio-x rápido do dia a dia da loja sem precisar abrir vários menus.",
    ],
    passos: [
      "Use os filtros de período no topo da página para comparar dias, semanas ou meses diferentes.",
      "Os cards de resumo (vendas, OS, financeiro) são clicáveis e levam direto para a tela detalhada daquele indicador.",
      "Acompanhe aniversariantes do mês e avisos importantes diretamente nos cards de destaque.",
      "Use o Dashboard no início do dia para ver o que precisa de atenção (OS atrasadas, contas vencendo) antes de começar a trabalhar.",
    ],
  },
  {
    slug: "pdv",
    title: "PDV (Ponto de Venda)",
    icon: ShoppingCart,
    resumo: "Venda produtos e peças rapidamente no balcão.",
    imagem: imgPdv,
    conteudo: [
      "O PDV é a tela de venda rápida para produtos e peças do seu estoque, pensada para o atendimento de balcão.",
      "Vendas feitas pelo PDV já baixam automaticamente o estoque e aparecem no relatório de Vendas e no Financeiro.",
    ],
    passos: [
      "1. Clique em \"Item\" e busque o produto pelo nome ou código para adicionar à venda.",
      "2. Ajuste a quantidade de cada item, se necessário.",
      "3. Digite ou busque o nome do cliente (opcional, mas recomendado para histórico).",
      "4. Aplique um desconto em R$ ou % se for o caso.",
      "5. Escolha o vendedor responsável e a forma de pagamento.",
      "6. Clique em \"Finalizar Venda\" para concluir — o estoque é atualizado automaticamente.",
    ],
  },
  {
    slug: "ordem-servico",
    title: "Ordem de Serviço (OS)",
    icon: ClipboardCheck,
    resumo: "Controle conserto de aparelhos do recebimento à entrega.",
    imagem: imgOrdemServico,
    conteudo: [
      "A Ordem de Serviço é o coração do sistema para assistências técnicas: organiza cada aparelho recebido até a entrega final ao cliente.",
      "Os status (Aguardando Aprovação, Em Andamento, Finalizado, Aguardando Retirada, Entregue, Cancelada, Em Garantia, Estornado) ajudam a visualizar rapidamente em que etapa cada conserto está.",
    ],
    passos: [
      "1. Clique em \"+ Nova OS\" e selecione ou cadastre o cliente.",
      "2. Informe o dispositivo (ou cadastre um novo) com modelo, IMEI e defeito relatado.",
      "3. Adicione os serviços e peças usados no reparo — eles puxam automaticamente o preço já cadastrado.",
      "4. Atualize o status da OS conforme o conserto avança (em andamento, finalizado, aguardando retirada...).",
      "5. Gere o link de acompanhamento para o cliente acompanhar o status sem precisar ligar para a loja.",
      "6. Ao marcar como \"Entregue\", a OS pode gerar automaticamente o lançamento financeiro e a baixa de estoque dos itens usados.",
      "Use os filtros por período, status, canal e mídia para localizar OS específicas rapidamente, e alterne entre visualização em Tabela ou Kanban.",
    ],
  },
  {
    slug: "produtos-pecas",
    title: "Produtos e Peças",
    icon: Package,
    resumo: "Gerencie seu estoque de produtos e peças.",
    imagem: imgProdutosPecas,
    conteudo: [
      "Cadastre produtos e peças com preço de custo, preço de venda, quantidade em estoque e fornecedor.",
      "Produtos cadastrados aqui aparecem automaticamente no PDV, nas OS e nos orçamentos.",
    ],
    passos: [
      "1. Clique em \"+ Novo Item\" e escolha se é um Produto/Acessório ou uma Peça.",
      "2. Preencha nome, categoria, fornecedor, custo, preço de venda e quantidade em estoque.",
      "3. Use as abas \"Estoque\" e \"Trocas em Garantia\" para separar o controle normal do controle de garantia.",
      "4. Acompanhe os cards de resumo (cadastros, total em estoque, custo e lucro potencial) no topo da tela.",
      "5. Use a busca e os filtros por categoria (Acessórios/Peças) para localizar itens rapidamente.",
      "O sistema avisa quando o estoque está baixo ou negativo, ajudando a planejar a reposição.",
    ],
  },
  {
    slug: "servicos",
    title: "Serviços",
    icon: WrenchIcon,
    resumo: "Cadastre os tipos de serviço oferecidos pela loja.",
    imagem: imgServicos,
    conteudo: [
      "Cadastre os serviços que sua loja realiza (ex: troca de tela, troca de bateria, formatação) com seus respectivos valores.",
      "Esses serviços ficam disponíveis para serem adicionados dentro de uma Ordem de Serviço ou Orçamento, agilizando o lançamento.",
    ],
    passos: [
      "1. Clique em \"+ Novo Serviço\".",
      "2. Informe o nome do serviço, custo (se houver) e preço de venda — o lucro é calculado automaticamente.",
      "3. Vincule uma peça ao serviço, se aplicável (ex: \"Troca de Tela\" vinculada à peça correspondente).",
      "4. Use a busca para localizar rapidamente um serviço já cadastrado ao montar uma OS ou orçamento.",
    ],
  },
  {
    slug: "dispositivos",
    title: "Dispositivos",
    icon: Tablet,
    resumo: "Histórico de aparelhos atendidos e em estoque na loja.",
    imagem: imgDispositivos,
    conteudo: [
      "Reúne tanto os aparelhos vinculados a Ordens de Serviço quanto os dispositivos comprados para revenda (estoque).",
      "Facilita identificar clientes recorrentes e aparelhos com problemas repetidos, além de controlar o estoque de aparelhos para venda.",
    ],
    passos: [
      "1. Use a aba \"Estoque\" para ver dispositivos disponíveis para revenda, com custo, preço e lucro.",
      "2. Use a aba \"Vendidos\" e \"Estornados\" para acompanhar o histórico de saída de dispositivos.",
      "3. Filtre por marca, condição (novo/seminovo) ou garantia para localizar um aparelho específico.",
      "4. Clique em \"+ Novo Dispositivo\" para cadastrar um aparelho novo no estoque.",
    ],
  },
  {
    slug: "catalogo",
    title: "Catálogo",
    icon: BookOpen,
    resumo: "Página pública com seus produtos para divulgação.",
    imagem: imgCatalogo,
    conteudo: [
      "O Catálogo gera uma página pública (link compartilhável) com os produtos e dispositivos da sua loja, para você enviar a clientes ou divulgar nas redes sociais.",
    ],
    passos: [
      "1. Selecione os itens que deseja exibir publicamente e organize-os em categorias.",
      "2. Ative o \"Modo de Edição\" para ajustar fotos e preços exibidos no catálogo.",
      "3. Use a aba \"Templates\" para escolher o visual da página pública.",
      "4. Compartilhe o link gerado na aba \"Link\" com seus clientes, ou gere um PDF para enviar diretamente.",
      "5. A aba \"Landing Page\" permite configurar uma página de divulgação mais completa, se desejar.",
    ],
  },
  {
    slug: "origem-dispositivos",
    title: "Origem de Dispositivos",
    icon: ShoppingBag,
    resumo: "Controle de onde vieram os aparelhos em estoque.",
    imagem: imgOrigemDispositivos,
    conteudo: [
      "Registre a origem dos dispositivos que entram para revenda ou troca (compra de cliente, troca, consignado, etc), com valor pago e forma de pagamento.",
    ],
    passos: [
      "1. Clique em \"+ Nova Compra\".",
      "2. Informe a pessoa/fornecedor de quem o aparelho foi adquirido.",
      "3. Cadastre o dispositivo (modelo, IMEI) e o valor pago.",
      "4. Escolha a forma de pagamento utilizada na compra.",
      "5. Gere o termo de compra (ícone de documento) para ter um comprovante formal da aquisição.",
    ],
  },
  {
    slug: "fornecedores",
    title: "Fornecedores",
    icon: Truck,
    resumo: "Cadastro de fornecedores de produtos e peças.",
    conteudo: [
      "Cadastre seus fornecedores e vincule produtos/peças a eles para saber rapidamente onde comprar cada item.",
    ],
    passos: [
      "1. Clique em \"+ Novo Fornecedor\".",
      "2. Informe nome, tipo (PF ou PJ), documento e dados de contato.",
      "3. Use os filtros \"Ativos\"/\"Inativos\" para gerenciar fornecedores que não usa mais sem excluir o histórico.",
      "4. Vincule o fornecedor ao cadastrar ou editar um produto/peça em Produtos e Peças.",
    ],
  },
  {
    slug: "clientes",
    title: "Clientes",
    icon: Users,
    resumo: "Cadastro e histórico completo de clientes.",
    conteudo: [
      "Cadastre clientes com dados de contato e acompanhe o histórico de OS, vendas e orçamentos de cada um.",
      "A sub-seção Fidelidade permite acumular pontos ou benefícios para clientes recorrentes.",
    ],
    passos: [
      "1. Clique em \"+ Novo Cliente\" e informe nome, CPF, telefone e endereço.",
      "2. Use \"Importar\" para cadastrar vários clientes de uma vez via planilha.",
      "3. Use a busca por nome, CPF ou telefone para localizar um cliente rapidamente.",
      "4. Clique no ícone de olho para ver o histórico completo do cliente (OS, compras, orçamentos).",
      "5. Cadastre a data de nascimento para que o cliente apareça nos aniversariantes do mês no Dashboard.",
    ],
  },
  {
    slug: "orcamentos",
    title: "Orçamentos",
    icon: FileSpreadsheet,
    resumo: "Monte propostas antes de abrir uma OS ou venda.",
    imagem: imgOrcamentos,
    conteudo: [
      "Crie orçamentos com produtos e serviços para enviar ao cliente antes de fechar o negócio.",
      "Um orçamento aprovado pode ser convertido diretamente em Ordem de Serviço ou Venda, sem precisar redigitar os itens.",
    ],
    passos: [
      "1. Clique em \"+ Novo Orçamento\" e selecione o cliente.",
      "2. Adicione os produtos e/ou serviços que farão parte da proposta.",
      "3. Defina a validade do orçamento.",
      "4. Envie o orçamento ao cliente (compartilhável) para aprovação.",
      "5. Quando aprovado, converta o orçamento em OS ou Venda com um clique — os itens já vêm preenchidos.",
      "Acompanhe os cards de Total, Pendentes, Aprovados e Valor Aprovado no topo da tela.",
    ],
  },
  {
    slug: "pedidos",
    title: "Pedidos/Encomendas",
    icon: ClipboardList,
    resumo: "Controle produtos encomendados para clientes.",
    imagem: imgPedidos,
    conteudo: [
      "Registre encomendas de produtos que ainda não estão em estoque, controlando status até a chegada e entrega ao cliente.",
    ],
    passos: [
      "1. Clique em \"+ Novo Pedido\" e informe o cliente e o item encomendado.",
      "2. Acompanhe o status do pedido: Aguardando, Chegaram, A Receber.",
      "3. Use a aba \"Lista de Compras\" para consolidar o que precisa comprar de fornecedores com base nas encomendas pendentes.",
      "4. Atualize o status conforme o produto chega e é entregue ao cliente.",
    ],
  },
  {
    slug: "vendas",
    title: "Vendas",
    icon: BarChart3,
    resumo: "Histórico e relatório de todas as vendas realizadas.",
    imagem: imgVendas,
    conteudo: [
      "Veja todas as vendas feitas pelo PDV, OS e orçamentos convertidos, com filtros por período, tipo e forma de pagamento.",
      "O resumo por tipo (Dispositivos, Produtos, Serviços, Venda Avulsa) ajuda a entender de onde vem o faturamento da loja.",
    ],
    passos: [
      "1. Use os filtros rápidos (Hoje, Ontem, Últimos 7 dias) ou escolha um período/mês específico.",
      "2. Filtre por tipo de venda ou forma de pagamento para análises mais específicas.",
      "3. Confira o total vendido no período no card de destaque no topo.",
      "4. Veja o resumo por categoria (dispositivos, produtos, serviços, avulsas) com quantidade, faturamento e lucro de cada uma.",
    ],
  },
  {
    slug: "financeiro",
    title: "Financeiro",
    icon: FileText,
    resumo: "Contas a pagar/receber e relatórios financeiros.",
    imagem: imgFinanceiro,
    conteudo: [
      "Controle contas a pagar e a receber, com vencimentos e status de pagamento.",
      "A seção de Análise de Lucros e Custos mostra a evolução de receita, custos e lucro da loja ao longo do tempo.",
    ],
    passos: [
      "1. Use \"Lançar Despesa\" ou \"Lançar Receita\" para registrar uma nova conta.",
      "2. Filtre por período (Hoje, Ontem, 7 dias, Mês) para visualizar as contas daquela faixa de tempo.",
      "3. Acompanhe os cards de Total a Pagar, Total a Receber, Contas Pagas e Contas em Aberto.",
      "4. Veja os gráficos de Evolução de Receita/Custos e Evolução de Lucro para entender a saúde financeira da loja.",
      "5. Exporte um PDF do relatório financeiro quando precisar compartilhar com o contador ou sócios.",
    ],
  },
  {
    slug: "equipe",
    title: "Equipe",
    icon: Users,
    resumo: "Cadastre funcionários e defina permissões de acesso.",
    conteudo: [
      "Adicione funcionários à sua loja e configure exatamente quais módulos e dados cada um pode acessar.",
      "Defina comissões por cargo (vendedor, técnico, estoque) sobre vendas e serviços realizados.",
    ],
    passos: [
      "1. Clique em \"+ Novo Funcionário\" e informe nome, e-mail e cargo.",
      "2. Configure as permissões de acesso: quais módulos o funcionário pode ver e quais dados pode acessar.",
      "3. Defina a comissão (percentual ou valor fixo) e o escopo (produtos, dispositivos, serviços ou tudo).",
      "4. Ative \"Técnico/Funcionário obrigatório\" se quiser exigir que toda OS tenha um responsável definido antes de salvar.",
      "5. Use a aba \"Desempenho\" para acompanhar o resultado de cada funcionário no período.",
    ],
  },
  {
    slug: "configuracoes",
    title: "Configurações",
    icon: Settings,
    resumo: "Personalize dados da loja e comportamento do sistema.",
    conteudo: [
      "Ajuste dados da sua loja (nome, razão social, CNPJ, endereço), aparência, numeração de documentos e permissões padrão.",
      "O \"Status do Perfil\" indica se faltam dados para a emissão de recibos profissionais.",
    ],
    passos: [
      "1. Na aba \"Perfil\", preencha os dados básicos da loja (nome, razão social, CNPJ) e o endereço completo.",
      "2. Na aba \"Logo\", envie a logo da sua loja para aparecer em recibos e no catálogo.",
      "3. Na aba \"Aparência\" e \"Cores\", personalize a identidade visual do sistema para sua loja.",
      "4. Na aba \"Numeração\", defina como os números de OS, orçamentos e vendas são gerados.",
      "5. Na aba \"Notificações\", configure os avisos automáticos enviados a clientes e equipe.",
      "6. Na aba \"Permissões\", defina os padrões de acesso aplicados a novos funcionários.",
    ],
  },
  {
    slug: "plano",
    title: "Plano e Assinatura",
    icon: CreditCard,
    resumo: "Gerencie sua assinatura do sistema.",
    imagem: imgPlano,
    conteudo: [
      "Veja seu plano atual, compare os planos disponíveis (Free, Básico, Intermediário, Profissional) e acompanhe a cobrança da sua assinatura.",
    ],
    passos: [
      "1. Veja o plano atual e a data de renovação no topo da página.",
      "2. Compare os planos disponíveis e seus limites de funcionalidades.",
      "3. Escolha entre cobrança Mensal ou Anual (com desconto) ao fazer upgrade.",
      "4. Clique no plano desejado para fazer upgrade ou downgrade da assinatura.",
    ],
  },
  {
    slug: "multi-empresas",
    title: "Multi Empresas",
    icon: Building2,
    resumo: "Gerencie mais de uma loja/filial na mesma conta.",
    imagem: imgMultiEmpresas,
    conteudo: [
      "Disponível nos planos Ultra: permite alternar entre diferentes empresas/filiais cadastradas na mesma conta e comparar o desempenho entre elas.",
    ],
    passos: [
      "1. Clique em \"+ Nova Filial\" para cadastrar uma nova empresa/unidade.",
      "2. Use o seletor de filial no topo do menu lateral para alternar entre as empresas.",
      "3. Veja o Dashboard consolidado com faturamento total, OS e ticket médio de todas as filiais.",
      "4. Use a aba \"Empresas\" para comparar o desempenho entre as unidades e a aba \"Relatórios\" para análises mais detalhadas.",
      "5. Acompanhe o \"Ranking Geral\" para ver qual filial está performando melhor no período.",
    ],
  },
  {
    slug: "precificador",
    title: "Precificador",
    icon: Calculator,
    resumo: "Calcule o preço de venda ideal de um produto ou serviço.",
    imagem: imgPrecificador,
    conteudo: [
      "Calcule o preço de venda ideal considerando custo da nota, DIFAL (diferencial de alíquota interestadual) e taxas de cartão.",
    ],
    passos: [
      "1. Informe o valor da nota fiscal de compra e a margem de lucro desejada.",
      "2. Selecione o estado do fornecedor para calcular o DIFAL automaticamente, se aplicável.",
      "3. Cadastre suas maquininhas de cartão na aba \"Configurações\" para simular o preço ideal em cada modalidade de pagamento.",
      "4. Use o resultado para definir o preço de venda do produto já considerando impostos e taxas.",
    ],
  },
  {
    slug: "fidelidade",
    title: "Fidelidade de Clientes",
    icon: Gift,
    resumo: "Programa de pontos e benefícios para clientes fiéis.",
    imagem: imgFidelidade,
    conteudo: [
      "Acumule pontos ou benefícios para clientes recorrentes com base nas compras e serviços realizados, com níveis Bronze, Prata e Ouro.",
      "O programa já vem configurado com um modelo de pontuação padrão, que pode ser personalizado em \"Configurações\".",
    ],
    passos: [
      "1. Os clientes entram automaticamente no programa conforme acumulam compras/serviços.",
      "2. Acompanhe os cards de Clientes no Programa, Total de Pontos Distribuídos e Clientes por Nível.",
      "3. Use \"Configurações\" para personalizar a pontuação, os níveis e o tipo de resgate de acordo com sua loja.",
      "4. Busque um cliente específico para ver seu saldo de pontos e nível atual.",
    ],
  },
];

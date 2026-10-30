import type { NivelPlano } from "../components/SeloPlano";

// TODAS as funcionalidades do MécApp, levantadas no código do app em 2026-10-29 (somente leitura):
// rotas em src/App.tsx, módulos por plano em src/types/assinatura.ts (LIMITES_POR_PLANO), recursos em src/types/plano.ts
// e bloqueios dentro das páginas (Fidelidade = Profissional+, Multi Empresas = Ultra, Precificador = Ultra).
// Textos baseados nos títulos e subtítulos das próprias telas. Nada inventado.
//
// Imagens: pc = print do computador, cel = print do celular. Sem print ainda = card só com texto
// (a lista do que falta está em projetos/mecapp/PRINTS-FALTANDO.md). Para adicionar depois, é só preencher pc/cel.
export type Img = { src: string; w: number; h: number; alt: string };
export type Funcionalidade = {
  id: string;
  nome: string;
  texto: string;
  plano?: NivelPlano;
  emBreve?: boolean;
  limite?: string; // detalhe de limite por plano (de plano.ts)
  pc?: Img;
  cel?: Img;
};
export type Grupo = { id: string; titulo: string; curto: string; itens: Funcionalidade[] };

const pc = (src: string, w: number, h: number, alt: string): Img => ({ src, w, h, alt });
const cel = (src: string, w: number, h: number, alt: string): Img => ({ src, w, h, alt });

export const grupos: Grupo[] = [
  {
    id: "atendimento",
    curto: "Ordem de serviço",
    titulo: "Ordem de serviço e atendimento",
    itens: [
      {
        id: "os",
        nome: "Ordens de serviço",
        texto: "Cada aparelho com status, do orçamento à entrega. Busque por nome, IMEI, modelo ou número da OS.",
        plano: "basico",
        limite: "20 OS por mês no Básico, 60 no Intermediário e ilimitadas a partir do Profissional.",
        pc: pc("/img/hero/os-1258.webp", 1258, 677, "Centro de controle das ordens de serviço com os indicadores de cada status"),
        cel: cel("/img/cel/os-lista.webp", 744, 1594, "Lista de ordens de serviço no celular com status, aparelho e defeito"),
      },
      {
        id: "checklist",
        nome: "Checklist de entrada e saída",
        texto: "Teste tela, alto-falante, microfone, câmeras, flash, botões, biometria, bateria, Wi-Fi, Bluetooth, chip e conectores na entrada e na saída.",
        plano: "basico",
        pc: pc("/img/func/pc-checklist.webp", 1200, 1060, "Checklist de entrada e saída do aparelho com a marcação de avarias ao lado"),
        cel: cel("/img/func/cel-checklist.webp", 520, 1114, "Checklist de entrada e saída no celular"),
      },
      {
        id: "avarias",
        nome: "Marcação de avarias",
        texto: "Marque riscos, trincas, amassados e quebras no desenho do aparelho, na frente e no verso.",
        plano: "basico",
        cel: cel("/img/func/cel-avarias.webp", 520, 1114, "Marcação de avarias no desenho do aparelho"),
        pc: pc("/img/func/pc-avarias.webp", 799, 1088, "Marcação de avarias no desenho do aparelho, com trincas e riscos marcados na frente"),
      },
      {
        id: "fotos",
        nome: "Fotos do aparelho na OS",
        texto: "Fotografe o aparelho na entrada e guarde as fotos junto da ordem de serviço.",
        plano: "basico",
        cel: cel("/img/func/cel-fotos.webp", 520, 1114, "Fotos do aparelho dentro da OS"),
        pc: pc("/img/func/pc-fotos.webp", 1200, 933, "Aba de fotos do aparelho dentro da OS com duas fotos tiradas na entrada"),
      },
      {
        id: "assinatura",
        nome: "Assinatura digital do cliente",
        texto: "O cliente assina na tela, na entrada e na retirada, concordando com o checklist e as avarias registradas.",
        plano: "intermediario",
        cel: cel("/img/func/cel-assinatura.webp", 520, 1114, "Assinatura digital do cliente na OS"),
        pc: pc("/img/func/pc-assinatura.webp", 1200, 890, "Resumo da OS com a assinatura digital do cliente na entrada e campo para a assinatura na retirada"),
      },
      {
        id: "acompanhamento",
        nome: "Link de acompanhamento da OS",
        texto: "Envie pelo WhatsApp e o cliente acompanha cada etapa do conserto, com as fotos do aparelho, sem ligar para a loja.",
        plano: "intermediario",
        limite: "10 por mês no Intermediário, 50 no Profissional e ilimitado no Ultra.",
        pc: pc("/img/func/pc-acompanhamento.webp", 483, 620, "Página de acompanhamento da OS aberta no navegador do computador"),
        cel: cel("/img/cel/os-acompanhamento.webp", 744, 1594, "Página de acompanhamento da OS que o cliente recebe"),
      },
      {
        id: "orcamentos",
        nome: "Orçamentos",
        texto: "Monte orçamentos e acompanhe os pendentes, aprovados, expirados e convertidos.",
        plano: "basico",
        pc: pc("/img/func/pc-orcamentos.webp", 1200, 772, "Lista de orçamentos com totais de pendentes, aprovados, valor aprovado e a validade de cada um"),
      },
      {
        id: "notificacoes",
        nome: "Notificações automáticas no celular",
        texto: "Receba um aviso no celular quando uma OS muda de etapa ou é finalizada.",
        plano: "profissional",
        cel: cel("/img/func/cel-notificacoes.webp", 520, 1128, "Notificações do MécApp na tela do celular avisando que a OS está em andamento e que foi finalizada"),
      },
      {
        id: "recibos",
        nome: "Impressão da OS e recibo de venda",
        texto: "Imprima a ordem de serviço e o recibo de venda em folha A4 ou na impressora térmica de 80 mm, com a logo da sua loja.",
        pc: pc("/img/func/pc-recibo.webp", 1055, 1491, "Ordem de serviço impressa em A4 com dados do cliente, aparelho, defeito, checklist, fotos e termo de garantia"),
      },
      {
        id: "app",
        nome: "Instale como aplicativo",
        texto: "Instale o MécApp no iPhone, no Android ou no computador, sem precisar de loja de apps.",
        pc: pc("/img/func/pc-app.webp", 1200, 735, "Passo a passo para instalar o MécApp no iPhone pela tela de início"),
      },
      {
        id: "pedidos",
        nome: "Pedidos e encomendas",
        texto: "Gerencie pedidos e encomendas de clientes.",
        plano: "intermediario",
        pc: pc("/img/func/pc-pedidos.webp", 1200, 775, "Tela de pedidos e encomendas com total de pedidos, aguardando, chegaram e a receber"),
      },
      {
        id: "aniversariantes",
        nome: "Aniversariantes do mês com WhatsApp",
        texto: "Veja quem faz aniversário no mês e chame o cliente pelo WhatsApp.",
        plano: "profissional",
      },
    ],
  },
  {
    id: "balcao",
    curto: "Balcão e estoque",
    titulo: "Balcão, estoque e vendas",
    itens: [
      {
        id: "estoque",
        nome: "Estoque de aparelhos",
        texto: "Cada aparelho com IMEI, condição, custo, preço de venda e lucro, pronto para vender no PDV em 1 toque.",
        plano: "basico",
        limite: "Até 50 aparelhos no Básico, 500 no Intermediário e ilimitados a partir do Profissional.",
        pc: pc("/img/hero-estoque-1258.webp", 1258, 677, "Estoque de dispositivos com resumo e aparelhos com custo, preço e lucro"),
        cel: cel("/img/cel/estoque.webp", 744, 1594, "Estoque de aparelhos no celular"),
      },
      {
        id: "pdv",
        nome: "PDV (frente de caixa)",
        texto: "Venda avulsa, abrir e fechar caixa, sangria e suprimento, desconto, vendedor e forma de pagamento.",
        plano: "basico",
        pc: pc("/img/hero/pdv-1258.webp", 1258, 677, "PDV frente de caixa no computador"),
        cel: cel("/img/cel/pdv-1.webp", 744, 1594, "PDV frente de caixa no celular"),
      },
      {
        id: "produtos",
        nome: "Produtos e peças",
        texto: "Acessórios e peças com custo, preço de venda e quantidade em estoque.",
        plano: "basico",
        limite: "Ilimitados em todos os planos.",
        pc: pc("/img/func/pc-produtos.webp", 1185, 870, "Estoque de produtos e peças com custo, preço e quantidade"),
      },
      {
        id: "servicos",
        nome: "Serviços",
        texto: "Cadastre os serviços que você faz, com custo, preço e lucro de cada um.",
        plano: "basico",
        pc: pc("/img/func/pc-servicos.webp", 1185, 870, "Lista de serviços com custo, preço e lucro"),
      },
      {
        id: "vendas",
        nome: "Vendas",
        texto: "Todas as vendas separadas por aparelhos, produtos, serviços e venda avulsa, com faturamento e lucro de cada tipo.",
        plano: "basico",
        pc: pc("/img/func/pc-vendas.webp", 1185, 870, "Tela de vendas com total vendido e resumo por tipo"),
        cel: cel("/img/func/cel-vendas.webp", 520, 1114, "Vendas no celular com total vendido e resumo por tipo"),
      },
      {
        id: "a-receber",
        nome: "Vendas a receber",
        texto: "Quanto falta receber, o que já venceu e o que vence nos próximos dias.",
        plano: "basico",
        cel: cel("/img/cel/vendas-a-receber.webp", 740, 1586, "Vendas a receber no celular"),
      },
      {
        id: "catalogo",
        nome: "Catálogo de aparelhos",
        texto: "Monte um catálogo em PDF ou com link público para mandar aos clientes, com modelos visuais prontos.",
        plano: "intermediario",
        limite: "10 aparelhos no catálogo no Intermediário e ilimitado a partir do Profissional.",
        pc: pc("/img/func/pc-catalogo.webp", 1200, 666, "Personalização do catálogo com modelos visuais prontos e a prévia do catálogo online"),
      },
      {
        id: "peliculas",
        nome: "Compatibilidade de películas e vidros",
        texto: "Descubra quais modelos usam a mesma película ou o mesmo vidro de tela.",
        plano: "basico",
        pc: pc("/img/func/pc-peliculas.webp", 1200, 716, "Busca de compatibilidade de películas: o iPhone 11 usa a mesma película do iPhone XR"),
      },
      {
        id: "origem",
        nome: "Origem de dispositivos",
        texto: "Registre as compras de aparelhos: de quem comprou, quanto pagou e a forma de pagamento.",
        plano: "basico",
        pc: pc("/img/func/pc-origem.webp", 1200, 750, "Origem de dispositivos com as compras de aparelhos, valor pago e forma de pagamento"),
      },
      {
        id: "remessas",
        nome: "Remessas corporativas",
        texto: "Organize lotes de aparelhos recebidos de uma vez e crie a ordem de serviço de cada aparelho.",
        plano: "basico",
      },
      {
        id: "imei",
        nome: "Consulta de IMEI pela Anatel",
        texto: "Consulte o IMEI do aparelho sem sair do sistema.",
        plano: "profissional",
      },
      {
        id: "garantia",
        nome: "Verificação de garantia Apple",
        texto: "Confira a garantia de aparelhos Apple direto no MécApp.",
        plano: "profissional",
      },
    ],
  },
  {
    id: "financeiro",
    curto: "Financeiro",
    titulo: "Financeiro e números da loja",
    itens: [
      {
        id: "dashboard",
        nome: "Dashboard",
        texto: "Faturamento, lucro líquido, faturamento e lucro de hoje e o que precisa de atenção, numa tela só.",
        plano: "basico",
        pc: pc("/img/hero/dashboard-1258.webp", 1258, 677, "Dashboard com faturamento total, lucro líquido e indicadores do dia"),
      },
      {
        id: "contas",
        nome: "Contas a pagar e a receber",
        texto: "O que vence, o que está atrasado e o que já foi pago ou recebido, por período.",
        plano: "intermediario",
        pc: pc("/img/hero/financeiro-1258.webp", 1258, 677, "Financeiro com contas a pagar e a receber e análise de lucros"),
        cel: cel("/img/cel/contas.webp", 851, 1848, "Contas a pagar e a receber no celular"),
      },
      {
        id: "extrato",
        nome: "Extrato da loja",
        texto: "Tudo o que entrou e saiu, dia a dia, como um extrato de banco.",
        plano: "intermediario",
        pc: pc("/img/func/pc-extrato.webp", 1260, 673, "Extrato da loja no computador com entradas, saídas e movimentações"),
        cel: cel("/img/cel/extrato.webp", 744, 1594, "Extrato da loja no celular com entradas, saídas e movimentações"),
      },
      {
        id: "lucros",
        nome: "Análise de lucros e custos",
        texto: "Lucro bruto, lucro líquido, margem e o lucro de cada item vendido.",
        plano: "intermediario",
        pc: pc("/img/func/pc-lucros.webp", 1200, 660, "Análise de lucros e custos com faturamento, custos, lucro bruto, lucro líquido, margem, gráficos e lucro por item"),
      },
      {
        id: "relatorios",
        nome: "Relatórios",
        texto: "Exporte em PDF os relatórios de OS, vendas, financeiro (DRE) e clientes, e compare aparelhos, produtos, serviços e venda avulsa.",
        plano: "basico",
        pc: pc("/img/func/pc-relatorios.webp", 1200, 660, "Relatórios com exportação em PDF de OS, vendas, financeiro e clientes, e análise por tipo de venda"),
      },
      {
        id: "precificador",
        nome: "Precificador",
        texto: "Calcule o preço de venda com DIFAL e taxas de cartão em segundos.",
        plano: "ultra",
        pc: pc("/img/func/pc-precificador.webp", 1185, 870, "Precificador com custo de compra, margem de lucro, estado do fornecedor e taxas de cartão"),
      },
      {
        id: "nota-fiscal",
        nome: "Emissão de nota fiscal",
        texto: "Ainda não está disponível. Estamos construindo.",
        emBreve: true,
      },
    ],
  },
  {
    id: "pessoas",
    curto: "Clientes e equipe",
    titulo: "Clientes e equipe",
    itens: [
      {
        id: "clientes",
        nome: "Cadastro de clientes",
        texto: "Seus clientes cadastrados para usar na OS, no PDV e nas vendas.",
        plano: "intermediario",
        pc: pc("/img/func/pc-clientes.webp", 1200, 744, "Lista de clientes com total em compras, última compra e status"),
      },
      {
        id: "fornecedores",
        nome: "Fornecedores",
        texto: "Cadastro dos fornecedores de peças e aparelhos.",
        plano: "intermediario",
        pc: pc("/img/func/pc-fornecedores.webp", 1200, 663, "Lista de fornecedores com tipo, documento, cidade e status"),
      },
      {
        id: "equipe",
        nome: "Equipe, comissões e permissões",
        texto: "Cadastre funcionários por cargo, defina a comissão sobre os serviços e escolha o que cada um pode ver e fazer.",
        plano: "intermediario",
        limite: "1 funcionário com comissão no Intermediário e ilimitados a partir do Profissional.",
        pc: pc("/img/func/pc-equipe.webp", 1200, 748, "Lista de funcionários com cargo, comissão, status e acessos de cada um"),
      },
      {
        id: "fidelidade",
        nome: "Programa de fidelidade",
        texto: "Pontos e recompensas para os clientes que voltam, com níveis bronze, prata e ouro.",
        plano: "profissional",
        pc: pc("/img/func/pc-fidelidade.webp", 1200, 752, "Programa de fidelidade com clientes no programa, pontos distribuídos e níveis bronze, prata e ouro"),
      },
    ],
  },
  {
    id: "lojas",
    curto: "Várias lojas",
    titulo: "Várias lojas",
    itens: [
      {
        id: "multi",
        nome: "Multi Empresas",
        texto: "Matriz e até 3 filiais no mesmo painel, com faturamento, OS, vendas e ticket médio de cada loja.",
        plano: "ultra",
        pc: pc("/img/hero/multiempresas-1258.webp", 1258, 677, "Multi Empresas com faturamento total, OS e ticket médio de todas as lojas"),
        cel: cel("/img/cel/multiempresas.webp", 740, 1586, "Multi Empresas no celular"),
      },
      {
        id: "avaliador",
        nome: "Avaliador de preço de dispositivo",
        texto: "Ajuda para avaliar o preço de aparelhos. Vai chegar no plano Ultra.",
        plano: "ultra",
        emBreve: true,
      },
    ],
  },
];

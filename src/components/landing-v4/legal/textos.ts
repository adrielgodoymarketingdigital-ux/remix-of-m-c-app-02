// Textos dos Termos de uso e da Política de privacidade do MécApp (criados no estúdio em 2026-10-30).
// Baseados no que o app faz de verdade, lido no código do MecApp (somente leitura):
// - login por e-mail e senha + Cloudflare Turnstile; funcionários com permissões
// - pagamento pela Pagar.me (cartão recorrente tokenizado direto na Pagar.me, e Pix); webhooks de Hotmart, Kirvano e Ticto
// - cancelamento (supabase/functions/cancel-subscription/cancelarPlano.ts): volta ao plano gratuito NA HORA
//   (decisão do Adriel em 2026-10-30: vale o que o app faz)
// - backups (supabase/functions/backup-diario): diários por 7 dias, semanais por 28 dias, mensais por 365 dias
// - serviços: Supabase, Vercel, Pagar.me, Meta Pixel + API de Conversões, TikTok Pixel, UTMify, OneSignal, Cloudflare,
//   Anthropic (analista financeiro com IA), Tiny (integração opcional), automação de atendimento (nome e telefone do cadastro)
// - dados guardados: tabelas clientes, fornecedores, origem_pessoas, ordens_servico, compras_dispositivos etc. (types.ts)
//
// Sem CNPJ, razão social, e-mail e foro por enquanto (decisão do Adriel em 2026-10-30): o responsável aparece como "MécApp"
// e o contato é o WhatsApp do suporte. Quando a SLU estiver aberta, acrescentar a razão social e o CNPJ na seção 1
// dos dois documentos (e, se quiser, um e-mail de contato e o foro na seção 12 dos Termos).
// Recomendação: pedir para um advogado revisar antes de publicar.

export const DADOS = {
  whatsapp: "(19) 97145-4829",
  site: "appmec.in",
  atualizado: "30 de outubro de 2026",
};

export type Bloco = string | { lista: string[] };
export type Secao = { id: string; titulo: string; blocos: Bloco[] };
export type Documento = { titulo: string; resumo: string; secoes: Secao[] };

const D = DADOS;

export const termos: Documento = {
  titulo: "Termos de uso",
  resumo:
    "As regras para usar o MécApp: conta, teste grátis, planos, pagamento, cancelamento e as responsabilidades de cada lado. Escrito em linguagem simples.",
  secoes: [
    {
      id: "quem-somos",
      titulo: "1. Quem somos e o que é o MécApp",
      blocos: [
        `O MécApp é um sistema online para assistências técnicas e lojas de celular. Ele funciona no navegador do computador, do tablet e do celular, e também pode ser instalado como aplicativo.`,
        `Neste documento, quem oferece o sistema é chamado de "MécApp" ou "nós", e quem cria uma conta é chamado de "você" ou "usuário".`,
        `Ao criar uma conta ou usar o MécApp, você concorda com estes Termos e com a nossa Política de privacidade. Se não concordar, não use o sistema.`,
      ],
    },
    {
      id: "conta",
      titulo: "2. Sua conta",
      blocos: [
        {
          lista: [
            "O cadastro é feito com e-mail e senha. Para proteger o sistema contra robôs, usamos uma verificação automática no cadastro e no login.",
            "Você precisa informar dados verdadeiros e mantê-los atualizados.",
            "A senha é pessoal. Você é responsável por guardá-la e por tudo o que for feito com a sua conta.",
            "Você pode criar acessos para funcionários e escolher o que cada um pode ver e fazer. Você é responsável pelo uso que eles fizerem desses acessos.",
            "O MécApp é feito para empresas e profissionais. Para criar uma conta, você precisa ter 18 anos ou mais.",
          ],
        },
      ],
    },
    {
      id: "teste",
      titulo: "3. Teste grátis",
      blocos: [
        `Todo cadastro novo ganha 24h de acesso para testar os principais recursos. As condições do teste aparecem na tela de cadastro antes de você confirmar.`,
      ],
    },
    {
      id: "planos",
      titulo: "4. Planos, limites e pagamento",
      blocos: [
        `O MécApp tem um plano gratuito e planos pagos (Básico, Intermediário, Profissional e Ultra), com cobrança mensal ou anual. Os preços, os recursos e os limites de cada plano (por exemplo, quantidade de ordens de serviço por mês, de aparelhos no estoque e de armazenamento) aparecem na página de planos antes da contratação.`,
        {
          lista: [
            "O pagamento é feito por cartão de crédito ou Pix, processado pela Pagar.me.",
            "No cartão, a assinatura é renovada e cobrada automaticamente a cada período, até você cancelar.",
            "No Pix, cada período é pago separadamente. Se o pagamento da renovação não for feito, os recursos do plano pago podem ser suspensos.",
            "Ao atingir um limite do seu plano, você pode mudar para um plano maior a qualquer momento.",
            "Recursos marcados como \"Em breve\" ainda não estão disponíveis e não fazem parte do que foi contratado até serem lançados.",
          ],
        },
      ],
    },
    {
      id: "cancelamento",
      titulo: "5. Cancelamento e reembolso",
      blocos: [
        {
          lista: [
            "Você pode cancelar o plano pago a qualquer momento, pelo próprio sistema, sem multa.",
            "Ao cancelar, sua conta volta na hora para o plano gratuito, e os recursos do plano pago deixam de estar disponíveis a partir desse momento.",
            "No cartão, o cancelamento também encerra a cobrança automática das próximas renovações.",
            "Seus dados continuam na sua conta depois do cancelamento. Para apagar a conta, veja a seção 8.",
          ],
        },
        `Pedidos de reembolso devem ser feitos pelo suporte e são analisados de acordo com o Código de Defesa do Consumidor, quando ele se aplicar.`,
      ],
    },
    {
      id: "uso",
      titulo: "6. Uso permitido",
      blocos: [
        "Ao usar o MécApp, você se compromete a não:",
        {
          lista: [
            "usar o sistema para qualquer atividade ilegal, como vender produtos de origem ilícita;",
            "cadastrar dados de terceiros sem ter um motivo legítimo para isso;",
            "tentar acessar contas, dados ou partes do sistema que não são suas;",
            "copiar, revender ou repassar o acesso ao sistema para outras empresas;",
            "atrapalhar o funcionamento do sistema, por exemplo com robôs ou ataques.",
          ],
        },
        `Se isso acontecer, podemos suspender ou encerrar a conta, avisando sempre que possível.`,
      ],
    },
    {
      id: "dados",
      titulo: "7. Seus dados e os dados dos seus clientes",
      blocos: [
        `Os dados que você cadastra (clientes, aparelhos, ordens de serviço, vendas, financeiro etc.) são seus. O MécApp só usa esses dados para prestar o serviço para você.`,
        `Pela Lei Geral de Proteção de Dados (LGPD), em relação aos dados dos seus clientes, você é o controlador (quem decide o que cadastrar e para quê) e o MécApp é o operador (quem guarda e processa esses dados em seu nome). Por isso, você é responsável por ter um motivo legítimo para cadastrar esses dados e por atender os pedidos dos seus clientes sobre eles.`,
        `A forma como tratamos dados pessoais está explicada na Política de privacidade.`,
      ],
    },
    {
      id: "exclusao",
      titulo: "8. Encerramento da conta",
      blocos: [
        `Você pode pedir a exclusão da sua conta e dos seus dados pelo suporte. Depois da exclusão, os dados saem do sistema e das cópias de segurança no prazo normal delas (até 1 ano, veja a Política de privacidade), exceto o que precisarmos guardar por obrigação legal.`,
        `Antes de pedir a exclusão, guarde o que precisar: dados apagados não podem ser recuperados.`,
      ],
    },
    {
      id: "disponibilidade",
      titulo: "9. Funcionamento do sistema",
      blocos: [
        `Trabalhamos para manter o MécApp no ar e fazemos cópias de segurança automáticas dos dados. Mesmo assim, como todo serviço online, ele pode ter instabilidades, manutenções ou falhas de serviços parceiros (internet, hospedagem, pagamento). Quando possível, avisaremos sobre manutenções com antecedência.`,
      ],
    },
    {
      id: "responsabilidade",
      titulo: "10. Responsabilidades",
      blocos: [
        {
          lista: [
            "O MécApp é uma ferramenta de gestão. As decisões da sua loja, os preços que você cobra e as informações que você passa para os seus clientes são de sua responsabilidade.",
            "Relatórios, cálculos de lucro e sugestões do analista financeiro com inteligência artificial são apoio para a gestão. Eles não substituem um contador ou consultor.",
            "Não respondemos por prejuízos causados por uso indevido da conta, por dados cadastrados errado ou por falhas fora do nosso controle.",
          ],
        },
      ],
    },
    {
      id: "mudancas",
      titulo: "11. Mudanças nestes Termos",
      blocos: [
        `Podemos atualizar estes Termos. Quando houver mudança importante, avisaremos pelo sistema ou por mensagem. A data da última atualização fica no topo desta página.`,
      ],
    },
    {
      id: "contato",
      titulo: "12. Contato e lei aplicável",
      blocos: [
        `Dúvidas sobre estes Termos: fale com o suporte pelo WhatsApp ${D.whatsapp}.`,
        `Estes Termos seguem as leis do Brasil.`,
      ],
    },
  ],
};

export const privacidade: Documento = {
  titulo: "Política de privacidade",
  resumo:
    "Quais dados o MécApp coleta, para que usa, com quem compartilha, por quanto tempo guarda e como você pode pedir acesso, correção ou exclusão. De acordo com a LGPD.",
  secoes: [
    {
      id: "responsavel",
      titulo: "1. Quem cuida dos seus dados",
      blocos: [
        `O MécApp é o responsável pelos dados pessoais tratados no site e no sistema. Para qualquer assunto sobre dados pessoais, inclusive com o encarregado de proteção de dados, fale com a gente pelo WhatsApp do suporte ${D.whatsapp}.`,
        `Esta Política vale para o site ${D.site} e para o sistema MécApp, no navegador ou instalado como aplicativo.`,
      ],
    },
    {
      id: "coletamos",
      titulo: "2. Quais dados coletamos",
      blocos: [
        "Dados da sua conta e da sua loja:",
        {
          lista: [
            "nome, e-mail, telefone e senha (a senha é guardada de forma protegida, nunca em texto aberto);",
            "dados da loja que você preencher: nome, CNPJ, endereço, telefone, inscrição municipal, logo e assinatura usada em documentos;",
            "nome e e-mail dos funcionários que você cadastrar, com as permissões e comissões de cada um.",
          ],
        },
        "Dados de pagamento:",
        {
          lista: [
            "plano, forma de pagamento, datas e situação da assinatura;",
            "os dados do cartão são digitados e enviados diretamente para a Pagar.me. O MécApp não recebe nem guarda o número completo do cartão nem o código de segurança;",
            "se a compra for feita por uma plataforma parceira de vendas (como Hotmart, Kirvano ou Ticto), recebemos dela os dados da compra para liberar o seu acesso.",
          ],
        },
        "Dados que você cadastra sobre os seus clientes, fornecedores e aparelhos:",
        {
          lista: [
            "nome, CPF ou CNPJ, RG, data de nascimento, telefone, e-mail e endereço;",
            "dados dos aparelhos: modelo, IMEI, defeito, fotos e a senha de desbloqueio, se você registrar na ordem de serviço;",
            "assinaturas em termos de compra de aparelhos, com data e endereço IP de quem assinou;",
            "ordens de serviço, orçamentos, vendas, estoque e financeiro.",
          ],
        },
        "Dados de uso e navegação:",
        {
          lista: [
            "endereço IP, tipo de navegador e aparelho, páginas visitadas e ações no site;",
            "origem da visita (parâmetros de campanha, como UTM, e identificadores de anúncios, como o fbclid);",
            "o registro do seu aparelho para notificações, se você permitir receber notificações.",
          ],
        },
      ],
    },
    {
      id: "usamos",
      titulo: "3. Para que usamos os dados",
      blocos: [
        {
          lista: [
            "Prestar o serviço: guardar e mostrar as informações da sua loja, gerar ordens de serviço, recibos, relatórios e o link de acompanhamento.",
            "Criar e proteger a sua conta, inclusive com a verificação contra robôs.",
            "Cobrar a assinatura e liberar o plano contratado.",
            "Dar suporte, inclusive pelo WhatsApp, e enviar avisos importantes sobre a conta.",
            "Enviar notificações do sistema, se você permitir.",
            "Medir de onde vêm os visitantes e o resultado dos nossos anúncios.",
            "Melhorar o sistema e cumprir obrigações legais.",
          ],
        },
        `Não vendemos dados pessoais. Os dados que você cadastra sobre os seus clientes não são usados para os nossos anúncios.`,
      ],
    },
    {
      id: "bases",
      titulo: "4. Bases legais (LGPD)",
      blocos: [
        {
          lista: [
            "Execução de contrato: para prestar o serviço que você contratou ou está testando.",
            "Cumprimento de obrigação legal: por exemplo, guardar registros exigidos por lei.",
            "Legítimo interesse: segurança, prevenção a fraudes, melhoria do sistema e medição de campanhas, sempre respeitando os seus direitos.",
            "Consentimento: por exemplo, para notificações no aparelho. Você pode retirar o consentimento quando quiser.",
          ],
        },
        `Para os dados dos seus clientes, o MécApp atua como operador, seguindo as suas instruções como controlador (veja a seção 7 dos Termos de uso).`,
      ],
    },
    {
      id: "compartilhamos",
      titulo: "5. Com quem compartilhamos",
      blocos: [
        "Usamos serviços de empresas parceiras para o MécApp funcionar. Elas recebem só o necessário para a sua parte do trabalho:",
        {
          lista: [
            "Supabase: banco de dados, login e armazenamento de arquivos e fotos.",
            "Vercel: hospedagem do site e do sistema.",
            "Pagar.me: processamento de pagamentos por cartão e Pix.",
            "Meta (Facebook e Instagram), TikTok e UTMify: medição de visitas e de anúncios no site.",
            "OneSignal: envio de notificações para quem está logado e permitiu receber.",
            "Cloudflare: verificação contra robôs no cadastro e no login.",
            "Anthropic: inteligência artificial do analista financeiro. Só recebe um resumo dos números financeiros da sua loja quando você usa esse recurso.",
            "Tiny: só se você conectar essa integração na sua conta.",
            "Ferramenta de automação de atendimento: recebe o nome e o telefone informados no cadastro, para entrarmos em contato com você depois do cadastro.",
          ],
        },
        `Também podemos compartilhar dados quando a lei exigir ou por ordem de uma autoridade.`,
        `Alguns desses serviços podem guardar dados em servidores fora do Brasil. Nesses casos, a transferência segue as regras da LGPD.`,
      ],
    },
    {
      id: "cookies",
      titulo: "6. Cookies e armazenamento no navegador",
      blocos: [
        {
          lista: [
            "Necessários: manter você logado e guardar preferências do sistema.",
            "De medição e anúncios: os códigos da Meta, do TikTok e da UTMify, e o registro da origem da visita (parâmetros de campanha), para sabermos quais anúncios trazem clientes.",
          ],
        },
        `Você pode apagar ou bloquear cookies nas configurações do seu navegador. Se bloquear os necessários, o login pode não funcionar.`,
      ],
    },
    {
      id: "guardamos",
      titulo: "7. Por quanto tempo guardamos",
      blocos: [
        {
          lista: [
            "Os dados da sua conta e da sua loja ficam guardados enquanto a conta existir, inclusive no plano gratuito.",
            "Fazemos cópias de segurança automáticas: as diárias são guardadas por 7 dias, as semanais por 28 dias e as mensais por 1 ano.",
            "Se você pedir a exclusão da conta, os dados saem do sistema e deixam de existir nas cópias de segurança quando elas vencerem, em até 1 ano.",
            "Alguns registros podem ser guardados por mais tempo quando a lei exigir.",
          ],
        },
      ],
    },
    {
      id: "direitos",
      titulo: "8. Seus direitos",
      blocos: [
        "Pela LGPD, você pode pedir, a qualquer momento:",
        {
          lista: [
            "confirmação de que tratamos seus dados e acesso a eles;",
            "correção de dados incompletos ou errados;",
            "exclusão, bloqueio ou anonimização de dados desnecessários;",
            "portabilidade dos dados;",
            "informação sobre com quem compartilhamos;",
            "retirada do consentimento, quando ele for a base legal.",
          ],
        },
        `Faça o pedido pelo WhatsApp do suporte ${D.whatsapp}. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).`,
        `Se você é cliente de uma loja que usa o MécApp, faça o pedido diretamente para a loja: ela é a responsável pelos seus dados. Se precisar, ajudamos a loja a atender o pedido.`,
      ],
    },
    {
      id: "seguranca",
      titulo: "9. Segurança",
      blocos: [
        `Usamos conexão criptografada (HTTPS), login com senha, verificação contra robôs, controle de acesso por funcionário e cópias de segurança. Nenhum sistema é 100% seguro. Se acontecer um incidente que possa trazer risco a você, avisaremos você e a ANPD, como manda a lei.`,
        `Você também ajuda: não compartilhe sua senha e dê aos funcionários só as permissões de que eles precisam.`,
      ],
    },
    {
      id: "mudancas",
      titulo: "10. Mudanças nesta Política",
      blocos: [
        `Podemos atualizar esta Política. Quando houver mudança importante, avisaremos pelo sistema ou por mensagem. A data da última atualização fica no topo desta página.`,
      ],
    },
  ],
};

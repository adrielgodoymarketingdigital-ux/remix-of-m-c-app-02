-- Criar tabela de configuração global do onboarding (singleton)
CREATE TABLE public.onboarding_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo boolean NOT NULL DEFAULT true,
  publico_alvo text[] NOT NULL DEFAULT ARRAY['trial']::text[],
  mostrar_para_usuarios_ativos boolean NOT NULL DEFAULT false,
  config_passos jsonb NOT NULL DEFAULT '{
    "assistencia": [
      {
        "id": "cliente",
        "titulo": "Cadastre seu primeiro cliente",
        "descricao": "Organize todos os seus clientes em um só lugar. Adicione nome, telefone e endereço para facilitar o atendimento.",
        "icone": "user",
        "rota": "/clientes",
        "botao_texto": "Cadastrar Cliente",
        "ordem": 1,
        "ativo": true
      },
      {
        "id": "peca",
        "titulo": "Adicione suas peças/produtos",
        "descricao": "Cadastre as peças e produtos que você usa nos serviços. Isso facilita o controle de estoque e custos.",
        "icone": "package",
        "rota": "/produtos",
        "botao_texto": "Cadastrar Peça",
        "ordem": 2,
        "ativo": true
      },
      {
        "id": "os",
        "titulo": "Crie sua primeira Ordem de Serviço",
        "descricao": "Registre o serviço do cliente com todos os detalhes: dispositivo, defeito, peças usadas e valor.",
        "icone": "clipboard-list",
        "rota": "/ordem-servico",
        "botao_texto": "Criar OS",
        "ordem": 3,
        "ativo": true
      },
      {
        "id": "lucro",
        "titulo": "Visualize seu lucro",
        "descricao": "Acompanhe seus ganhos em tempo real no dashboard financeiro.",
        "icone": "trending-up",
        "rota": "/financeiro",
        "botao_texto": "Ver Lucros",
        "ordem": 4,
        "ativo": true
      }
    ],
    "vendas": [
      {
        "id": "cliente",
        "titulo": "Cadastre seu primeiro cliente",
        "descricao": "Organize todos os seus clientes em um só lugar. Adicione nome, telefone e endereço para facilitar as vendas.",
        "icone": "user",
        "rota": "/clientes",
        "botao_texto": "Cadastrar Cliente",
        "ordem": 1,
        "ativo": true
      },
      {
        "id": "dispositivo",
        "titulo": "Cadastre seu primeiro aparelho",
        "descricao": "Adicione os dispositivos que você tem para vender: celulares, tablets, notebooks e mais.",
        "icone": "smartphone",
        "rota": "/dispositivos",
        "botao_texto": "Cadastrar Aparelho",
        "ordem": 2,
        "ativo": true
      },
      {
        "id": "lucro",
        "titulo": "Visualize seu lucro",
        "descricao": "Acompanhe seus ganhos em tempo real no dashboard financeiro.",
        "icone": "trending-up",
        "rota": "/financeiro",
        "botao_texto": "Ver Lucros",
        "ordem": 3,
        "ativo": true
      }
    ]
  }'::jsonb,
  textos_personalizados jsonb NOT NULL DEFAULT '{
    "titulo_boas_vindas": "Bem-vindo ao MEC App!",
    "subtitulo_boas_vindas": "Vamos configurar o sistema para você em poucos minutos.",
    "titulo_selecao_tipo": "Qual é o seu foco principal?",
    "descricao_assistencia": "Conserto de celulares, tablets, notebooks e outros dispositivos eletrônicos.",
    "descricao_vendas": "Venda de celulares, tablets, notebooks e acessórios usados ou novos.",
    "botao_primeiros_passos": "Primeiros Passos",
    "botao_pular": "Já sei como usar",
    "mensagem_aha_moment": "Parabéns! Você completou o onboarding e está pronto para usar o sistema!",
    "titulo_assistencia": "Assistência Técnica",
    "titulo_vendas": "Venda de Dispositivos"
  }'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.onboarding_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - apenas admins podem ler/escrever
CREATE POLICY "Admins podem ver configuração de onboarding"
  ON public.onboarding_config FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem inserir configuração de onboarding"
  ON public.onboarding_config FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar configuração de onboarding"
  ON public.onboarding_config FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Inserir registro inicial (singleton)
INSERT INTO public.onboarding_config (id) 
VALUES ('00000000-0000-0000-0000-000000000001');

-- Criar view pública para leitura por usuários autenticados (apenas campos necessários)
CREATE VIEW public.onboarding_config_public AS
SELECT 
  ativo,
  publico_alvo,
  mostrar_para_usuarios_ativos,
  config_passos,
  textos_personalizados
FROM public.onboarding_config
LIMIT 1;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_onboarding_config_updated_at
  BEFORE UPDATE ON public.onboarding_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
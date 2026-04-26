-- Criar enum para tipos de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'tecnico', 'vendedor');

-- Criar enum para tipos de produto
CREATE TYPE public.tipo_produto AS ENUM ('produto', 'dispositivo');

-- Criar enum para status de OS
CREATE TYPE public.status_os AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');

-- Criar enum para status de conta
CREATE TYPE public.status_conta AS ENUM ('pendente', 'pago', 'recebido');

-- Criar enum para tipo de conta
CREATE TYPE public.tipo_conta AS ENUM ('pagar', 'receber');

-- Criar enum para formas de pagamento
CREATE TYPE public.forma_pagamento AS ENUM ('dinheiro', 'pix', 'debito', 'credito', 'credito_parcelado');

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de roles de usuário
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Tabela de clientes
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  endereco TEXT,
  cpf TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de dispositivos
CREATE TABLE public.dispositivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  cor TEXT,
  numero_serie TEXT,
  imei TEXT,
  saude_bateria INTEGER,
  capacidade_gb INTEGER,
  garantia BOOLEAN DEFAULT false,
  custo DECIMAL(10, 2),
  preco DECIMAL(10, 2),
  lucro DECIMAL(10, 2) GENERATED ALWAYS AS (preco - custo) STORED,
  vendido BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de produtos
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  sku TEXT,
  quantidade INTEGER DEFAULT 0,
  custo DECIMAL(10, 2),
  preco DECIMAL(10, 2),
  lucro DECIMAL(10, 2) GENERATED ALWAYS AS (preco - custo) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de peças
CREATE TABLE public.pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  custo DECIMAL(10, 2),
  quantidade INTEGER DEFAULT 0,
  preco DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de serviços
CREATE TABLE public.servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  custo DECIMAL(10, 2),
  preco DECIMAL(10, 2),
  peca_id UUID REFERENCES public.pecas(id),
  lucro DECIMAL(10, 2) GENERATED ALWAYS AS (preco - custo) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de ordens de serviço
CREATE TABLE public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_os TEXT NOT NULL UNIQUE,
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  dispositivo_tipo TEXT NOT NULL,
  dispositivo_marca TEXT NOT NULL,
  dispositivo_modelo TEXT NOT NULL,
  dispositivo_cor TEXT,
  dispositivo_numero_serie TEXT,
  dispositivo_imei TEXT,
  defeito_relatado TEXT NOT NULL,
  senha_desbloqueio TEXT,
  avarias JSONB,
  servico_id UUID REFERENCES public.servicos(id),
  status status_os DEFAULT 'pendente',
  total DECIMAL(10, 2),
  forma_pagamento forma_pagamento,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de vendas
CREATE TABLE public.vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id),
  tipo tipo_produto NOT NULL,
  produto_id UUID REFERENCES public.produtos(id),
  dispositivo_id UUID REFERENCES public.dispositivos(id),
  quantidade INTEGER DEFAULT 1,
  total DECIMAL(10, 2) NOT NULL,
  forma_pagamento forma_pagamento NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  data TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de contas
CREATE TABLE public.contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo tipo_conta NOT NULL,
  nome TEXT NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  data DATE NOT NULL,
  recorrente BOOLEAN DEFAULT false,
  status status_conta DEFAULT 'pendente',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pecas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;

-- Função para verificar role do usuário
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies para profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies para user_roles (apenas admins)
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para clientes (todos autenticados)
CREATE POLICY "Authenticated users can view clients" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON public.clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete clients" ON public.clientes FOR DELETE TO authenticated USING (true);

-- RLS Policies para dispositivos
CREATE POLICY "Authenticated users can view devices" ON public.dispositivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert devices" ON public.dispositivos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update devices" ON public.dispositivos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete devices" ON public.dispositivos FOR DELETE TO authenticated USING (true);

-- RLS Policies para produtos
CREATE POLICY "Authenticated users can view products" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert products" ON public.produtos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products" ON public.produtos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete products" ON public.produtos FOR DELETE TO authenticated USING (true);

-- RLS Policies para peças
CREATE POLICY "Authenticated users can view parts" ON public.pecas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert parts" ON public.pecas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update parts" ON public.pecas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete parts" ON public.pecas FOR DELETE TO authenticated USING (true);

-- RLS Policies para serviços
CREATE POLICY "Authenticated users can view services" ON public.servicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert services" ON public.servicos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update services" ON public.servicos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete services" ON public.servicos FOR DELETE TO authenticated USING (true);

-- RLS Policies para ordens de serviço
CREATE POLICY "Authenticated users can view service orders" ON public.ordens_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert service orders" ON public.ordens_servico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update service orders" ON public.ordens_servico FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete service orders" ON public.ordens_servico FOR DELETE TO authenticated USING (true);

-- RLS Policies para vendas
CREATE POLICY "Authenticated users can view sales" ON public.vendas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sales" ON public.vendas FOR INSERT TO authenticated WITH CHECK (true);

-- RLS Policies para contas
CREATE POLICY "Authenticated users can view accounts" ON public.contas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert accounts" ON public.contas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update accounts" ON public.contas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete accounts" ON public.contas FOR DELETE TO authenticated USING (true);

-- Função para criar perfil ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome', new.email),
    new.email
  );
  RETURN new;
END;
$$;

-- Trigger para criar perfil
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ordens_servico_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para gerar número de OS
CREATE OR REPLACE FUNCTION public.generate_os_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM public.ordens_servico;
  new_number := 'OS-' || LPAD(counter::TEXT, 6, '0');
  RETURN new_number;
END;
$$;

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordens_servico;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contas;
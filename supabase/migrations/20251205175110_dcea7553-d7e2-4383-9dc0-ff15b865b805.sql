-- =============================================
-- CORREÇÃO DE SEGURANÇA RLS - TO authenticated
-- =============================================

-- TABELA: clientes (CRÍTICA - dados pessoais)
DROP POLICY IF EXISTS "Users can delete own clients" ON public.clientes;
DROP POLICY IF EXISTS "Users can insert own clients" ON public.clientes;
DROP POLICY IF EXISTS "Users can update own clients" ON public.clientes;
DROP POLICY IF EXISTS "Users can view own clients" ON public.clientes;

CREATE POLICY "Users can view own clients" ON public.clientes
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients" ON public.clientes
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients" ON public.clientes
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients" ON public.clientes
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TABELA: origem_pessoas (CRÍTICA - CPF/CNPJ, RG, documentos)
DROP POLICY IF EXISTS "Users can delete own origem_pessoas" ON public.origem_pessoas;
DROP POLICY IF EXISTS "Users can insert own origem_pessoas" ON public.origem_pessoas;
DROP POLICY IF EXISTS "Users can update own origem_pessoas" ON public.origem_pessoas;
DROP POLICY IF EXISTS "Users can view own origem_pessoas" ON public.origem_pessoas;

CREATE POLICY "Users can view own origem_pessoas" ON public.origem_pessoas
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own origem_pessoas" ON public.origem_pessoas
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own origem_pessoas" ON public.origem_pessoas
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own origem_pessoas" ON public.origem_pessoas
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TABELA: vendas (CRÍTICA - transações financeiras)
DROP POLICY IF EXISTS "Users can insert own sales" ON public.vendas;
DROP POLICY IF EXISTS "Users can view own sales" ON public.vendas;

CREATE POLICY "Users can view own sales" ON public.vendas
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sales" ON public.vendas
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- TABELA: assinaturas (CRÍTICA - dados de pagamento)
DROP POLICY IF EXISTS "Usuários podem ver própria assinatura" ON public.assinaturas;

CREATE POLICY "Usuários podem ver própria assinatura" ON public.assinaturas
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- TABELA: configuracoes_loja (ALTA - CNPJ, dados empresa)
DROP POLICY IF EXISTS "Users can delete own store config" ON public.configuracoes_loja;
DROP POLICY IF EXISTS "Users can insert own store config" ON public.configuracoes_loja;
DROP POLICY IF EXISTS "Users can update own store config" ON public.configuracoes_loja;
DROP POLICY IF EXISTS "Users can view own store config" ON public.configuracoes_loja;

CREATE POLICY "Users can view own store config" ON public.configuracoes_loja
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own store config" ON public.configuracoes_loja
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own store config" ON public.configuracoes_loja
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own store config" ON public.configuracoes_loja
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TABELA: contas (ALTA - informações financeiras)
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.contas;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.contas;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.contas;
DROP POLICY IF EXISTS "Users can view own accounts" ON public.contas;

CREATE POLICY "Users can view own accounts" ON public.contas
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON public.contas
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON public.contas
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON public.contas
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TABELA: ordens_servico (ALTA - dados de clientes)
DROP POLICY IF EXISTS "Users can delete own service orders" ON public.ordens_servico;
DROP POLICY IF EXISTS "Users can insert own service orders" ON public.ordens_servico;
DROP POLICY IF EXISTS "Users can update own service orders" ON public.ordens_servico;
DROP POLICY IF EXISTS "Users can view own service orders" ON public.ordens_servico;

CREATE POLICY "Users can view own service orders" ON public.ordens_servico
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own service orders" ON public.ordens_servico
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own service orders" ON public.ordens_servico
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own service orders" ON public.ordens_servico
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TABELA: compras_dispositivos (ALTA - valores e documentos)
DROP POLICY IF EXISTS "Users can delete own compras" ON public.compras_dispositivos;
DROP POLICY IF EXISTS "Users can insert own compras" ON public.compras_dispositivos;
DROP POLICY IF EXISTS "Users can update own compras" ON public.compras_dispositivos;
DROP POLICY IF EXISTS "Users can view own compras" ON public.compras_dispositivos;

CREATE POLICY "Users can view own compras" ON public.compras_dispositivos
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own compras" ON public.compras_dispositivos
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own compras" ON public.compras_dispositivos
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own compras" ON public.compras_dispositivos
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TABELA: dispositivos (MÉDIA - IMEI, seriais)
DROP POLICY IF EXISTS "Users can delete own devices" ON public.dispositivos;
DROP POLICY IF EXISTS "Users can insert own devices" ON public.dispositivos;
DROP POLICY IF EXISTS "Users can update own devices" ON public.dispositivos;
DROP POLICY IF EXISTS "Users can view own devices" ON public.dispositivos;

CREATE POLICY "Users can view own devices" ON public.dispositivos
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices" ON public.dispositivos
FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id) AND can_insert_device(auth.uid()));

CREATE POLICY "Users can update own devices" ON public.dispositivos
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices" ON public.dispositivos
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TABELA: produtos (MÉDIA - inventário)
DROP POLICY IF EXISTS "Users can delete own products" ON public.produtos;
DROP POLICY IF EXISTS "Users can insert own products" ON public.produtos;
DROP POLICY IF EXISTS "Users can update own products" ON public.produtos;
DROP POLICY IF EXISTS "Users can view own products" ON public.produtos;

CREATE POLICY "Users can view own products" ON public.produtos
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products" ON public.produtos
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products" ON public.produtos
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own products" ON public.produtos
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TABELA: pecas (MÉDIA - inventário)
DROP POLICY IF EXISTS "Users can delete own parts" ON public.pecas;
DROP POLICY IF EXISTS "Users can insert own parts" ON public.pecas;
DROP POLICY IF EXISTS "Users can update own parts" ON public.pecas;
DROP POLICY IF EXISTS "Users can view own parts" ON public.pecas;

CREATE POLICY "Users can view own parts" ON public.pecas
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parts" ON public.pecas
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own parts" ON public.pecas
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own parts" ON public.pecas
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TABELA: servicos (MÉDIA - preços)
DROP POLICY IF EXISTS "Users can delete own services" ON public.servicos;
DROP POLICY IF EXISTS "Users can insert own services" ON public.servicos;
DROP POLICY IF EXISTS "Users can update own services" ON public.servicos;
DROP POLICY IF EXISTS "Users can view own services" ON public.servicos;

CREATE POLICY "Users can view own services" ON public.servicos
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own services" ON public.servicos
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own services" ON public.servicos
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own services" ON public.servicos
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TABELA: fornecedores (MÉDIA - dados comerciais)
DROP POLICY IF EXISTS "Users can delete own suppliers" ON public.fornecedores;
DROP POLICY IF EXISTS "Users can insert own suppliers" ON public.fornecedores;
DROP POLICY IF EXISTS "Users can update own suppliers" ON public.fornecedores;
DROP POLICY IF EXISTS "Users can view own suppliers" ON public.fornecedores;

CREATE POLICY "Users can view own suppliers" ON public.fornecedores
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own suppliers" ON public.fornecedores
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suppliers" ON public.fornecedores
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own suppliers" ON public.fornecedores
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TABELA: cupons (MÉDIA - códigos promocionais)
DROP POLICY IF EXISTS "Users can delete own coupons" ON public.cupons;
DROP POLICY IF EXISTS "Users can insert own coupons" ON public.cupons;
DROP POLICY IF EXISTS "Users can update own coupons" ON public.cupons;
DROP POLICY IF EXISTS "Users can view own coupons" ON public.cupons;

CREATE POLICY "Users can view own coupons" ON public.cupons
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coupons" ON public.cupons
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own coupons" ON public.cupons
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own coupons" ON public.cupons
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TABELA: profiles (dados do usuário)
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile" ON public.profiles
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TABELA: user_roles (admin)
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert roles" ON public.user_roles
FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles" ON public.user_roles
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles" ON public.user_roles
FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- TABELA: vendas_cupons (SELECT autenticado, INSERT sistema)
DROP POLICY IF EXISTS "System can insert coupon usage" ON public.vendas_cupons;
DROP POLICY IF EXISTS "Users can view own coupon usage" ON public.vendas_cupons;

CREATE POLICY "Users can view own coupon usage" ON public.vendas_cupons
FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM vendas WHERE vendas.id = vendas_cupons.venda_id AND vendas.user_id = auth.uid()));

CREATE POLICY "System can insert coupon usage" ON public.vendas_cupons
FOR INSERT TO authenticated WITH CHECK (true);

-- TABELA: kirvano_eventos (SELECT admin, INSERT sistema via webhook)
DROP POLICY IF EXISTS "Admins can view kirvano events" ON public.kirvano_eventos;
DROP POLICY IF EXISTS "Sistema pode inserir eventos Kirvano" ON public.kirvano_eventos;

CREATE POLICY "Admins can view kirvano events" ON public.kirvano_eventos
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- INSERT para kirvano_eventos precisa ser público para webhook funcionar
CREATE POLICY "Sistema pode inserir eventos Kirvano" ON public.kirvano_eventos
FOR INSERT TO public WITH CHECK (true);
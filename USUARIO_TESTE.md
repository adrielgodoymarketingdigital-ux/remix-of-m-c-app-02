# Usuário de Teste - Zak360 App

## Credenciais do Usuário Teste

**Email:** `teste@zak360.com`  
**Senha:** `Admin@123456`  
**Plano:** Admin (acesso total e ilimitado)

---

## Como Criar o Usuário de Teste

### Opção 1: Via Interface do Supabase (Recomendado)

1. Acesse o Lovable Cloud > Authentication
2. Clique em "Adicionar Usuário"
3. Preencha:
   - Email: `teste@zak360.com`
   - Senha: `Admin@123456`
   - Nome: `Usuário Teste Admin`
4. Clique em "Criar Usuário"
5. Após criar, execute o SQL abaixo para atribuir o plano admin

### Opção 2: Via SQL Completo

Execute o seguinte SQL no Lovable Cloud:

```sql
-- 1. Primeiro, crie o usuário manualmente via interface do Supabase Auth
-- Email: teste@zak360.com
-- Senha: Admin@123456

-- 2. Depois de criar o usuário, execute este SQL para atribuir o plano admin:

-- Atualizar ou criar assinatura admin para o usuário teste
INSERT INTO public.assinaturas (
  user_id,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  plano_tipo,
  status,
  data_inicio,
  data_proxima_cobranca
)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'teste@zak360.com'),
  'test_admin_customer',
  'sub_test_admin',
  'price_test_admin',
  'admin',
  'active',
  NOW(),
  NOW() + INTERVAL '100 years'
)
ON CONFLICT (user_id) DO UPDATE SET
  plano_tipo = 'admin',
  status = 'active',
  data_proxima_cobranca = NOW() + INTERVAL '100 years';
```

---

## Verificar se o Usuário foi Criado Corretamente

Execute este SQL para verificar:

```sql
-- Verificar usuário
SELECT 
  u.id,
  u.email,
  a.plano_tipo,
  a.status,
  a.data_proxima_cobranca
FROM auth.users u
LEFT JOIN public.assinaturas a ON u.id = a.user_id
WHERE u.email = 'teste@zak360.com';
```

**Resultado esperado:**
- Email: `teste@zak360.com`
- Plano: `admin`
- Status: `active`
- Data próxima cobrança: data distante no futuro (100 anos)

---

## Recursos do Plano Admin

O plano admin tem **acesso total e ilimitado** a todos os recursos:

### ✅ Limites Ilimitados
- **Dispositivos:** ∞ (ilimitado)
- **Usuários:** ∞ (ilimitado)
- **Armazenamento:** ∞ (ilimitado)

### ✅ Todos os Módulos
- ✅ Dashboard
- ✅ PDV (Ponto de Venda)
- ✅ Produtos e Peças
- ✅ Dispositivos
- ✅ Vendas
- ✅ Ordem de Serviço
- ✅ Fornecedores
- ✅ Clientes
- ✅ Contas a Pagar/Receber
- ✅ Financeiro
- ✅ Configurações
- ✅ Serviços

### ✅ Recursos Premium
- ✅ Consulta IMEI
- ✅ Verificação de Garantia Apple
- ✅ Suporte Prioritário

---

## Testando o Usuário

1. **Faça logout** se estiver logado
2. **Faça login** com:
   - Email: `teste@zak360.com`
   - Senha: `Admin@123456`
3. **Verifique**:
   - Todos os menus estão visíveis na sidebar
   - Não há limites de cadastro de dispositivos
   - A página de planos mostra "Ilimitado" no contador
4. **Teste cadastros**:
   - Cadastre 100+ dispositivos sem restrição
   - Acesse todos os módulos
   - Crie ordens de serviço
   - Adicione produtos e serviços

---

## ⚠️ Avisos de Segurança

### Em Desenvolvimento
✅ Pode usar livremente o usuário teste

### Em Produção
⚠️ **CUIDADO:**
- Troque a senha regularmente
- Considere desabilitar após testes
- Não compartilhe as credenciais publicamente
- Considere adicionar flag `is_test_user` para bloqueio em produção

### Boas Práticas
- Use apenas em ambiente de desenvolvimento
- Se necessário em produção, use senha muito forte
- Considere criar ambiente de staging separado
- Documente todos os testes realizados

---

## Remover Usuário de Teste

Para remover o usuário de teste após os testes:

```sql
-- 1. Remover assinatura
DELETE FROM public.assinaturas 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'teste@zak360.com');

-- 2. Remover dados relacionados (opcional)
DELETE FROM public.dispositivos 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'teste@zak360.com');

DELETE FROM public.clientes 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'teste@zak360.com');

-- (adicione outras tabelas conforme necessário)

-- 3. Remover usuário (via interface do Supabase Auth é mais seguro)
-- Ou use: DELETE FROM auth.users WHERE email = 'teste@zak360.com';
```

---

## Troubleshooting

### Problema: Usuário criado mas plano não aparece
**Solução:** Execute novamente o SQL de criação da assinatura (seção Opção 2, passo 2)

### Problema: Não consigo fazer login
**Solução:** Verifique se o email foi confirmado automaticamente ou confirme manualmente

### Problema: Limites ainda aparecem
**Solução:** 
1. Faça logout e login novamente
2. Verifique se o plano_tipo está como 'admin' no banco
3. Limpe o cache do navegador

### Problema: Não vejo todos os módulos
**Solução:** Verifique se o arquivo `src/types/assinatura.ts` tem o tipo 'admin' configurado corretamente

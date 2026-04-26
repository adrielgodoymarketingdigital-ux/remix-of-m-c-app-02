# 🧪 Guia de Teste da Integração Stripe

## 📋 Pré-requisitos

Antes de começar os testes, certifique-se de que:

1. ✅ O webhook do Stripe está configurado no dashboard
2. ✅ O `STRIPE_WEBHOOK_SECRET` está configurado nos secrets do Supabase
3. ✅ O `STRIPE_SECRET_KEY` está configurado nos secrets do Supabase
4. ✅ Você tem uma conta de teste no Stripe

---

## 🎯 Como Testar o Fluxo Completo

### Opção 1: Usando a Página de Teste (Recomendado)

1. **Acesse a página de teste**:
   ```
   https://seu-dominio.com/admin/stripe/teste
   ```

2. **Verifique o status atual**:
   - A seção "Status da Assinatura" mostra o estado atual
   - Anote o `user_id` e `plano_tipo` atual

3. **Teste um plano**:
   - Escolha um dos planos na seção "Testar Checkout de Planos"
   - Clique em "Testar Checkout"
   - Você será redirecionado para o Stripe Checkout

4. **Use um cartão de teste**:
   ```
   Número: 4242 4242 4242 4242
   CVV: Qualquer 3 dígitos (ex: 123)
   Data: Qualquer data futura (ex: 12/25)
   ```

5. **Complete o pagamento**:
   - Preencha os dados solicitados
   - Clique em "Assinar"

6. **Verifique a atualização**:
   - Você será redirecionado para `/plano?success=true`
   - O sistema fará polling automático por 30 segundos
   - Ou clique em "Atualizar Status" manualmente
   - Volte para `/admin/stripe/teste` para ver o histórico

### Opção 2: Usando a Página de Planos Normal

1. **Acesse a página de planos**:
   ```
   https://seu-dominio.com/plano
   ```

2. **Escolha um plano e clique em "Fazer Upgrade"**

3. **Siga os mesmos passos 4-6 da Opção 1**

---

## 🔍 Verificando se Funcionou

### 1. No Sistema

Acesse `/admin/stripe/teste` e verifique:

- ✅ **Status da Assinatura**: Deve mostrar `active`
- ✅ **Plano**: Deve mostrar o plano que você escolheu
- ✅ **Customer ID**: Deve ter um ID válido do Stripe
- ✅ **Subscription ID**: Deve ter um ID válido do Stripe
- ✅ **Histórico**: Deve mostrar a atualização recente

### 2. No Banco de Dados

```sql
SELECT * FROM assinaturas WHERE user_id = 'SEU_USER_ID';
```

Verifique se:
- ✅ `plano_tipo` está correto
- ✅ `status` é `active`
- ✅ `stripe_customer_id` está preenchido
- ✅ `stripe_subscription_id` está preenchido
- ✅ `stripe_price_id` está correto
- ✅ `data_proxima_cobranca` está no futuro

### 3. Nos Logs do Webhook

Acesse o Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs

Você deve ver logs como:
```
✅ Webhook recebido
✅ Signature encontrada
✅ Evento validado: checkout.session.completed
✅ Assinatura criada/atualizada com sucesso
```

### 4. No Dashboard do Stripe

1. Acesse https://dashboard.stripe.com/test/payments
2. Você deve ver o pagamento recente
3. Clique no pagamento para ver os detalhes
4. Verifique se o `metadata` contém `user_id` e `plano_tipo`

---

## 🐛 Troubleshooting

### Problema: O plano não atualiza após o pagamento

**Possíveis causas**:

1. **Webhook não está configurado**
   - Verifique se o webhook está ativo no Stripe Dashboard
   - URL: `https://cmcmliokvmnahcazavwv.supabase.co/functions/v1/stripe-webhook`

2. **Eventos não selecionados**
   - Certifique-se de que estes eventos estão marcados:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`

3. **Secret do webhook incorreto**
   - Verifique se `STRIPE_WEBHOOK_SECRET` está correto
   - Copie o secret do webhook no Stripe Dashboard

4. **Erro no webhook**
   - Verifique os logs do Edge Function
   - Procure por erros ou avisos
   - Veja a seção "Informações de Debug" na página de teste

### Problema: Erro ao abrir o checkout

**Solução**:
- Verifique se `STRIPE_SECRET_KEY` está configurado
- Verifique os logs do Edge Function `create-checkout-session`
- Certifique-se de que o price ID existe no Stripe

### Problema: Webhook retorna erro 400

**Solução**:
- O signature está inválido
- Verifique se o `STRIPE_WEBHOOK_SECRET` está correto
- Recrie o webhook no Stripe e atualize o secret

---

## 📊 Logs Detalhados

Para ver logs detalhados do webhook:

1. **Via Supabase Dashboard**:
   - Edge Functions → `stripe-webhook` → Logs
   - Filtre por "STRIPE WEBHOOK" para ver apenas logs relevantes

2. **Via Código**:
   - Todos os logs têm emojis para facilitar a identificação:
     - 🎯 = Webhook recebido
     - ✅ = Sucesso
     - ❌ = Erro
     - ⚠️ = Aviso
     - 🔍 = Buscando dados
     - 💾 = Salvando no banco

---

## 🧪 Testando Diferentes Cenários

### Teste 1: Nova Assinatura (Upgrade)
1. Usuário sem plano → Assina Plano Básico
2. Verificar: `plano_tipo = basico_mensal` e `status = active`

### Teste 2: Upgrade de Plano
1. Usuário com Plano Básico → Assina Plano Intermediário
2. Verificar: `plano_tipo = intermediario_mensal` e `status = active`

### Teste 3: Falha de Pagamento
1. Use o cartão de teste para falha: `4000 0000 0000 0341`
2. Verificar: `status = past_due` e `plano_tipo = demonstracao`

### Teste 4: Cancelamento
1. Cancele a assinatura no Stripe Dashboard
2. Verificar: `status = canceled` e `plano_tipo = demonstracao`

---

## 📞 Suporte

Se algo não funcionar:

1. ✅ Verifique os logs do webhook
2. ✅ Verifique a configuração no Stripe Dashboard
3. ✅ Verifique os secrets do Supabase
4. ✅ Use a página `/admin/stripe/teste` para debug
5. ✅ Verifique o histórico de atualizações

---

## 🔐 Segurança

**IMPORTANTE**: Esta página de teste (`/admin/stripe/teste`) deve ser protegida em produção!

Adicione autenticação/autorização para permitir apenas usuários admin:

```typescript
// Exemplo de proteção (implementar no componente)
const { data: { user } } = await supabase.auth.getUser();
const isAdmin = user?.email?.endsWith('@suaempresa.com');

if (!isAdmin) {
  return <Navigate to="/dashboard" />;
}
```

---

## ✅ Checklist de Teste Completo

Antes de considerar a integração como funcionando, teste:

- [ ] Criar nova assinatura (upgrade do plano demonstração)
- [ ] Fazer upgrade de plano
- [ ] Verificar atualização em tempo real após pagamento
- [ ] Verificar dados no banco de dados
- [ ] Verificar logs do webhook
- [ ] Verificar dados no Stripe Dashboard
- [ ] Testar falha de pagamento
- [ ] Testar cancelamento de assinatura
- [ ] Verificar que plano reverte para demonstração após cancelamento

---

## 📖 Documentação Relacionada

- [Documentação Stripe](https://stripe.com/docs)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Cartões de Teste](https://stripe.com/docs/testing)

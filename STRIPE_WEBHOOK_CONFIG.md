# 🔧 Guia de Configuração do Webhook do Stripe

## 📋 Visão Geral

Este guia fornece instruções passo a passo para configurar corretamente o webhook do Stripe no seu projeto. **Esta configuração é CRÍTICA** para que os pagamentos sejam processados e os planos dos usuários sejam atualizados automaticamente.

---

## ⚠️ IMPORTÂNCIA CRÍTICA

**SEM O WEBHOOK CONFIGURADO:**
- ❌ Pagamentos não atualizam o plano do usuário
- ❌ Cliente paga mas continua no plano demonstração
- ❌ Funcionalidades premium não são liberadas
- ❌ Sistema não recebe notificações do Stripe
- ❌ Reembolsos não revertem o plano automaticamente

**COM O WEBHOOK CONFIGURADO:**
- ✅ Pagamentos atualizam automaticamente o plano
- ✅ Cliente recebe acesso imediato às funcionalidades
- ✅ Sistema sincroniza em tempo real com o Stripe
- ✅ Downgrades e cancelamentos funcionam corretamente
- ✅ Reembolsos revertem automaticamente para plano demonstração
- ✅ Disputas/chargebacks suspendem acesso imediatamente

---

## 🚀 PASSO A PASSO

### 1️⃣ Acessar o Stripe Dashboard

1. Acesse: https://dashboard.stripe.com
2. Faça login com sua conta Stripe
3. **IMPORTANTE**: Se você tem múltiplas contas, certifique-se de estar na conta correta

### 2️⃣ Navegar para Webhooks

1. No menu lateral, clique em **"Developers"** (Desenvolvedores)
2. Clique em **"Webhooks"**
3. Clique no botão **"Add endpoint"** (Adicionar endpoint)

### 3️⃣ Configurar o Endpoint

**URL do Webhook:**
```
https://cmcmliokvmnahcazavwv.supabase.co/functions/v1/stripe-webhook
```

**Descrição (opcional):**
```
Webhook para atualização de assinaturas - Zak360 App
```

### 4️⃣ Selecionar Eventos

**CRÍTICO**: Você DEVE selecionar exatamente estes **7 eventos**:

#### Eventos de Pagamento e Assinatura:

1. **`checkout.session.completed`**
   - Quando o pagamento é confirmado
   - Cria/atualiza a assinatura no sistema

2. **`customer.subscription.updated`**
   - Quando o plano é modificado (upgrade/downgrade)
   - Quando a assinatura é renovada

3. **`customer.subscription.deleted`**
   - Quando a assinatura é cancelada
   - Remove acesso às funcionalidades premium

4. **`invoice.payment_failed`**
   - Quando o pagamento falha
   - Reverte o usuário para o plano demonstração

#### Eventos de Reembolso: ⭐ NOVOS

5. **`charge.refunded`**
   - Quando um reembolso é processado na cobrança
   - Reverte automaticamente para plano demonstração

6. **`charge.dispute.created`**
   - Quando uma disputa/chargeback é aberta
   - Suspende acesso imediatamente por segurança

7. **`refund.created`**
   - Quando um reembolso é criado via API
   - Reverte automaticamente para plano demonstração

**Como selecionar:**
- Clique em **"Select events to listen to"**
- Use a busca para encontrar cada evento
- Marque a checkbox de cada um dos **7 eventos** acima
- Confirme que todos estão selecionados

### 5️⃣ Copiar o Signing Secret

1. Após criar o webhook, você verá uma página de detalhes
2. Procure por **"Signing secret"** (começa com `whsec_...`)
3. Clique em **"Reveal"** para mostrar o secret
4. Clique em **"Copy"** para copiar

### 6️⃣ Verificar Secret no Lovable Cloud

1. O secret `STRIPE_WEBHOOK_SECRET` já deve estar configurado
2. Se não estiver, adicione usando as ferramentas do Lovable Cloud
3. O valor deve ser exatamente o signing secret copiado no passo anterior

### 7️⃣ Testar o Webhook

1. Na página do webhook no Stripe Dashboard
2. Clique em **"Send test webhook"**
3. Selecione o evento **`checkout.session.completed`**
4. Clique em **"Send test webhook"**
5. Você deve ver uma resposta HTTP **200 OK**

---

## ✅ CHECKLIST DE VALIDAÇÃO

Use este checklist para garantir que tudo está configurado corretamente:

- [ ] Webhook criado no Stripe Dashboard
- [ ] URL correta: `https://cmcmliokvmnahcazavwv.supabase.co/functions/v1/stripe-webhook`
- [ ] **7 eventos selecionados:**
  - [ ] `checkout.session.completed`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_failed`
  - [ ] `charge.refunded` ⭐
  - [ ] `charge.dispute.created` ⭐
  - [ ] `refund.created` ⭐
- [ ] Signing secret copiado
- [ ] Secret `STRIPE_WEBHOOK_SECRET` configurado no Lovable Cloud
- [ ] Teste de webhook enviado com sucesso (HTTP 200)
- [ ] Logs da Edge Function mostram eventos sendo recebidos

---

## 🧪 TESTANDO A INTEGRAÇÃO COMPLETA

Após configurar o webhook, teste o fluxo completo:

### Teste 1: Nova Assinatura

1. Acesse a página de planos: `/plano`
2. Clique em "Assinar" em qualquer plano
3. Use um cartão de teste do Stripe:
   - **Número**: `4242 4242 4242 4242`
   - **Validade**: Qualquer data futura (ex: `12/34`)
   - **CVC**: Qualquer 3 dígitos (ex: `123`)
   - **CEP**: Qualquer CEP válido (ex: `12345`)
4. Complete o pagamento
5. Aguarde redirecionamento para `/obrigado`
6. **Verificar**:
   - Página mostra "Pagamento Realizado com Sucesso"
   - Após alguns segundos, plano é atualizado
   - Menu "Plano" mostra o plano correto
   - Funcionalidades premium são liberadas

### Teste 2: Reembolso ⭐ NOVO

1. Vá para o Stripe Dashboard → **Payments**
2. Encontre o pagamento de teste
3. Clique no pagamento → **"Refund"**
4. Confirme o reembolso
5. **Verificar**:
   - Logs mostram `💸 REEMBOLSO DETECTADO`
   - Plano do usuário volta para `demonstracao`
   - Status da assinatura muda para `canceled`

### Teste 3: Verificar Logs

1. Acesse os logs da Edge Function `stripe-webhook`
2. **Deve mostrar** para reembolsos:
   ```
   📩 Evento recebido: charge.refunded
   💸 REEMBOLSO DETECTADO - {"chargeId":"ch_...","refundedAmount":"99.90 BRL"...}
   ✅ Assinatura revertida para demonstração após reembolso
   ```

### Teste 4: Verificar Banco de Dados

Execute esta query no Lovable Cloud (Database):

```sql
SELECT 
  user_id,
  plano_tipo,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  data_inicio,
  created_at,
  updated_at
FROM assinaturas
ORDER BY updated_at DESC
LIMIT 5;
```

**Deve mostrar após reembolso**:
- `plano_tipo` = "demonstracao"
- `status` = "canceled"
- `updated_at` recente

---

## 🐛 TROUBLESHOOTING

### Problema: Webhook retorna erro 400

**Causa**: Signing secret incorreto

**Solução**:
1. Vá para o Stripe Dashboard → Webhooks
2. Clique no webhook criado
3. Copie o signing secret novamente
4. Atualize o secret `STRIPE_WEBHOOK_SECRET` no Lovable Cloud
5. Teste novamente

### Problema: Webhook não é chamado

**Causa**: URL do webhook incorreta ou eventos não selecionados

**Solução**:
1. Verifique se a URL está exatamente assim:
   ```
   https://cmcmliokvmnahcazavwv.supabase.co/functions/v1/stripe-webhook
   ```
2. Verifique se os **7 eventos** estão marcados:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `charge.refunded`
   - `charge.dispute.created`
   - `refund.created`
3. Envie um teste pelo Stripe Dashboard
4. Verifique os logs da Edge Function

### Problema: Plano não atualiza após pagamento

**Causa Possível 1**: Webhook não configurado
- **Solução**: Siga os passos 1-7 acima

**Causa Possível 2**: Evento `checkout.session.completed` não selecionado
- **Solução**: Edite o webhook e adicione o evento

**Causa Possível 3**: Erro no processamento do webhook
- **Solução**: Verifique os logs da Edge Function `stripe-webhook`
- Procure por linhas com "❌" ou "ERROR"
- Se encontrar erros, corrija e reenvie o teste

### Problema: Reembolso não reverte o plano ⭐ NOVO

**Causa Possível 1**: Evento `charge.refunded` não configurado
- **Solução**: Adicione o evento no Stripe Dashboard

**Causa Possível 2**: Assinatura não encontrada
- **Solução**: Verifique os logs - o sistema tenta:
  1. Buscar por `customer_id`
  2. Buscar por `email` como fallback
- Se não encontrar de nenhuma forma, verifique os dados no banco

### Problema: Timeout ao verificar plano

**Causa**: Webhook está demorando para processar

**Solução**:
1. Aguarde 2-3 minutos
2. Clique em "Verificar Agora" na página `/obrigado`
3. Ou vá para `/plano` e clique em "Atualizar Status"
4. Se ainda não atualizar, verifique logs do webhook

---

## 📊 MONITORAMENTO

### Verificar Eventos Recebidos

No Stripe Dashboard:
1. Vá para **Developers** → **Webhooks**
2. Clique no webhook configurado
3. Role até **"Event logs"**
4. Veja todos os eventos enviados e suas respostas

**O que verificar:**
- ✅ Status HTTP 200 = Sucesso
- ⚠️ Status HTTP 400 = Erro de autenticação (secret incorreto)
- ❌ Status HTTP 500 = Erro no processamento

### Verificar Logs da Edge Function

No Lovable Cloud:
1. Acesse a aba **"Edge Functions"**
2. Clique em **"stripe-webhook"**
3. Veja os logs em tempo real

**Logs esperados para pagamentos:**
```
📩 Evento recebido: checkout.session.completed
🔥 Checkout completed
📝 Plano identificado - {"planoTipo":"basico_mensal"}
✅ Assinatura registrada e atualizada
```

**Logs esperados para reembolsos:**
```
📩 Evento recebido: charge.refunded
💸 REEMBOLSO DETECTADO - {"chargeId":"ch_...","refundedAmount":"99.90 BRL"...}
🔍 Buscando assinatura - {"customerId":"cus_..."}
✅ Assinatura revertida para demonstração após reembolso
```

---

## 🔐 SEGURANÇA

### Validação de Assinatura

O webhook SEMPRE valida a assinatura usando o signing secret:

```typescript
const signature = req.headers.get("stripe-signature");
const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
```

**Isso garante:**
- ✅ Eventos vêm do Stripe (não são falsificados)
- ✅ Conteúdo não foi modificado em trânsito
- ✅ Proteção contra ataques man-in-the-middle

### Boas Práticas

1. **NUNCA** compartilhe o signing secret publicamente
2. **NUNCA** commit o signing secret no código
3. **SEMPRE** use variáveis de ambiente (secrets do Lovable Cloud)
4. **SEMPRE** verifique os logs do webhook regularmente
5. **SEMPRE** teste após fazer mudanças no webhook

---

## 📝 RESUMO DOS EVENTOS

| Evento | Ação no Sistema |
|--------|-----------------|
| `checkout.session.completed` | Ativa plano pago |
| `customer.subscription.updated` | Atualiza plano (upgrade/downgrade) |
| `customer.subscription.deleted` | Reverte para demonstração |
| `invoice.payment_failed` | Reverte para demonstração |
| `charge.refunded` | Reverte para demonstração |
| `charge.dispute.created` | Suspende acesso (demonstração) |
| `refund.created` | Reverte para demonstração |

---

## 📞 SUPORTE

Se ainda tiver problemas após seguir este guia:

1. Verifique a documentação oficial do Stripe: https://stripe.com/docs/webhooks
2. Use a página de teste: `/admin/stripe/teste`
3. Verifique os logs da Edge Function
4. Entre em contato com o suporte técnico

---

## 📝 NOTAS IMPORTANTES

- O webhook funciona tanto em **modo de teste** quanto em **modo de produção**
- Use cartões de teste do Stripe para não fazer cobranças reais
- Em produção, use uma chave API e webhook secret de produção
- Mantenha os secrets sempre atualizados
- Monitore os logs regularmente para detectar problemas

---

**Última atualização**: Dezembro 2024
**Versão do guia**: 2.0 (Adicionado suporte a reembolsos)

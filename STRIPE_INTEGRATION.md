# 💳 Integração Stripe - Zak360 App

## 📋 Visão Geral

Esta integração permite a gestão completa de assinaturas de planos usando o Stripe como processador de pagamentos. O sistema suporta:

- ✅ Múltiplos planos (Básico, Intermediário, Profissional)
- ✅ Pagamentos mensais e anuais
- ✅ **Suporte a cupons de desconto** 🆕
- ✅ Upgrades e downgrades automáticos
- ✅ Renovação automática
- ✅ Gerenciamento via webhook
- ✅ Rastreamento de descontos aplicados 🆕

---

## 🎫 NOVO: Suporte a Cupons

### Como Funciona

O sistema agora suporta cupons de desconto que podem ser aplicados no checkout do Stripe:

1. **Cupons Nativos do Stripe**: Use o Stripe Dashboard para criar cupons
2. **Campo no Checkout**: Cliente pode inserir código do cupom na página de planos
3. **Aplicação Automática**: Cupom é validado e aplicado automaticamente pelo Stripe
4. **Rastreamento**: Sistema registra qual cupom foi usado e o valor do desconto

### Como Criar Cupons no Stripe

1. Acesse: https://dashboard.stripe.com/coupons
2. Clique em "Create coupon"
3. Configure:
   - **Nome/ID**: Ex: "BLACK_FRIDAY_2024" (este é o código que o cliente digitará)
   - **Tipo**: Percentual ou Valor Fixo
   - **Valor**: Ex: 20% ou R$50
   - **Duração**: Once (uma vez), Forever (para sempre), ou Repeating (repetir N meses)
   - **Restrições**: Valor mínimo, uso máximo, data de expiração, etc.
4. Salve e copie o código do cupom
5. Cliente poderá digitar este código na página de planos

### Dados Salvos no Banco

Quando um cupom é usado, o sistema salva automaticamente na tabela `assinaturas`:
- `cupom_stripe_id`: ID do cupom no Stripe (ex: "BLACK_FRIDAY_2024")
- `valor_desconto`: Valor total do desconto em reais (ex: 50.00)

---

## 🔧 Configuração Inicial

### 1. Secrets Configurados

Os seguintes secrets já estão configurados no Lovable Cloud:

- `STRIPE_SECRET_KEY`: Chave secreta da API Stripe
- `STRIPE_WEBHOOK_SECRET`: Secret para validação de webhooks (começa com `whsec_`)

### 2. Edge Functions Deployadas

Duas edge functions foram criadas:

#### `create-checkout-session`
- **Rota**: `/functions/v1/create-checkout-session`
- **Método**: POST
- **Autenticação**: JWT requerido
- **Função**: Cria uma sessão de checkout no Stripe
- **Parâmetros**:
  - `priceId`: ID do preço no Stripe
  - `planoTipo`: Tipo do plano interno
  - `cupomCodigo` (opcional): Código do cupom fornecido pelo usuário

#### `stripe-webhook`
- **Rota**: `/functions/v1/stripe-webhook`
- **Método**: POST
- **Autenticação**: Webhook signature
- **Função**: Processa eventos do Stripe (pagamentos, cancelamentos, upgrades, etc.)
- **Eventos processados**:
  - `checkout.session.completed`: Novo pagamento confirmado
  - `customer.subscription.updated`: Assinatura modificada
  - `customer.subscription.deleted`: Assinatura cancelada
  - `invoice.payment_failed`: Pagamento falhou

---

## ⚠️ CONFIGURAÇÃO CRÍTICA DO WEBHOOK

**ATENÇÃO**: O webhook DEVE estar configurado para que os pagamentos atualizem o plano dos usuários.

### Passo a Passo Rápido

1. **Acesse**: https://dashboard.stripe.com/webhooks
2. **Clique em**: "Add endpoint"
3. **URL**: `https://cmcmliokvmnahcazavwv.supabase.co/functions/v1/stripe-webhook`
4. **Selecione os eventos**:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_failed`
5. **Copie o Signing Secret** (começa com `whsec_...`)
6. **Verifique** se o secret `STRIPE_WEBHOOK_SECRET` está configurado
7. **Teste** enviando um evento de teste pelo Stripe Dashboard

### Guia Detalhado

Para instruções completas com screenshots e troubleshooting, veja:
📖 **[STRIPE_WEBHOOK_CONFIG.md](./STRIPE_WEBHOOK_CONFIG.md)**

---

## 💳 Planos e Preços do Stripe

### IDs dos Planos

Os seguintes price IDs estão configurados:

| Plano | Price ID | Valor |
|-------|----------|-------|
| Básico Mensal | `price_1SSF2wCjA5c0MuV84L3o7lkK` | R$ 29,90/mês |
| Intermediário Mensal | `price_1SSF5yCjA5c0MuV8k1swhQCK` | R$ 49,90/mês |
| Profissional Mensal | `price_1SSF8aCjA5c0MuV8Ff60Tg0H` | R$ 99,90/mês |
| Básico Anual | `price_1SSFBaCjA5c0MuV8dPesDigv` | R$ 260,00/ano |
| Intermediário Anual | `price_1SSFE6CjA5c0MuV8wQcFYhHf` | R$ 510,00/ano |
| Profissional Anual | `price_1SSFGSCjA5c0MuV8tQE82qGs` | R$ 960,00/ano |

---

## 🔄 Fluxo de Pagamento

### 1. Usuário Seleciona Plano e Cupom (Opcional)

```typescript
// src/pages/Plano.tsx
const [cupomCodigo, setCupomCodigo] = useState("");

<Input
  placeholder="Código do cupom (opcional)"
  value={cupomCodigo}
  onChange={(e) => setCupomCodigo(e.target.value)}
/>

<BotaoAssinatura 
  planoKey="basico_mensal"
  onSubscribe={(planoKey) => handleSubscribe(planoKey, cupomCodigo)}
/>
```

### 2. Redirecionamento para Checkout

```typescript
// src/hooks/useAssinatura.ts
const abrirPaginaPagamento = async (planoKey: string, cupomCodigo?: string) => {
  // Dispara evento Meta Pixel
  window.fbq('track', 'InitiateCheckout', {...});
  
  // Chama edge function para criar checkout session
  const { data } = await supabase.functions.invoke('create-checkout-session', {
    body: { 
      priceId, 
      planoTipo: planoKey,
      cupomCodigo: cupomCodigo || null 
    }
  });
  
  // Redireciona para Stripe Checkout
  window.location.href = data.url;
};
```

### 3. Checkout no Stripe

- Usuário preenche dados de pagamento
- Stripe processa pagamento
- Se cupom foi fornecido, o desconto é aplicado automaticamente
- Após sucesso, redireciona para: `/obrigado?plan={planoTipo}`

### 4. Webhook Processa Evento

```typescript
// supabase/functions/stripe-webhook/index.ts
switch (event.type) {
  case "checkout.session.completed":
    const session = event.data.object;
    
    // Extrai dados de desconto
    const totalDesconto = session.total_details?.amount_discount || 0;
    const cupomAplicado = session.discount?.coupon?.id || null;
    
    // Atualiza tabela assinaturas
    await supabaseClient.from("assinaturas").upsert({
      user_id,
      stripe_customer_id,
      stripe_subscription_id,
      plano_tipo,
      status: "active",
      cupom_stripe_id: cupomAplicado,
      valor_desconto: totalDesconto / 100, // Converte centavos para reais
      data_inicio: ...,
      data_proxima_cobranca: ...
    });
    break;
}
```

### 5. Página de Confirmação

```typescript
// src/pages/Obrigado.tsx
// Faz polling para verificar se plano foi atualizado
useEffect(() => {
  const interval = setInterval(async () => {
    await recarregar();
    if (assinatura?.plano_tipo !== "demonstracao") {
      // Plano ativado! Redireciona para dashboard
      toast({
        title: "✅ Assinatura ativada!",
        description: "Seu plano foi ativado com sucesso."
      });
      navigate("/dashboard");
    }
  }, 2000); // Polling a cada 2 segundos
}, []);
```

---

## 📊 Estrutura do Banco de Dados

### Tabela `assinaturas`

```sql
CREATE TABLE assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  plano_tipo plano_tipo NOT NULL DEFAULT 'demonstracao',
  status status_assinatura NOT NULL DEFAULT 'active',
  cupom_stripe_id TEXT,               -- 🆕 ID do cupom usado
  valor_desconto NUMERIC(10,2) DEFAULT 0, -- 🆕 Valor do desconto em reais
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  data_proxima_cobranca TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🐛 Troubleshooting

### Problema: Plano não atualiza após pagamento

**Possíveis causas:**

1. **Webhook não configurado** ⚠️ CAUSA MAIS COMUM
   - Verifique se o webhook está ativo no Stripe Dashboard
   - Confirme que a URL está correta: `https://cmcmliokvmnahcazavwv.supabase.co/functions/v1/stripe-webhook`
   - **Siga o guia**: [STRIPE_WEBHOOK_CONFIG.md](./STRIPE_WEBHOOK_CONFIG.md)

2. **Secret incorreto**
   - Verifique se `STRIPE_WEBHOOK_SECRET` está correto
   - O secret deve começar com `whsec_`
   - Copie novamente do Stripe Dashboard

3. **Eventos não selecionados**
   - Confirme que `checkout.session.completed` está marcado
   - Verifique os 4 eventos obrigatórios

**Como verificar:**

1. Acesse Stripe Dashboard → Webhooks
2. Clique no webhook criado
3. Vá em "Event logs" para ver eventos recebidos
4. Verifique se há erros ou falhas
5. Se não há eventos, significa que o webhook não foi acionado

**Solução rápida:**
- Vá para `/admin/stripe/teste`
- Teste o fluxo completo com cartão de teste
- Verifique os logs na mesma página

### Problema: Erro ao criar checkout

**Possíveis causas:**

1. **STRIPE_SECRET_KEY inválida**
   - Verifique se a chave está correta
   - Confirme se é a chave do ambiente correto (test/live)

2. **Price ID não encontrado**
   - Verifique se os price IDs em `src/types/assinatura.ts` estão corretos
   - Confirme no Stripe Dashboard → Products

### Problema: Cupom não aplicado

**Possíveis causas:**

1. **Cupom não existe no Stripe**
   - Verifique se o cupom foi criado no Stripe Dashboard
   - Confirme se o código está correto (case-sensitive)

2. **Cupom expirado ou esgotado**
   - Verifique se o cupom ainda está válido
   - Verifique se não atingiu o limite de uso

3. **Restrições não atendidas**
   - Verifique se o valor mínimo foi atingido
   - Verifique se o produto/plano é elegível

---

## 📈 Eventos do Meta Pixel

### InitiateCheckout
Disparado quando usuário clica no botão de assinar:

```javascript
fbq('track', 'InitiateCheckout', {
  content_name: 'Plano Básico',
  content_category: 'Subscription',
  currency: 'BRL',
  value: 29.90
});
```

### Purchase
Disparado na página `/obrigado` após pagamento confirmado:

```javascript
fbq('track', 'Purchase', {
  content_name: 'Plano Básico',
  content_category: 'Subscription',
  currency: 'BRL',
  value: 29.90
});
```

---

## 🔐 Segurança

### Validação de Webhooks

Todos os webhooks são validados usando `stripe.webhooks.constructEvent()`:

```typescript
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  webhookSecret
);
```

Isso garante que apenas eventos legítimos do Stripe são processados.

### Autenticação

- Edge function `create-checkout-session` requer JWT token
- Usuário deve estar autenticado para criar checkout
- User ID é extraído do token e usado na subscription

---

## 🧪 Testando a Integração

### Página de Teste

Acesse `/admin/stripe/teste` para:
- Ver status da assinatura atual
- Testar checkout de diferentes planos
- Ver histórico de atualizações
- Acessar informações de debug

### Cartões de Teste

Use estes cartões para testar:

- **Sucesso**: `4242 4242 4242 4242`
- **Falha**: `4000 0000 0000 0002`
- **Requer autenticação**: `4000 0025 0000 3155`

**Detalhes dos cartões:**
- Validade: Qualquer data futura (ex: 12/34)
- CVC: Qualquer 3 dígitos (ex: 123)
- CEP: Qualquer CEP válido

---

## 📞 Suporte

### Links Úteis

- [Stripe Dashboard](https://dashboard.stripe.com)
- [Documentação Stripe](https://stripe.com/docs)
- [Webhook Testing](https://stripe.com/docs/webhooks/test)
- [Stripe Coupons Docs](https://stripe.com/docs/billing/subscriptions/coupons)

### Logs

Para debug, verifique os logs das edge functions no Lovable Cloud:

1. Acesse o painel do Lovable Cloud
2. Vá em **Backend** → **Functions**
3. Selecione a função e veja os logs

**Logs esperados em `stripe-webhook`:**
```
🎯 Webhook recebido
✅ Evento validado: checkout.session.completed
💳 Cliente e assinatura identificados
🎫 Desconto aplicado no checkout (se cupom usado)
💾 Salvando assinatura no banco de dados
✅ Assinatura criada/atualizada com sucesso
```

---

**Última atualização**: Dezembro 2024
**Versão**: 2.0 (com suporte a cupons)

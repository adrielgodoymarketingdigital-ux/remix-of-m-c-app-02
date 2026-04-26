# 🔧 Guia Passo-a-Passo: Configuração do Webhook Kirvano

Este guia detalha **exatamente** como configurar o webhook da Kirvano para funcionar perfeitamente com o Zak360 App.

---

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter:

- ✅ Acesso ao painel administrativo da Kirvano
- ✅ Produtos/planos criados na Kirvano
- ✅ Permissões de administrador no Zak360 App

---

## 🚀 Passo 1: Acessar Configurações de Webhook na Kirvano

1. **Entre no painel da Kirvano**: https://app.kirvano.com
2. **Navegue até**: Configurações → Webhooks → Adicionar Webhook
3. **Clique em**: "Novo Webhook" ou "Adicionar Endpoint"

---

## 🔗 Passo 2: Configurar URL do Webhook

### URL do Webhook:
```
https://cmcmliokvmnahcazavwv.supabase.co/functions/v1/kirvano-webhook
```

### Configurações:
- **Método HTTP**: `POST`
- **Content-Type**: `application/json`
- **Status**: Ativo ✅

---

## 🔐 Passo 3: Adicionar Header de Autenticação

**CRÍTICO**: O webhook precisa do header de autenticação correto.

### Header Obrigatório:
```
x-webhook-token: tokenappmec
```

### Como adicionar:
1. Procure por "Headers Personalizados" ou "Custom Headers"
2. Adicione um novo header:
   - **Nome**: `x-webhook-token`
   - **Valor**: `tokenappmec`
3. Salve as configurações

⚠️ **IMPORTANTE**: Sem este header, o webhook será rejeitado!

---

## 📡 Passo 4: Selecionar Eventos

Selecione **TODOS** os seguintes eventos para enviar ao webhook:

### Eventos Obrigatórios:
- ✅ **Compra Aprovada** (`purchase.approved` / `compra_aprovada`)
- ✅ **Assinatura Renovada** (`subscription.renewed` / `assinatura_renovada`)
- ✅ **Assinatura Cancelada** (`subscription.canceled` / `assinatura_cancelada`)
- ✅ **Pagamento Falhou** (`payment.failed` / `assinatura_atrasada`)

### Como selecionar:
1. Procure por "Eventos" ou "Events"
2. Marque cada checkbox dos eventos acima
3. Salve as configurações

---

## 🎯 Passo 5: Configurar Success URL

Após o pagamento ser concluído, o cliente deve ser redirecionado para a página de agradecimento.

### Success URL:
```
https://seu-dominio.com/obrigado?plan={plano}&email={customer_email}
```

### Substituir:
- `seu-dominio.com` → Seu domínio real do Zak360 App
- `{plano}` → Variável da Kirvano para o plano comprado
- `{customer_email}` → Variável da Kirvano para o email do cliente

### Exemplo:
```
https://zak360.app/obrigado?plan=basico_mensal&email=cliente@email.com
```

---

## 🔗 Passo 6: Mapear Payment Links para Planos

Cada produto/plano criado na Kirvano tem um ID único (Payment Link ID). Você precisa mapear esses IDs para os planos do sistema.

### IDs Atuais Configurados:

| Plano no Sistema | Payment Link ID Kirvano |
|------------------|-------------------------|
| **Básico Mensal** | `46cd45d6-b09b-42f3-8036-448b63955812` |
| **Básico Anual** | `a72b2648-2d46-43e1-b6a1-3c5751c6ead1` |
| **Intermediário Mensal** | `89cdff61-8871-4938-9d49-56c7a9e2a15f` |
| **Intermediário Anual** | `60d387e1-d518-4f7a-935c-d345666ee7a1` |
| **Profissional Mensal** | `e66550fb-05d7-4012-87b0-9764e56d0fbe` |
| **Profissional Anual** | `2ada7374-358e-4c9f-9e83-0f2c388d14de` |

### Como encontrar seu Payment Link ID:
1. Na Kirvano, vá em "Produtos" ou "Links de Pagamento"
2. Clique no produto/plano criado
3. Copie o **ID do Link** (geralmente um UUID)
4. Adicione no mapeamento do webhook (se necessário, contate o desenvolvedor)

---

## 🧪 Passo 7: Testar o Webhook

### Teste Manual via cURL:
```bash
curl -X POST https://cmcmliokvmnahcazavwv.supabase.co/functions/v1/kirvano-webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: tokenappmec" \
  -d '{
    "event": "compra_aprovada",
    "customer": {"email": "seu-email-de-teste@email.com"},
    "payment_link_id": "46cd45d6-b09b-42f3-8036-448b63955812"
  }'
```

### Resultado Esperado:
```json
{
  "success": true,
  "message": "Webhook processado com sucesso",
  "requestId": "...",
  "duration": "...ms"
}
```

### Teste pela Kirvano:
1. Procure por "Testar Webhook" na Kirvano
2. Clique em "Enviar Teste"
3. Verifique se o status é `200 OK`

---

## 📊 Passo 8: Monitorar Webhooks

### No Zak360 App:
1. Acesse: `/admin/kirvano`
2. Visualize todos os eventos recebidos
3. Verifique estatísticas:
   - Total de eventos
   - Processados com sucesso
   - Pendentes
   - Taxa de sucesso

### Logs do Edge Function:
- Todos os webhooks são logados com detalhes
- Acesse os logs em tempo real via Lovable Cloud

---

## ✅ Checklist Final de Configuração

Antes de colocar em produção, verifique:

- [ ] URL do webhook está correta
- [ ] Método HTTP é `POST`
- [ ] Header `x-webhook-token` está configurado corretamente
- [ ] Todos os 4 eventos estão selecionados
- [ ] Success URL está configurada
- [ ] Payment Link IDs estão mapeados
- [ ] Teste manual retornou sucesso
- [ ] Dashboard `/admin/kirvano` está acessível

---

## 🐛 Troubleshooting

### Problema: "Token inválido"
**Solução**: Verifique se o header `x-webhook-token: tokenappmec` está configurado corretamente na Kirvano.

### Problema: "Email do usuário não encontrado"
**Solução**: Certifique-se de que o cliente está usando o **mesmo email** cadastrado no Zak360 App ao fazer o pagamento na Kirvano.

### Problema: "Payment Link ID não encontrado"
**Solução**: Verifique o mapeamento de IDs no código do webhook (`KIRVANO_LINK_MAPPING`).

### Problema: Evento não processado
**Solução**: 
1. Acesse `/admin/kirvano`
2. Encontre o evento na lista
3. Clique em "Reprocessar" (ícone de refresh)
4. Verifique os logs detalhados

---

## 📞 Suporte

Se precisar de ajuda adicional:

1. **Logs Detalhados**: Acesse `/admin/kirvano` e visualize o evento com problema
2. **Reprocessar Manualmente**: Use o botão de reprocessamento na tabela de eventos
3. **Contato**: Entre em contato com o suporte técnico com o **Request ID** do evento

---

## 🎉 Pronto!

Seu webhook Kirvano está configurado e funcionando! 

Agora, sempre que um cliente efetuar um pagamento na Kirvano:
1. ✅ O webhook será chamado automaticamente
2. ✅ O plano do usuário será atualizado no sistema
3. ✅ O cliente será redirecionado para a página de agradecimento
4. ✅ Tudo será logado para monitoramento e debugging

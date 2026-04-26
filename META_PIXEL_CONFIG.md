# Configuração do Meta Pixel

## ⚠️ AÇÃO NECESSÁRIA

Para que o rastreamento do Meta Pixel funcione corretamente, você precisa substituir o placeholder `SEU_PIXEL_ID_AQUI` pelo seu ID real do Meta Pixel.

### Passos para configurar:

1. **Obter seu Pixel ID**
   - Acesse o [Meta Business Manager](https://business.facebook.com/)
   - Vá em "Gerenciador de Eventos"
   - Copie o ID do seu Pixel (um número como `123456789012345`)

2. **Atualizar o código**
   - Abra o arquivo `index.html`
   - Localize `SEU_PIXEL_ID_AQUI` (aparece 2 vezes)
   - Substitua pelas seguintes linhas com seu ID real:

```html
<!-- Linha ~26 -->
fbq('init', '123456789012345'); 

<!-- Linha ~29 -->
src="https://www.facebook.com/tr?id=123456789012345&ev=PageView&noscript=1"
```

### Eventos implementados:

✅ **PageView**: Disparado automaticamente em todas as páginas
✅ **InitiateCheckout**: Disparado quando o usuário clica para ir ao checkout
✅ **Purchase**: Disparado na página de obrigado após compra bem-sucedida

### Testar a implementação:

1. Instale a extensão [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper/) no Chrome
2. Navegue pelo seu site
3. Verifique se os eventos estão sendo disparados corretamente
4. Confira no Meta Events Manager se os eventos estão chegando

### Estrutura dos eventos:

**InitiateCheckout:**
```javascript
{
  content_name: "Plano Básico",
  content_category: "Subscription",
  currency: "BRL",
  value: 29.90
}
```

**Purchase:**
```javascript
{
  content_name: "Plano Básico",
  content_category: "Subscription", 
  currency: "BRL",
  value: 29.90
}
```

## Fluxo do usuário:

1. Usuário está em `/plano` → clica em "Assinar Plano"
2. ⚡ Evento **InitiateCheckout** dispara
3. Redireciona para página de pagamento da Kirvano
4. Usuário completa o pagamento na Kirvano
5. Kirvano envia webhook para nosso sistema
6. Sistema atualiza o plano do usuário
7. Kirvano redireciona para `/obrigado`
8. ⚡ Evento **Purchase** dispara
9. Sistema faz polling (até 40 segundos) para verificar ativação
10. Após confirmação, redireciona automaticamente para `/dashboard`

## Configuração na Kirvano:

### URL de Sucesso (Success URL)
Configure na Kirvano para redirecionar após pagamento:
```
https://seu-dominio.com/obrigado?email={customer_email}
```

### Webhook
Configure o webhook para:
- **URL**: `https://cmcmliokvmnahcazavwv.supabase.co/functions/v1/kirvano-webhook`
- **Header**: `x-webhook-token: tokenappmec`
- **Eventos**: compra_aprovada, assinatura_renovada, assinatura_cancelada, assinatura_atrasada

## Troubleshooting:

### Plano não atualiza após pagamento:
1. Verifique se o webhook está configurado corretamente na Kirvano
2. Acesse `/admin/kirvano` para ver os logs dos eventos
3. Confirme que o email do usuário na Kirvano é o mesmo do cadastro no sistema
4. Verifique se o header `x-webhook-token` está sendo enviado

### Usuário não é redirecionado após pagamento:
1. Confirme que a Success URL está configurada na Kirvano
2. Verifique se o domínio está correto
3. Teste o redirecionamento manualmente acessando `/obrigado`

---

**Importante:** Sem substituir o Pixel ID, os eventos não serão rastreados no Meta!

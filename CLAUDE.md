# CLAUDE.md — Méc App

Arquivo de contexto persistente para o Claude Code. Lido automaticamente a cada sessão.

---

## Visão Geral do Projeto

**Méc App** (`appmec.in`) — sistema SaaS de gestão para assistências técnicas de celulares/eletrônicos.

- **URL produção:** https://appmec.in
- **Repositório:** https://github.com/adrielgodoymarketingdigital-ux/remix-of-m-c-app-02.git
- **Deploy:** Vercel (automático via push na branch main)
- **Supabase:** https://qztuzcchknptrvkdmdph.supabase.co

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite + TypeScript |
| Estilização | Tailwind CSS + shadcn/ui |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) |
| Deploy | Vercel |
| Automações | n8n |
| Pagamentos | Ticto + PagArme + Stripe |

---

## Estrutura de Pastas

```
/src
  /components    # Componentes reutilizáveis
  /pages         # Páginas da aplicação
  /hooks         # Hooks customizados (queries Supabase aqui)
  /lib           # Utilitários e configurações
  /types         # Tipos TypeScript
```

**Padrões:**
- Queries Supabase ficam nos hooks ou componentes diretamente
- Tailwind para estilização
- shadcn/ui como biblioteca base de componentes
- Sem camada de API própria — Supabase client direto

---

## Banco de Dados — Tabelas Principais

| Tabela | Descrição |
|---|---|
| `ordens_servico` | OS com campos de dispositivo, serviço, status, pagamento |
| `clientes` | Cadastro de clientes |
| `dispositivos` | Estoque de dispositivos (compra/venda) |
| `vendas` | Registro de vendas |
| `produtos` | Catálogo de produtos |
| `pecas` | Catálogo de peças |
| `servicos` | Catálogo de serviços |
| `contas` | Financeiro (contas a pagar/receber) |
| `profiles` | Perfis de usuários (vinculado ao Supabase Auth) |
| `assinaturas` | Controle de planos/assinaturas |

---

## Funcionalidades Implementadas e Funcionando

- ✅ Ordens de Serviço (OS) completas
- ✅ Cadastro de clientes
- ✅ Cadastro de produtos, peças e serviços
- ✅ Dispositivos (compra, venda, estoque)
- ✅ Financeiro (contas a pagar/receber, vendas)
- ✅ Orçamentos
- ✅ Notificações
- ✅ CRM básico
- ✅ Frase do Dia
- ✅ Cotação do Dólar
- ✅ Assinaturas (Ticto + PagArme + Stripe)

---

## Funcionalidades Mockadas — Pendentes de Integração Real

- 🔲 **Avaliador de Troca** — integrar com API do Mercado Livre
- 🔲 **MultiEmpresas** — múltiplas empresas por conta
- 🔲 **Troca Certa** — lógica de avaliação de troca de dispositivos
- 🔲 **Fidelidade de Clientes** — programa de pontos/fidelidade
- 🔲 **Venda no Atacado** — módulo de vendas para lojistas
- 🔲 **Venda de Peças para Lojistas** — catálogo B2B de peças

---

## Convenções de Código

```typescript
// Hook padrão com Supabase
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useClientes() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    }
  })
}
```

- Usar `useQuery` / `useMutation` do React Query para Supabase
- Componentes em PascalCase
- Hooks com prefixo `use`
- Imports com alias `@/` para `/src/`
- Tipar sempre com TypeScript — sem `any`

---

## Comandos Úteis

```bash
# Desenvolvimento local
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview

# Type check
npx tsc --noEmit
```

---

## Deploy

- Push na `main` → Vercel faz deploy automático
- Variáveis de ambiente configuradas no painel da Vercel
- Não commitar `.env` — usar `.env.local` localmente

---

## Integrações Externas

| Serviço | Uso |
|---|---|
| Mercado Livre API | Avaliador de Troca (pendente) |
| Ticto | Assinaturas |
| PagArme | Pagamentos |
| Stripe | Pagamentos internacionais |
| n8n | Automações e webhooks |

---

## Notas Importantes

- Projeto em **produção** — testar bem antes de fazer push na main
- Migração do Lovable para Supabase próprio já concluída
- MultiEmpresas ainda não implementado — profiles atuais são single-tenant
- Ao criar novas tabelas no Supabase, sempre configurar RLS (Row Level Security)

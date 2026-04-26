# CLAUDE.md — Méc App

Arquivo de contexto persistente para o Claude Code.

## Projeto
- **URL:** https://appmec.in
- **Repo:** https://github.com/adrielgodoymarketingdigital-ux/remix-of-m-c-app-02.git
- **Deploy:** Vercel (auto via push na main)
- **Supabase:** https://qztuzcchknptrvkdmdph.supabase.co

## Stack
React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase + n8n + Ticto + PagArme + Stripe

## Estrutura
- /src/components — componentes reutilizáveis
- /src/pages — páginas
- /src/hooks — hooks customizados (queries Supabase aqui)

## Banco — Tabelas Principais
- ordens_servico, clientes, dispositivos, vendas
- produtos, pecas, servicos, contas, profiles, assinaturas

## Funcionalidades OK
OS completas, clientes, produtos/peças/serviços, dispositivos, financeiro, orçamentos, notificações, CRM básico, frase do dia, cotação dólar, assinaturas.

## Funcionalidades Mockadas (pendentes)
- Avaliador de Troca (API Mercado Livre)
- MultiEmpresas
- Troca Certa
- Fidelidade de Clientes
- Venda no Atacado
- Venda de Peças para Lojistas

## Padrões
- Queries Supabase nos hooks/componentes
- React Query para useQuery/useMutation
- Tailwind + shadcn/ui
- Imports com alias @/
- Sem any no TypeScript
- Sempre configurar RLS em novas tabelas
- Projeto em produção — testar antes de push na main

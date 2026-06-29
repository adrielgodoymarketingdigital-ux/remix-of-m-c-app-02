# CONTEXT.md — MecApp (Assistência Técnica SaaS)

## Visão geral
SaaS multi-tenant para assistências técnicas de celular no Brasil.
Construído com React + TypeScript + Supabase. Iniciado no Lovable, mantido no VS Code com Claude Code.

## Stack
- Frontend: React + TypeScript + Vite
- UI: shadcn/ui + Tailwind CSS
- Backend: Supabase (Postgres + RLS + Edge Functions)
- Auth: Supabase Auth
- Deploy: Vercel
- Pagamentos: Stripe + Pagar.me + Ticto/Kirvano
- Notificações: OneSignal (push)
- State: TanStack Query (React Query)
- Roteamento: React Router v6

## Estrutura de pastas
src/
  pages/          — uma página por rota
  components/     — componentes por domínio (ordens/, produtos/, layout/, etc.)
  hooks/          — um hook por entidade/feature
  contexts/       — EmpresaContext, OSStatusConfigContext, OcultarValoresContext
  lib/            — utilitários (formatters, supabase-retry, pixel, tracking)
  types/          — interfaces TypeScript por domínio
  integrations/
    supabase/
      client.ts   — instância do Supabase
      types.ts    — tipos gerados do banco

## Autenticação e sessão
- useSessionRestore: roda uma vez na init, tenta getSession() → refreshSession(), timeout de 3s
- ProtectedAppRoute: verifica auth + onboarding + trial/assinatura + bloqueio admin
- Funcionários: herdam acesso do dono via loja_funcionarios, ignoram fluxo de trial

## Multi-empresa
- EmpresaContext: gerencia empresaAtiva (localStorage), isProprietario, userIdAtivo
- userIdAtivo: gerente da filial selecionada OU o próprio proprietário
- empresa_id nas tabelas: null = matriz, uuid = filial específica
- Queries sempre filtram por user_id (do dono/proprietário) + empresa_id quando aplicável

## Padrões de código

### Hooks de dados
- Sempre usar withRetry() de @/lib/supabase-retry para queries
- shouldSuppressToast() para não mostrar toast em erros de auth
- useEmpresaFiltro() / useIdentidade() para resolver user_id e empresa_id corretos
- Realtime via supabase.channel() com cleanup no return do useEffect

### Deleção com foreign key
- Sempre verificar dependências antes de deletar (ex: servico_id em ordens_servico)
- Tratar erro code '23503' explicitamente com mensagem clara ao usuário
- Soft delete em ordens_servico: preencher deleted_at + deleted_by, nunca DELETE físico

### Permissões de funcionário
- useFuncionarioPermissoes(): isFuncionario, lojaUserId, permissoes, podeSincronizarServicos
- Funcionários usam lojaUserId nas queries quando têm permissão de sincronizar
- ComVerificacaoFuncionario: guard de módulo por permissão
- ComVerificacaoPlano: guard de módulo por plano de assinatura

### Toasts
- Usar sonner (import { toast } from 'sonner') nas páginas e hooks de UI
- Usar useToast() de @/hooks/use-toast nos hooks mais antigos

### Formulários
- Nunca usar tag HTML <form> em artifacts/componentes React
- Usar onClick/onChange handlers diretos

## Tabelas principais do banco
- profiles: dados do usuário (nome, email, celular, UTMs, CRM)
- assinaturas: plano, status, datas, provider de pagamento
- configuracoes_loja: config da assistência (nome, logo, mensagens WhatsApp, layouts)
- empresas: matriz e filiais (tipo: 'matriz' | 'filial')
- empresa_usuarios: vínculo gerente ↔ filial
- loja_funcionarios: funcionários da loja com permissões JSON
- ordens_servico: OS com soft delete (deleted_at), servico_id FK para servicos
- servicos: serviços cadastrados, FK peca_id para pecas
- pecas: peças do estoque
- produtos: produtos do estoque
- clientes: clientes com soft delete (deleted_at)
- vendas: vendas de produtos/peças/dispositivos
- contas: financeiro (pagar/receber), gerado automaticamente por status da OS
- dispositivos: aparelhos para venda (NÃO confundir com aparelhos de OS)
- caixas: controle de caixa diário
- user_roles: roles do usuário (admin, tecnico, vendedor, entrada_corporativa)
- os_status_config: status customizáveis de OS por usuário

## Fluxo de criação de OS
1. numero_os gerado por trigger do banco (generate_os_number)
2. OS criada com status inicial configurável
3. Mudança para aguardando_retirada/em_andamento → cria conta a receber (pendente)
4. Mudança para entregue → marca conta como recebida, preenche data_saida
5. Mudança para estornado → deleta contas, devolve peças ao estoque
6. Exclusão → soft delete em deleted_at, remove contas vinculadas

## Enums importantes
- forma_pagamento: dinheiro | pix | debito | credito | credito_parcelado | a_receber | a_prazo
- plano_tipo: free | trial | basico_mensal | intermediario_mensal | profissional_mensal | (versões anuais) | profissional_ultra_mensal | profissional_ultra_anual | admin
- status_assinatura: active | canceled | trialing | past_due | unpaid | incomplete | incomplete_expired
- app_role: admin | tecnico | vendedor | entrada_corporativa

## Features especiais
- Entrada Corporativa: funcionalidade exclusiva por role (entrada_corporativa em user_roles)
- Personalizar colunas produtos: salvo em localStorage ('produtos_colunas_visiveis')
- Painel gerencial OS: OSGerencialCards com seções colapsáveis individualmente
- Realtime em servicos, OS e outras tabelas via postgres_changes
- PWA: manifest, service worker, InstallPrompt, PWAUpdateBanner
- Catálogo público: /c/:slug (sem auth)
- Acompanhamento OS: /acompanhar/:token (sem auth)
- Entrada corporativa pública: /entrada/:remessa_id (sem auth, em desenvolvimento)

## Rotas protegidas vs públicas
Públicas (sem ProtectedAppRoute):
  / | /lp1 | /lp2 | /auth | /reset-password | /obrigado
  /completar-cadastro | /cadastro-plano | /instalar-app
  /video-boas-vindas | /onboarding-inicial | /team-onboarding | /renovar
  /c/:slug | /lp/:slug | /acompanhar/:token | /entrada/:remessa_id

Protegidas: todas as demais, com guards de plano e funcionário conforme o módulo

## Convenções de nomenclatura
- Arquivos: PascalCase para componentes, camelCase para hooks/libs
- Hooks: prefixo 'use' (useServicos, useOrdensServico, useEmpresa)
- Contextos: NomeContext + useNome() como export do hook de consumo
- Tipos: interfaces em PascalCase em src/types/
- Tabelas Supabase: snake_case em português
- Variáveis e funções: camelCase em português quando faz sentido ao domínio
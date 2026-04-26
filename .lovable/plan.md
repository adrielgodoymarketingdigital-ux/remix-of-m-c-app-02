
# Repaginação do Painel Admin + Novo Menu Financeiro

## 1. Remoção de menus

Remover dos menus do painel admin (sidebar desktop + drawer mobile + título mobile header) os itens:
- **CRM** (`/admin/crm`)
- **Analytics** (`/admin/analytics`)
- **Webhooks Kirvano** (`/admin/kirvano`)

Arquivos afetados:
- `src/components/layout/AppSidebar.tsx` — remover entradas em `adminMenuItems`.
- `src/components/layout/MobileMenuDrawer.tsx` — remover entradas equivalentes.
- `src/components/layout/MobileHeader.tsx` — remover títulos `/admin/crm`, `/admin/analytics`, `/admin/kirvano`.
- `src/App.tsx` — remover rotas e imports de `AdminCRM`, `AdminAnalytics`, `AdminKirvano`.

Os arquivos de página (`AdminCRM.tsx`, `AdminAnalytics.tsx`, `AdminKirvano.tsx`) e seus hooks ficarão órfãos. Proposta: **manter os arquivos** (não deletar) para preservar histórico e permitir reativação futura, apenas removendo as rotas/links — eles ficam inacessíveis pela UI.

## 2. Novo menu Admin Financeiro

### Rota e arquivo
- Nova rota: `/admin/financeiro`
- Nova página: `src/pages/AdminFinanceiro.tsx`
- Adicionar no sidebar (e mobile drawer) entrada **"Financeiro"** com ícone `DollarSign` (lucide-react), protegida por role `admin`.

### Métricas exibidas (cards e listas)

**Topo — KPIs principais (grid de cards):**
1. **Assinantes ativos no banco** — total de `assinaturas` onde `status='active'` e `plano_tipo` em `(basico_mensal, intermediario_mensal, profissional_mensal, basico_anual, intermediario_anual, profissional_anual)` (exclui trial/free/demonstracao/admin).
2. **Assinantes ativos na Pagar.me** — total retornado pela API Pagar.me em `GET /subscriptions?status=active`.
3. **MRR Pagar.me (líquido)** — soma das `subscriptions.current_cycle.billing_amount` (ou `plan.amount`) ativas, **descontando a taxa Pagar.me** por transação (cartão de crédito ~3,79% + R$ 0,39 conforme cobrança do projeto — buscar via `GET /balance` ou aplicar fórmula configurável). Exibir bruto e líquido lado a lado.
4. **MRR Banco de Dados** — soma de `PRECOS_MES[plano_tipo]` para assinaturas `active` cuja `data_proxima_cobranca` (ou `data_fim`) cai nos próximos 30 dias.

**Seção — Distribuição:**
5. **Assinaturas por plano** — tabela/gráfico de pizza com contagem por `plano_tipo` (basico/intermediario/profissional × mensal/anual), origem: banco. Mostrar contagem + MRR de cada plano.

**Seção — Recebimentos do mês (cartão):**
6. **Valor a receber no mês (cartão)** — para cada assinatura ativa de cartão na Pagar.me com `next_billing_at` dentro do mês corrente, somar o valor previsto. Pagar.me faz repasse D+30 (cartão) por padrão; exibir:
   - Valor bruto previsto a faturar no mês.
   - Valor líquido estimado (descontadas taxas).
   - Data prevista de repasse de cada cobrança (usar `GET /balance/operations` para repasses já agendados quando disponível).
7. **Renovações pendentes do mês** — lista de assinaturas com `next_billing_at` (Pagar.me) ou `data_proxima_cobranca` (banco) dentro do mês corrente, separando:
   - Cartão (renovação automática) — apenas informativo.
   - Pix/boleto (ação manual do cliente) — destaque.
   - Colunas: cliente (nome/email), plano, valor, data prevista, método.

### Estrutura técnica

**Edge Function nova: `supabase/functions/admin-financeiro/index.ts`**
- Valida JWT + role `admin` (mesmo padrão de `pagarme-balance`).
- Em paralelo:
  - Consulta Supabase: `assinaturas` ativas pagas, agrupamento por `plano_tipo`, `data_proxima_cobranca` próximos 30 dias.
  - Chama Pagar.me API (`PAGARME_SECRET_KEY` já existe nos secrets):
    - `GET /core/v5/subscriptions?status=active&size=100` (paginar) — para contar ativos e somar MRR.
    - `GET /core/v5/balance` — saldo disponível/aguardando.
    - `GET /core/v5/balance/operations?status=waiting_funds` — repasses futuros do mês.
- Calcula taxa Pagar.me: aplicar fórmula `liquido = bruto * (1 - taxa_percentual) - taxa_fixa` (configuráveis como constantes no início do arquivo, ex.: cartão 3,79% + R$ 0,39; Pix 0,99%).
- Retorna JSON consolidado com todas as métricas.

**Hook novo: `src/hooks/useAdminFinanceiro.ts`** — usa `useQuery` (TanStack) para invocar a edge function.

**Componentes da página `AdminFinanceiro.tsx`:**
- Cards de KPI no topo (shadcn `Card`).
- `RechartsPieChart` para distribuição por plano.
- `Tabela` (shadcn) para renovações pendentes do mês.
- `Tabela` para recebimentos previstos (cartão).
- Botão "Atualizar" com `refetch`.
- Skeleton loaders durante fetch.
- Responsivo: grid 1 col mobile / 2 cols tablet / 4 cols desktop.

### Considerações
- **Reaproveitamento:** boa parte da lógica já existe em `pagarme-balance` (cálculo de MRR, plan_breakdown). Vou estender essa função OU criar `admin-financeiro` que importa as mesmas constantes `PRECOS_MES`. Preferência: **nova função dedicada** (`admin-financeiro`) para manter responsabilidades separadas, deixando `pagarme-balance` intocada.
- **Taxas Pagar.me:** os valores exatos dependem do contrato. Usarei valores padrão (cartão 3,79% + R$ 0,39; Pix 0,99%) como constantes no topo da função, fácil de ajustar. Pode ser configurável via secret futuramente.
- **Cache:** `staleTime` de 60s no useQuery para evitar chamadas excessivas à Pagar.me.

## Arquivos criados/editados

**Criados:**
- `src/pages/AdminFinanceiro.tsx`
- `src/hooks/useAdminFinanceiro.ts`
- `supabase/functions/admin-financeiro/index.ts`

**Editados:**
- `src/App.tsx` — remover rotas CRM/Analytics/Kirvano, adicionar rota `/admin/financeiro`.
- `src/components/layout/AppSidebar.tsx` — atualizar `adminMenuItems`.
- `src/components/layout/MobileMenuDrawer.tsx` — atualizar lista admin.
- `src/components/layout/MobileHeader.tsx` — atualizar mapa de títulos.

**Não deletados (ficam órfãos por segurança/histórico):**
- `src/pages/AdminCRM.tsx`, `src/pages/AdminAnalytics.tsx`, `src/pages/AdminKirvano.tsx`
- Hooks relacionados (`useAdminAnalytics`, etc.) — podem ser usados em outros lugares; se confirmado que não, removo numa etapa posterior.

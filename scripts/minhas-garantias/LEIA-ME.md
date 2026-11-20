# Minhas garantias — fase A (banco + tela só para admin)

Nada desta fase é usado na venda, nos recibos, nas reimpressões ou no catálogo.
A tela fica atrás do freio `MINHAS_GARANTIAS_LIBERADA = false`
(`src/lib/garantias/visibilidadeMinhasGarantias.ts`): só admin vê.

## Ordem para aplicar em produção (SQL Editor, UM arquivo por vez; nunca `supabase db push`)

| # | Arquivo | Grava? | Lock em `vendas` | Depois, conferir |
|---|---------|--------|------------------|------------------|
| 1 | `scripts/minhas-garantias/0-conferir-producao.sql` | não | nenhum | 14 linhas `ok = true` (a 3, md5, pode dar false se 1 e 2 derem true) |
| 2 | `supabase/migrations/20261120120000_minhas_garantias_estrutura.sql` | sim | forte, só no fim e até o COMMIT; `lock_timeout` 5 s | `1-verificar-estrutura.sql`: tudo `ok = true` (constraints existem, ainda NÃO validadas) |
| 3 | `supabase/migrations/20261120120010_minhas_garantias_validar_constraints.sql` | só marca as constraints | leve (não para o PDV) | — |
| 4 | `supabase/migrations/20261120120020_minhas_garantias_indice_vendas_garantia_id.sql` | índice | nenhum que trave (CONCURRENTLY) | — |
| 5 | `supabase/migrations/20261120120030_minhas_garantias_indice_vendas_garantia_texto_id.sql` | índice | nenhum que trave (CONCURRENTLY) | `1b-verificar-validacao-indices.sql`: 8 linhas `ok = true` |
| 6 | `scripts/minhas-garantias/2-previa-copia.sql` | não | nenhum | anotar `linhas` por passo e o total; `acima_do_limite` = 0 |
| 7 | `supabase/migrations/20261120120100_minhas_garantias_copia_dados.sql` | sim (só `garantias_loja`) | nenhum | `3-verificar-copia.sql`: linhas por origem = prévia, `ok = true` |

- Se o passo 2 der `canceling statement due to lock timeout`: nada foi criado;
  rodar de novo num momento mais calmo (de preferência fora do horário de loja).
- Passos 4 e 5 rodam SOZINHOS (CONCURRENTLY não roda em transação nem junto
  com outro comando). Índice "INVÁLIDO" na 1b: rodar sozinho
  `DROP INDEX CONCURRENTLY public.<nome>;` e o arquivo do índice de novo.
- Passos 3 a 5 podem ficar para outro horário; nada da fase A depende deles.

Rollback, **NÃO RODE, só em emergência**, na ordem inversa:
`rollback-2-copia.sql` e depois `rollback-1-estrutura.sql` (os índices e as
constraints caem com as colunas). Os dois recusam se houver dado em uso.

## O que entra na `_zerar_catalogo()`

`zerar-catalogo.diff`: +3 linhas logo depois da 1550 (comentário, 1560
`garantias_loja` e 1570 `garantias_textos_venda`, ambas MANTER); 112 → 114.
A migration REMENDA a função em vigor (não troca por cópia antiga) e aborta
se ela não tiver 112 linhas ou a linha 1550 uma vez só.

## Provas (nada toca produção)

```sh
# Locks com 3 conexões num Postgres REAL e LOCAL (cria e apaga um banco descartável)
PG_DIR=<pasta com node_modules/pg> PG_URL=postgres://postgres:senha@127.0.0.1:5432/postgres \
  node scripts/minhas-garantias/teste-lock-postgres.mjs

# Migrations no PGlite (Postgres 17 em WebAssembly), com mutantes
mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
PGLITE_DIR=/tmp/pg node scripts/minhas-garantias/teste-pglite.mjs --mutantes

# Lib (prévia, padrões virtuais, plano de gravação, freio) + SQL gerado em dia
TZ=UTC deno test --no-check --allow-run --allow-read scripts/testes-minhas-garantias/
deno run --allow-read --allow-write --allow-run --allow-env scripts/testes-minhas-garantias/mutantes.ts

# A migration de cópia e a prévia saem do MESMO núcleo (não edite à mão)
node scripts/minhas-garantias/gerar-sql-copia.ts            # regrava
node scripts/minhas-garantias/gerar-sql-copia.ts --verificar

# Tela de verdade com Supabase simulado (dados fictícios, rede externa bloqueada)
npx vite --port 8204 --strictPort --host 127.0.0.1
PLAYWRIGHT_PATH=<.../node_modules/playwright> CHROMIUM_PATH=<chrome> \
  node scripts/minhas-garantias/tela.playwright.mjs <pasta-saida>

# Build antes × depois
python3 scripts/minhas-garantias/comparar-build.py <dist-main> <dist-branch>
```

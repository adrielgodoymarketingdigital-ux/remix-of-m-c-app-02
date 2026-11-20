# Minhas garantias — fase A (banco + tela só para admin)

Nada desta fase é usado na venda, nos recibos, nas reimpressões ou no catálogo.
A tela fica atrás do freio `MINHAS_GARANTIAS_LIBERADA = false`
(`src/lib/garantias/visibilidadeMinhasGarantias.ts`): só admin vê.

## Ordem para aplicar em produção (SQL Editor, um por vez; nunca `supabase db push`)

| # | Arquivo | Tipo | Depois, conferir |
|---|---------|------|------------------|
| 0 | `scripts/minhas-garantias/0-conferir-producao.sql` | só leitura | todas as linhas `ok = true` (a 3, md5, pode dar false se 1 e 2 derem true) |
| 1 | `supabase/migrations/20261120120000_minhas_garantias_estrutura.sql` | grava (estrutura) | `1-verificar-estrutura.sql`: tudo `ok = true` |
| 2 | `scripts/minhas-garantias/2-previa-copia.sql` | só leitura | anotar `linhas` por passo e o `TOTAL`; `acima_do_limite` = 0 |
| 3 | `supabase/migrations/20261120120100_minhas_garantias_copia_dados.sql` | grava (dados) | `3-verificar-copia.sql`: linhas por origem = prévia; `ok = true` |

Rollback, **NÃO RODE, só em emergência**, na ordem inversa:
`rollback-2-copia.sql` e depois `rollback-1-estrutura.sql`. Os dois recusam
se houver dado em uso.

## O que entra na `_zerar_catalogo()`

`zerar-catalogo.diff`: +3 linhas logo depois da 1550 (comentário, 1560
`garantias_loja` e 1570 `garantias_textos_venda`, ambas MANTER); 112 → 114.
A migration REMENDA a função em vigor (não troca por cópia antiga) e aborta
se ela não tiver 112 linhas ou a linha 1550 uma vez só.

## Provas (nada toca produção)

```sh
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

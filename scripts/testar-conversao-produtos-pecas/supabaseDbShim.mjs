/**
 * Adaptador mínimo que fala a MESMA "linguagem" do client supabase-js
 * (.from(tabela).select/eq/in/insert/update/delete()) usado pelas funções
 * reais em src/lib/produtos/conversaoTipo.ts, mas executa cada operação via
 * `supabase db query --linked` (acesso direto ao Postgres, ignora RLS —
 * mesmo mecanismo já usado nesta sessão pra ler/gravar produção via CLI)
 * em vez de HTTP/PostgREST.
 *
 * Por quê não usar o client HTTP real: as funções em conversaoTipo.ts
 * chamam supabase.auth.getUser() por fora (no wrapper do hook) — pra testar
 * como a conta de teste sem ter a senha dela, o caminho mais direto é bypass
 * de RLS + userId explícito, igual ao script de mitigação de fraude já usado
 * nesta sessão.
 *
 * Por quê não é uma transação SQL com ROLLBACK: `supabase db query --linked`
 * NÃO garante uma sessão/conexão única entre statements — confirmado
 * empiricamente nesta mesma sessão (uma CREATE TEMP TABLE seguida de INSERT
 * na mesma chamada falhou com "relation does not exist", ou seja, nem um
 * único envio de SQL multi-statement preserva estado de sessão). Sem uma
 * conexão Postgres persistente (biblioteca `pg`, não instalada, exigiria
 * senha do banco — outro segredo pra pedir) não dá pra garantir BEGIN/
 * ROLLBACK de verdade entre chamadas. A segurança aqui vem de outro jeito:
 * cada cenário só cria fixtures PRÓPRIAS (produtos/peças/venda "TESTE_CONV_*"
 * com UUID gerado no próprio script) numa conta de teste vazia, e um bloco
 * finally no script principal apaga TUDO que foi criado, rode o que rodar
 * (sucesso ou falha no meio).
 */
import { execFileSync } from 'node:child_process';

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

function parseJsonBlock(text) {
  const clean = stripAnsi(text);
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Saída inesperada do supabase CLI: ' + clean.slice(0, 300));
  return JSON.parse(clean.slice(start, end + 1));
}

let chamadas = 0;

async function runSql(sql) {
  chamadas++;
  try {
    const stdout = execFileSync('supabase', ['db', 'query', '--linked', sql], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 20,
    });
    const parsed = parseJsonBlock(stdout);
    return parsed.rows || [];
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    let msg = out;
    try {
      const parsed = parseJsonBlock(out);
      msg = parsed?.error?.message || parsed?.message || out;
    } catch (_) { /* usa o texto cru mesmo */ }
    throw new Error(msg.trim());
  }
}

const sqlValueList = (arr) => arr.map((v) => (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)).join(', ');

function sqlValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v) || (typeof v === 'object')) return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

class QueryBuilder {
  constructor(table) {
    this._table = table;
    this._op = null;
    this._selectCols = '*';
    this._returning = null;
    this._payload = null;
    this._filters = [];
    this._single = false;
  }

  select(cols = '*') {
    if (this._op === 'insert') this._returning = cols;
    else { this._op = this._op || 'select'; this._selectCols = cols; }
    return this;
  }

  insert(rows) { this._op = 'insert'; this._payload = Array.isArray(rows) ? rows : [rows]; return this; }
  update(obj) { this._op = 'update'; this._payload = obj; return this; }
  delete() { this._op = 'delete'; return this; }
  eq(col, val) { this._filters.push({ col, op: '=', val }); return this; }
  in(col, arr) { this._filters.push({ col, op: 'in', val: arr }); return this; }
  single() { this._single = true; return this; }

  _whereClause() {
    if (this._filters.length === 0) return '';
    const parts = this._filters.map((f) => {
      if (f.op === 'in') {
        if (!f.val || f.val.length === 0) return '1=0';
        return `${f.col} IN (${sqlValueList(f.val)})`;
      }
      return `${f.col} = ${sqlValue(f.val)}`;
    });
    return ' WHERE ' + parts.join(' AND ');
  }

  _buildSql() {
    if (this._op === 'select' || this._op === null) {
      return `SELECT ${this._selectCols} FROM ${this._table}${this._whereClause()}`;
    }
    if (this._op === 'insert') {
      const rows = this._payload;
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const values = rows
        .map((r) => '(' + cols.map((c) => sqlValue(r[c] === undefined ? null : r[c])).join(', ') + ')')
        .join(', ');
      const returning = this._returning ? ` RETURNING ${this._returning}` : '';
      return `INSERT INTO ${this._table} (${cols.join(', ')}) VALUES ${values}${returning}`;
    }
    if (this._op === 'update') {
      const sets = Object.entries(this._payload).map(([k, v]) => `${k} = ${sqlValue(v)}`).join(', ');
      return `UPDATE ${this._table} SET ${sets}${this._whereClause()}`;
    }
    if (this._op === 'delete') {
      return `DELETE FROM ${this._table}${this._whereClause()}`;
    }
    throw new Error('Operação desconhecida no shim: ' + this._op);
  }

  then(resolve) {
    (async () => {
      try {
        const sql = this._buildSql();
        const rows = await runSql(sql);
        const data = this._single ? (rows[0] ?? null) : rows;
        resolve({ data, error: null });
      } catch (e) {
        resolve({ data: null, error: { message: e.message } });
      }
    })();
  }
}

/** Objeto com a mesma forma usada por conversaoTipo.ts: só `.from(tabela)`. */
export const supabaseShim = {
  from(table) {
    return new QueryBuilder(table);
  },
};

/** Pra queries de verificação fora do formato .from() (ex: SELECT com JOIN). */
export async function sqlBruto(sql) {
  return runSql(sql);
}

export function totalChamadas() {
  return chamadas;
}

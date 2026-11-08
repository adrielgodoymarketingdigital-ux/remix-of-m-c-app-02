// node --test src/lib/multiempresas/identidadeGravacao.core.test.ts
// Identidade de gravação com banco FALSO (sem rede, nada é gravado).
// Inclui a lógica ANTIGA da OS e do PDV copiada aqui, para provar que dono e
// gerente continuam gravando exatamente igual e só o funcionário muda.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buscarMatrizIdCore,
  resolverIdentidadeGravacaoCore,
  type ClienteBancoLike,
} from "./identidadeGravacao.core.ts";

type Linha = Record<string, unknown>;
interface Cenario {
  empresa_usuarios?: Linha[];
  loja_funcionarios?: Linha[];
  empresas?: Linha[];
  /** RLS de empresas bloqueia (erro na leitura). */
  empresasComErro?: boolean;
  /** Leitura de empresas lança (rede). */
  empresasLanca?: boolean;
}

/** Cliente falso: só select + eq + maybeSingle, como as consultas usam. */
function bancoFalso(c: Cenario): ClienteBancoLike & { consultas: string[] } {
  const consultas: string[] = [];
  const cliente = {
    consultas,
    from(tabela: string) {
      const filtros: Array<[string, unknown]> = [];
      const builder = {
        select() { return builder; },
        eq(col: string, val: unknown) { filtros.push([col, val]); return builder; },
        maybeSingle() {
          consultas.push(tabela);
          if (tabela === "empresas" && c.empresasLanca) return Promise.reject(new Error("rede"));
          if (tabela === "empresas" && c.empresasComErro) return Promise.resolve({ data: null, error: { message: "RLS" } });
          const linhas = ((c as Record<string, Linha[] | undefined>)[tabela] ?? [])
            .filter((l) => filtros.every(([col, val]) => l[col] === val));
          if (linhas.length > 1) return Promise.resolve({ data: null, error: { message: "várias linhas" } });
          return Promise.resolve({ data: linhas[0] ?? null, error: null });
        },
      };
      return builder;
    },
  };
  return cliente as unknown as ClienteBancoLike & { consultas: string[] };
}

// ── Lógica ANTIGA (cópia fiel de antes da F2) ──────────────────────────────

/** resolverIdentidadeOS antes da F2. */
async function legadoOS(cli: ClienteBancoLike, authUserId: string, isProprietario: boolean, empresaAtivaCtx: string | null) {
  const [gerenteFilialOS, funcData] = await Promise.all([
    cli.from("empresa_usuarios").select("proprietario_id, empresa_id").eq("gerente_id", authUserId).maybeSingle().then((r) => r.data as Linha | null),
    cli.from("loja_funcionarios").select("loja_user_id").eq("funcionario_user_id", authUserId).eq("ativo", true).maybeSingle().then((r) => r.data as Linha | null),
  ]);
  const effectiveUserId = (gerenteFilialOS?.proprietario_id as string) || (funcData?.loja_user_id as string) || authUserId;
  let empresaId: string | null = (gerenteFilialOS?.empresa_id as string | null) ?? null;
  if (!empresaId) {
    if (isProprietario && empresaAtivaCtx) {
      empresaId = empresaAtivaCtx;
    } else {
      const { data } = await cli.from("empresas").select("id").eq("proprietario_id", effectiveUserId).eq("tipo", "matriz").maybeSingle();
      empresaId = ((data as Linha | null)?.id as string) ?? null;
    }
  }
  return { effectiveUserId, empresaId };
}

/** Bloco do PDV antes da F2 (lojaUserId vem do hook: dono → próprio id, funcionário → dono). */
async function legadoPDV(cli: ClienteBancoLike, userId: string, lojaUserId: string, isProprietario: boolean, empresaAtivaCtx: string | null) {
  const { data: g } = await cli.from("empresa_usuarios").select("proprietario_id, empresa_id").eq("gerente_id", userId).maybeSingle();
  const gerente = g as Linha | null;
  const userIdParaVenda = (gerente?.proprietario_id as string) || lojaUserId || userId;
  let empresaIdPDV: string | null = (gerente?.empresa_id as string | null) ?? null;
  if (!empresaIdPDV) {
    if (isProprietario && empresaAtivaCtx) {
      empresaIdPDV = empresaAtivaCtx;
    } else {
      const { data } = await cli.from("empresas").select("id").eq("proprietario_id", userIdParaVenda).eq("tipo", "matriz").maybeSingle();
      empresaIdPDV = ((data as Linha | null)?.id as string) ?? null;
    }
  }
  return { userIdParaVenda, empresaIdPDV };
}

// ── Cenários fictícios ─────────────────────────────────────────────────────

const DONO = "u-dono";
const GERENTE = "u-gerente";
const FUNC_FILIAL = "u-func-filial";
const FUNC_MATRIZ = "u-func-matriz";
const MATRIZ = "emp-matriz";
const FILIAL = "emp-filial";

const contaMulti: Cenario = {
  empresas: [{ id: MATRIZ, proprietario_id: DONO, tipo: "matriz" }, { id: FILIAL, proprietario_id: DONO, tipo: "filial" }],
  empresa_usuarios: [{ gerente_id: GERENTE, proprietario_id: DONO, empresa_id: FILIAL }],
  loja_funcionarios: [
    { funcionario_user_id: FUNC_FILIAL, loja_user_id: DONO, empresa_id: FILIAL, ativo: true },
    { funcionario_user_id: FUNC_MATRIZ, loja_user_id: DONO, empresa_id: null, ativo: true },
  ],
};
const contaSimples: Cenario = { empresas: [], empresa_usuarios: [], loja_funcionarios: [] };

test("PROVA: dono comum sem filiais grava igual (user_id próprio, sem loja)", async () => {
  const novo = await resolverIdentidadeGravacaoCore(bancoFalso(contaSimples), DONO, false, null);
  const antigoOS = await legadoOS(bancoFalso(contaSimples), DONO, false, null);
  const antigoPDV = await legadoPDV(bancoFalso(contaSimples), DONO, DONO, false, null);
  assert.deepEqual({ effectiveUserId: novo.effectiveUserId, empresaId: novo.empresaId }, antigoOS);
  assert.deepEqual({ userIdParaVenda: novo.effectiveUserId, empresaIdPDV: novo.empresaId }, antigoPDV);
  assert.deepEqual(novo, { effectiveUserId: DONO, empresaId: null, papel: "dono" });
});

test("PROVA: dono multiempresa e gerente gravam igual ao código antigo", async () => {
  const casos: Array<[string, boolean, string | null]> = [
    [DONO, true, null],    // dono na matriz
    [DONO, true, FILIAL],  // dono com filial ativa
    [GERENTE, false, null],
  ];
  for (const [quem, isProp, ativa] of casos) {
    const novo = await resolverIdentidadeGravacaoCore(bancoFalso(contaMulti), quem, isProp, ativa);
    const antigo = await legadoOS(bancoFalso(contaMulti), quem, isProp, ativa);
    assert.deepEqual({ effectiveUserId: novo.effectiveUserId, empresaId: novo.empresaId }, antigo, `${quem}/${ativa}`);
    const antigoPDV = await legadoPDV(bancoFalso(contaMulti), quem, quem, isProp, ativa);
    assert.equal(novo.empresaId, antigoPDV.empresaIdPDV, `PDV ${quem}/${ativa}`);
  }
});

test("funcionário de filial: antes caía na matriz, agora grava na filial", async () => {
  const antigo = await legadoOS(bancoFalso(contaMulti), FUNC_FILIAL, false, null);
  const novo = await resolverIdentidadeGravacaoCore(bancoFalso(contaMulti), FUNC_FILIAL, false, null);
  assert.equal(antigo.empresaId, MATRIZ);
  assert.equal(novo.empresaId, FILIAL);
  assert.equal(novo.effectiveUserId, antigo.effectiveUserId); // user_id não muda
  assert.equal(novo.papel, "funcionario");
});

test("funcionário sem loja continua na matriz (igual ao antigo)", async () => {
  const antigo = await legadoOS(bancoFalso(contaMulti), FUNC_MATRIZ, false, null);
  const novo = await resolverIdentidadeGravacaoCore(bancoFalso(contaMulti), FUNC_MATRIZ, false, null);
  assert.deepEqual({ effectiveUserId: novo.effectiveUserId, empresaId: novo.empresaId }, antigo);
  assert.equal(novo.empresaId, MATRIZ);
});

test("matriz ilegível (RLS) ou leitura que lança: grava sem loja e não bloqueia", async () => {
  const comErro = await resolverIdentidadeGravacaoCore(bancoFalso({ ...contaMulti, empresasComErro: true }), FUNC_MATRIZ, false, null);
  assert.equal(comErro.empresaId, null);
  assert.equal(comErro.effectiveUserId, DONO);
  const lanca = await resolverIdentidadeGravacaoCore(bancoFalso({ ...contaMulti, empresasLanca: true }), FUNC_MATRIZ, false, null);
  assert.equal(lanca.empresaId, null);
  assert.equal(await buscarMatrizIdCore(bancoFalso({ empresasLanca: true }), DONO), null);
});

test("não consulta a matriz quando a loja já é conhecida", async () => {
  const cli = bancoFalso(contaMulti);
  await resolverIdentidadeGravacaoCore(cli, FUNC_FILIAL, false, null);
  assert.equal(cli.consultas.includes("empresas"), false);
  const cliGerente = bancoFalso(contaMulti);
  await resolverIdentidadeGravacaoCore(cliGerente, GERENTE, false, null);
  assert.equal(cliGerente.consultas.includes("empresas"), false);
});

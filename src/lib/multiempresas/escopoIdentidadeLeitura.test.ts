// node --test src/lib/multiempresas/escopoIdentidadeLeitura.test.ts
// Trava da F3: a regra nova de leitura vale SÓ para Vendas, Dashboard, OS,
// Contas e Relatórios. As demais telas que usam useIdentidade continuam
// lendo e gravando exatamente como na origin/main (207a93e).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { decidirFiltroLeituraAnterior, type EntradaFiltroLeitura } from "./filtroLeituraLoja.ts";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ler = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/** sha256 do corpo de useIdentidade na origin/main 207a93e (antes da F3). */
const HASH_USE_IDENTIDADE_ORIGINAL = "b570334930d156dd5499a8b22df3ea1b0d6b6b2075ddb7f8b12296c4d77a3092";

/** Únicos arquivos que podem usar a regra nova (escopo da F3) + a definição. */
const ESCOPO_F3 = new Set([
  "hooks/useResolvedUserId.ts",
  "hooks/useVendas.ts",
  "hooks/useDashboardResumo.ts",
  "pages/Dashboard.tsx",
  "hooks/useOrdensServico.ts",
  "hooks/useContas.ts",
  "hooks/useRelatorios.ts",
  "hooks/useRelatoriosVendas.ts",
  "pages/Relatorios.tsx",
]);

/** Telas fora do escopo que usam useIdentidade e NÃO podem mudar. */
const FORA_DO_ESCOPO = [
  "hooks/useProdutos.ts",
  "hooks/useFornecedores.ts",
  "hooks/useTrocasGarantia.ts",
  "components/orcamentos/DialogConverterOrcamentoOS.tsx",
  "hooks/useCatalogoDispositivosCustom.ts",
  "components/fiscal/ConfirmarImportacaoXml.tsx",
  "hooks/useGravarXmlCompra.ts",
  "hooks/useCandidatosVinculoXml.ts",
  "hooks/useConfiguracaoEstoque.ts",
  "hooks/useCustoNaoConfirmado.ts",
  "hooks/useExtratoFinanceiro.ts",
  "components/financeiro/SecaoVendasPorFormaPagamento.tsx",
  "components/financeiro/SecaoLucratividadePorServico.tsx",
  "pages/ConfiguracaoFiscal.tsx",
];

/** Chamada ou import do hook novo (menção em comentário não conta). */
const USA_LEITURA = /useIdentidadeLeitura\(|import\s*\{[^}]*\buseIdentidadeLeitura\b[^}]*\}/;

function arquivosFonte(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosFonte(caminho));
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

test("useIdentidade está byte a byte igual à origin/main", () => {
  const s = ler("hooks/useResolvedUserId.ts");
  const ini = s.indexOf("export function useIdentidade(");
  assert.ok(ini >= 0);
  const fim = s.indexOf("\n}\n", ini) + 3;
  const hash = createHash("sha256").update(s.slice(ini, fim)).digest("hex");
  assert.equal(hash, HASH_USE_IDENTIDADE_ORIGINAL);
});

test("só os arquivos do escopo da F3 usam useIdentidadeLeitura", () => {
  const usam = arquivosFonte(SRC)
    .filter((f) => USA_LEITURA.test(readFileSync(f, "utf8")))
    .map((f) => relative(SRC, f).split("\\").join("/"));
  for (const f of usam) assert.ok(ESCOPO_F3.has(f), `fora do escopo usa a regra nova: ${f}`);
});

test("telas fora do escopo continuam no useIdentidade original", () => {
  for (const f of FORA_DO_ESCOPO) {
    const s = ler(f);
    assert.ok(s.includes("useIdentidade()"), `${f} deveria chamar useIdentidade()`);
    assert.ok(!USA_LEITURA.test(s), `${f} não pode usar useIdentidadeLeitura`);
    assert.ok(!s.includes("empresaIdAnterior"), `${f} não pode depender de campos novos`);
  }
});

test("fora do escopo, funcionário da matriz continua gravando sem loja (não passa a matriz)", () => {
  // useIdentidade (inalterado) devolve esta saída; telas como Produtos gravam
  // `empresa_id: empresaFiltro ?? null` → null, como antes.
  const funcMatriz: EntradaFiltroLeitura = { papel: "funcionario", funcionarioEmpresaId: null };
  assert.deepEqual(decidirFiltroLeituraAnterior({ ...funcMatriz, matrizId: "emp-matriz" }), { empresaId: null, isFilial: false });
  const funcFilial: EntradaFiltroLeitura = { papel: "funcionario", funcionarioEmpresaId: "emp-filial" };
  assert.deepEqual(decidirFiltroLeituraAnterior(funcFilial), { empresaId: "emp-filial", isFilial: false });
});

test("no escopo, o que grava continua com a identidade antiga", () => {
  // useContas: gravação (F2) usa useEmpresaInfo, não o filtro de leitura.
  const contas = ler("hooks/useContas.ts");
  assert.match(contas, /const \{ empresaId: empresaGravacaoVisao \} = useEmpresaInfo\(\);/);
  assert.match(contas, /resolverEmpresaGravacaoSegura\(user\.id, false, null, empresaGravacaoVisao\)/);
  // useOrdensServico: importação por planilha e ajuste de caixa usam useIdentidade().
  const os = ler("hooks/useOrdensServico.ts");
  assert.match(os, /= useIdentidade\(\);/);
  assert.match(os, /let empresaIdParaImport = empresaAntigaRef\.current;/);
  assert.match(os, /empresaId: empresaAntigaRef\.current \?\? null,/);
  // useVendas: formas de pagamento personalizadas (configuração) na loja de antes.
  assert.match(ler("hooks/useVendas.ts"), /useFormasPagamentoCustomizadas\(empresaConfigFormas\)/);
});

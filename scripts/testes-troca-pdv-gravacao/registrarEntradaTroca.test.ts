// deno test --no-check --no-lock --config scripts/testes-troca-pdv-gravacao/deno.json scripts/testes-troca-pdv-gravacao/
// Roda o registrarEntradaTroca REAL (src/lib/vendas/registrarEntradaTroca.ts)
// contra um banco falso em memória (supabaseFalso.ts, ligado pelo deno.json
// desta pasta no lugar do cliente Supabase). Só dados fictícios; nada vai à rede.
import { assertEquals } from "jsr:@std/assert@1";
import { registrarEntradaTroca } from "../../src/lib/vendas/registrarEntradaTroca.ts";
import type { DadosEntradaTroca } from "../../src/lib/vendas/trocaPDV.ts";
import { montarEntradaTroca } from "../../src/lib/vendas/entradaTrocaForm.ts";
import { chamadas, reiniciarBanco } from "./supabaseFalso.ts";

const ctx = { userId: "dono-teste", empresaId: "empresa-teste", grupoVenda: "grupo-teste", caixaId: null };

const aparelhoBase = {
  marca: "Marca Teste",
  modelo: "Modelo Teste",
  imei: "111111111111111",
  numeroSerie: null,
  cor: null,
  capacidadeGb: 128,
  condicao: "usado",
  checklistEntrada: null,
};

const dados = (aparelho: DadosEntradaTroca["aparelho"]): DadosEntradaTroca => ({
  vendedor: { nome: "Pessoa Teste", cpf: null, telefone: null },
  aparelho,
  valorEntrada: 500,
  valorVenda: 800,
  observacoes: null,
});

const linhaDispositivo = () => chamadas.find((c) => c.tabela === "dispositivos" && c.op === "insert")!.linha;

Deno.test("grava imei2 quando o aparelho tem IMEI 2", async () => {
  reiniciarBanco();
  const r = await registrarEntradaTroca(dados({ ...aparelhoBase, imei2: "222222222222222" }), ctx, {});
  assertEquals(r, { ok: true });
  assertEquals([linhaDispositivo().imei, linhaDispositivo().imei2], ["111111111111111", "222222222222222"]);
});

Deno.test("IMEI 2 vazio no diálogo → grava imei2 null", async () => {
  reiniciarBanco();
  const r = montarEntradaTroca({
    vendedorNome: "Pessoa Teste", vendedorCpf: "", vendedorTelefone: "",
    marca: "Marca Teste", modelo: "Modelo Teste", imei: "111111111111111", imei2: "  ",
    numeroSerie: "", cor: "", capacidadeGb: "", condicao: "usado", checklistEntrada: {},
    valorCusto: "500", valorVenda: "800", observacoes: "",
  });
  await registrarEntradaTroca(r.dados!, ctx, {});
  assertEquals(linhaDispositivo().imei2, null);
});

Deno.test("troca pendente antiga (JSON sem imei2) → grava imei2 null e o resto igual ao de antes", async () => {
  reiniciarBanco();
  const antiga = JSON.parse(JSON.stringify(dados(aparelhoBase))) as DadosEntradaTroca;
  assertEquals("imei2" in antiga.aparelho, false);
  const r = await registrarEntradaTroca(antiga, ctx, {});
  assertEquals(r, { ok: true });
  // Linha exata: a de antes da F2 + imei2 null (o padrão da coluna).
  assertEquals(linhaDispositivo(), {
    user_id: "dono-teste",
    empresa_id: "empresa-teste",
    tipo: "celular",
    marca: "Marca Teste",
    modelo: "Modelo Teste",
    imei: "111111111111111",
    imei2: null,
    numero_serie: null,
    cor: null,
    capacidade_gb: 128,
    condicao: "usado",
    custo: 500,
    preco: 800,
    quantidade: 1,
    vendido: false,
    garantia: false,
    origem_tipo: "troca_pdv",
  });
});

Deno.test("nenhuma outra mudança: mesmas etapas, mesmas tabelas, na mesma ordem", async () => {
  reiniciarBanco();
  await registrarEntradaTroca(dados({ ...aparelhoBase, imei2: "222222222222222" }), ctx, {});
  assertEquals(chamadas.map((c) => `${c.op}:${c.tabela}`), [
    "insert:origem_pessoas",
    "insert:dispositivos",
    "insert:compras_dispositivos",
    "update:dispositivos",
    "upsert:vendas_trocas",
  ]);
  // imei2 só na linha do aparelho.
  assertEquals(chamadas.filter((c) => "imei2" in c.linha).map((c) => c.tabela), ["dispositivos"]);
});

Deno.test("retomada: aparelho já gravado não é inserido de novo", async () => {
  reiniciarBanco({ falharEm: "compras_dispositivos" });
  const progresso = {};
  const r1 = await registrarEntradaTroca(dados({ ...aparelhoBase, imei2: "222222222222222" }), ctx, progresso);
  assertEquals(r1.ok, false);
  reiniciarBanco();
  const r2 = await registrarEntradaTroca(dados({ ...aparelhoBase, imei2: "222222222222222" }), ctx, progresso);
  assertEquals(r2, { ok: true });
  assertEquals(chamadas.filter((c) => c.tabela === "dispositivos" && c.op === "insert").length, 0);
});

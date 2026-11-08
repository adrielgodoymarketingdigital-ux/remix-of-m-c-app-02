// deno test --no-check scripts/testes-troca-pdv/entradaTrocaForm.test.ts
// Roda as funções reais de src/lib/vendas/entradaTrocaForm.ts (montagem e
// validação do diálogo "Dispositivo de Entrada (Troca)").
//
// Prova de "nada mudou": `referenciaAntiga` é a cópia literal do handleConfirmar
// do DialogDispositivoEntrada.tsx antes da extração (commit 207a93e), só com
// os setters/toast trocados por retorno. Para as mesmas entradas, a função nova
// tem de dar EXATAMENTE o mesmo resultado (mesmo erro ou mesmo objeto).
import { assertEquals, assertStrictEquals } from "jsr:@std/assert@1";
import {
  colunasImeiDaEntrada,
  imeisRepetidos,
  montarEntradaTroca,
  vendedorDoCliente,
  type CamposEntradaTroca,
} from "../../src/lib/vendas/entradaTrocaForm.ts";
import type { DadosEntradaTroca } from "../../src/lib/vendas/trocaPDV.ts";

// ── Referência: lógica antiga, copiada do diálogo ─────────────────────────────
function referenciaAntiga(c: CamposEntradaTroca): { erro: string } | { dados: DadosEntradaTroca } {
  const { vendedorNome, vendedorCpf, vendedorTelefone, marca, modelo, imei, numeroSerie, cor, capacidadeGb, condicao, valorCusto, valorVenda, observacoes } = c;
  const checklist = { entrada: c.checklistEntrada as Record<string, boolean> };
  if (!vendedorNome.trim()) {
    return { erro: "informeVendedor" };
  }
  if (!marca.trim() || !modelo.trim()) {
    return { erro: "informeMarcaModelo" };
  }
  const custo = parseFloat(valorCusto.replace(",", "."));
  if (isNaN(custo) || custo <= 0) {
    return { erro: "custoInvalido" };
  }
  const venda = parseFloat(valorVenda.replace(",", "."));
  if (isNaN(venda) || venda <= 0) {
    return { erro: "vendaInvalido" };
  }

  const capacidade = capacidadeGb ? parseInt(capacidadeGb) : NaN;
  const checklistEntrada =
    checklist.entrada && Object.keys(checklist.entrada).length > 0
      ? checklist.entrada
      : null;

  return {
    dados: {
      vendedor: {
        nome: vendedorNome.trim(),
        cpf: vendedorCpf.trim() || null,
        telefone: vendedorTelefone.trim() || null,
      },
      aparelho: {
        marca: marca.trim(),
        modelo: modelo.trim(),
        imei: imei.trim() || null,
        numeroSerie: numeroSerie.trim() || null,
        cor: cor.trim() || null,
        capacidadeGb: Number.isFinite(capacidade) ? capacidade : null,
        condicao,
        checklistEntrada,
      },
      valorEntrada: Math.round(custo * 100) / 100,
      valorVenda: Math.round(venda * 100) / 100,
      observacoes: observacoes.trim() || null,
    },
  };
}

const novo = (c: CamposEntradaTroca) => {
  const r = montarEntradaTroca(c);
  return r.ok ? { dados: r.dados } : { erro: r.erro };
};

// Estado inicial do diálogo (resetForm): tudo vazio, condição "usado", checklist {}.
const vazio: CamposEntradaTroca = {
  vendedorNome: "",
  vendedorCpf: "",
  vendedorTelefone: "",
  marca: "",
  modelo: "",
  imei: "",
  numeroSerie: "",
  cor: "",
  capacidadeGb: "",
  condicao: "usado",
  checklistEntrada: {},
  valorCusto: "",
  valorVenda: "",
  observacoes: "",
};

const completo: CamposEntradaTroca = {
  vendedorNome: "  Maria Teste  ",
  vendedorCpf: " 123.456.789-00 ",
  vendedorTelefone: " (11) 90000-0000 ",
  marca: " Apple ",
  modelo: " iPhone 12 ",
  imei: " 356789104567891 ",
  numeroSerie: " F2LXX ",
  cor: " Azul ",
  capacidadeGb: "128",
  condicao: "semi_novo",
  checklistEntrada: { tela: true, bateria: false },
  valorCusto: "1500,555",
  valorVenda: "2199.9",
  observacoes: "  risco na tampa ",
};

// ── Mesmas entradas → mesmo resultado de antes ───────────────────────────────
const casosAntigos: [string, CamposEntradaTroca][] = [
  ["formulário vazio", vazio],
  ["nome só com espaços", { ...completo, vendedorNome: "   " }],
  ["sem marca", { ...completo, marca: " " }],
  ["sem modelo", { ...completo, modelo: "" }],
  ["custo vazio", { ...completo, valorCusto: "" }],
  ["custo zero", { ...completo, valorCusto: "0" }],
  ["custo negativo", { ...completo, valorCusto: "-10" }],
  ["custo texto", { ...completo, valorCusto: "abc" }],
  ["venda vazia", { ...completo, valorVenda: "" }],
  ["venda zero", { ...completo, valorVenda: "0,00" }],
  ["completo (trim, vírgula, centavos)", completo],
  ["só obrigatórios", { ...vazio, vendedorNome: "João", marca: "Samsung", modelo: "A55", valorCusto: "800", valorVenda: "1200" }],
  ["capacidade não numérica", { ...completo, capacidadeGb: "abc" }],
  ["capacidade com decimal", { ...completo, capacidadeGb: "64.5" }],
  ["checklist vazio vira null", { ...completo, checklistEntrada: {} }],
  ["checklist undefined vira null", { ...completo, checklistEntrada: undefined }],
  ["valores com muitas casas", { ...completo, valorCusto: "0.005", valorVenda: "1,999" }],
  ["valor com milhar BR (comportamento antigo)", { ...completo, valorCusto: "1.500,00" }],
  ["vários erros: vale o primeiro", { ...vazio, vendedorNome: "", marca: "", valorCusto: "0" }],
];

for (const [nome, campos] of casosAntigos) {
  Deno.test(`igual ao de antes: ${nome}`, () => {
    assertEquals(novo(campos), referenciaAntiga(campos));
  });
}

Deno.test("sem IMEI 2 o objeto não ganha a chave imei2 (idêntico ao de hoje)", () => {
  const r = montarEntradaTroca(completo);
  assertStrictEquals(r.ok, true);
  assertEquals("imei2" in r.dados!.aparelho, false);
  assertEquals(Object.keys(r.dados!.aparelho), [
    "marca", "modelo", "imei", "numeroSerie", "cor", "capacidadeGb", "condicao", "checklistEntrada",
  ]);
});

Deno.test("valores exatos do caso completo", () => {
  assertEquals(montarEntradaTroca(completo).dados, {
    vendedor: { nome: "Maria Teste", cpf: "123.456.789-00", telefone: "(11) 90000-0000" },
    aparelho: {
      marca: "Apple",
      modelo: "iPhone 12",
      imei: "356789104567891",
      numeroSerie: "F2LXX",
      cor: "Azul",
      capacidadeGb: 128,
      condicao: "semi_novo",
      checklistEntrada: { tela: true, bateria: false },
    },
    valorEntrada: 1500.56,
    valorVenda: 2199.9,
    observacoes: "risco na tampa",
  });
});

// ── Troca pendente antiga (salva no navegador antes do IMEI 2) ───────────────
Deno.test("troca pendente antiga, sem imei2: lê do JSON e grava imei2 null", () => {
  const salvoAntigo = JSON.stringify({
    vendedor: { nome: "Maria", cpf: null, telefone: null },
    aparelho: { marca: "Apple", modelo: "iPhone 11", imei: "359876543210987", numeroSerie: null, cor: null, capacidadeGb: 64, condicao: "usado", checklistEntrada: null },
    valorEntrada: 900,
    valorVenda: 1300,
    observacoes: null,
  });
  const dados = JSON.parse(salvoAntigo) as DadosEntradaTroca;
  assertEquals(colunasImeiDaEntrada(dados.aparelho), { imei: "359876543210987", imei2: null });
  // Sem IMEI nenhum também não quebra.
  assertEquals(colunasImeiDaEntrada({ ...dados.aparelho, imei: null }), { imei: null, imei2: null });
});

Deno.test("colunasImeiDaEntrada repassa o IMEI 2 quando existe", () => {
  const r = montarEntradaTroca({ ...completo, imei2: " 356789104567892 " });
  assertEquals(colunasImeiDaEntrada(r.dados!.aparelho), { imei: "356789104567891", imei2: "356789104567892" });
});

// ── IMEI 2 (novo) ────────────────────────────────────────────────────────────
Deno.test("IMEI 2 preenchido entra no aparelho, com trim", () => {
  const r = montarEntradaTroca({ ...completo, imei2: "  356789104567892 " });
  assertStrictEquals(r.ok, true);
  assertEquals(r.dados!.aparelho.imei2, "356789104567892");
});

Deno.test("campo IMEI 2 na tela mas vazio: imei2 null e nada bloqueia", () => {
  for (const imei2 of ["", "   "]) {
    const r = montarEntradaTroca({ ...completo, imei2 });
    assertStrictEquals(r.ok, true);
    assertEquals(r.dados!.aparelho.imei2, null);
    // O resto é idêntico ao de hoje.
    const { imei2: _, ...resto } = r.dados!.aparelho;
    assertEquals({ ...r.dados!, aparelho: resto }, (referenciaAntiga(completo) as { dados: DadosEntradaTroca }).dados);
  }
});

Deno.test("IMEI 1 igual ao IMEI 2 bloqueia (mesma regra da compra: ignora espaços/traços)", () => {
  assertEquals(montarEntradaTroca({ ...completo, imei: "356789104567891", imei2: "356789104567891" }).erro, "imeiRepetido");
  assertEquals(montarEntradaTroca({ ...completo, imei: "35 6789-104567891", imei2: "356789104567891 " }).erro, "imeiRepetido");
});

Deno.test("IMEI 2 sem IMEI 1 não bloqueia", () => {
  const r = montarEntradaTroca({ ...completo, imei: "", imei2: "356789104567892" });
  assertStrictEquals(r.ok, true);
  assertEquals(r.dados!.aparelho.imei, null);
  assertEquals(r.dados!.aparelho.imei2, "356789104567892");
});

Deno.test("ordem das recusas: vendedor e marca/modelo antes do IMEI repetido; IMEI antes dos valores", () => {
  const repetido = { imei: "356789104567891", imei2: "356789104567891" };
  assertEquals(montarEntradaTroca({ ...completo, ...repetido, vendedorNome: "" }).erro, "informeVendedor");
  assertEquals(montarEntradaTroca({ ...completo, ...repetido, marca: "" }).erro, "informeMarcaModelo");
  assertEquals(montarEntradaTroca({ ...completo, ...repetido, valorCusto: "0" }).erro, "imeiRepetido");
});

Deno.test("imeisRepetidos: só com os dois preenchidos", () => {
  assertEquals(imeisRepetidos("123", "123"), true);
  assertEquals(imeisRepetidos("123", "124"), false);
  assertEquals(imeisRepetidos("123", ""), false);
  assertEquals(imeisRepetidos("123", null), false);
  assertEquals(imeisRepetidos("", ""), false);
  assertEquals(imeisRepetidos(null, undefined), false);
});

// ── Cliente já cadastrado → vendedor (novo) ──────────────────────────────────
Deno.test("vendedorDoCliente copia nome, CPF e telefone como estão no cadastro", () => {
  assertEquals(
    vendedorDoCliente({ nome: "Maria Teste", cpf: "123.456.789-00", cnpj: null, telefone: "(11) 90000-0000" }),
    { nome: "Maria Teste", documento: "123.456.789-00", telefone: "(11) 90000-0000" },
  );
  // Sem máscara e sem trim: exatamente o que está gravado.
  assertEquals(
    vendedorDoCliente({ nome: " Ana ", cpf: "12345678900", telefone: "11900000000" }),
    { nome: " Ana ", documento: "12345678900", telefone: "11900000000" },
  );
});

Deno.test("vendedorDoCliente: CNPJ quando não há CPF; CPF ganha se houver os dois", () => {
  assertEquals(vendedorDoCliente({ nome: "Loja X", cpf: null, cnpj: "12.345.678/0001-90" }).documento, "12.345.678/0001-90");
  assertEquals(vendedorDoCliente({ nome: "Y", cpf: "", cnpj: "12.345.678/0001-90" }).documento, "12.345.678/0001-90");
  assertEquals(vendedorDoCliente({ nome: "Z", cpf: "111", cnpj: "222" }).documento, "111");
});

Deno.test("vendedorDoCliente: campos ausentes viram texto vazio (campo editável fica em branco)", () => {
  assertEquals(vendedorDoCliente({ nome: "Só nome" }), { nome: "Só nome", documento: "", telefone: "" });
  assertEquals(vendedorDoCliente({ nome: null, cpf: undefined, telefone: null }), { nome: "", documento: "", telefone: "" });
});

Deno.test("cliente copiado → montar entrada: mesmo resultado de digitar à mão", () => {
  const v = vendedorDoCliente({ nome: "Maria Teste", cpf: "123.456.789-00", telefone: "(11) 90000-0000" });
  const viaCliente = montarEntradaTroca({ ...completo, vendedorNome: v.nome, vendedorCpf: v.documento, vendedorTelefone: v.telefone });
  const digitado = montarEntradaTroca({ ...completo, vendedorNome: "Maria Teste", vendedorCpf: "123.456.789-00", vendedorTelefone: "(11) 90000-0000" });
  assertEquals(viaCliente, digitado);
  // Cliente sem documento/telefone → null, como hoje com os campos vazios.
  const semDados = vendedorDoCliente({ nome: "Maria" });
  const r = montarEntradaTroca({ ...completo, vendedorNome: semDados.nome, vendedorCpf: semDados.documento, vendedorTelefone: semDados.telefone });
  assertEquals(r.dados!.vendedor, { nome: "Maria", cpf: null, telefone: null });
});

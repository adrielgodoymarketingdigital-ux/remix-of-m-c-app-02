// deno test --no-check scripts/testes-comecar-do-zero/
// Roda as funções reais de src/lib/comecarDoZero/regras.ts (tela do Começar do zero):
// inclusão automática igual à da prévia do banco, textos, erros ZD000–ZD007,
// numeração, botão final e a marca de conta de teste.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  CATEGORIAS,
  categoriasParaEnviar,
  contagemAmigavel,
  type Escolha,
  expandirEscolha,
  linhasPorTabela,
  linhasResumo,
  mensagemErro,
  ORDEM_CATEGORIAS,
  podeConfirmar,
  ROTULOS_TABELA,
  temMarcaComecarDoZero,
  textosNumeracao,
} from "../../src/lib/comecarDoZero/regras.ts";

Deno.test("categorias: as 7 da tela, cada uma com o que apaga e o que fica", () => {
  assertEquals(CATEGORIAS.map((c) => c.id), ["vendas", "os", "clientes", "financeiro", "estoque", "orcamentos", "tudo"]);
  for (const c of CATEGORIAS) assert(c.titulo && c.apaga && c.fica, c.id);
  assert(CATEGORIAS.find((c) => c.id === "clientes")!.aviso!.includes("ordens de serviço, as vendas e os orçamentos"));
  assert(CATEGORIAS.find((c) => c.id === "estoque")!.aviso!.includes("vendas"));
});

Deno.test("inclusão automática: igual às regras da prévia do banco", () => {
  assertEquals(expandirEscolha(["clientes"]), {
    efetivas: ["vendas", "os", "clientes", "orcamentos"], tudo: false,
    incluidas: [
      { categoria: "os", por_causa_de: "clientes", motivo: "As ordens de serviço ficariam sem cliente." },
      { categoria: "vendas", por_causa_de: "clientes", motivo: "As vendas ficariam sem cliente." },
      { categoria: "orcamentos", por_causa_de: "clientes", motivo: "Os orçamentos ficariam sem cliente." },
    ],
  });
  assertEquals(expandirEscolha(["estoque"]).efetivas, ["vendas", "estoque"]);
  assertEquals(expandirEscolha(["estoque"]).incluidas.map((i) => `${i.categoria}<${i.por_causa_de}`), ["vendas<estoque"]);
  // já marcada não aparece como incluída
  assertEquals(expandirEscolha(["estoque", "vendas"]).incluidas, []);
  assertEquals(expandirEscolha(["clientes", "estoque"]).incluidas.map((i) => i.categoria), ["os", "vendas", "orcamentos"]);
  assertEquals(expandirEscolha(["tudo", "os"]), { efetivas: [...ORDEM_CATEGORIAS], tudo: true, incluidas: [] });
  assertEquals(expandirEscolha([]), { efetivas: [], tudo: false, incluidas: [] });
  assertEquals(expandirEscolha(["financeiro", "orcamentos"]).efetivas, ["financeiro", "orcamentos"]);
});

Deno.test("lista enviada ao banco: 'tudo' sozinho; senão na ordem do banco", () => {
  assertEquals(categoriasParaEnviar(["orcamentos", "vendas"] as Escolha[]), ["vendas", "orcamentos"]);
  assertEquals(categoriasParaEnviar(["os", "tudo"]), ["tudo"]);
  assertEquals(categoriasParaEnviar([]), []);
});

Deno.test("contagens em português", () => {
  assertEquals(contagemAmigavel(1, ROTULOS_TABELA.ordens_servico), "1 ordem de serviço");
  assertEquals(contagemAmigavel(128, ROTULOS_TABELA.ordens_servico), "128 ordens de serviço");
  assertEquals(contagemAmigavel(1204, ROTULOS_TABELA.clientes), "1.204 clientes");
  assertEquals(linhasResumo("os", { ordens_servico: 14, na_lixeira: 2 }), ["14 ordens de serviço", "2 delas na lixeira"]);
  assertEquals(linhasResumo("estoque", { produtos: 0, pecas: 1, aparelhos: 3, compras_aparelhos: 0, fornecedores: 0, notas_xml: 0 }), ["1 peça", "3 aparelhos"]);
  assertEquals(linhasPorTabela({ clientes: 342, pedidos: 0, os_tecnicos: 5, tabela_nova_x: 2 }), ["342 clientes", "5 registros de técnicos das OS", "2 tabela nova x"]);
  // principais primeiro, históricos por último (mesmo sendo maiores)
  assertEquals(linhasPorTabela({ os_audit_log: 1503, clientes: 342, ordens_servico: 128, os_tecnicos: 90 }),
    ["128 ordens de serviço", "342 clientes", "90 registros de técnicos das OS", "1.503 registros do histórico das OS"]);
});

Deno.test("todas as tabelas que a prévia pode devolver têm nome amigável", () => {
  const doCatalogo = ["os_tecnicos", "os_dispositivos_adicionais", "os_tracking_links", "cliente_tracking_links", "fidelidade_resgates", "fidelidade_pontos",
    "remessa_itens", "remessas_corporativas", "trocas_garantia", "vendas_trocas", "vendas_cupons", "dispositivo_imeis", "vendas_alteracoes",
    "caixa_movimentacoes", "pagamentos_contas", "entradas_estoque", "compras_xml_itens", "compras_xml_mapeamento", "compras_xml_importadas",
    "ordens_servico", "vendas", "vendas_avulsas", "servicos_avulsos", "pedidos", "orcamentos", "contas", "extrato_lancamentos_manuais", "caixas",
    "notifications", "lista_compras", "listas_compras", "dispositivos", "compras_dispositivos", "produtos", "pecas", "origem_pessoas",
    "fornecedores", "clientes", "os_localizacoes", "os_audit_log", "clientes_audit_log"];
  for (const t of doCatalogo) assert(ROTULOS_TABELA[t], `sem nome: ${t}`);
});

Deno.test("numeração: exatamente a regra da etapa 1", () => {
  assertEquals(textosNumeracao(["os", "financeiro"], { os: { volta_para_1: true, proximo: 1 }, venda: { volta_para_1: false, proximo: 9 } }),
    ["A próxima ordem de serviço volta a ser a nº 1."]);
  assertEquals(textosNumeracao(["os"], { os: { volta_para_1: false, proximo: 2044 }, venda: { volta_para_1: false, proximo: 9 } }),
    ["A numeração das ordens de serviço continua: a próxima será a nº 2044, porque ainda há contas do Financeiro citando números de OS."]);
  assertEquals(textosNumeracao(["vendas"], { os: { volta_para_1: false, proximo: 5 }, venda: { volta_para_1: true, proximo: 1 } }),
    ["A próxima venda volta a ser a nº 1."]);
  assertEquals(textosNumeracao(["financeiro"], undefined), ["A numeração das ordens de serviço e das vendas não muda."]);
});

Deno.test("erros ZD000–ZD007, tempo esgotado, trava, senha e rede: todos dizem que nada foi apagado", () => {
  const casos: [unknown, string][] = [
    [{ code: "ZD000" }, "Você não está conectado"],
    [{ code: "ZD001", message: "Sua conta tem filiais com dados. Fale com o suporte." }, "Não é possível usar este recurso"],
    [{ code: "ZD002" }, "Palavra de confirmação errada"],
    [{ code: "ZD003" }, "Confirme sua senha"],
    [{ code: "ZD004" }, "Aguarde alguns minutos"],
    [{ code: "ZD005" }, "Os números mudaram"],
    [{ code: "ZD006" }, "A conferência final não bateu"],
    [{ code: "ZD007" }, "Escolha inválida"],
    [{ code: "57014", message: "canceling statement due to statement timeout" }, "Demorou demais"],
    [{ code: "55P03" }, "Já existe uma operação em andamento"],
    [{ code: "invalid_credentials", message: "Invalid login credentials" }, "Senha incorreta"],
    [{ name: "AuthApiError", message: "Invalid login credentials" }, "Senha incorreta"],
    [new TypeError("Failed to fetch"), "Não foi possível concluir"],
    [null, "Não foi possível concluir"],
  ];
  for (const [erro, titulo] of casos) {
    const m = mensagemErro(erro);
    assertEquals(m.titulo, titulo, JSON.stringify(erro));
    assert(m.texto.includes("Nada foi apagado."), titulo);
    assert(!/ZD0|SQLSTATE|statement|null|undefined/i.test(m.texto), `sem jargão: ${m.texto}`);
  }
  assert(mensagemErro({ code: "ZD001", message: "Sua conta tem filiais com dados. Fale com o suporte." }).texto.startsWith("Sua conta tem filiais"));
  assertEquals(mensagemErro({ code: "ZD005" }).refazerRevisao, true);
  assertEquals(mensagemErro({ code: "ZD003" }).refazerRevisao, undefined);
});

Deno.test("botão final: só com revisão válida, senha e APAGAR exato, fora de execução", () => {
  const base = { revisaoValida: true, senha: "segredo", palavra: "APAGAR", executando: false };
  assertEquals(podeConfirmar(base), true);
  assertEquals(podeConfirmar({ ...base, senha: "" }), false);
  for (const palavra of ["apagar", "Apagar", "APAGAR ", " APAGAR", "APAGA", ""]) assertEquals(podeConfirmar({ ...base, palavra }), false, palavra);
  assertEquals(podeConfirmar({ ...base, executando: true }), false);
  assertEquals(podeConfirmar({ ...base, revisaoValida: false }), false);
});

Deno.test("marca de conta de teste: só true liga", () => {
  assertEquals(temMarcaComecarDoZero({ comecar_do_zero: true }), true);
  for (const v of [null, undefined, {}, { comecar_do_zero: false }, { comecar_do_zero: "true" }, { comecar_do_zero: 1 }, [true], "x"]) {
    assertEquals(temMarcaComecarDoZero(v), false, JSON.stringify(v));
  }
});

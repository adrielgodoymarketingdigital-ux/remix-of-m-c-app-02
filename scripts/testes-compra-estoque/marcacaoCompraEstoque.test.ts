// deno test --no-check scripts/testes-compra-estoque/
// Roda as funções reais de src/lib/financeiro/marcacaoCompraEstoque.ts (caixinha
// compra_estoque no cadastro de contas reagindo à categoria).
import { assertEquals } from "jsr:@std/assert@1";
import {
  CATEGORIA_COMPRA_MERCADORIA as COMPRA,
  decidirMarcacaoCompraEstoque as decidir,
  deveAvisarSemMarcacao,
  marcacaoManual,
} from "../../src/lib/financeiro/marcacaoCompraEstoque.ts";

const DESMARCADA = { marcada: false, automatica: false };

Deno.test("escolher 'Compra de Mercadoria' marca automaticamente", () => {
  assertEquals(
    decidir({ tipo: "pagar", categoriaAnterior: "", categoriaNova: COMPRA, estado: DESMARCADA }),
    { marcada: true, automatica: true },
  );
  assertEquals(
    decidir({ tipo: "pagar", categoriaAnterior: "Aluguel", categoriaNova: COMPRA, estado: DESMARCADA }),
    { marcada: true, automatica: true },
  );
});

Deno.test("trocar para outra categoria desmarca se a marcação foi automática", () => {
  const marcadaAuto = decidir({ tipo: "pagar", categoriaAnterior: "", categoriaNova: COMPRA, estado: DESMARCADA });
  assertEquals(
    decidir({ tipo: "pagar", categoriaAnterior: COMPRA, categoriaNova: "Fornecedores", estado: marcadaAuto }),
    DESMARCADA,
  );
});

Deno.test("trocar para outra categoria NÃO desmarca se o usuário marcou à mão", () => {
  const manual = marcacaoManual(true);
  // Marcou à mão, depois escolheu a categoria: continua "do usuário".
  const comCategoria = decidir({ tipo: "pagar", categoriaAnterior: "Fornecedores", categoriaNova: COMPRA, estado: manual });
  assertEquals(comCategoria, { marcada: true, automatica: false });
  assertEquals(
    decidir({ tipo: "pagar", categoriaAnterior: COMPRA, categoriaNova: "Outros", estado: comCategoria }),
    { marcada: true, automatica: false },
  );
});

Deno.test("marcada automaticamente, usuário mexe na caixinha: troca de categoria não muda mais nada", () => {
  // Usuário desmarcou à mão com a categoria ainda selecionada.
  const desmarcadaMao = marcacaoManual(false);
  assertEquals(
    decidir({ tipo: "pagar", categoriaAnterior: COMPRA, categoriaNova: "Outros", estado: desmarcadaMao }),
    desmarcadaMao,
  );
  // Usuário remarcou à mão: trocar de categoria mantém marcada.
  assertEquals(
    decidir({ tipo: "pagar", categoriaAnterior: COMPRA, categoriaNova: "Outros", estado: marcacaoManual(true) }),
    { marcada: true, automatica: false },
  );
});

Deno.test("edição de conta antiga: sem ação do usuário, nada muda", () => {
  // Conta antiga já com a categoria e sem a marca (estado vem do banco, automatica=false).
  const doBanco = { marcada: false, automatica: false };
  // Mesma categoria "reescolhida"/reset do formulário: sem troca, sem efeito.
  assertEquals(decidir({ tipo: "pagar", categoriaAnterior: COMPRA, categoriaNova: COMPRA, estado: doBanco }), doBanco);
  // Conta antiga marcada, usuário troca a categoria: a marca era do banco (não automática), fica.
  const marcadaNoBanco = { marcada: true, automatica: false };
  assertEquals(
    decidir({ tipo: "pagar", categoriaAnterior: COMPRA, categoriaNova: "Fornecedores", estado: marcadaNoBanco }),
    marcadaNoBanco,
  );
});

Deno.test("conta a receber: categoria não mexe na caixinha", () => {
  assertEquals(decidir({ tipo: "receber", categoriaAnterior: "", categoriaNova: COMPRA, estado: DESMARCADA }), DESMARCADA);
});

Deno.test("trocas entre outras categorias não mexem na caixinha", () => {
  assertEquals(decidir({ tipo: "pagar", categoriaAnterior: "Aluguel", categoriaNova: "Luz", estado: DESMARCADA }), DESMARCADA);
  assertEquals(
    decidir({ tipo: "pagar", categoriaAnterior: "Aluguel", categoriaNova: "Luz", estado: marcacaoManual(true) }),
    { marcada: true, automatica: false },
  );
});

Deno.test("aviso só com categoria Compra de Mercadoria, conta a pagar e caixinha desmarcada", () => {
  assertEquals(deveAvisarSemMarcacao({ tipo: "pagar", categoria: COMPRA, marcada: false }), true);
  assertEquals(deveAvisarSemMarcacao({ tipo: "pagar", categoria: COMPRA, marcada: true }), false);
  assertEquals(deveAvisarSemMarcacao({ tipo: "pagar", categoria: "Fornecedores", marcada: false }), false);
  assertEquals(deveAvisarSemMarcacao({ tipo: "receber", categoria: COMPRA, marcada: false }), false);
});


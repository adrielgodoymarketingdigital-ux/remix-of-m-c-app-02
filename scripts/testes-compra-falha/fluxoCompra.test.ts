// TZ=UTC deno test --no-check scripts/testes-compra-falha/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-compra-falha/
// Roda as funções reais de src/lib/origem/fluxoCompra.ts (envio de "Registrar
// Nova Compra"). Caso real (out/2026, Android/PWA): 4 tentativas criaram pessoa
// e dispositivo, a compra não gravou e o diálogo fechou e limpou o formulário
// como num sucesso.
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  ASSINATURA_ALTURA_MAX,
  ASSINATURA_LARGURA_MAX,
  MENSAGEM_FALHA_COMPRA,
  ResultadoCompra,
  TempoEsgotado,
  TravaEnvio,
  comLimiteDeTempo,
  compraFalhou,
  criadosSemCompra,
  deveFecharDialogo,
  dimensaoAssinaturaExportada,
  finalizarEnvio,
  idsParaTentativa,
  iniciarEnvio,
  montarMensagemErroCompra,
  tamanhoPayloadKB,
} from "../../src/lib/origem/fluxoCompra.ts";

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

// (a) Quando fechar o diálogo
Deno.test("(a) só fecha o diálogo quando a compra gravou", () => {
  const ok: ResultadoCompra<{ id: string }> = { ok: true, compra: { id: "c1" } };
  const falha: ResultadoCompra<{ id: string }> = { ok: false, mensagem: MENSAGEM_FALHA_COMPRA, detalhe: "x" };
  assertEquals(deveFecharDialogo(ok), true);
  assertEquals(deveFecharDialogo(falha), false);
  assertEquals(deveFecharDialogo(null), false, "antes: null (falha) também fechava");
  assertEquals(deveFecharDialogo(undefined), false);
  assertEquals(compraFalhou(falha), true);
  assertEquals(compraFalhou(ok), false);
});

// (b) Mensagem de erro
Deno.test("(b) mensagem fixa + motivo técnico resumido", () => {
  const casos: [unknown, string | null][] = [
    [{ message: 'new row violates check constraint "check_origem"', code: "23514" }, "Selecione apenas uma origem (pessoa OU fornecedor)."],
    [new TempoEsgotado("Obter sessão", 15000), "O aparelho demorou para confirmar a sessão. Verifique a internet e tente de novo."],
    [new TypeError("Failed to fetch"), "Sem conexão com o servidor."],
    [{ status: 413, message: "Payload Too Large" }, "Dados grandes demais para enviar (fotos/assinaturas)."],
    [{ status: 401, message: "JWT expired", code: "PGRST301" }, "Sessão expirada. Saia e entre de novo no app."],
    [new Error("Usuário não autenticado"), "Sessão expirada. Saia e entre de novo no app."],
    [{ code: "23503", message: "insert or update violates foreign key constraint" }, "23503: insert or update violates foreign key constraint"],
    [{}, null],
    [null, null],
  ];
  for (const [erro, detalhe] of casos) {
    assertEquals(montarMensagemErroCompra(erro), { mensagem: MENSAGEM_FALHA_COMPRA, detalhe }, JSON.stringify(erro));
  }
  assertEquals(MENSAGEM_FALHA_COMPRA, "Não foi possível registrar a compra. Seus dados continuam aqui, tente de novo.");
  const longo = montarMensagemErroCompra({ code: "XX000", message: "a".repeat(500) }).detalhe!;
  assertEquals(longo.length, 160);
});

// (c) Reaproveitar o que foi criado na sessão (nunca apagar)
Deno.test("(c) nova tentativa usa os ids do formulário; se vazio, reaproveita o criado na sessão", () => {
  const criados = { pessoaId: "p-nova", dispositivoId: "d-novo" };
  assertEquals(idsParaTentativa({ tipo_origem: "terceiro", pessoa_id: "p1", dispositivo_id: "d1" }, criados), { pessoaId: "p1", dispositivoId: "d1" });
  assertEquals(idsParaTentativa({ tipo_origem: "terceiro", pessoa_id: "", dispositivo_id: "" }, criados), { pessoaId: "p-nova", dispositivoId: "d-novo" });
  assertEquals(idsParaTentativa({ tipo_origem: "terceiro" }, {}), { pessoaId: null, dispositivoId: null });
  // Origem fornecedor: nunca manda pessoa (check_origem exige só uma).
  assertEquals(idsParaTentativa({ tipo_origem: "fornecedor", pessoa_id: "p1", dispositivo_id: "d1" }, criados), { pessoaId: null, dispositivoId: "d1" });
});

Deno.test("(c) pendentes sem compra só aparecem quando a compra falhou", () => {
  const criados = { pessoaId: "p-nova", dispositivoId: "d-novo" };
  assertEquals(criadosSemCompra(criados, false), ["pessoa p-nova", "dispositivo d-novo"]);
  assertEquals(criadosSemCompra(criados, true), []);
  assertEquals(criadosSemCompra({}, false), []);
});

// (d) Trava de duplo envio
Deno.test("(d) segundo clique durante o envio é ignorado; libera ao terminar", () => {
  const trava: TravaEnvio = { emAndamento: false };
  assertEquals(iniciarEnvio(trava), true);
  assertEquals(iniciarEnvio(trava), false);
  assertEquals(iniciarEnvio(trava), false);
  finalizarEnvio(trava);
  assertEquals(iniciarEnvio(trava), true);
});

Deno.test("(d) cliques simultâneos: só um envio roda", async () => {
  const trava: TravaEnvio = { emAndamento: false };
  let envios = 0;
  const clicar = async () => {
    if (!iniciarEnvio(trava)) return;
    try {
      envios++;
      await new Promise((r) => setTimeout(r, 10));
    } finally {
      finalizarEnvio(trava);
    }
  };
  await Promise.all([clicar(), clicar(), clicar()]);
  assertEquals(envios, 1);
});

// Limite de tempo (só antes de escrever)
Deno.test("limite de tempo: rejeita com TempoEsgotado; resposta a tempo passa", async () => {
  const nunca = new Promise<string>(() => {});
  const erro = await assertRejects(() => comLimiteDeTempo(nunca, 20, "Obter sessão"), TempoEsgotado);
  assertEquals(erro.message, "Obter sessão: sem resposta em 0s");
  assertEquals(await comLimiteDeTempo(Promise.resolve("ok"), 50, "Obter sessão"), "ok");
  await assertRejects(() => comLimiteDeTempo(Promise.reject(new Error("falhou")), 50, "x"), Error, "falhou");
});

// (e) Assinatura exportada
Deno.test("(e) assinatura: reduz para caber em 600×200 mantendo a proporção, nunca amplia", () => {
  assertEquals([ASSINATURA_LARGURA_MAX, ASSINATURA_ALTURA_MAX], [600, 200]);
  // Medidas reais (signature_pad + trim-canvas, celular de 390 px): DPR 1, 2 e 3.
  assertEquals(dimensaoAssinaturaExportada(333, 86), { largura: 333, altura: 86, reduzida: false });
  assertEquals(dimensaoAssinaturaExportada(666, 172), { largura: 600, altura: 155, reduzida: true });
  assertEquals(dimensaoAssinaturaExportada(998, 257), { largura: 600, altura: 155, reduzida: true });
  // Assinatura alta: o limite de altura manda.
  assertEquals(dimensaoAssinaturaExportada(400, 384), { largura: 208, altura: 200, reduzida: true });
  assertEquals(dimensaoAssinaturaExportada(0, 10), { largura: 0, altura: 0, reduzida: false });
  for (const [w, h] of [[1236, 384], [921, 257], [3000, 900]]) {
    const d = dimensaoAssinaturaExportada(w, h);
    assert(d.largura <= 600 && d.altura <= 200, `${w}x${h}`);
    assert(Math.abs(d.largura / d.altura - w / h) < 0.02, "proporção");
  }
});

Deno.test("tamanho do payload em KB (UTF-8)", () => {
  assertEquals(tamanhoPayloadKB({ a: "x".repeat(1024 * 10 - 8) }), 10);
  assertEquals(tamanhoPayloadKB([{ assinatura: "data:image/png;base64," + "A".repeat(58 * 1024) }]), 58);
  assertEquals(tamanhoPayloadKB({ nome: "ç".repeat(1024) }), 2, "ç ocupa 2 bytes em UTF-8");
});

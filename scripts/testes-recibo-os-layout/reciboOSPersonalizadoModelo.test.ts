// deno test --no-check scripts/testes-recibo-os-layout/
// Dados do recibo A4 personalizado: os mesmos campos, nas mesmas condições, do
// recibo de sempre (ImpressaoA4Padrao/Tech). Dados fictícios.
import { assertEquals } from "jsr:@std/assert@1";
import { colunasFotosRecibo, montarDadosReciboOSPersonalizado } from "../../src/lib/ordemServico/reciboOSPersonalizadoModelo.ts";

const ligado = { mostrar_checklist: true, mostrar_avarias: true };

Deno.test("checklist: estado real de cada item, nunca marca ok o que não está ok", () => {
  const d = montarDadosReciboOSPersonalizado({
    avarias: { checklist: { entrada: { tela: true, camera_traseira: false, peca_trocada: true }, saida: {}, peca_trocada_descricao_entrada: "Tela paralela" } },
  }, ligado);
  assertEquals(d.checklistEntrada?.itens, [
    { chave: "tela", rotulo: "tela", ok: true, detalhe: null },
    { chave: "camera_traseira", rotulo: "camera traseira", ok: false, detalhe: null },
    { chave: "peca_trocada", rotulo: "peca trocada", ok: true, detalhe: "Tela paralela" },
  ]);
  assertEquals(d.checklistSaida, null);
  assertEquals(d.checklistSemTeste, false);
});

Deno.test("checklist: peça trocada desmarcada não mostra a descrição", () => {
  const d = montarDadosReciboOSPersonalizado({
    avarias: { checklist: { entrada: { peca_trocada: false }, saida: { peca_trocada: true }, peca_trocada_descricao_entrada: "X", peca_trocada_descricao_saida: "Y" } },
  }, ligado);
  assertEquals(d.checklistEntrada?.itens[0].detalhe, null);
  assertEquals(d.checklistSaida?.itens[0], { chave: "peca_trocada", rotulo: "peca trocada", ok: true, detalhe: "Y" });
});

Deno.test("checklist e avarias desligados na loja não aparecem", () => {
  const avarias = {
    checklist: { entrada: { tela: true }, saida: { tela: true }, sem_teste: true },
    avarias_visuais: [{ id: "1", lado: "frente", x: 1, y: 1, tipo: "risco" }],
  };
  const d = montarDadosReciboOSPersonalizado({ avarias }, { mostrar_checklist: false, mostrar_avarias: false });
  assertEquals([d.checklistEntrada, d.checklistSaida, d.avarias, d.checklistSemTeste], [null, null, null, false]);
  const l = montarDadosReciboOSPersonalizado({ avarias }, ligado);
  assertEquals(l.checklistSemTeste, true);
  assertEquals(l.avarias?.frente.length, 1);
  assertEquals(l.avarias?.traseira.length, 0);
});

Deno.test("serviços: servicos_inline só quando servicos_realizados está vazio", () => {
  const inline = montarDadosReciboOSPersonalizado({ avarias: { servicos_inline: [{ nome: "Troca de tela", valor: 350 }] } }, ligado);
  assertEquals(inline.servicos.map((s) => [s.nome, s.preco]), [["Troca de tela", 350]]);
  const ambos = montarDadosReciboOSPersonalizado({
    avarias: { servicos_realizados: [{ id: "a", nome: "Bateria", preco: 200, custo: 0, lucro: 200 }], servicos_inline: [{ nome: "X", valor: 1 }] },
  }, ligado);
  assertEquals(ambos.servicos.map((s) => s.nome), ["Bateria"]);
});

Deno.test("desconto e subtotal: mesma regra do recibo de sempre", () => {
  assertEquals(montarDadosReciboOSPersonalizado({ avarias: {}, total: 100 }, ligado).subtotal, undefined);
  const semSubtotal = montarDadosReciboOSPersonalizado({ avarias: { dados_pagamento: { desconto: 20 } }, total: 100 }, ligado);
  assertEquals([semSubtotal.desconto, semSubtotal.subtotal], [20, 120]);
  const comSubtotal = montarDadosReciboOSPersonalizado({ avarias: { dados_pagamento: { desconto: 20, subtotal: 150 } }, total: 130 }, ligado);
  assertEquals(comSubtotal.subtotal, 150);
});

Deno.test("observações internas só quando a OS manda imprimir", () => {
  assertEquals(montarDadosReciboOSPersonalizado({ avarias: { observacoes_internas: "Nota" } }, ligado).observacoesInternas, null);
  assertEquals(
    montarDadosReciboOSPersonalizado({ avarias: { observacoes_internas: "Nota", mostrar_obs_internas_impressao: true } }, ligado).observacoesInternas,
    "Nota",
  );
});

Deno.test("OS sem avarias não quebra", () => {
  const d = montarDadosReciboOSPersonalizado({ avarias: null, total: null }, ligado);
  assertEquals([d.servicos, d.produtos, d.custos, d.desconto, d.checklistEntrada, d.avarias], [[], [], [], 0, null, null]);
});

Deno.test("colunas das fotos", () => {
  assertEquals([1, 2, 3, 4, 6].map(colunasFotosRecibo), [2, 2, 3, 3, 3]);
});

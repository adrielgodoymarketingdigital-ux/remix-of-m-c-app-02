// deno test --no-check scripts/testes-consulta-imei/
// Roda as funções reais de src/lib/dispositivos/consultaImei.ts.
import { assertEquals } from "jsr:@std/assert@1";
import {
  consultarImeiNoCelularSeguro,
  copiarTexto,
  MENSAGEM_IMEI_COPIADO,
  URL_CELULAR_SEGURO,
  validarImei,
} from "../../src/lib/dispositivos/consultaImei.ts";

const VALIDO = "490154203237518";

Deno.test("IMEI vazio dá erro próprio", () => {
  for (const v of ["", "   ", null, undefined]) {
    assertEquals(validarImei(v), { valido: false, erro: "Informe o IMEI do aparelho para consultar." });
  }
});

Deno.test("tamanho errado ou letras dão erro de 15 números", () => {
  for (const v of ["12345", "49015420323751", "4901542032375180", "49015420323751A"]) {
    assertEquals(validarImei(v), { valido: false, erro: "O IMEI precisa ter 15 números." });
  }
});

Deno.test("dígito verificador errado é inválido, inclusive o exemplo do campo", () => {
  for (const v of ["490154203237519", "123456789012345"]) {
    assertEquals(validarImei(v), { valido: false, erro: "IMEI inválido: confira os números digitados." });
  }
});

Deno.test("válido com espaços e hífens volta só com os dígitos", () => {
  for (const v of [VALIDO, ` ${VALIDO} `, "49-015420-323751-8", "49 015420 323751 8"]) {
    assertEquals(validarImei(v), { valido: true, imei: VALIDO });
  }
});

Deno.test("copiarTexto usa a API moderna quando funciona", async () => {
  const usadas: string[] = [];
  const ok = await copiarTexto(VALIDO, {
    escreverNaAreaDeTransferencia: (t) => { usadas.push(`api:${t}`); return Promise.resolve(); },
    copiarPorSelecao: (t) => { usadas.push(`selecao:${t}`); return true; },
  });
  assertEquals([ok, usadas], [true, [`api:${VALIDO}`]]);
});

Deno.test("copiarTexto cai na seleção se a API rejeita ou não existe", async () => {
  const copiarPorSelecao = () => true;
  assertEquals(await copiarTexto(VALIDO, {
    escreverNaAreaDeTransferencia: () => Promise.reject(new Error("NotAllowedError")),
    copiarPorSelecao,
  }), true);
  assertEquals(await copiarTexto(VALIDO, { copiarPorSelecao }), true);
});

Deno.test("copiarTexto devolve false quando nada funciona, sem rejeitar", async () => {
  assertEquals(await copiarTexto(VALIDO, {
    escreverNaAreaDeTransferencia: () => Promise.reject(new Error("x")),
    copiarPorSelecao: () => { throw new Error("y"); },
  }), false);
  assertEquals(await copiarTexto(VALIDO, { copiarPorSelecao: () => false }), false);
});

Deno.test("IMEI inválido não copia nem abre o site", async () => {
  const chamadas: string[] = [];
  const r = await consultarImeiNoCelularSeguro("123", {
    escreverNaAreaDeTransferencia: () => { chamadas.push("copia"); return Promise.resolve(); },
    copiarPorSelecao: () => { chamadas.push("selecao"); return true; },
    abrirSite: () => { chamadas.push("abre"); },
  });
  assertEquals([r.ok, chamadas], [false, []]);
});

Deno.test("cópia e abertura acontecem na mesma pilha do clique, antes de a cópia terminar", () => {
  const chamadas: string[] = [];
  consultarImeiNoCelularSeguro(VALIDO, {
    escreverNaAreaDeTransferencia: (t) => { chamadas.push(`copia:${t}`); return new Promise(() => {}); },
    copiarPorSelecao: () => true,
    abrirSite: (u) => { chamadas.push(`abre:${u}`); },
  });
  // Sem await: as duas já precisam ter ocorrido de forma síncrona.
  assertEquals(chamadas, [`copia:${VALIDO}`, `abre:${URL_CELULAR_SEGURO}`]);
});

Deno.test("resultado informa se copiou, e o site abre mesmo sem cópia", async () => {
  let abriu = 0;
  const r = await consultarImeiNoCelularSeguro(VALIDO, {
    copiarPorSelecao: () => false,
    abrirSite: () => { abriu++; },
  });
  assertEquals([r, abriu], [{ ok: true, imei: VALIDO, copiado: false }, 1]);
});

Deno.test("mensagem de sucesso avisa que o site também pede o CPF", () => {
  assertEquals(
    MENSAGEM_IMEI_COPIADO,
    "IMEI copiado. Cole no campo de consulta do Celular Seguro. O site também pede o CPF de quem consulta.",
  );
});

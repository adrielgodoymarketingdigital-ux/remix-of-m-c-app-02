// deno test --no-check scripts/testes-etiquetas/
// Regra do aviso "a impressão não abriu" e registro de diagnóstico das etiquetas.
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  deveAvisarImpressaoNaoAbriu,
  descreverPlataforma,
  ehSinalDeImpressao,
  ESPERA_SINAL_IMPRESSAO_MS,
  type EventoImpressao,
  formatarDiagnosticoImpressao,
  limparEventosImpressao,
  listarEventosImpressao,
  MENSAGEM_IMPRESSAO_NAO_ABRIU,
  registrarEventoImpressao,
} from "../../src/lib/etiquetas/avisoImpressao.ts";

const evento = (tentativa: number): EventoImpressao => ({
  quando: "2026-11-05T12:00:00.000Z",
  tentativa,
  tipo: "print_chamado",
  botao: "teste",
  plataforma: "iphone",
  instalado: true,
  caminho: "print-root",
});

Deno.test("aviso: só iOS instalado sem nenhum sinal", () => {
  const casos: Array<[boolean, boolean, boolean, boolean]> = [
    // isIOS, instalado, recebeuSinal, avisa
    [true, true, false, true],
    [true, true, true, false],
    [true, false, false, false], // Safari em aba comum
    [true, false, true, false],
    [false, true, false, false], // Android ou computador instalado: só registra
    [false, true, true, false],
    [false, false, false, false], // Android ou computador no navegador
    [false, false, true, false],
  ];
  for (const [isIOS, isStandalone, recebeuSinal, esperado] of casos) {
    assertEquals(deveAvisarImpressaoNaoAbriu({ isIOS, isStandalone, recebeuSinal }), esperado, JSON.stringify({ isIOS, isStandalone, recebeuSinal }));
  }
});

Deno.test("aviso: espera e texto combinados", () => {
  assertEquals(ESPERA_SINAL_IMPRESSAO_MS, 1500);
  assertEquals(MENSAGEM_IMPRESSAO_NAO_ABRIU, "Não foi possível abrir a impressão neste aparelho. Tente pelo navegador ou use Salvar PDF");
});

Deno.test("sinais: eventos de impressão contam; passos do próprio app não", () => {
  for (const tipo of ["beforeprint", "afterprint", "midia_print", "pagina_oculta"] as const) assertEquals(ehSinalDeImpressao(tipo), true, tipo);
  for (const tipo of ["inicio", "print_chamado", "print_retornou", "print_nao_chamado", "sem_sinal", "aviso_mostrado", "popup_bloqueado", "erro"] as const) {
    assertEquals(ehSinalDeImpressao(tipo), false, tipo);
  }
});

Deno.test("plataforma: iPadOS com identificação de Mac só pelo toque", () => {
  assertEquals(descreverPlataforma("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5), "iphone");
  assertEquals(descreverPlataforma("Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X)", 5), "ipad");
  assertEquals(descreverPlataforma("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), "ipad-provavel");
  assertEquals(descreverPlataforma("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), "computador");
  assertEquals(descreverPlataforma("Mozilla/5.0 (Linux; Android 14; Pixel 7)", 5), "android");
  assertEquals(descreverPlataforma("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 10), "computador");
});

Deno.test("registro: guarda só os últimos 20, em ordem", () => {
  limparEventosImpressao();
  for (let i = 1; i <= 25; i++) registrarEventoImpressao(evento(i));
  const lista = listarEventosImpressao();
  assertEquals(lista.length, 20);
  assertEquals(lista[0].tentativa, 6);
  assertEquals(lista[19].tentativa, 25);
  limparEventosImpressao();
});

Deno.test("diagnóstico: texto para copiar", () => {
  const texto = formatarDiagnosticoImpressao([evento(1)], ["Versão: x"]);
  assertEquals(texto, "Versão: x\n\n2026-11-05T12:00:00.000Z | #1 | print_chamado | teste | iphone | instalado | print-root");
  assertStringIncludes(formatarDiagnosticoImpressao([], []), "Nenhuma impressão");
});

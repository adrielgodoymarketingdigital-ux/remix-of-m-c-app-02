// deno test --no-check --allow-read scripts/testes-layout-os/
// Mescla do JSON configuracoes_loja.layout_os_config (src/lib/ordemServico/mesclarLayoutOS.ts).
// Caso real (out/2026): salvar o layout da OS apagava etiqueta_config e
// tecnico_obrigatorio_os; salvar o técnico obrigatório numa loja com filiais
// gravava em todas as linhas um JSON só com tecnico_obrigatorio_os.
import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { linhaMatrizUnica, mesclarLayoutOS } from "../../src/lib/ordemServico/mesclarLayoutOS.ts";

// O que a tela de layout envia hoje (DialogConfiguracaoLayoutOS, sem mexer em nada).
const LAYOUT_DA_TELA = {
  mostrar_logo_impressao: true, mostrar_logo_whatsapp: true, mostrar_checklist: true, mostrar_avarias: true,
  mostrar_senha: true, mostrar_assinaturas: true, mostrar_termos_condicoes: true,
  cor_primaria: "#000000", tamanho_fonte: "normal", formato_papel: "a4", versao_layout_a4: "padrao",
  duas_os_por_folha: false, duas_os_orientacao: "horizontal",
  config_80mm: { mostrar_logo: true, mostrar_valor: true, mostrar_checklist: false },
};
const NO_BANCO = {
  ...LAYOUT_DA_TELA,
  cor_primaria: "#ff0000",
  tecnico_obrigatorio_os: true,
  etiqueta_config: { largura_mm: 44, altura_mm: 55, mostrar_senha: true },
  chave_do_futuro: { qualquer: ["coisa", 1] },
};

Deno.test("preserva etiqueta_config, tecnico_obrigatorio_os e chaves desconhecidas", () => {
  const r = mesclarLayoutOS(NO_BANCO, LAYOUT_DA_TELA);
  assertEquals(r.etiqueta_config, NO_BANCO.etiqueta_config);
  assertEquals(r.tecnico_obrigatorio_os, true);
  assertEquals(r.chave_do_futuro, NO_BANCO.chave_do_futuro);
});

Deno.test("o que foi editado vence o que estava gravado", () => {
  const r = mesclarLayoutOS(NO_BANCO, { ...LAYOUT_DA_TELA, cor_primaria: "#00ff00", mostrar_senha: false });
  assertEquals(r.cor_primaria, "#00ff00");
  assertEquals(r.mostrar_senha, false);
  assertEquals(mesclarLayoutOS(NO_BANCO, { tecnico_obrigatorio_os: false }).tecnico_obrigatorio_os, false);
});

Deno.test("editar uma chave só não toca nas outras", () => {
  const r = mesclarLayoutOS(NO_BANCO, { tecnico_obrigatorio_os: false });
  assertEquals(r, { ...NO_BANCO, tecnico_obrigatorio_os: false });
  const e = mesclarLayoutOS(NO_BANCO, { etiqueta_config: { largura_mm: 30 } });
  assertEquals(e, { ...NO_BANCO, etiqueta_config: { largura_mm: 30 } });
});

Deno.test("atual vazio, nulo, indefinido ou que não é objeto: fica só o editado", () => {
  for (const atual of [{}, null, undefined, "texto", 7, ["lista"]]) {
    assertEquals(mesclarLayoutOS(atual, LAYOUT_DA_TELA), LAYOUT_DA_TELA);
  }
});

Deno.test("antes e depois: salvar o layout sem mexer gera o JSON de hoje mais as chaves preservadas", () => {
  const antes = LAYOUT_DA_TELA; // o que era gravado (substituía o JSON inteiro)
  const depois = mesclarLayoutOS({ ...LAYOUT_DA_TELA, tecnico_obrigatorio_os: true, etiqueta_config: { largura_mm: 44 } }, LAYOUT_DA_TELA);
  assertEquals(depois, { ...antes, tecnico_obrigatorio_os: true, etiqueta_config: { largura_mm: 44 } });
  // Sem nada a preservar, o JSON é idêntico ao de hoje.
  assertEquals(mesclarLayoutOS(LAYOUT_DA_TELA, LAYOUT_DA_TELA), antes);
  assertEquals(JSON.stringify(mesclarLayoutOS(null, LAYOUT_DA_TELA)), JSON.stringify(antes));
});

Deno.test("não altera os objetos de entrada", () => {
  const atual = structuredClone(NO_BANCO);
  const editado = { tecnico_obrigatorio_os: false };
  mesclarLayoutOS(atual, editado);
  assertEquals(atual, NO_BANCO);
  assertEquals(editado, { tecnico_obrigatorio_os: false });
});

Deno.test("linhaMatrizUnica: devolve a linha quando há exatamente uma", () => {
  const linha = { id: "matriz", layout_os_config: NO_BANCO };
  assertEquals(linhaMatrizUnica([linha]), linha);
  assertEquals(linhaMatrizUnica([{ id: "m", layout_os_config: null }]).layout_os_config, null);
});

Deno.test("linhaMatrizUnica: erro de leitura, sem dados, nenhuma ou mais de uma linha lançam erro", () => {
  const linha = { id: "matriz", layout_os_config: {} };
  assertThrows(() => linhaMatrizUnica([linha], { message: "falhou" }), Error, "Nada foi alterado");
  assertThrows(() => linhaMatrizUnica(null), Error, "Nada foi alterado");
  assertThrows(() => linhaMatrizUnica(undefined), Error, "Nada foi alterado");
  assertThrows(() => linhaMatrizUnica([]), Error, "não encontrada");
  assertThrows(() => linhaMatrizUnica([linha, { id: "outra", layout_os_config: {} }]), Error, "mais de uma");
});

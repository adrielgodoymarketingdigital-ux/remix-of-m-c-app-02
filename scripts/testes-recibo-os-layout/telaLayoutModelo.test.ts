// deno test --no-check scripts/testes-recibo-os-layout/
// Tela "Layout da OS": textos da escolha do modelo (pt-BR e es com as mesmas
// chaves, um texto por caminho que fica no padrão) e gravação por mescla —
// salvar etiqueta/técnico obrigatório não apaga a escolha, e salvar o layout
// sem mexer no modelo não cria a chave.
import { assert, assertEquals } from "jsr:@std/assert@1";
import servicosPtBR from "../../src/locales/pt-BR/servicos.ts";
import servicosEs from "../../src/locales/es/servicos.ts";
import { CAMINHOS_SO_PADRAO, modeloReciboA4 } from "../../src/lib/ordemServico/modeloReciboOS.ts";
import { mesclarLayoutOS } from "../../src/lib/ordemServico/mesclarLayoutOS.ts";

Deno.test("um texto por caminho que fica no padrão, em pt-BR e es", () => {
  assertEquals(Object.keys(servicosPtBR.layoutOS.soPadrao).sort(), [...CAMINHOS_SO_PADRAO].sort());
  assertEquals(Object.keys(servicosEs.layoutOS.soPadrao).sort(), [...CAMINHOS_SO_PADRAO].sort());
  assertEquals(Object.keys(servicosEs.layoutOS).sort(), Object.keys(servicosPtBR.layoutOS).sort());
  assertEquals(Object.keys(servicosEs.reciboOS).sort(), Object.keys(servicosPtBR.reciboOS).sort());
  for (const v of [...Object.values(servicosEs.layoutOS), ...Object.values(servicosEs.reciboOS)]) assert(v);
});

Deno.test("o cartão antigo da versão Tech passa a se chamar Tech", () => {
  assertEquals(servicosPtBR.layoutOS.versaoTech, "Tech");
  assertEquals(servicosPtBR.layoutOS.versaoTitulo, "Versão do Layout A4");
});

Deno.test("outras telas gravando no mesmo JSON não apagam a escolha", () => {
  const banco = { versao_layout_a4: "tech", modelo_recibo_a4: "personalizado" };
  const depoisEtiqueta = mesclarLayoutOS(banco, { etiqueta_config: { largura: 50 } });
  assertEquals(modeloReciboA4(depoisEtiqueta), "personalizado");
  const depoisTecnico = mesclarLayoutOS(depoisEtiqueta, { tecnico_obrigatorio_os: true });
  assertEquals(modeloReciboA4(depoisTecnico), "personalizado");
});

Deno.test("salvar o layout sem tocar no modelo não cria a chave (loja segue no padrão)", () => {
  const banco = { versao_layout_a4: "padrao", mostrar_checklist: true };
  const daTela = { versao_layout_a4: "padrao", mostrar_checklist: false };
  const gravado = mesclarLayoutOS(banco, daTela);
  assert(!("modelo_recibo_a4" in gravado));
  assertEquals(modeloReciboA4(gravado), "padrao");
});

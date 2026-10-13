// deno test --no-check scripts/testes-fotos-os/
// Tela "Layout da OS" com o interruptor "Fotos do aparelho": o que a tela envia
// (só os campos dela, agora com mostrar_fotos_impressao) é gravado por mescla
// sobre o JSON do banco (src/lib/ordemServico/mesclarLayoutOS.ts), sem apagar
// etiqueta_config nem tecnico_obrigatorio_os.
import { assertEquals } from "jsr:@std/assert@1";
import { mesclarLayoutOS } from "../../src/lib/ordemServico/mesclarLayoutOS.ts";

// O que DialogConfiguracaoLayoutOS envia ao salvar (LAYOUT_PADRAO da tela).
const layoutDaTela = (mostrar_fotos_impressao: boolean) => ({
  mostrar_logo_impressao: true, mostrar_logo_whatsapp: true, mostrar_checklist: true, mostrar_avarias: true,
  mostrar_senha: true, mostrar_assinaturas: true, mostrar_termos_condicoes: true, mostrar_fotos_impressao,
  cor_primaria: "#000000", tamanho_fonte: "normal", formato_papel: "a4", versao_layout_a4: "padrao",
  duas_os_por_folha: false, duas_os_orientacao: "horizontal",
  config_80mm: { mostrar_logo: true, mostrar_valor: true, mostrar_checklist: false },
});
const PRESERVADAS = {
  tecnico_obrigatorio_os: true,
  etiqueta_config: { largura_mm: 60, altura_mm: 55, mostrar_telefone: true },
  chave_do_futuro: { qualquer: ["coisa", 1] },
};

Deno.test("ligar 'Fotos do aparelho' grava mostrar_fotos_impressao e mantém etiqueta e técnico obrigatório", () => {
  // Banco ainda sem o campo novo (loja que nunca abriu a tela depois da novidade).
  const noBanco = { ...layoutDaTela(false), ...PRESERVADAS } as Record<string, unknown>;
  delete noBanco.mostrar_fotos_impressao;
  const gravado = mesclarLayoutOS(noBanco, layoutDaTela(true));
  assertEquals(gravado.mostrar_fotos_impressao, true);
  assertEquals(gravado.etiqueta_config, PRESERVADAS.etiqueta_config);
  assertEquals(gravado.tecnico_obrigatorio_os, true);
  assertEquals(gravado.chave_do_futuro, PRESERVADAS.chave_do_futuro);
  assertEquals(gravado, { ...layoutDaTela(true), ...PRESERVADAS });
});

Deno.test("desligar 'Fotos do aparelho' grava false (não some com a chave) e mantém o resto", () => {
  const noBanco = { ...layoutDaTela(true), ...PRESERVADAS };
  const gravado = mesclarLayoutOS(noBanco, layoutDaTela(false));
  assertEquals(gravado.mostrar_fotos_impressao, false);
  assertEquals(gravado, { ...layoutDaTela(false), ...PRESERVADAS });
});

Deno.test("etiqueta e técnico obrigatório gravados depois não mexem em mostrar_fotos_impressao", () => {
  const noBanco = { ...layoutDaTela(true), ...PRESERVADAS };
  assertEquals(mesclarLayoutOS(noBanco, { etiqueta_config: { largura_mm: 30 } }).mostrar_fotos_impressao, true);
  assertEquals(mesclarLayoutOS(noBanco, { tecnico_obrigatorio_os: false }).mostrar_fotos_impressao, true);
});

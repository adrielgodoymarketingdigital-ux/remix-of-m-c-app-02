// deno test --no-check scripts/testes-fiscal/
// Campos fiscais dos cadastros (src/lib/fiscal/dadosFiscais.ts) e quem vê o
// módulo (src/lib/fiscal/visibilidade.ts). Regras: texto vazio vira null; os
// avisos não impedem salvar; editar e salvar sem mexer devolve o mesmo valor.
import { assertEquals } from "jsr:@std/assert@1";
import {
  aliquotaParaNumero,
  avisosFiscaisCliente,
  avisosFiscaisItem,
  avisosFiscaisServico,
  CAMPOS_FISCAIS_CLIENTE_VAZIOS,
  CAMPOS_FISCAIS_ITEM_VAZIOS,
  CAMPOS_FISCAIS_SERVICO_VAZIOS,
  camposFiscaisClienteDaLinha,
  camposFiscaisItemDaLinha,
  camposFiscaisServicoDaLinha,
  colunasFiscaisCliente,
  colunasFiscaisItem,
  colunasFiscaisServico,
} from "../../src/lib/fiscal/dadosFiscais.ts";
import { fiscalVisivelPara } from "../../src/lib/fiscal/visibilidade.ts";

Deno.test("visibilidade: só admin vê o módulo fiscal", () => {
  assertEquals(fiscalVisivelPara({ isAdmin: true }), true);
  assertEquals(fiscalVisivelPara({ isAdmin: false }), false);
});

Deno.test("formulário vazio grava tudo null (nunca string vazia)", () => {
  assertEquals(colunasFiscaisItem(CAMPOS_FISCAIS_ITEM_VAZIOS), { ncm: null, cest: null, unidade: null, perfil_tributario_id: null });
  assertEquals(colunasFiscaisServico(CAMPOS_FISCAIS_SERVICO_VAZIOS),
    { codigo_lc116: null, codigo_municipal: null, aliquota_iss: null, iss_retido: null, perfil_tributario_id: null });
  assertEquals(colunasFiscaisCliente(CAMPOS_FISCAIS_CLIENTE_VAZIOS), { email: null, complemento: null, inscricao_estadual: null });
  assertEquals(colunasFiscaisItem({ ncm: "   ", cest: "\t", unidade: " ", perfil_tributario_id: "" }),
    { ncm: null, cest: null, unidade: null, perfil_tributario_id: null });
});

Deno.test("item: carrega do banco e salva de volta sem perder (linha antiga sem as chaves = vazio)", () => {
  const linha = { ncm: "85171300", cest: "2105300", unidade: "UN", perfil_tributario_id: "perfil-1" };
  assertEquals(colunasFiscaisItem(camposFiscaisItemDaLinha(linha)), linha);
  assertEquals(camposFiscaisItemDaLinha({}), CAMPOS_FISCAIS_ITEM_VAZIOS);
  assertEquals(camposFiscaisItemDaLinha(null), CAMPOS_FISCAIS_ITEM_VAZIOS);
  assertEquals(colunasFiscaisItem({ ...CAMPOS_FISCAIS_ITEM_VAZIOS, unidade: " kit " }).unidade, "KIT");
});

Deno.test("serviço: carrega e salva de volta sem perder; iss_retido sim/não/não informado", () => {
  const linha = { codigo_lc116: "14.01", codigo_municipal: "1401", aliquota_iss: 2.5, iss_retido: false, perfil_tributario_id: "p" };
  const form = camposFiscaisServicoDaLinha(linha);
  assertEquals([form.aliquota_iss, form.iss_retido], ["2,5", "nao"]);
  assertEquals(colunasFiscaisServico(form), linha);
  assertEquals(camposFiscaisServicoDaLinha({ iss_retido: true }).iss_retido, "sim");
  assertEquals(camposFiscaisServicoDaLinha({ iss_retido: null }).iss_retido, "");
  assertEquals(colunasFiscaisServico({ ...CAMPOS_FISCAIS_SERVICO_VAZIOS, iss_retido: "" }).iss_retido, null);
});

Deno.test("cliente: carrega e salva de volta sem perder", () => {
  const linha = { email: "a@b.com", complemento: "Sala 2", inscricao_estadual: "123.456.789.000" };
  assertEquals(colunasFiscaisCliente(camposFiscaisClienteDaLinha(linha)), linha);
});

Deno.test("alíquota: vírgula ou ponto, 2 casas, fora de 0..100 ou inválida vira null", () => {
  assertEquals(["5", "5,5", "2.75", "0", "100", "3,333"].map(aliquotaParaNumero), [5, 5.5, 2.75, 0, 100, 3.33]);
  assertEquals(["", "abc", "-1", "100,01", "1e2", "5%"].map(aliquotaParaNumero), [null, null, null, null, null, null]);
});

Deno.test("avisos leves: NCM 8, CEST 7, unidade até 6, LC 116 14.01, alíquota e e-mail", () => {
  assertEquals(avisosFiscaisItem({ ncm: "8517.13.00", cest: "21.053.00", unidade: "UN", perfil_tributario_id: "" }), {});
  const item = avisosFiscaisItem({ ncm: "851713", cest: "12", unidade: "UNIDADE", perfil_tributario_id: "" });
  assertEquals(Object.keys(item).sort(), ["cest", "ncm", "unidade"]);
  assertEquals(avisosFiscaisServico({ ...CAMPOS_FISCAIS_SERVICO_VAZIOS, codigo_lc116: "14.01", aliquota_iss: "5" }), {});
  assertEquals(avisosFiscaisServico({ ...CAMPOS_FISCAIS_SERVICO_VAZIOS, codigo_lc116: "1.01" }), {});
  const serv = avisosFiscaisServico({ ...CAMPOS_FISCAIS_SERVICO_VAZIOS, codigo_lc116: "1401", aliquota_iss: "150" });
  assertEquals(Object.keys(serv).sort(), ["aliquota_iss", "codigo_lc116"]);
  assertEquals(typeof avisosFiscaisServico({ ...CAMPOS_FISCAIS_SERVICO_VAZIOS, aliquota_iss: "2,555" }).aliquota_iss, "string");
  assertEquals(avisosFiscaisCliente({ ...CAMPOS_FISCAIS_CLIENTE_VAZIOS, email: "a@b.com" }), {});
  assertEquals(Object.keys(avisosFiscaisCliente({ ...CAMPOS_FISCAIS_CLIENTE_VAZIOS, email: "a@b" })), ["email"]);
  // Campo vazio nunca gera aviso.
  assertEquals(avisosFiscaisItem(CAMPOS_FISCAIS_ITEM_VAZIOS), {});
});

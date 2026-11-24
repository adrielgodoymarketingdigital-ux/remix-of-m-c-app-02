// deno test -A --no-check src/lib/ordemServico/tempoGarantiaOS.test.ts
// "Sem garantia" na OS: o Select mostra o valor real e a edição não vira 90.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TEMPO_GARANTIA_OS_PADRAO,
  tempoGarantiaCarregadoDaOS,
  tempoGarantiaDoSelect,
  tempoGarantiaParaSelect,
  VALOR_SELECT_SEM_GARANTIA,
} from "./tempoGarantiaOS.ts";

const RAIZ = new URL("../../../", import.meta.url);
const ler = (caminho: string) => readFileSync(new URL(caminho, RAIZ), "utf8");
const WIZARD = "src/components/ordens/ordem-servico-wizard/";

test("OS nova começa em 90 dias", () => {
  assert.equal(TEMPO_GARANTIA_OS_PADRAO, 90);
  assert.equal(tempoGarantiaParaSelect(TEMPO_GARANTIA_OS_PADRAO), "90");
  const estado = ler(WIZARD + "useOrdemServicoWizardState.ts");
  assert.match(estado, /tempoGarantia: TEMPO_GARANTIA_OS_PADRAO,/);
});

test("null/undefined/0 mostram 'Sem garantia' (\"0\"), nunca 90", () => {
  assert.equal(VALOR_SELECT_SEM_GARANTIA, "0");
  assert.equal(tempoGarantiaParaSelect(null), "0");
  assert.equal(tempoGarantiaParaSelect(undefined), "0");
  assert.equal(tempoGarantiaParaSelect(0), "0");
  assert.equal(tempoGarantiaParaSelect(Number.NaN), "0");
});

test("número de dias mostra o próprio número", () => {
  for (const d of [7, 15, 30, 60, 90, 180, 365]) assert.equal(tempoGarantiaParaSelect(d), String(d));
});

test("escolher 'Sem garantia' grava null (formato de sempre); dias gravam o número", () => {
  assert.equal(tempoGarantiaDoSelect("0"), null);
  assert.equal(tempoGarantiaDoSelect(""), null);
  for (const d of [7, 30, 90, 365]) assert.equal(tempoGarantiaDoSelect(String(d)), d);
});

test("ida e volta: escolher no Select e reler mostra a mesma opção", () => {
  for (const v of ["0", "7", "15", "30", "60", "90", "180", "365"]) {
    assert.equal(tempoGarantiaParaSelect(tempoGarantiaDoSelect(v)), v);
  }
});

test("carga da OS para editar: null/0 continuam sem garantia, dias preservados", () => {
  assert.equal(tempoGarantiaCarregadoDaOS(null), null);
  assert.equal(tempoGarantiaCarregadoDaOS(undefined), null);
  assert.equal(tempoGarantiaCarregadoDaOS(0), null);
  for (const d of [7, 30, 90, 365]) assert.equal(tempoGarantiaCarregadoDaOS(d), d);
  // OS salva sem garantia reabre mostrando "Sem garantia".
  assert.equal(tempoGarantiaParaSelect(tempoGarantiaCarregadoDaOS(null)), "0");
});

test("wizard usa as funções (sem fallback '90' / '?? 90')", () => {
  const etapa = ler(WIZARD + "EtapaInformacoesServico.tsx");
  const estado = ler(WIZARD + "useOrdemServicoWizardState.ts");
  assert.match(etapa, /value=\{tempoGarantiaParaSelect\(formData\.tempoGarantia\)\}/);
  assert.match(etapa, /tempoGarantia: tempoGarantiaDoSelect\(value\)/);
  assert.doesNotMatch(etapa, /tempoGarantia\?\.toString\(\) \|\| "90"/);
  assert.match(estado, /tempoGarantia: tempoGarantiaCarregadoDaOS\(ordem\.tempo_garantia\)/);
  assert.doesNotMatch(estado, /tempo_garantia \?\? 90/);
  // Toda opção que o Select pode receber existe na lista.
  const opcoes = [...etapa.matchAll(/<SelectItem value="(\d+)">/g)].map((m) => m[1]);
  for (const v of ["0", "7", "15", "30", "60", "90", "180", "365"]) assert.ok(opcoes.includes(v), v);
});

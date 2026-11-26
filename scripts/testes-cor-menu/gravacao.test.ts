// deno test --no-check --no-lock --allow-read scripts/testes-cor-menu/
// Gravação da cor do menu em configuracoes_loja.cores_personalizadas: sempre
// mescla, nunca substitui (src/lib/configuracaoLoja/coresPersonalizadasLinhas.ts).
// Cliente simulado em memória; dados fictícios.
import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import {
  definirCorMenu,
  gravarCoresPorLinha,
  linhaDeReferencia,
  mesclarCoresApp,
  removerCorMenu,
  removerCoresApp,
  type ClienteCores,
  type LinhaCores,
} from "../../src/lib/configuracaoLoja/coresPersonalizadasLinhas.ts";
import { corMenuDasCores } from "../../src/lib/menu/corMenu.ts";

interface Linha extends LinhaCores {
  user_id: string;
}

function simulado(linhas: Linha[]) {
  const estado = { linhas: structuredClone(linhas) };
  const cliente: ClienteCores = {
    from: () => ({
      select: () => ({
        eq: (_c: string, v: string) => Promise.resolve({ data: estado.linhas.filter((l) => l.user_id === v).map(({ id, empresa_id, cores_personalizadas }) => ({ id, empresa_id, cores_personalizadas: structuredClone(cores_personalizadas) })), error: null }),
      }),
      update: (valores) => ({
        eq: (_c: string, id: string) => {
          const l = estado.linhas.find((x) => x.id === id);
          if (l) l.cores_personalizadas = structuredClone(valores.cores_personalizadas);
          return Promise.resolve({ data: null, error: null });
        },
      }),
    }),
  };
  return { estado, cliente };
}

const DONO = "dono-1";
const APP = { primary_from: "#064e3b", primary_via: "#059669", primary_to: "#10b981", card_faturamento_from: "#064e3b", card_faturamento_via: "#059669", card_faturamento_to: "#10b981" };
const NOVAS_APP = { primary_from: "#4c1d95", primary_via: "#6d28d9", primary_to: "#8b5cf6", card_faturamento_from: "#4c1d95", card_faturamento_via: "#6d28d9", card_faturamento_to: "#8b5cf6" };
const TRACK = { cor_fundo: "#000000", mostrar_fotos: true };
const OUTRO: Linha = { id: "cfg-outro", user_id: "outro", empresa_id: null, cores_personalizadas: { menu_cor: "#ffffff", ...APP } };

const loja = (m: unknown, f: unknown = m): Linha[] => [
  { id: "cfg-m", user_id: DONO, empresa_id: null, cores_personalizadas: structuredClone(m) },
  { id: "cfg-f", user_id: DONO, empresa_id: "filial-1", cores_personalizadas: structuredClone(f) },
  structuredClone(OUTRO),
];
const valor = (s: { estado: { linhas: Linha[] } }, id: string) => s.estado.linhas.find((l) => l.id === id)!.cores_personalizadas;

Deno.test("salvar cor do menu preserva primary_*, card_faturamento_*, recibo e tracking (matriz e filial)", async () => {
  const s = simulado(loja({ ...APP, recibo_cabecalho_cor: "#7f1d1d", tracking_config: TRACK }, { tracking_config: { x: 1 } }));
  assertEquals(await gravarCoresPorLinha(s.cliente, DONO, definirCorMenu("#1F2937")), 2);
  assertEquals(valor(s, "cfg-m"), { ...APP, recibo_cabecalho_cor: "#7f1d1d", tracking_config: TRACK, menu_cor: "#1f2937" });
  assertEquals(valor(s, "cfg-f"), { tracking_config: { x: 1 }, menu_cor: "#1f2937" });
  assertEquals(s.estado.linhas[2], OUTRO, "outro dono intocado");
});

Deno.test("salvar cor do menu em linha nula/vazia cria só a chave", async () => {
  for (const atual of [null, {}, [], "lixo"]) {
    const s = simulado(loja(atual));
    await gravarCoresPorLinha(s.cliente, DONO, definirCorMenu("#000"));
    assertEquals(valor(s, "cfg-m"), { menu_cor: "#000000" }, JSON.stringify(atual));
  }
});

Deno.test("cor inválida não grava nada", () => {
  for (const v of ["azul", "#12", "", "#1d4ed8;x"]) assertThrows(() => definirCorMenu(v));
});

Deno.test("salvar cores antigas (Salvar Cores) preserva menu_cor", async () => {
  const s = simulado(loja({ ...APP, menu_cor: "#4a0e1c" }));
  await gravarCoresPorLinha(s.cliente, DONO, mesclarCoresApp(NOVAS_APP));
  assertEquals(valor(s, "cfg-m"), { ...NOVAS_APP, menu_cor: "#4a0e1c" });
  assertEquals(valor(s, "cfg-f"), { ...NOVAS_APP, menu_cor: "#4a0e1c" });
});

Deno.test("Salvar Cores com estado da tela carregado ANTES de trocar o menu não desfaz a troca", async () => {
  // A tela carrega { ...DEFAULT, ...linha } (todas as chaves). Depois o dono restaura/troca o menu
  // e então clica em "Salvar Cores": a menu_cor velha do estado não pode voltar.
  const s = simulado(loja({ ...APP, menu_cor: "#4a0e1c", recibo_cabecalho_cor: "#7f1d1d" }));
  const estadoDaTela = { ...APP, menu_cor: "#4a0e1c", recibo_cabecalho_cor: "#7f1d1d" };
  await gravarCoresPorLinha(s.cliente, DONO, removerCorMenu);
  await gravarCoresPorLinha(s.cliente, DONO, mesclarCoresApp({ ...estadoDaTela, ...NOVAS_APP }));
  assertEquals(valor(s, "cfg-m"), { ...NOVAS_APP, recibo_cabecalho_cor: "#7f1d1d" });
});

Deno.test("resetar cores antigas (Resetar para Padrão) preserva menu_cor", async () => {
  const s = simulado(loja({ ...APP, menu_cor: "#4a0e1c" }, { ...APP, menu_cor: "#4a0e1c", tracking_config: TRACK }));
  await gravarCoresPorLinha(s.cliente, DONO, removerCoresApp);
  assertEquals(valor(s, "cfg-m"), { menu_cor: "#4a0e1c" });
  assertEquals(valor(s, "cfg-f"), { menu_cor: "#4a0e1c", tracking_config: TRACK });
});

Deno.test("restaurar padrão do menu remove só menu_cor", async () => {
  const s = simulado(loja({ ...APP, menu_cor: "#4a0e1c", recibo_cabecalho_cor: "#7f1d1d", tracking_config: TRACK }, { menu_cor: "#4a0e1c" }));
  await gravarCoresPorLinha(s.cliente, DONO, removerCorMenu);
  assertEquals(valor(s, "cfg-m"), { ...APP, recibo_cabecalho_cor: "#7f1d1d", tracking_config: TRACK });
  assertEquals(valor(s, "cfg-f"), null, "linha que fica vazia vira null, como o Resetar já fazia");
  assertEquals(s.estado.linhas[2], OUTRO);
});

Deno.test("restaurar padrão sem menu_cor gravada: linha igual", async () => {
  const s = simulado(loja({ ...APP }));
  await gravarCoresPorLinha(s.cliente, DONO, removerCorMenu);
  assertEquals(valor(s, "cfg-m"), { ...APP });
});

Deno.test("leitura usa a linha da matriz (linhaDeReferencia)", () => {
  const linhas = [
    { empresa_id: "filial-1", cores_personalizadas: { menu_cor: "#ffffff" } },
    { empresa_id: null, cores_personalizadas: { menu_cor: "#000000" } },
  ];
  assertEquals(corMenuDasCores(linhaDeReferencia(linhas)?.cores_personalizadas), "#000000");
  assertEquals(corMenuDasCores(linhaDeReferencia([])?.cores_personalizadas), null);
});

Deno.test("erro de leitura propaga e não grava", async () => {
  const cliente: ClienteCores = {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: null, error: new Error("falhou") }) }),
      update: () => ({ eq: () => { throw new Error("não deveria gravar"); } }),
    }),
  };
  await assertRejects(() => gravarCoresPorLinha(cliente, DONO, definirCorMenu("#000000")));
});

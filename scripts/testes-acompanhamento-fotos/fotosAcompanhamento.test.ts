// deno test --no-check --allow-read scripts/testes-acompanhamento-fotos/
// Fotos do aparelho nos links de acompanhamento (src/lib/acompanhamento/fotosAcompanhamento.ts):
// leitura da coluna "fotos" das RPCs, caixa "Incluir fotos neste link" e as mesclas
// de gravação da loja (cores_personalizadas.tracking_config) e da OS (avarias).
// As regras e o corte em 6 valem no SQL; aqui é o que a tela faz com a resposta.
// Regra por OS (opt-out): com a loja ligada, as fotos saem por padrão; só o false
// explícito em avarias.fotos_acompanhamento tira.
import { assertEquals } from "jsr:@std/assert@1";
import {
  AVISO_CAIXA_OS, AVISO_LIGAR_FOTOS_LOJA, MAX_FOTOS_ACOMPANHAMENTO, MOTIVO_LOJA_DESLIGADA, MOTIVO_OS_SEM_FOTOS,
  aplicarEscolhaFotosDoBanco, decidirCaixaFotosLink, fotosDoAcompanhamento, lojaMostraFotos, mesclarFotosAcompanhamento,
  mesclarTrackingConfig, osIncluiFotos, precisaConfirmarFotosLoja, textoVerFotos, totalFotosParaLink,
} from "../../src/lib/acompanhamento/fotosAcompanhamento.ts";
import { PARAMETROS_MINIATURA, urlMiniatura } from "../../src/lib/os/fotosImpressaoOS.ts";
import { linhaMatrizUnica } from "../../src/lib/ordemServico/mesclarLayoutOS.ts";

const url = (n: number) => `https://qztuzcchknptrvkdmdph.supabase.co/storage/v1/object/public/dispositivos-fotos/u1/os-${n}.jpg`;
const fotos = (n: number) => Array.from({ length: n }, (_, i) => url(i + 1));

Deno.test("resposta da RPC: lista de URLs vira lista de fotos, na ordem", () => {
  assertEquals(fotosDoAcompanhamento(fotos(3)), fotos(3));
});

Deno.test("resposta antiga, sem o campo fotos (antes da migration): nenhuma foto, sem erro", () => {
  for (const v of [undefined, null, "", "https://x/y.jpg", 7, {}, { 0: url(1) }, []]) assertEquals(fotosDoAcompanhamento(v), []);
});

Deno.test("itens que não são URL são ignorados e a tela nunca mostra mais de 6", () => {
  assertEquals(MAX_FOTOS_ACOMPANHAMENTO, 6);
  assertEquals(fotosDoAcompanhamento([url(1), 7, null, "arquivo.jpg", "javascript:alert(1)", `  ${url(2)}  `]), [url(1), url(2)]);
  assertEquals(fotosDoAcompanhamento(fotos(10)), fotos(6));
});

Deno.test("miniatura do acompanhamento é a mesma da impressão (render/image 600x600)", () => {
  const mini = urlMiniatura(url(1));
  assertEquals(mini, `https://qztuzcchknptrvkdmdph.supabase.co/storage/v1/render/image/public/dispositivos-fotos/u1/os-1.jpg?${PARAMETROS_MINIATURA}`);
  assertEquals(PARAMETROS_MINIATURA.includes("width=600&height=600"), true);
  // URL de fora do Supabase fica como está.
  assertEquals(urlMiniatura("https://exemplo.com/a.jpg"), "https://exemplo.com/a.jpg");
});

Deno.test("texto do botão", () => {
  assertEquals(textoVerFotos(1), "Ver fotos (1)");
  assertEquals(textoVerFotos(6), "Ver fotos (6)");
});

Deno.test("opção da loja: só true de verdade liga", () => {
  assertEquals(lojaMostraFotos({ tracking_config: { mostrar_fotos: true } }), true);
  for (const v of [null, undefined, {}, { tracking_config: null }, { tracking_config: {} }, { tracking_config: { mostrar_fotos: false } },
    { tracking_config: { mostrar_fotos: "true" } }, { tracking_config: { mostrar_fotos: 1 } }, { mostrar_fotos: true }, [], "x"]) {
    assertEquals(lojaMostraFotos(v), false);
  }
});

Deno.test("escolha da OS: inclui por padrão; só o false explícito tira", () => {
  for (const v of [null, undefined, {}, [], { fotos_acompanhamento: true }, { fotos_acompanhamento: null }, { fotos_acompanhamento: undefined },
    { fotos_acompanhamento: "false" }, { fotos_acompanhamento: 0 }]) {
    assertEquals(osIncluiFotos(v), true);
  }
  assertEquals(osIncluiFotos({ fotos_acompanhamento: false }), false);
});

Deno.test("quantas fotos iriam para o link: só URLs válidas, no máximo 6", () => {
  assertEquals(totalFotosParaLink({ fotos_dispositivo: fotos(3) }), 3);
  assertEquals(totalFotosParaLink({ fotos_dispositivo: fotos(10) }), 6);
  assertEquals(totalFotosParaLink({ fotos_dispositivo: [url(1), null, "x"] }), 1);
  for (const v of [null, {}, { fotos_dispositivo: [] }, { fotos_dispositivo: "x" }]) assertEquals(totalFotosParaLink(v), 0);
});

Deno.test("caixa por OS: loja ligada e OS com fotos → já vem MARCADA quando a chave está ausente ou null", () => {
  for (const avarias of [{ fotos_dispositivo: fotos(3) }, { fotos_dispositivo: fotos(3), fotos_acompanhamento: null }, { fotos_dispositivo: fotos(3), fotos_acompanhamento: true }]) {
    const d = decidirCaixaFotosLink({ lojaLigada: true, totalFotos: totalFotosParaLink(avarias), marcada: osIncluiFotos(avarias) });
    assertEquals(d, { habilitada: true, motivo: null, incluir: true });
  }
});

Deno.test("caixa por OS: desmarcada (false) → habilitada e desmarcada", () => {
  const avarias = { fotos_dispositivo: fotos(3), fotos_acompanhamento: false };
  assertEquals(decidirCaixaFotosLink({ lojaLigada: true, totalFotos: totalFotosParaLink(avarias), marcada: osIncluiFotos(avarias) }), { habilitada: true, motivo: null, incluir: false });
});

Deno.test("caixa por OS: loja desligada ou OS sem fotos → desabilitada, desmarcada, com o motivo", () => {
  assertEquals(decidirCaixaFotosLink({ lojaLigada: false, totalFotos: 3, marcada: true }), { habilitada: false, motivo: MOTIVO_LOJA_DESLIGADA, incluir: false });
  assertEquals(decidirCaixaFotosLink({ lojaLigada: true, totalFotos: 0, marcada: true }), { habilitada: false, motivo: MOTIVO_OS_SEM_FOTOS, incluir: false });
  // Sem fotos e com a loja desligada: o motivo mostrado é o da OS.
  assertEquals(decidirCaixaFotosLink({ lojaLigada: false, totalFotos: 0, marcada: true }).motivo, MOTIVO_OS_SEM_FOTOS);
});

Deno.test("textos de apoio", () => {
  assertEquals(AVISO_CAIXA_OS, "Desmarque se houver foto de documento do cliente.");
  assertEquals(AVISO_LIGAR_FOTOS_LOJA, "Todas as OS com fotos passarão a exibir as fotos no link do cliente, inclusive links já enviados. Desmarque nas OS com foto de documento.");
});

Deno.test("confirmação da loja: só ao LIGAR (estava desligada no banco e a tela vai gravar ligada)", () => {
  assertEquals(precisaConfirmarFotosLoja({ ligadaNoBanco: false, ligadaNaTela: true }), true);
  assertEquals(precisaConfirmarFotosLoja({ ligadaNoBanco: true, ligadaNaTela: true }), false);  // já estava ligada
  assertEquals(precisaConfirmarFotosLoja({ ligadaNoBanco: true, ligadaNaTela: false }), false); // desligar não pede
  assertEquals(precisaConfirmarFotosLoja({ ligadaNoBanco: false, ligadaNaTela: false }), false);
});

const TELA = {
  cor_fundo: "#0a0f1e", cor_card: "#111827", cor_primaria: "#3b82f6", cor_texto: "#ffffff", cor_texto_secundario: "#94a3b8",
  mostrar_logo: true, mostrar_valor: true, mostrar_defeito: true, mostrar_fotos: true, mensagem_rodape: "",
};

Deno.test("gravação da loja: mantém o tema e as outras chaves de cores_personalizadas", () => {
  const noBanco = {
    cor_primaria: "#ff0000", tema: { sidebar: "#000" }, chave_do_futuro: [1, 2],
    tracking_config: { ...TELA, mostrar_fotos: false, cor_fundo: "#123456", chave_nova_do_tracking: "fica" },
  };
  const r = mesclarTrackingConfig(noBanco, TELA);
  assertEquals(r.cor_primaria, "#ff0000");
  assertEquals(r.tema, { sidebar: "#000" });
  assertEquals(r.chave_do_futuro, [1, 2]);
  // O que a tela editou vence; o que ela não conhece dentro de tracking_config fica.
  assertEquals(r.tracking_config, { ...TELA, chave_nova_do_tracking: "fica" });
  // Não altera a entrada.
  assertEquals(noBanco.tracking_config.mostrar_fotos, false);
});

Deno.test("gravação da loja: banco vazio, nulo ou que não é objeto → só o tracking_config", () => {
  for (const atual of [null, undefined, {}, "x", 7, ["a"]]) assertEquals(mesclarTrackingConfig(atual, TELA), { tracking_config: TELA });
  assertEquals(mesclarTrackingConfig({ tracking_config: "lixo", outra: 1 }, TELA), { outra: 1, tracking_config: TELA });
});

Deno.test("antes e depois na loja: com as fotos desligadas, o que se grava é o de hoje mais a chave nova como false", () => {
  const { mostrar_fotos: _fora, ...telaDeHoje } = TELA;
  const antes = { cor_primaria: "#ff0000", tracking_config: telaDeHoje }; // { ...coresAtuais, tracking_config: cfg }
  const depois = mesclarTrackingConfig({ cor_primaria: "#ff0000", tracking_config: telaDeHoje }, { ...telaDeHoje, mostrar_fotos: false });
  assertEquals(depois, { ...antes, tracking_config: { ...telaDeHoje, mostrar_fotos: false } });
});

const AVARIAS = {
  senha_desbloqueio: { tipo: "letra", valor: "cifrada" },
  checklist: { entrada: { tela: false }, saida: {} },
  avarias_visuais: [{ lado: "frente", x: 1, y: 2 }],
  servicos_realizados: [{ id: "s1", nome: "Troca de tela", preco: 300 }],
  produtos_utilizados: [{ id: "p1", quantidade: 1 }],
  assinaturas: { cliente_entrada: "data:image/png;base64,AAA" },
  fotos_dispositivo: fotos(3),
  dados_pagamento: { forma: "pix" },
  chave_do_futuro: { x: 1 },
};

Deno.test("gravação da OS: desmarcar grava false sem apagar fotos, checklist, assinaturas nem o resto de avarias", () => {
  assertEquals(mesclarFotosAcompanhamento(AVARIAS, false), { ...AVARIAS, fotos_acompanhamento: false });
  assertEquals("fotos_acompanhamento" in AVARIAS, false); // não altera a entrada
});

Deno.test("gravação da OS: marcar de novo grava true (escolha explícita) e mantém o resto", () => {
  assertEquals(mesclarFotosAcompanhamento({ ...AVARIAS, fotos_acompanhamento: false }, true), { ...AVARIAS, fotos_acompanhamento: true });
});

Deno.test("edição da OS e assinatura de saída: a escolha da caixa é a do banco, não a do objeto velho da tela", () => {
  // Tela carregada antes de desmarcar (sem a chave); no banco está false → mantém false.
  const montadaPelaTela: { fotos_acompanhamento?: boolean; checklist: unknown } = { checklist: { entrada: {} } };
  aplicarEscolhaFotosDoBanco(montadaPelaTela, { fotos_acompanhamento: false, outra: 1 });
  assertEquals(montadaPelaTela, { checklist: { entrada: {} }, fotos_acompanhamento: false });
  // Tela com true velho; no banco foi desmarcada → false.
  const comTrueVelho = { fotos_acompanhamento: true };
  aplicarEscolhaFotosDoBanco(comTrueVelho, { fotos_acompanhamento: false });
  assertEquals(comTrueVelho, { fotos_acompanhamento: false });
  // Tela com false velho; no banco foi marcada de novo → true.
  const comFalseVelho = { fotos_acompanhamento: false };
  aplicarEscolhaFotosDoBanco(comFalseVelho, { fotos_acompanhamento: true });
  assertEquals(comFalseVelho, { fotos_acompanhamento: true });
  // Banco sem a chave (ou com valor que não é booleano) → a chave sai: segue o padrão da loja.
  for (const banco of [{}, null, { fotos_acompanhamento: null }, { fotos_acompanhamento: "false" }]) {
    const a: { fotos_acompanhamento?: boolean } = { fotos_acompanhamento: false };
    aplicarEscolhaFotosDoBanco(a, banco);
    assertEquals("fotos_acompanhamento" in a, false);
  }
});

Deno.test("gravação da OS: avarias nula ou que não é objeto → só a chave nova", () => {
  for (const atual of [null, undefined, "x", 7, ["a"]]) assertEquals(mesclarFotosAcompanhamento(atual, true), { fotos_acompanhamento: true });
});

Deno.test("linha da matriz da loja: erro, nenhuma ou mais de uma linha → não grava (lança erro)", () => {
  const linha = { id: "matriz", cores_personalizadas: { cor_primaria: "#fff" } };
  assertEquals(linhaMatrizUnica([linha]), linha);
  for (const [linhas, erro] of [[[linha], { message: "falhou" }], [null, null], [[], null], [[linha, { ...linha, id: "outra" }], null]] as const) {
    let lancou = false;
    try { linhaMatrizUnica(linhas as typeof linha[] | null, erro); } catch { lancou = true; }
    assertEquals(lancou, true);
  }
});

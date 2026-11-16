// deno test -A --no-check --config scripts/testes-recibo-legal/deno.json scripts/testes-recibo-legal/
// Orquestrador do "Gerar novo recibo" com banco FALSO, storage FALSO e rede FALSA.
// O jsPDF é o real: o PDF sai em memória e as imagens são contadas.
import { assert, assertEquals, assertNotEquals, assertRejects } from "jsr:@std/assert@1";
import { fromFileUrl, join } from "jsr:@std/path@1";
import {
  avisosDoRecibo,
  gerarEBaixarReciboLegal,
  reciboComProblema,
  reciboLegalEmAndamento,
  type DependenciasReciboLegal,
} from "../../src/lib/origem/gerarEBaixarReciboLegal.ts";
import { buscarCompraParaRecibo } from "../../src/lib/origem/buscarCompraParaRecibo.ts";
import { carregarImagensRecibo } from "../../src/lib/origem/carregarImagensRecibo.ts";
import { ErroReciboLegal } from "../../src/lib/origem/erroReciboLegal.ts";
import { gerarReciboLegalPDF } from "../../src/lib/gerarReciboLegalPDF.ts";
import comumPtBR from "../../src/locales/pt-BR/comum.ts";
import comumEs from "../../src/locales/es/comum.ts";
import { pngDataUrl } from "./fixtures.ts";

type Linha = Record<string, unknown>;

// ---------- banco falso (só o que buscarCompraParaRecibo usa) ----------
function bancoFalso(tabelas: Record<string, Linha[]>) {
  const leituras: string[] = [];
  const cliente = {
    from(tabela: string) {
      const filtros: [string, unknown][] = [];
      const q = {
        select: (_cols: string) => q,
        eq: (col: string, val: unknown) => { filtros.push([col, val]); return q; },
        maybeSingle: async () => {
          leituras.push(tabela);
          const linha = (tabelas[tabela] ?? []).find((l) => filtros.every(([c, v]) => l[c] === v));
          return { data: linha ? structuredClone(linha) : null, error: null };
        },
      };
      return q;
    },
  };
  return { cliente: cliente as unknown as Parameters<typeof buscarCompraParaRecibo>[1], leituras, tabelas };
}

// ---------- rede falsa: URL → bytes de PNG; "/404" falha ----------
const PNG_BYTES: Record<string, Uint8Array> = {};
function rede() {
  const pedidos: string[] = [];
  const fetchFn = (async (url: string) => {
    pedidos.push(String(url));
    if (String(url).includes("/404")) return new Response("x", { status: 404 });
    // Uma cor por URL: o jsPDF guarda imagens idênticas uma vez só, e a contagem precisa de imagens diferentes.
    const cor = [...String(url)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const b = PNG_BYTES[String(url)] ??= Uint8Array.from(atob(pngDataUrl(20, 15, [cor & 255, (cor >> 8) & 255, (cor >> 16) & 255]).split(",")[1]), (c) => c.charCodeAt(0));
    return new Response(b, { status: 200, headers: { "content-type": "image/png" } });
  }) as unknown as typeof fetch;
  // "Decodifica" devolvendo o próprio PNG como data URL (o canvas real é provado no navegador).
  const decodificar = async (blob: Blob) => {
    const b = new Uint8Array(await blob.arrayBuffer());
    return "data:image/png;base64," + btoa(String.fromCharCode(...b));
  };
  return { pedidos, opcoes: { fetchFn, decodificar } };
}

const LOJA = { nome_loja: "Loja Teste Ficticia", razao_social: "Loja Teste LTDA", cnpj: "00.000.000/0001-00", telefone: "(11) 90000-0000", cidade: "Cidade Teste", estado: "SP" };
const DISPOSITIVO = { id: "d1", empresa_id: null, tipo: "celular", marca: "Marca X", modelo: "Modelo Y", condicao: "usado", checklist: { entrada: { tela: true } } };
const PESSOA = { id: "p1", nome: "Fulano de Teste", tipo: "fisica", cpf_cnpj: "000.000.000-00" };

function compraBanco(extra: Linha = {}): Linha {
  return {
    id: "c1", dispositivo_id: "d1", pessoa_id: "p1", fornecedor_id: null, empresa_id: null,
    data_compra: "2026-11-10T14:30:00", valor_pago: 900, forma_pagamento: "pix",
    origem_pessoas: PESSOA, fornecedores: null,
    fotos: [], documento_vendedor_frente: null, documento_vendedor_verso: null,
    termo_pdf_url: null, ...extra,
  };
}

interface Montagem {
  deps: DependenciasReciboLegal;
  chamadas: { salvar: number; atualizar: number; gerar: number; carregar: { fotos: readonly string[] | null | undefined }[] };
  pdfs: string[];
  banco: ReturnType<typeof bancoFalso>;
  pedidos: string[];
}

function montar(compra: Linha, extra: Partial<DependenciasReciboLegal> & { linhasAtualizadas?: number } = {}): Montagem {
  const banco = bancoFalso({ compras_dispositivos: [compra], dispositivos: [DISPOSITIVO] });
  const r = rede();
  const chamadas: Montagem["chamadas"] = { salvar: 0, atualizar: 0, gerar: 0, carregar: [] };
  const pdfs: string[] = [];
  let n = 0;
  const deps: DependenciasReciboLegal = {
    buscarCompra: (id) => buscarCompraParaRecibo(id, banco.cliente),
    buscarLoja: async () => LOJA,
    validarLoja: (l) => ({ valido: !!l?.nome_loja, camposFaltando: l?.nome_loja ? [] : ["Nome da loja"] }),
    carregarImagens: (e) => { chamadas.carregar.push({ fotos: e.fotos }); return carregarImagensRecibo(e, r.opcoes); },
    gerarPdf: async (d) => { chamadas.gerar++; return gerarReciboLegalPDF(d); },
    salvar: async (pdf, compraId) => { chamadas.salvar++; pdfs.push(pdf.output()); return `https://storage.falso/termos-compra/u/recibo-legal-${compraId}-${++n}.pdf?token=t`; },
    atualizarTermo: async (compraId, url) => {
      chamadas.atualizar++;
      if (extra.linhasAtualizadas === 0) return 0;
      const linha = banco.tabelas.compras_dispositivos.find((l) => l.id === compraId);
      if (!linha) return 0;
      linha.termo_pdf_url = url;
      return 1;
    },
    ...extra,
  };
  return { deps, chamadas, pdfs, banco, pedidos: r.pedidos };
}

const contarImagens = (pdf: string) => (pdf.match(/\/Subtype \/Image/g) ?? []).length;
const silenciar = async <T>(fn: () => Promise<T>) => {
  const w = console.warn;
  console.warn = () => {};
  try { return await fn(); } finally { console.warn = w; }
};

Deno.test("gera NOVO recibo mesmo com termo_pdf_url antigo, com as fotos atuais do banco", async () => {
  const fotosBanco = ["https://img/f1.png", "https://img/f2.png", "https://img/f3.png"];
  const m = montar(compraBanco({ termo_pdf_url: "https://storage.falso/antigo.pdf", fotos: fotosBanco }));
  const r = await silenciar(() => gerarEBaixarReciboLegal("c1", m.deps));
  assert(r.url.includes("recibo-legal-c1-1.pdf"));
  assertEquals(m.banco.tabelas.compras_dispositivos[0].termo_pdf_url, r.url);
  assertEquals(r.tinhaReciboAnterior, true);
  assertEquals(m.chamadas.carregar[0].fotos, fotosBanco);
  assertEquals(contarImagens(m.pdfs[0]), 3);
  assertEquals(m.pedidos, fotosBanco, "cada foto baixada uma vez, pelo carregador");
  assertEquals(avisosDoRecibo(r), [{ chave: "reciboLegal.anteriorGuardado" }]);
});

Deno.test("lê a compra do banco: fotos da lista em memória não importam", async () => {
  const m = montar(compraBanco({ fotos: ["https://img/nova.png"] }));
  // A lista em memória teria 0 fotos; o orquestrador só recebe o id.
  const listaEmMemoria = compraBanco({ fotos: [] });
  const r = await silenciar(() => gerarEBaixarReciboLegal(String(listaEmMemoria.id), m.deps));
  assertEquals(m.banco.leituras, ["compras_dispositivos", "dispositivos"]);
  assertEquals(m.chamadas.carregar[0].fotos, ["https://img/nova.png"]);
  assertEquals(contarImagens(m.pdfs[0]), 1);
  assertEquals(r.tinhaReciboAnterior, false);
});

Deno.test("buscarCompraParaRecibo: erro claro sem compra ou sem dispositivo", async () => {
  const semCompra = bancoFalso({ compras_dispositivos: [], dispositivos: [DISPOSITIVO] });
  const e1 = await assertRejects(() => buscarCompraParaRecibo("c1", semCompra.cliente), ErroReciboLegal);
  assertEquals(e1.codigo, "compra_nao_encontrada");
  const semDisp = bancoFalso({ compras_dispositivos: [compraBanco()], dispositivos: [] });
  const e2 = await assertRejects(() => buscarCompraParaRecibo("c1", semDisp.cliente), ErroReciboLegal);
  assertEquals(e2.codigo, "dispositivo_nao_encontrado");
  const semVinculo = bancoFalso({ compras_dispositivos: [compraBanco({ dispositivo_id: null })], dispositivos: [DISPOSITIVO] });
  const e3 = await assertRejects(() => buscarCompraParaRecibo("c1", semVinculo.cliente), ErroReciboLegal);
  assertEquals(e3.codigo, "dispositivo_nao_encontrado");
});

Deno.test("falha ANTES de salvar não grava nada e mantém o termo_pdf_url antigo", async () => {
  const antigo = "https://storage.falso/antigo.pdf";
  const casos: [string, Partial<DependenciasReciboLegal>, Linha?][] = [
    ["loja incompleta", { buscarLoja: async () => ({ nome_loja: "" }) }],
    ["loja inexistente", { buscarLoja: async () => null }],
    ["PDF explode", { gerarPdf: async () => { throw new Error("jsPDF"); } }],
    ["carregar imagens explode", { carregarImagens: async () => { throw new Error("canvas"); } }],
    ["sem vendedor", {}, { pessoa_id: null, origem_pessoas: null, fornecedor_id: null }],
  ];
  for (const [nome, deps, extraCompra] of casos) {
    const m = montar(compraBanco({ termo_pdf_url: antigo, fotos: ["https://img/a.png"], ...extraCompra }), deps);
    await assertRejects(() => silenciar(() => gerarEBaixarReciboLegal("c1", m.deps)), Error, undefined, nome);
    assertEquals(m.chamadas.salvar, 0, nome);
    assertEquals(m.chamadas.atualizar, 0, nome);
    assertEquals(m.banco.tabelas.compras_dispositivos[0].termo_pdf_url, antigo, nome);
  }
  const semDisp = montar(compraBanco({ termo_pdf_url: antigo }));
  semDisp.banco.tabelas.dispositivos.length = 0;
  const e = await assertRejects(() => gerarEBaixarReciboLegal("c1", semDisp.deps), ErroReciboLegal);
  assertEquals(e.codigo, "dispositivo_nao_encontrado");
  assertEquals(semDisp.chamadas.salvar, 0);
  const incompleto = montar(compraBanco());
  incompleto.banco.tabelas.dispositivos[0] = { ...DISPOSITIVO, marca: null, tipo: "" };
  const e2 = await assertRejects(() => gerarEBaixarReciboLegal("c1", incompleto.deps), ErroReciboLegal);
  assertEquals([e2.codigo, e2.campos], ["dispositivo_incompleto", ["Marca", "Tipo"]]);
  incompleto.banco.tabelas.dispositivos[0] = DISPOSITIVO;
});

Deno.test("loja incompleta devolve os campos que faltam", async () => {
  const m = montar(compraBanco(), { buscarLoja: async () => ({ nome_loja: "" }) });
  const e = await assertRejects(() => gerarEBaixarReciboLegal("c1", m.deps), ErroReciboLegal);
  assertEquals([e.codigo, e.campos], ["loja_incompleta", ["Nome da loja"]]);
});

Deno.test("0 linhas atualizadas vira erro termo_nao_atualizado", async () => {
  const m = montar(compraBanco(), { linhasAtualizadas: 0 });
  const e = await assertRejects(() => silenciar(() => gerarEBaixarReciboLegal("c1", m.deps)), ErroReciboLegal);
  assertEquals(e.codigo, "termo_nao_atualizado");
  assertEquals(m.chamadas.salvar, 1);
  assertEquals(m.banco.tabelas.compras_dispositivos[0].termo_pdf_url, null);
});

Deno.test("fotos que falham viram resumo e o PDF sai mesmo assim", async () => {
  const m = montar(compraBanco({ fotos: ["https://img/ok1.png", "https://img/404", "https://img/ok2.png", "https://img/404?b"] }));
  const r = await silenciar(() => gerarEBaixarReciboLegal("c1", m.deps));
  assertEquals(m.chamadas.salvar, 1);
  assertEquals(contarImagens(m.pdfs[0]), 2);
  assert(m.pdfs[0].includes("(Foto 2)") && m.pdfs[0].includes("(Foto 4)"));
  assertEquals(r.resumoImagens.fotos, { total: 4, falhas: 2, porMotivo: { http: 2 } });
  assertEquals(avisosDoRecibo(r), [{ chave: "reciboLegal.falhasFotos", valores: { count: 2, total: 4 } }]);
  assert(reciboComProblema(r));
});

Deno.test("mais de 5 fotos: só as 5 primeiras entram e há aviso", async () => {
  const fotos = Array.from({ length: 7 }, (_, i) => `https://img/f${i}.png`);
  const m = montar(compraBanco({ fotos }));
  const r = await silenciar(() => gerarEBaixarReciboLegal("c1", m.deps));
  assertEquals(contarImagens(m.pdfs[0]), 5);
  assertEquals(m.pedidos.length, 5);
  assertEquals(r.resumoImagens.fotosIgnoradas, 2);
  assertEquals(avisosDoRecibo(r), [{ chave: "reciboLegal.fotosIgnoradas", valores: { max: 5 } }]);
  assert(reciboComProblema(r));
});

Deno.test("documentos: PDF com ?token vira texto, imagem que falha vira aviso", async () => {
  const m = montar(compraBanco({
    documento_vendedor_frente: "https://img/sign/rg.pdf?token=x",
    documento_vendedor_verso: "https://img/404",
  }));
  const r = await silenciar(() => gerarEBaixarReciboLegal("c1", m.deps));
  assert(m.pdfs[0].includes("Frente: [Arquivo PDF - Ver anexo]"));
  assert(m.pdfs[0].includes("(Documento Verso)"));
  assertEquals(avisosDoRecibo(r), [{ chave: "reciboLegal.falhasDocumentos", valores: { count: 1, total: 1 } }]);
});

Deno.test("clique duplo: duas chamadas juntas geram UM recibo", async () => {
  const m = montar(compraBanco({ fotos: ["https://img/a.png"] }));
  const [a, b] = await silenciar(() => Promise.all([gerarEBaixarReciboLegal("c1", m.deps), gerarEBaixarReciboLegal("c1", m.deps)]));
  assertEquals(a, b);
  assertEquals(m.chamadas.gerar, 1);
  assertEquals(m.chamadas.salvar, 1);
  assertEquals(m.chamadas.atualizar, 1);
  assertEquals(reciboLegalEmAndamento("c1"), false);
  // Depois de terminar, um clique novo gera outro arquivo.
  const c = await silenciar(() => gerarEBaixarReciboLegal("c1", m.deps));
  assertNotEquals(c.url, a.url);
  assertEquals(m.chamadas.salvar, 2);
  assertEquals(c.tinhaReciboAnterior, true);
});

Deno.test("clique duplo durante uma falha também não repete; depois libera", async () => {
  const m = montar(compraBanco(), { gerarPdf: async () => { throw new Error("falhou"); } });
  const p1 = gerarEBaixarReciboLegal("c1", m.deps);
  const p2 = gerarEBaixarReciboLegal("c1", m.deps);
  assertEquals(p1, p2);
  await assertRejects(() => p1);
  assertEquals(reciboLegalEmAndamento("c1"), false);
});

Deno.test("fornecedor sem pessoa: vendedor é o fornecedor", async () => {
  const m = montar(compraBanco({ pessoa_id: null, origem_pessoas: null, fornecedor_id: "f1", fornecedores: { nome: "Fornecedor Teste" } }));
  await silenciar(() => gerarEBaixarReciboLegal("c1", m.deps));
  assert(m.pdfs[0].includes("Nome: Fornecedor Teste"));
});

// Recibo SEM fotos: o orquestrador produz o MESMO PDF que o gerador da origin/main
// (antes das mudanças do recibo legal) com os mesmos dados — bytes, menos /CreationDate e /ID.
const REFERENCIA = "3b6e8a7519163d2fb13708fcbc5e9fdeb777b827";
const AQUI = fromFileUrl(new URL(".", import.meta.url));
const normalizar = (pdf: string) =>
  pdf.replace(/\/CreationDate \(D:[^)]*\)/g, "/CreationDate (X)").replace(/\/ID \[ <[0-9A-Fa-f]+> <[0-9A-Fa-f]+> \]/g, "/ID [X]");

Deno.test("recibo SEM fotos pelo orquestrador = PDF do gerador da origin/main", async () => {
  const git = await new Deno.Command("git", { args: ["--no-pager", "show", `${REFERENCIA}:src/lib/gerarReciboLegalPDF.ts`], cwd: AQUI }).output();
  const arquivo = join(AQUI, `.referencia-orq-${Date.now()}.ts`);
  await Deno.writeFile(arquivo, git.stdout);
  let referencia: typeof gerarReciboLegalPDF;
  try {
    referencia = (await import(`file://${arquivo}`)).gerarReciboLegalPDF;
  } finally {
    await Deno.remove(arquivo);
  }
  const assinatura = pngDataUrl(60, 20, [0, 0, 0]);
  const compra = compraBanco({
    observacoes: "Observação fictícia",
    assinatura_vendedor: assinatura, assinatura_vendedor_ip: "10.0.0.1", assinatura_vendedor_data: "2026-11-10T14:31:00",
  });
  let dadosUsados: Parameters<typeof gerarReciboLegalPDF>[0] | null = null;
  const m = montar(compra, { gerarPdf: async (d) => { dadosUsados = d; return gerarReciboLegalPDF(d); } });
  await gerarEBaixarReciboLegal("c1", m.deps);
  const { imagens: _imagens, ...semImagens } = dadosUsados!;
  const antes = normalizar((await referencia(semImagens)).output());
  assertEquals(normalizar(m.pdfs[0]), antes);
  assertEquals(contarImagens(m.pdfs[0]), 1); // só a assinatura
});

Deno.test("textos: todas as chaves de aviso e de erro existem em pt-BR e es", () => {
  type Arvore = { [k: string]: string | Arvore };
  const pegar = (o: Arvore, chave: string) => chave.split(".").reduce<string | Arvore | undefined>((a, k) => (a && typeof a === "object" ? a[k] : undefined), o);
  const chaves = [
    "reciboLegal.gerando", "reciboLegal.gerado", "reciboLegal.gerandoBotao",
    "reciboLegal.falhasFotos_zero", "reciboLegal.falhasFotos_one", "reciboLegal.falhasFotos_other",
    "reciboLegal.falhasDocumentos_one", "reciboLegal.falhasDocumentos_other",
    "reciboLegal.fotosIgnoradas", "reciboLegal.anteriorGuardado", "reciboLegal.avisoEdicao",
    "reciboLegal.gerar", "reciboLegal.gerarNovo", "reciboLegal.gerarNovoFotos", "reciboLegal.baixarAtual", "reciboLegal.erro",
    ...["compra_nao_encontrada", "dispositivo_nao_encontrado", "dispositivo_incompleto", "sem_vendedor", "loja_incompleta", "termo_nao_atualizado"].map((c) => `reciboLegal.erros.${c}`),
  ];
  for (const [nome, textos] of [["pt-BR", comumPtBR], ["es", comumEs]] as const) {
    for (const c of chaves) assert(typeof pegar(textos as unknown as Arvore, c) === "string" && (pegar(textos as unknown as Arvore, c) as string).length > 0, `${nome}: ${c}`);
  }
  assertEquals(pegar(comumPtBR as unknown as Arvore, "reciboLegal.fotosIgnoradas"), "Só as {{max}} primeiras fotos entram no recibo");
  assertEquals(pegar(comumPtBR as unknown as Arvore, "reciboLegal.anteriorGuardado"), "O recibo anterior continua guardado");
  assertEquals(pegar(comumPtBR as unknown as Arvore, "reciboLegal.avisoEdicao"), "O PDF já gerado não muda sozinho. Depois de salvar, use Gerar novo recibo para incluir as fotos atuais.");
  // es: usted, sem voseo/tú nas frases de ação
  const es = JSON.stringify(comumEs.reciboLegal);
  assert(!/\b(usa|guarda|tú|vosotros)\b/i.test(es));
});

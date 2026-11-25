// Gera as impressões da OS com dados FICTÍCIOS (sem banco, sem rede) para a prova
// de páginas do valor da linha de produto/peça. Empacotado pelo run.sh (esbuild)
// duas vezes: com o src de antes e com o src de agora.
//
//   node gerar.mjs <pasta-saida>
//
// Saída: html/<modelo>__<os>.html  (A4 Padrão, Tech, Personalizado n0-n3, cupom 80 mm)
//        pdf/<a4|cupom>__<os>.pdf  (jsPDF: gerarOrdemServicoPDF completo e cupom 80 mm)
//        jspdf.json                páginas de cada PDF, ou o erro se a geração quebrou
//
// Além das séries, "antigo-sem-total" e "antigo-nan": produtos de OS antiga sem
// preco_total (chave ausente) e com preco_total NaN, só para o PDF (na main quebra/NaN).
//
// Séries de OS (N = 0 a 40 itens), em 3 densidades:
//   semprod-<dens>-NN  N serviços, nenhum produto          (tem de ficar IDÊNTICA)
//   mista-<dens>-NN    metade serviços, metade produtos com nome curto
//   longo-<dens>-NN    metade serviços, metade produtos com nome longo (25 a 99
//                      caracteres, variando) e valor de 4 dígitos (pior largura)
//   densidades: simples (termo curto), leve (termo longo), cheia (checklist grande,
//   defeito e observação longos, termo longo) — juntas atravessam o limite da folha.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { OrdemServico } from "@/hooks/useOrdensServico";
import type { ConfiguracaoLoja, LayoutOSConfig } from "@/types/configuracao-loja";
import type { AvariasOS, ProdutoUtilizado, ServicoRealizado } from "@/types/ordem-servico";
import { ImpressaoA4Padrao } from "@/components/ordens/ImpressaoA4Padrao";
import { ImpressaoA4Tech } from "@/components/ordens/ImpressaoA4Tech";
import { ImpressaoA4Personalizado } from "@/components/ordens/recibo-personalizado/ImpressaoA4Personalizado";
import { ImpressaoCupom80mm } from "@/components/ordens/ImpressaoCupom80mm";
import { getCupom80mmOSPrintDocCSS } from "@/lib/paper-size-utils";
import { gerarOrdemServicoPDF, gerarOrdemServicoCupom80mmPDF } from "@/lib/gerarOrdemServicoPDF";

const AGORA_FIXO = new Date("2026-11-25T15:00:00.000Z").getTime();
const DataReal = Date;
class DataFixa extends DataReal {
  constructor(...args: ConstructorParameters<DateConstructor> | []) {
    if (args.length === 0) super(AGORA_FIXO);
    else super(...(args as ConstructorParameters<DateConstructor>));
  }
  static now() {
    return AGORA_FIXO;
  }
}
globalThis.Date = DataFixa as DateConstructor;

const SAIDA = path.resolve(process.argv[2] ?? "saida-impressao-valor-produtos");
mkdirSync(path.join(SAIDA, "html"), { recursive: true });
mkdirSync(path.join(SAIDA, "pdf"), { recursive: true });
const jspdf: Record<string, { paginas?: number; erro?: string; nan?: boolean }> = {};
const contarPaginas = (bytes: Uint8Array) => (Buffer.from(bytes).toString("latin1").match(/\/Type \/Page\b(?!s)/g) ?? []).length;
async function pdfs(nomeOS: string, os: OrdemServico, loja: ConfiguracaoLoja) {
  const gerar = {
    a4: async () => new Uint8Array(await (await gerarOrdemServicoPDF(os, loja, "completo", {})).arrayBuffer()),
    cupom: async () => new Uint8Array(await (await gerarOrdemServicoCupom80mmPDF(os, loja, [])).arrayBuffer()),
  };
  for (const [tipo, fn] of Object.entries(gerar)) {
    const chave = `${tipo}__${nomeOS}`;
    try {
      const bytes = await fn();
      writeFileSync(path.join(SAIDA, "pdf", `${chave}.pdf`), bytes);
      jspdf[chave] = { paginas: contarPaginas(bytes), nan: Buffer.from(bytes).toString("latin1").includes("NaN") };
    } catch (e) {
      jspdf[chave] = { erro: String((e as Error)?.message ?? e) };
    }
  }
}

type Cliente = NonNullable<OrdemServico["cliente"]>;
const CLIENTE: Cliente = {
  id: "cli-ficticio",
  nome: "Maria Aparecida dos Santos Oliveira",
  telefone: "11987654321",
  cpf: "12345678909",
  endereco: "Rua das Flores", numero: "120", bairro: "Centro", cidade: "Campinas", estado: "SP", cep: null,
} as Cliente;

const TERMO_LONGO = Array.from({ length: 14 }, (_, i) =>
  `${i + 1}. A garantia cobre exclusivamente o serviço e as peças descritas nesta ordem, pelo prazo indicado, não cobrindo quedas, contato com líquidos, mau uso ou intervenção de terceiros.`,
).join("\n");
const TERMO_CURTO = "Garantia de 90 dias para serviços realizados, conforme o Código de Defesa do Consumidor.";

const NOME_LONGO = "Tela Frontal Display LCD Incell com Aro e Película para iPhone 11 Pro Max Preta Qualidade Premium A+++ Garantia";

function servicos(n: number): ServicoRealizado[] {
  return Array.from({ length: n }, (_, i) => ({ id: `s${i}`, nome: `Serviço fictício número ${i + 1} com descrição`, preco: 50 + i, custo: 0, lucro: 50 + i }));
}
function produtos(n: number, longo: boolean): ProdutoUtilizado[] {
  return Array.from({ length: n }, (_, i) => {
    const quantidade = (i % 3) + 1;
    const preco_unitario = longo ? 1234.56 : 30;
    const nome = longo ? NOME_LONGO.slice(0, 25 + ((i * 13) % 75)).trim() : `Peça fictícia ${i + 1}`;
    return { id: `p${i}`, nome, tipo: "peca", quantidade, preco_unitario, custo_unitario: 10, preco_total: quantidade * preco_unitario };
  });
}

type Tipo = "semprod" | "mista" | "longo";
type Dens = "simples" | "leve" | "cheia";
function ordem(tipo: Tipo, dens: Dens, itens: number): OrdemServico {
  const cheia = dens === "cheia";
  const nServ = tipo === "semprod" ? itens : Math.ceil(itens / 2);
  const nProd = tipo === "semprod" ? 0 : Math.floor(itens / 2);
  const avarias: AvariasOS = {
    checklist: cheia
      ? { entrada: { tela: true, bateria: false, camera: true, wifi: true, bluetooth: false, alto_falante: true, microfone: true, botoes: false, biometria: true }, saida: {} }
      : { entrada: { tela: true, bateria: false, camera: true }, saida: {} },
    avarias_visuais: [],
    servicos_realizados: servicos(nServ),
    produtos_utilizados: produtos(nProd, tipo === "longo"),
    custos_adicionais: [],
    dados_pagamento: { forma: "pix", desconto: 0, subtotal: 250, total: 250 },
    ...(cheia ? { observacoes_internas: "Cliente pediu para preservar dados. ".repeat(6), mostrar_obs_internas_impressao: true } : {}),
  } as AvariasOS;
  return {
    id: "os-ficticia",
    numero_os: "4321",
    created_at: "2026-11-24T13:00:00.000Z",
    data_saida: null,
    defeito_relatado: cheia ? "Aparelho não liga após queda; tela trincada no canto superior; bateria estufada. ".repeat(4) : "Tela quebrada, não liga",
    total: 250,
    status: "Aberta",
    dispositivo_modelo: "iPhone 14 Pro",
    dispositivo_imei: "356938035643809",
    dispositivo_tipo: "Smartphone",
    dispositivo_marca: "Apple",
    dispositivo_cor: "Preto",
    dispositivo_numero_serie: null,
    cliente_id: "cli-ficticio",
    funcionario_id: null,
    tipo_servico_id: null,
    tempo_garantia: 90,
    cliente: CLIENTE,
    avarias,
  } as unknown as OrdemServico;
}

const LAYOUT: LayoutOSConfig = {
  mostrar_logo_impressao: false,
  mostrar_checklist: true,
  mostrar_avarias: true,
  mostrar_senha: true,
  mostrar_assinaturas: true,
  mostrar_termos_condicoes: true,
  mostrar_fotos_impressao: false,
} as LayoutOSConfig;

const LOJA = {
  id: "loja-ficticia",
  nome_loja: "Loja Fictícia de Teste",
  cnpj: "00.000.000/0001-00",
  endereco: "Rua Exemplo, 123 - São Paulo",
  telefone: "11999999999",
  logo_url: undefined,
  layout_os_config: LAYOUT,
} as unknown as ConfiguracaoLoja;

let total = 0;
for (const tipo of ["semprod", "mista", "longo"] as const) {
  for (const dens of ["simples", "leve", "cheia"] as const) {
    for (let n = 0; n <= 40; n++) {
      const nomeOS = `${tipo}-${dens}-${String(n).padStart(2, "0")}`;
      const termo = dens === "simples" ? TERMO_CURTO : TERMO_LONGO;
      const loja = { ...LOJA, layout_os_config: { ...LAYOUT, termo_garantia: termo } } as unknown as ConfiguracaoLoja;
      const os = ordem(tipo, dens, n);
      const props = { ordem: os, configuracaoLoja: loja, layoutConfig: LAYOUT, termoGarantia: termo };
      const html: Record<string, string> = {
        padrao: renderToStaticMarkup(<ImpressaoA4Padrao {...props} />),
        tech: renderToStaticMarkup(<ImpressaoA4Tech {...props} />),
      };
      for (const nivel of [0, 1, 2, 3] as const) {
        html[`personalizado-n${nivel}`] = renderToStaticMarkup(
          <ImpressaoA4Personalizado {...props} compactacao={{ nivel, agrupamento: "nenhum" }} />,
        );
      }
      const cupom = renderToStaticMarkup(<ImpressaoCupom80mm ordem={os} configuracaoLoja={loja} config80mm={{}} />);
      html.cupom = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getCupom80mmOSPrintDocCSS()}</style></head><body><div id="print-root">${cupom}</div></body></html>`;
      for (const [modelo, corpo] of Object.entries(html)) writeFileSync(path.join(SAIDA, "html", `${modelo}__${nomeOS}.html`), corpo);
      await pdfs(nomeOS, os, loja);
      total++;
    }
  }
}
// OS antiga: só PDF (o HTML já foi provado pela série e pelo teste unitário).
{
  const loja = { ...LOJA, layout_os_config: { ...LAYOUT, termo_garantia: TERMO_CURTO } } as unknown as ConfiguracaoLoja;
  const casos: Record<string, (p: ProdutoUtilizado) => ProdutoUtilizado> = {
    "antigo-sem-total": (p) => { const { preco_total: _sem, ...resto } = p; void _sem; return resto as ProdutoUtilizado; },
    "antigo-nan": (p) => ({ ...p, preco_total: NaN }),
  };
  for (const [nomeOS, mexer] of Object.entries(casos)) {
    const os = ordem("mista", "simples", 6);
    const av = os.avarias as AvariasOS;
    av.produtos_utilizados = (av.produtos_utilizados ?? []).map(mexer);
    await pdfs(nomeOS, os, loja);
  }
}
writeFileSync(path.join(SAIDA, "jspdf.json"), JSON.stringify(jspdf, null, 2));
console.log(`gerado: ${total} OS em ${SAIDA}`);

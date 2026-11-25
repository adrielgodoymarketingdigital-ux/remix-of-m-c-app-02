// Gera as impressões da OS com dados FICTÍCIOS (sem banco, sem rede) para a prova
// de páginas do endereço do cliente. Empacotado pelo run.sh (esbuild) duas vezes:
// com o src de antes e com o src de agora.
//
//   node gerar.mjs <pasta-saida>
//
// Saída:
//   html/<modelo>__<os>__<cliente>.html   corpo da impressão (renderToStaticMarkup)
//   pdf/<a4|cupom>__<os>__<cliente>.pdf   PDFs do jsPDF (gerarOrdemServicoPDF / cupom 80 mm)
//   jspdf.json                            páginas e altura de cada PDF do jsPDF
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
import { gerarOrdemServicoPDF, gerarOrdemServicoCupom80mmPDF } from "@/lib/gerarOrdemServicoPDF";
import { getCupom80mmOSPrintDocCSS } from "@/lib/paper-size-utils";

// Relógio congelado: o PDF imprime a hora da geração ("gerado em … às HH:MM"); antes
// e depois têm de sair com a mesma hora para a comparação byte a byte.
const AGORA_FIXO = new Date("2026-11-24T15:00:00.000Z").getTime();
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

const SAIDA = path.resolve(process.argv[2] ?? "saida-impressao-endereco");
mkdirSync(path.join(SAIDA, "html"), { recursive: true });
mkdirSync(path.join(SAIDA, "pdf"), { recursive: true });

// ── Clientes (fictícios) ─────────────────────────────────────────────────────
type Cliente = NonNullable<OrdemServico["cliente"]>;
const BASE_CLIENTE: Cliente = {
  id: "cli-ficticio",
  nome: "Maria Aparecida dos Santos Oliveira",
  telefone: "11987654321",
  cpf: "12345678909",
};
const CLIENTES: Record<string, Cliente> = {
  // (a) nenhum campo de endereço
  "a-sem-endereco": { ...BASE_CLIENTE, endereco: null, numero: null, bairro: null, cidade: null, estado: null, cep: null },
  // (b) endereço curto
  "b-curto": { ...BASE_CLIENTE, endereco: "Rua das Flores", numero: "120", bairro: "Centro", cidade: "Campinas", estado: "SP", cep: null },
  // (c) endereço muito longo, todos os campos
  "c-longo": {
    ...BASE_CLIENTE,
    endereco: "Avenida Presidente Juscelino Kubitschek de Oliveira (antiga Estrada Municipal do Jardim das Palmeiras)",
    numero: "12345-A, bloco C, apto 1201",
    bairro: "Jardim Residencial Parque das Flores e Colinas do Sul",
    cidade: "São José do Rio Preto",
    estado: "SP",
    cep: "15091450",
  },
  // (e) endereço sem rua (só bairro, cidade, UF e CEP): no PDF é linha nova
  "e-sem-rua": { ...BASE_CLIENTE, endereco: null, numero: null, bairro: "Vila Nova", cidade: "Ribeirão Preto", estado: "SP", cep: "14025000" },
  // (d) cliente antigo: o endereço inteiro só na rua
  "d-so-rua": { ...BASE_CLIENTE, endereco: "Rua XV de Novembro, 845 - Centro, Curitiba/PR", numero: null, bairro: null, cidade: null, estado: null, cep: null },
};

// ── OS (fictícias): normal e "cheia" com N itens ─────────────────────────────
const TERMO_LONGO = Array.from({ length: 14 }, (_, i) =>
  `${i + 1}. A garantia cobre exclusivamente o serviço e as peças descritas nesta ordem, pelo prazo indicado, não cobrindo quedas, contato com líquidos, mau uso ou intervenção de terceiros.`,
).join("\n");
const TERMO_CURTO = "Garantia de 90 dias para serviços realizados, conforme o Código de Defesa do Consumidor.";

function servicos(n: number): ServicoRealizado[] {
  return Array.from({ length: n }, (_, i) => ({ id: `s${i}`, nome: `Serviço fictício número ${i + 1} com descrição`, preco: 50 + i, custo: 0, lucro: 50 + i }));
}
function produtos(n: number): ProdutoUtilizado[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`, nome: `Peça fictícia ${i + 1}`, tipo: "peca", quantidade: 1, preco_unitario: 30, custo_unitario: 10, preco_total: 30,
  }));
}

function ordem(cliente: Cliente, itens: number, cheia: boolean): OrdemServico {
  const avarias: AvariasOS = {
    checklist: cheia
      ? { entrada: { tela: true, bateria: false, camera: true, wifi: true, bluetooth: false, alto_falante: true, microfone: true, botoes: false, biometria: true }, saida: {} }
      : { entrada: { tela: true, bateria: false, camera: true }, saida: {} },
    avarias_visuais: [],
    servicos_realizados: servicos(Math.ceil(itens / 2) || 1),
    produtos_utilizados: produtos(Math.floor(itens / 2)),
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
    cliente,
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

// normal = OS comum. cheia-NN = checklist grande, defeito e observação longos,
// termo longo e NN itens. leve-NN = só o termo longo e NN itens. As duas séries
// atravessam o limite da folha em todos os modelos: a OS mais cheia que hoje
// ainda cabe em 1 folha é o pior caso (o run.sh mostra qual é).
const OS: Record<string, { itens: number; cheia: boolean; termoLongo: boolean }> = { normal: { itens: 2, cheia: false, termoLongo: false } };
for (let n = 0; n <= 40; n += 2) {
  OS[`cheia-${String(n).padStart(2, "0")}`] = { itens: n, cheia: true, termoLongo: true };
  OS[`leve-${String(n).padStart(2, "0")}`] = { itens: n, cheia: false, termoLongo: true };
}

const jspdf: Record<string, { paginas: number; alturaMm: number }> = {};
const contarPaginas = (bytes: Uint8Array) => (Buffer.from(bytes).toString("latin1").match(/\/Type \/Page\b(?!s)/g) ?? []).length;
const alturaPrimeiraPaginaMm = (bytes: Uint8Array) => {
  const m = Buffer.from(bytes).toString("latin1").match(/\/MediaBox \[([\d.\s-]+)\]/);
  return m ? Number((Number(m[1].trim().split(/\s+/)[3]) * 25.4 / 72).toFixed(2)) : 0;
};

for (const [nomeOS, { itens, cheia, termoLongo }] of Object.entries(OS)) {
  const termo = termoLongo ? TERMO_LONGO : TERMO_CURTO;
  const loja = { ...LOJA, layout_os_config: { ...LAYOUT, termo_garantia: termo } } as unknown as ConfiguracaoLoja;
  for (const [nomeCliente, cliente] of Object.entries(CLIENTES)) {
    const os = ordem(cliente, itens, cheia);
    const chave = `${nomeOS}__${nomeCliente}`;
    const props = { ordem: os, configuracaoLoja: loja, layoutConfig: LAYOUT, termoGarantia: termo };
    const html: Record<string, string> = {
      padrao: renderToStaticMarkup(<ImpressaoA4Padrao {...props} />),
      tech: renderToStaticMarkup(<ImpressaoA4Tech {...props} />),
      cupom: renderToStaticMarkup(<ImpressaoCupom80mm ordem={os} configuracaoLoja={loja} config80mm={{}} />),
    };
    for (const nivel of [0, 1, 2, 3] as const) {
      html[`personalizado-n${nivel}`] = renderToStaticMarkup(
        <ImpressaoA4Personalizado {...props} compactacao={{ nivel, agrupamento: "nenhum" }} />,
      );
    }
    // Cupom: documento isolado igual ao de print80mm() (buildCupom80mmDoc), com a altura de prova.
    html.cupom = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getCupom80mmOSPrintDocCSS()}</style></head><body><div id="print-root">${html.cupom}</div></body></html>`;
    for (const [modelo, corpo] of Object.entries(html)) writeFileSync(path.join(SAIDA, "html", `${modelo}__${chave}.html`), corpo);

    const a4 = new Uint8Array(await (await gerarOrdemServicoPDF(os, loja, "completo", {})).arrayBuffer());
    const cupom = new Uint8Array(await (await gerarOrdemServicoCupom80mmPDF(os, loja, [])).arrayBuffer());
    writeFileSync(path.join(SAIDA, "pdf", `a4__${chave}.pdf`), a4);
    writeFileSync(path.join(SAIDA, "pdf", `cupom__${chave}.pdf`), cupom);
    jspdf[`a4__${chave}`] = { paginas: contarPaginas(a4), alturaMm: alturaPrimeiraPaginaMm(a4) };
    jspdf[`cupom__${chave}`] = { paginas: contarPaginas(cupom), alturaMm: alturaPrimeiraPaginaMm(cupom) };
  }
}
writeFileSync(path.join(SAIDA, "jspdf.json"), JSON.stringify(jspdf, null, 2));
console.log(`gerado: ${Object.keys(OS).length} OS × ${Object.keys(CLIENTES).length} clientes em ${SAIDA}`);

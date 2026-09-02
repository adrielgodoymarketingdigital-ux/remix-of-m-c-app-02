/**
 * FASE 1 — Regressão da correção do P1-c (docs/COMISSAO.md):
 * "OS com 1 serviço só usava (total da OS) × %, fora do motor item-a-item".
 *
 * A correção em handleSubmitOrdemServico.ts trocou o guard
 *   if (funcId && formData.servicos.length > 1)  →  ... > 0
 * e removeu o ramo `else if (funcId && tsId)` que fazia o cálculo antigo.
 * Agora TODA OS com serviço(s) passa por calcularComissaoPorServico().
 *
 * Inclui também os itens B + c1 + c2:
 *   B  — fallback do Tipo de Serviço do formulário (Etapa 4) quando o match
 *        por nome falha, mas SEMPRE na base por serviço, com proteção de custo.
 *   c1 — desempate: se todos os candidatos ambíguos dão o mesmo valor, aplica.
 *   c2 — palavrasChaveDaMarca reconhece "iphone"/"ipad" como família Apple.
 *
 * Usa as FUNÇÕES REAIS e puras do app.
 *
 *   node scripts/fase1-comissao-os-servico-unico/testes-regressao.mjs
 */
import {
  encontrarComissaoPorNomeServico,
  calcularComissaoDoItem,
  palavrasChaveDaMarca,
} from "../../src/lib/ordemServico/comissaoPorTipoServico.ts";

// ---------------------------------------------------------------------------
// util
// ---------------------------------------------------------------------------
const brl = (n) => (n === null ? "—" : (n < 0 ? "-" : "") + "R$ " + Math.abs(n).toFixed(2));
const near = (a, b, eps = 1e-9) => a === b || (a !== null && b !== null && Math.abs(a - b) <= eps);
let falhas = 0;
const check = (nome, cond, detalhe = "") => {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`   [${ok ? "PASS" : "FALHA"}] ${nome}${detalhe ? "  — " + detalhe : ""}`);
};

/**
 * Reproduz VERBATIM o laço de calcularComissaoPorServico()
 * (src/components/ordens/ordem-servico-wizard/handleSubmitOrdemServico.ts),
 * a parte pura — sem as buscas ao Supabase. `catalogo` e `configPorTipo`
 * são o que aquelas buscas devolveriam.
 */
function calcularComissaoPorServico(servicos, dispositivoMarca, catalogo, configPorTipo, comissaoCalculo, tipoServicoIdFallback) {
  const comissaoPorTipoServicoId = new Map(
    Object.entries(configPorTipo).map(([tipoId, c]) => [tipoId, { tipo_servico_id: tipoId, ...c }]),
  );
  const tiposComComissao = catalogo.filter((t) => comissaoPorTipoServicoId.has(t.id));

  const configFallbackFormulario =
    servicos.length === 1 && tipoServicoIdFallback
      ? comissaoPorTipoServicoId.get(tipoServicoIdFallback)
      : undefined;

  let comissaoTotal = 0;
  let algumEncontrado = false;
  const itensSemComissaoConfigurada = [];
  const itensComissaoAmbigua = [];
  const itensCustoNaoConfirmado = [];
  const itensFallbackTipoFormulario = [];

  for (const servico of servicos) {
    const resultado = encontrarComissaoPorNomeServico(
      servico.nome, tiposComComissao, comissaoPorTipoServicoId, dispositivoMarca,
    );
    const matchPorNomeResolveu = !!resultado.config && !resultado.ambiguo;
    const usarFallback =
      !matchPorNomeResolveu
      && !!configFallbackFormulario
      && Number(configFallbackFormulario.comissao_valor) > 0;

    if (!matchPorNomeResolveu && !usarFallback) {
      if (resultado.ambiguo) {
        itensComissaoAmbigua.push({ nome: servico.nome, candidatos: resultado.candidatosAmbiguos || [] });
      } else {
        itensSemComissaoConfigurada.push(servico.nome);
      }
      continue;
    }

    const config = usarFallback ? configFallbackFormulario : resultado.config;
    if (config.comissao_valor > 0) {
      const calc = calcularComissaoDoItem(
        {
          preco: servico.preco,
          custo: servico.peca_valor ?? servico.custo,
          custoConfirmado: servico.custo_confirmado,
        },
        config,
        comissaoCalculo,
      );
      if (calc.custoNaoConfirmado) {
        itensCustoNaoConfirmado.push(servico.nome);
        continue;
      }
      algumEncontrado = true;
      comissaoTotal += calc.valor;
      if (usarFallback) itensFallbackTipoFormulario.push(servico.nome);
    }
  }

  return {
    total: algumEncontrado ? comissaoTotal : null,
    itensSemComissaoConfigurada,
    itensComissaoAmbigua,
    itensCustoNaoConfirmado,
    itensFallbackTipoFormulario,
  };
}

/** Cálculo ANTIGO do ramo `else if (funcId && tsId)` para OS de 1 serviço. */
function calculoAntigoServicoUnico(totalOS, config) {
  if (!config || !(config.comissao_valor > 0)) return null;
  return config.comissao_tipo === "porcentagem"
    ? (totalOS > 0 ? totalOS : 0) * (config.comissao_valor / 100)
    : config.comissao_valor;
}

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------
// Catálogo de tipos de serviço da loja (o que `tipos_servico` devolveria)
const CATALOGO = [
  { id: "t-tela", nome: "TROCA DE TELA" },
  { id: "t-bateria", nome: "TROCA DE BATERIA" },
];
// Config de comissão do técnico (o que `comissoes_tipo_servico` devolveria)
const CFG_PCT_10 = { "t-tela": { comissao_tipo: "porcentagem", comissao_valor: 10 } };
const CFG_FIX_50 = { "t-tela": { comissao_tipo: "valor_fixo", comissao_valor: 50 } };
const CFG_MULTI = {
  "t-tela": { comissao_tipo: "porcentagem", comissao_valor: 10 },
  "t-bateria": { comissao_tipo: "porcentagem", comissao_valor: 5 },
};

console.log("\n=== FASE 1 — comissão de OS com 1 serviço passa pelo motor único ===\n");

// ---------------------------------------------------------------------------
// Cenário 1 — 1 serviço, comissão sobre LUCRO, custo NÃO confirmado
// ---------------------------------------------------------------------------
console.log("Cenário 1 — 1 serviço · LUCRO · custo R$ 0,00 NÃO confirmado");
{
  const servicos = [{ nome: "TROCA DE TELA", preco: 300, custo: 0, custo_confirmado: undefined }];
  const r = calcularComissaoPorServico(servicos, "samsung", CATALOGO, CFG_PCT_10, "lucro");

  check("snapshot fica null (não dá pra calcular com segurança)", r.total === null, `total=${brl(r.total)}`);
  check("item entra em itensCustoNaoConfirmado (dispara o aviso/toast)",
    r.itensCustoNaoConfirmado.length === 1 && r.itensCustoNaoConfirmado[0] === "TROCA DE TELA",
    JSON.stringify(r.itensCustoNaoConfirmado));
  check("NÃO entra em 'sem config' nem em 'ambíguo'",
    r.itensSemComissaoConfigurada.length === 0 && r.itensComissaoAmbigua.length === 0);
  // Antes da correção: pagava 300 × 10% = R$ 30,00 sobre o total, ignorando o custo 0.
  console.log(`   (comportamento ANTIGO nesse caso: ${brl(calculoAntigoServicoUnico(300, CFG_PCT_10["t-tela"]))} — pago "no escuro")`);
}

// ---------------------------------------------------------------------------
// Cenário 2 — 1 serviço, comissão sobre LUCRO, custo CONFIRMADO
// ---------------------------------------------------------------------------
console.log("\nCenário 2 — 1 serviço · LUCRO · custo confirmado → (preço − custo) × %");
{
  // 2a: custo real > 0 (confirmação automática)
  const r2a = calcularComissaoPorServico(
    [{ nome: "TROCA DE TELA", preco: 300, custo: 120 }], "samsung", CATALOGO, CFG_PCT_10, "lucro",
  );
  check("custo > 0 → (300 − 120) × 10% = R$ 18,00", near(r2a.total, 18), `total=${brl(r2a.total)}`);
  check("sem pendências", r2a.itensCustoNaoConfirmado.length === 0 && r2a.itensSemComissaoConfigurada.length === 0);

  // 2b: custo 0 mas confirmado no banner
  const r2b = calcularComissaoPorServico(
    [{ nome: "TROCA DE TELA", preco: 300, custo: 0, custo_confirmado: true }], "samsung", CATALOGO, CFG_PCT_10, "lucro",
  );
  check("custo 0 confirmado → (300 − 0) × 10% = R$ 30,00", near(r2b.total, 30), `total=${brl(r2b.total)}`);
  check("sem pendências", r2b.itensCustoNaoConfirmado.length === 0);

  // 2c: peca_valor tem precedência sobre custo (custo do item lançado na OS)
  const r2c = calcularComissaoPorServico(
    [{ nome: "TROCA DE TELA", preco: 300, custo: 0, peca_valor: 200 }], "samsung", CATALOGO, CFG_PCT_10, "lucro",
  );
  check("peca_valor=200 → (300 − 200) × 10% = R$ 10,00", near(r2c.total, 10), `total=${brl(r2c.total)}`);
}

// ---------------------------------------------------------------------------
// Cenário 3 — 1 serviço, comissão sobre FATURAMENTO → preço × %
//             (não pode quebrar o caso simples que já funcionava)
// ---------------------------------------------------------------------------
console.log("\nCenário 3 — 1 serviço · FATURAMENTO · preço × %");
{
  // 3a: OS só com o serviço (total da OS == preço do serviço): valor idêntico ao antigo
  const preco = 300;
  const rNovo = calcularComissaoPorServico(
    [{ nome: "TROCA DE TELA", preco, custo: 0 }], "samsung", CATALOGO, CFG_PCT_10, "faturamento",
  );
  const antigo = calculoAntigoServicoUnico(preco, CFG_PCT_10["t-tela"]);
  check("300 × 10% = R$ 30,00", near(rNovo.total, 30), `total=${brl(rNovo.total)}`);
  check("bate com o cálculo ANTIGO quando total da OS == preço do serviço",
    near(rNovo.total, antigo), `novo=${brl(rNovo.total)} antigo=${brl(antigo)}`);

  // 3b: valor fixo (não depende de faturamento nem de lucro)
  const rFix = calcularComissaoPorServico(
    [{ nome: "TROCA DE TELA", preco: 300, custo: 0 }], "samsung", CATALOGO, CFG_FIX_50, "faturamento",
  );
  check("valor fixo → R$ 50,00", near(rFix.total, 50), `total=${brl(rFix.total)}`);

  // 3c: aqui está o BUG que a Fase 1 corrige — OS de 1 serviço + 1 produto + desconto.
  //     Antigo: usava o TOTAL da OS como base. Novo: usa o preço do serviço.
  const totalOSComProdutoEDesconto = 300 /*serviço*/ + 150 /*produto*/ - 50 /*desconto*/; // 400
  const antigoComProduto = calculoAntigoServicoUnico(totalOSComProdutoEDesconto, CFG_PCT_10["t-tela"]); // 40
  const novoSemProduto = calcularComissaoPorServico(
    [{ nome: "TROCA DE TELA", preco: 300, custo: 0 }], "samsung", CATALOGO, CFG_PCT_10, "faturamento",
  ).total; // 30
  check("novo ignora produto/desconto: 300 × 10% = R$ 30,00", near(novoSemProduto, 30), `novo=${brl(novoSemProduto)}`);
  check("antigo inflava com produto e desconto (R$ 40,00 != R$ 30,00) — divergência esperada/corrigida",
    !near(antigoComProduto, novoSemProduto), `antigo=${brl(antigoComProduto)} novo=${brl(novoSemProduto)}`);
}

// ---------------------------------------------------------------------------
// Cenário 4 — 2+ serviços: comportamento inalterado (sem regressão)
// ---------------------------------------------------------------------------
console.log("\nCenário 4 — 2+ serviços · sem regressão");
{
  const servicos = [
    { nome: "TROCA DE TELA", preco: 400, custo: 0 },
    { nome: "TROCA DE BATERIA", preco: 200, custo: 0 },
  ];
  const rFat = calcularComissaoPorServico(servicos, "samsung", CATALOGO, CFG_MULTI, "faturamento");
  // 400×10% + 200×5% = 40 + 10 = 50
  check("faturamento: 400×10% + 200×5% = R$ 50,00", near(rFat.total, 50), `total=${brl(rFat.total)}`);

  const rLucro = calcularComissaoPorServico(
    [
      { nome: "TROCA DE TELA", preco: 400, custo: 150 },
      { nome: "TROCA DE BATERIA", preco: 200, custo: 80 },
    ],
    "samsung", CATALOGO, CFG_MULTI, "lucro",
  );
  // (400−150)×10% + (200−80)×5% = 25 + 6 = 31
  check("lucro: (400−150)×10% + (200−80)×5% = R$ 31,00", near(rLucro.total, 31), `total=${brl(rLucro.total)}`);

  // item sem config no meio de vários → contribui 0 e é reportado
  const rMisto = calcularComissaoPorServico(
    [
      { nome: "TROCA DE TELA", preco: 400, custo: 0 },
      { nome: "LIMPEZA INTERNA", preco: 100, custo: 0 },
    ],
    "samsung", CATALOGO, CFG_MULTI, "faturamento",
  );
  check("item sem config não entra na soma (400×10% = R$ 40,00)", near(rMisto.total, 40), `total=${brl(rMisto.total)}`);
  check("item sem config é reportado", rMisto.itensSemComissaoConfigurada.includes("LIMPEZA INTERNA"));
}

// ---------------------------------------------------------------------------
// Cenário 5 — 1 serviço, nome fora do catálogo E SEM tipo no formulário
// ---------------------------------------------------------------------------
console.log("\nCenário 5 — 1 serviço com nome fora do catálogo e SEM fallback do formulário");
{
  const r = calcularComissaoPorServico(
    [{ nome: "SERVICO EXOTICO SEM TIPO", preco: 300, custo: 0 }], "samsung", CATALOGO, CFG_PCT_10, "faturamento",
    /* tipoServicoIdFallback */ null,
  );
  check("snapshot null + item reportado como 'sem config'",
    r.total === null && r.itensSemComissaoConfigurada.length === 1,
    `total=${brl(r.total)} semConfig=${JSON.stringify(r.itensSemComissaoConfigurada)}`);
  check("sem fallback aplicado", r.itensFallbackTipoFormulario.length === 0);
}

// ---------------------------------------------------------------------------
// Cenário 6 — B: fallback do Tipo do formulário quando o nome não casa
// ---------------------------------------------------------------------------
console.log("\nCenário 6 — B · nome não casa, mas o Tipo da Etapa 4 (t-tela, 10%) tem config");
{
  // "BATERIA IPHONE 13" não contém nem está contido em "TROCA DE TELA".
  const r = calcularComissaoPorServico(
    [{ nome: "BATERIA IPHONE 13", preco: 250, custo: 0 }], "iphone", CATALOGO, CFG_PCT_10, "faturamento",
    "t-tela",
  );
  check("fallback aplica t-tela: 250 × 10% = R$ 25,00", near(r.total, 25), `total=${brl(r.total)}`);
  check("item vai para itensFallbackTipoFormulario (aviso BRANDO, não 'revise')",
    r.itensFallbackTipoFormulario.length === 1 && r.itensFallbackTipoFormulario[0] === "BATERIA IPHONE 13");
  check("NÃO entra em 'sem config' nem 'ambíguo'",
    r.itensSemComissaoConfigurada.length === 0 && r.itensComissaoAmbigua.length === 0);

  // base CORRETA: mesmo com produto/desconto na OS (total 400), a base é o preço do serviço
  const rBase = calcularComissaoPorServico(
    [{ nome: "BATERIA IPHONE 13", preco: 250, custo: 0 }], "iphone", CATALOGO, CFG_PCT_10, "faturamento", "t-tela",
  );
  check("fallback NÃO recupera o bug antigo: base = preço do serviço (250), não total da OS",
    near(rBase.total, 25), `total=${brl(rBase.total)}`);

  // fallback com valor fixo
  const rFix = calcularComissaoPorServico(
    [{ nome: "BATERIA IPHONE 13", preco: 250, custo: 0 }], "iphone", CATALOGO, CFG_FIX_50, "faturamento", "t-tela",
  );
  check("fallback com valor fixo → R$ 50,00", near(rFix.total, 50), `total=${brl(rFix.total)}`);

  // Tipo da Etapa 4 sem config (ou config 0) → fallback NÃO aplica
  const rSemCfg = calcularComissaoPorServico(
    [{ nome: "BATERIA IPHONE 13", preco: 250, custo: 0 }], "iphone", CATALOGO, CFG_PCT_10, "faturamento", "t-bateria",
  );
  check("Etapa 4 aponta tipo sem config p/ o técnico → snapshot null + 'sem config'",
    rSemCfg.total === null && rSemCfg.itensSemComissaoConfigurada.length === 1
      && rSemCfg.itensFallbackTipoFormulario.length === 0);
}

// ---------------------------------------------------------------------------
// Cenário 7 — B + modo lucro + proteção de custo continuam ativos no fallback
// ---------------------------------------------------------------------------
console.log("\nCenário 7 — B · via fallback, modo LUCRO e proteção de custo seguem valendo");
{
  // custo confirmado → (preço − custo) × %
  const rOk = calcularComissaoPorServico(
    [{ nome: "BATERIA IPHONE 13", preco: 250, custo: 90 }], "iphone", CATALOGO, CFG_PCT_10, "lucro", "t-tela",
  );
  check("fallback + lucro: (250 − 90) × 10% = R$ 16,00", near(rOk.total, 16), `total=${brl(rOk.total)}`);
  check("marcado como fallback", rOk.itensFallbackTipoFormulario.length === 1);

  // custo 0 NÃO confirmado → proteção dispara mesmo via fallback
  const rProt = calcularComissaoPorServico(
    [{ nome: "BATERIA IPHONE 13", preco: 250, custo: 0, custo_confirmado: undefined }], "iphone", CATALOGO, CFG_PCT_10, "lucro", "t-tela",
  );
  check("fallback + lucro + custo 0 não confirmado → snapshot null + itensCustoNaoConfirmado",
    rProt.total === null && rProt.itensCustoNaoConfirmado.length === 1,
    `total=${brl(rProt.total)} custoNaoConf=${JSON.stringify(rProt.itensCustoNaoConfirmado)}`);
  check("NÃO marcado como fallback aplicado (não entrou na soma)", rProt.itensFallbackTipoFormulario.length === 0);
}

// ---------------------------------------------------------------------------
// Cenário 8 — B NUNCA sobrepõe um match por nome bem-sucedido
// ---------------------------------------------------------------------------
console.log("\nCenário 8 — B · match por nome tem prioridade sobre o fallback");
{
  // nome casa "TROCA DE TELA" (10%). Etapa 4 aponta t-bateria... mas nem seria usado.
  const CFG = {
    "t-tela": { comissao_tipo: "porcentagem", comissao_valor: 10 },
    "t-bateria": { comissao_tipo: "porcentagem", comissao_valor: 99 },
  };
  const r = calcularComissaoPorServico(
    [{ nome: "TROCA DE TELA", preco: 300, custo: 0 }], "samsung", CATALOGO, CFG, "faturamento", "t-bateria",
  );
  check("usa o match por nome (10%), ignora o fallback (99%): R$ 30,00", near(r.total, 30), `total=${brl(r.total)}`);
  check("não marca fallback", r.itensFallbackTipoFormulario.length === 0);
}

// ---------------------------------------------------------------------------
// Cenário 9 — c1: candidatos ambíguos com o MESMO valor → aplica, não marca ambíguo
// ---------------------------------------------------------------------------
console.log("\nCenário 9 — c1 · duplicatas do mesmo reparo, todas 3% → aplica 3%");
{
  const CAT_DUP = [
    { id: "d1", nome: "TROCA DE FRONTAL" },
    { id: "d2", nome: "troca de frontal" },
    { id: "d3", nome: "FRONTAL" },
  ];
  const CFG_DUP = {
    d1: { comissao_tipo: "porcentagem", comissao_valor: 3 },
    d2: { comissao_tipo: "porcentagem", comissao_valor: 3 },
    d3: { comissao_tipo: "porcentagem", comissao_valor: 3 },
  };
  const r = calcularComissaoPorServico(
    [{ nome: "TROCA DE FRONTAL S20FE", preco: 400, custo: 0 }], "samsung", CAT_DUP, CFG_DUP, "faturamento",
  );
  check("c1 aplica 3% mesmo com 3 candidatos: 400 × 3% = R$ 12,00", near(r.total, 12), `total=${brl(r.total)}`);
  check("NÃO marca ambíguo", r.itensComissaoAmbigua.length === 0);

  // valores diferentes → continua ambíguo (c1 não mascara diferença real)
  const CFG_DIF = { ...CFG_DUP, d3: { comissao_tipo: "porcentagem", comissao_valor: 5 } };
  const rDif = calcularComissaoPorServico(
    [{ nome: "TROCA DE FRONTAL S20FE", preco: 400, custo: 0 }], "samsung", CAT_DUP, CFG_DIF, "faturamento",
  );
  check("valores diferentes → segue ambíguo (snapshot null)",
    rDif.total === null && rDif.itensComissaoAmbigua.length === 1, `total=${brl(rDif.total)}`);
}

// ---------------------------------------------------------------------------
// Cenário 10 — c2: "iphone"/"ipad" contam como família Apple na desambiguação
// ---------------------------------------------------------------------------
console.log("\nCenário 10 — c2 · marca 'iphone' resolve tampa IPHONE vs ANDROID");
{
  check('palavrasChaveDaMarca("iphone ") inclui "iphone"', palavrasChaveDaMarca("iphone ").includes("iphone"));
  check('palavrasChaveDaMarca("iPhone 13") reconhece Apple (não cai em android)',
    !palavrasChaveDaMarca("iPhone 13").includes("android"));
  check('palavrasChaveDaMarca("iPad") reconhece Apple', !palavrasChaveDaMarca("iPad").includes("android"));
  check('palavrasChaveDaMarca("samsung") continua android', palavrasChaveDaMarca("samsung").includes("android"));

  const CAT_TAMPA = [
    { id: "ti", nome: "TROCA DE TAMPA IPHONE" },
    { id: "ta", nome: "TROCA DE TAMPA DE ANDROID" },
  ];
  const CFG_TAMPA = {
    ti: { comissao_tipo: "porcentagem", comissao_valor: 15 },
    ta: { comissao_tipo: "porcentagem", comissao_valor: 10 },
  };
  const r = calcularComissaoPorServico(
    [{ nome: "TROCA DE TAMPA", preco: 200, custo: 0 }], "iphone", CAT_TAMPA, CFG_TAMPA, "faturamento",
  );
  check("marca 'iphone' escolhe a variante IPHONE (15%): 200 × 15% = R$ 30,00", near(r.total, 30), `total=${brl(r.total)}`);
  check("não marca ambíguo", r.itensComissaoAmbigua.length === 0);

  // controle: sem marca continua ambíguo (valores diferentes, c1 não resolve)
  const rSemMarca = calcularComissaoPorServico(
    [{ nome: "TROCA DE TAMPA", preco: 200, custo: 0 }], "", CAT_TAMPA, CFG_TAMPA, "faturamento",
  );
  check("sem marca → ambíguo (15% vs 10%)", rSemMarca.total === null && rSemMarca.itensComissaoAmbigua.length === 1);
}

// ---------------------------------------------------------------------------
console.log(`\n${falhas === 0 ? "✅ TODOS OS TESTES PASSARAM" : `❌ ${falhas} FALHA(S)`}\n`);
process.exit(falhas === 0 ? 0 : 1);

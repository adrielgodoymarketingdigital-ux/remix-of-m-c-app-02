/**
 * FASE 3 — Regressão do "vínculo direto Serviço → Tipo de Serviço"
 * (servicos.tipo_servico_id) tendo prioridade sobre a correspondência por nome
 * no cálculo de comissão.
 *
 * Cobre os cenários pedidos:
 *   1. serviço vinculado + % configurada → usa o vínculo DIRETO (sem nome)
 *   2. serviço vinculado SEM % → comissão 0 intencional (itensVinculoSemConfig,
 *      aviso brando — NÃO entra em "revise")
 *   3. assistente de vinculação (sugerirTipoServicoPorNome) sugere certo e não
 *      "resolve" casos ambíguos
 *   5. serviço SEM vínculo → fluxo antigo (match por nome), sem regressão
 *   6. caso Glaucio "TROCA DE CARCAÇA": vinculando ao Tipo de 15% a OS nova
 *      calcula 15%, não os 20% do Tipo homônimo pego pelo nome
 *
 * (Cenário 4 — mesclagem — é integração com banco: ver o plano de teste manual.
 *  Aqui vai só a partição pura do UNIQUE(func,tipo).)
 *
 * Usa as FUNÇÕES REAIS e puras do app.
 *   node scripts/fase3-vinculo-direto-tipo-servico/testes-regressao.mjs
 */
import {
  resolverComissaoDoServico,
  calcularComissaoDoItem,
  sugerirTipoServicoPorNome,
  normalizarNomeParaComparacao,
} from "../../src/lib/ordemServico/comissaoPorTipoServico.ts";

const brl = (n) => (n === null ? "—" : (n < 0 ? "-" : "") + "R$ " + Math.abs(n).toFixed(2));
const near = (a, b, eps = 1e-9) => a === b || (a !== null && b !== null && Math.abs(a - b) <= eps);
let falhas = 0;
const check = (nome, cond, detalhe = "") => {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`   [${ok ? "PASS" : "FALHA"}] ${nome}${detalhe ? "  — " + detalhe : ""}`);
};

/**
 * Reproduz VERBATIM o laço ATUAL de calcularComissaoPorServico()
 * (handleSubmitOrdemServico.ts) — a parte pura. `catalogo` e `configPorTipo`
 * são o que as buscas ao Supabase devolveriam; `vinculoPorServicoId` é o
 * `{ servico.id → tipo_servico_id }` que a busca em `servicos` devolveria.
 */
function calcularComissaoPorServico(servicos, dispositivoMarca, catalogo, configPorTipo, comissaoCalculo, vinculoPorServicoId = {}, tipoServicoIdFallback) {
  const comissaoPorTipoServicoId = new Map(
    Object.entries(configPorTipo).map(([tipoId, c]) => [tipoId, { tipo_servico_id: tipoId, ...c }]),
  );
  const tiposComComissao = catalogo.filter((t) => comissaoPorTipoServicoId.has(t.id));
  const vinculo = new Map(Object.entries(vinculoPorServicoId));

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
  const itensVinculoSemConfig = [];

  for (const servico of servicos) {
    const resultado = resolverComissaoDoServico(
      servico.nome,
      vinculo.get(servico.id),
      tiposComComissao,
      comissaoPorTipoServicoId,
      dispositivoMarca,
    );

    if (resultado.vinculoSemConfig) {
      itensVinculoSemConfig.push(servico.nome);
      continue;
    }

    const resolveu = !!resultado.config && !resultado.ambiguo;
    const usarFallback =
      !resolveu
      && !resultado.viaVinculoDireto
      && !!configFallbackFormulario
      && Number(configFallbackFormulario.comissao_valor) > 0;

    if (!resolveu && !usarFallback) {
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
        { preco: servico.preco, custo: servico.peca_valor ?? servico.custo, custoConfirmado: servico.custo_confirmado },
        config,
        comissaoCalculo,
      );
      if (calc.custoNaoConfirmado) { itensCustoNaoConfirmado.push(servico.nome); continue; }
      algumEncontrado = true;
      comissaoTotal += calc.valor;
      if (usarFallback) itensFallbackTipoFormulario.push(servico.nome);
    }
  }

  return {
    total: algumEncontrado ? comissaoTotal : null,
    itensSemComissaoConfigurada, itensComissaoAmbigua,
    itensCustoNaoConfirmado, itensFallbackTipoFormulario, itensVinculoSemConfig,
  };
}

console.log("\n=== FASE 3 — vínculo direto Serviço → Tipo de Serviço ===\n");

// ---------------------------------------------------------------------------
// Cenário 1 — serviço vinculado + % configurada → usa o vínculo DIRETO
// ---------------------------------------------------------------------------
console.log("Cenário 1 — vínculo direto com % configurada é usado sem match de nome");
{
  const catalogo = [
    { id: "t-15", nome: "MÃO DE OBRA" },       // nome NÃO casa com o serviço
    { id: "t-20", nome: "TROCA DE CARCAÇA" },  // nome casa (exato) — 20%
  ];
  const cfg = {
    "t-15": { comissao_tipo: "porcentagem", comissao_valor: 15 },
    "t-20": { comissao_tipo: "porcentagem", comissao_valor: 20 },
  };
  const servicos = [{ id: "s1", nome: "TROCA DE CARCAÇA", preco: 100, custo: 0 }];

  // Sem vínculo: pega o Tipo homônimo (20%)
  const semVinculo = calcularComissaoPorServico(servicos, "iphone", catalogo, cfg, "faturamento", {});
  check("sem vínculo, o nome casa com o Tipo de 20% → R$ 20,00", near(semVinculo.total, 20), brl(semVinculo.total));

  // Com vínculo para o Tipo de 15%: usa 15%, ignora o nome
  const comVinculo = calcularComissaoPorServico(servicos, "iphone", catalogo, cfg, "faturamento", { s1: "t-15" });
  check("com vínculo → t-15: 100 × 15% = R$ 15,00 (ignora o nome)", near(comVinculo.total, 15), brl(comVinculo.total));
  check("nada em 'revise' nem 'ambíguo'", comVinculo.itensComissaoAmbigua.length === 0 && comVinculo.itensSemComissaoConfigurada.length === 0);
  check("nada em 'vínculo sem config'", comVinculo.itensVinculoSemConfig.length === 0);
}

// ---------------------------------------------------------------------------
// Cenário 2 — serviço vinculado SEM % → comissão 0 intencional (brando)
// ---------------------------------------------------------------------------
console.log("\nCenário 2 — vínculo sem % para o técnico → comissão 0 + aviso brando (não 'revise')");
{
  const catalogo = [
    { id: "t-a", nome: "TROCA DE TELA" },
    { id: "t-b", nome: "LIMPEZA" },
  ];
  // Técnico só tem config para t-a; o serviço está vinculado a t-b
  const cfg = { "t-a": { comissao_tipo: "porcentagem", comissao_valor: 10 } };
  const servicos = [{ id: "s1", nome: "LIMPEZA COMPLETA", preco: 200, custo: 0 }];

  const r = calcularComissaoPorServico(servicos, "samsung", catalogo, cfg, "faturamento", { s1: "t-b" });
  check("total = — (nenhuma comissão aplicada)", r.total === null, brl(r.total));
  check("item entra em itensVinculoSemConfig", r.itensVinculoSemConfig.length === 1 && r.itensVinculoSemConfig[0] === "LIMPEZA COMPLETA");
  check("NÃO entra em itensSemComissaoConfigurada (que geraria 'revise')", r.itensSemComissaoConfigurada.length === 0);
  check("NÃO entra em itensComissaoAmbigua", r.itensComissaoAmbigua.length === 0);
}

// ---------------------------------------------------------------------------
// Cenário 3 — assistente: sugerirTipoServicoPorNome
// ---------------------------------------------------------------------------
console.log("\nCenário 3 — assistente de vinculação sugere certo e não chuta nos ambíguos");
{
  const tipos = [
    { id: "t-frontal", nome: "TROCA DE FRONTAL" },
    { id: "t-frontal2", nome: "frontal" },
    { id: "t-bat", nome: "TROCA DE BATERIA" },
    { id: "t-tampa-ip", nome: "TROCA DE TAMPA IPHONE" },
    { id: "t-tampa-an", nome: "TROCA DE TAMPA DE ANDROID" },
  ];

  const s1 = sugerirTipoServicoPorNome("TROCA DE BATERIA IPHONE 11", tipos);
  check("'TROCA DE BATERIA IPHONE 11' → t-bat (candidato único)", s1.tipoId === "t-bat" && !s1.ambiguo);

  const s2 = sugerirTipoServicoPorNome("TROCA DE FRONTAL", tipos);
  check("'TROCA DE FRONTAL' casa 2 (FRONTAL + TROCA DE FRONTAL) mas exato desempata → t-frontal", s2.tipoId === "t-frontal" && !s2.ambiguo);

  // "TROCA DE TAMPA" é contido por AMBOS os Tipos (tipo contém item), sem exato → ambíguo
  const s3 = sugerirTipoServicoPorNome("TROCA DE TAMPA", tipos);
  check("'TROCA DE TAMPA' contido por TAMPA IPHONE e TAMPA ANDROID, sem exato → ambíguo, sem sugestão", s3.tipoId === null && s3.ambiguo);

  const s4 = sugerirTipoServicoPorNome("HIGIENIZAÇÃO", tipos);
  check("'HIGIENIZAÇÃO' não casa nada → sem sugestão, não ambíguo", s4.tipoId === null && !s4.ambiguo);

  // nome que não contém nem é contido por nenhum Tipo → sem match (não ambíguo)
  const s5 = sugerirTipoServicoPorNome("TROCA DE TAMPA S21", tipos);
  check("'TROCA DE TAMPA S21' não é contido nem contém Tipo algum → sem sugestão, não ambíguo", s5.tipoId === null && !s5.ambiguo);

  // não sobrescrever vínculo já feito: a UI filtra `s.tipo_servico_id` antes de
  // chamar o assistente — aqui garantimos que a função não força nada por conta própria.
  check("normalização colapsa espaços e caixa", normalizarNomeParaComparacao("  Troca   DE  Tampa ") === "troca de tampa");
}

// ---------------------------------------------------------------------------
// Cenário 4 (parte pura) — partição do UNIQUE(func, tipo) na mesclagem
// ---------------------------------------------------------------------------
console.log("\nCenário 4 — mesclagem: config de duplicado colide com a do sobrevivente → descarta, senão reaponta");
{
  // Reproduz a lógica de mesclarTipos (useTiposServico.ts) para o passo 1.
  function particionar(configsSobrevivente, configsDups) {
    const funcs = new Set(configsSobrevivente.map((c) => c.funcionario_id));
    const reapontar = [], apagar = [];
    for (const c of configsDups) {
      if (funcs.has(c.funcionario_id)) apagar.push(c.id);
      else { reapontar.push(c.id); funcs.add(c.funcionario_id); }
    }
    return { reapontar, apagar };
  }

  const sobrevivente = [{ funcionario_id: "F1" }];               // F1 já tem config no sobrevivente
  const dups = [
    { id: "c-F1", funcionario_id: "F1" },   // colide → apagar
    { id: "c-F2", funcionario_id: "F2" },   // novo   → reapontar
    { id: "c-F2b", funcionario_id: "F2" },  // 2º duplicado do MESMO func → apagar (evita violar UNIQUE)
  ];
  const { reapontar, apagar } = particionar(sobrevivente, dups);
  check("reaponta só c-F2", reapontar.length === 1 && reapontar[0] === "c-F2");
  check("apaga c-F1 (colide) e c-F2b (2º do mesmo func)", apagar.length === 2 && apagar.includes("c-F1") && apagar.includes("c-F2b"));
}

// ---------------------------------------------------------------------------
// Cenário 5 — serviço SEM vínculo continua no fluxo antigo (sem regressão)
// ---------------------------------------------------------------------------
console.log("\nCenário 5 — serviço sem vínculo: match por nome + fallback do formulário intactos");
{
  const catalogo = [
    { id: "t-tela", nome: "TROCA DE TELA" },
    { id: "t-bat", nome: "TROCA DE BATERIA" },
  ];
  const cfg = {
    "t-tela": { comissao_tipo: "porcentagem", comissao_valor: 10 },
    "t-bat": { comissao_tipo: "porcentagem", comissao_valor: 5 },
  };

  // match por nome
  const r1 = calcularComissaoPorServico(
    [{ id: "s1", nome: "TROCA DE TELA SAMSUNG A10", preco: 300, custo: 0 }],
    "samsung", catalogo, cfg, "faturamento", {},
  );
  check("match por nome: 300 × 10% = R$ 30,00", near(r1.total, 30), brl(r1.total));

  // fallback do formulário (1 serviço, nome não casa, tsId aponta t-tela)
  const r2 = calcularComissaoPorServico(
    [{ id: "s1", nome: "SERVICO GENERICO", preco: 250, custo: 0 }],
    "samsung", catalogo, cfg, "faturamento", {}, "t-tela",
  );
  check("fallback do formulário: 250 × 10% = R$ 25,00", near(r2.total, 25), brl(r2.total));
  check("marcado como fallback (aviso brando)", r2.itensFallbackTipoFormulario.length === 1);

  // multi-serviço sem vínculo, item a item
  const r3 = calcularComissaoPorServico(
    [
      { id: "s1", nome: "TROCA DE TELA", preco: 400, custo: 0 },
      { id: "s2", nome: "TROCA DE BATERIA", preco: 200, custo: 0 },
    ],
    "samsung", catalogo, cfg, "faturamento", {},
  );
  check("item a item: 400×10% + 200×5% = R$ 50,00", near(r3.total, 50), brl(r3.total));
}

// ---------------------------------------------------------------------------
// Cenário 6 — caso Glaucio "TROCA DE CARCAÇA" (20% pelo nome → 15% pelo vínculo)
// ---------------------------------------------------------------------------
console.log("\nCenário 6 — Glaucio: 'TROCA DE CARCAÇA' vinculado ao Tipo de 15% → OS nova calcula 15%");
{
  // Catálogo real (resumido): existe o Tipo homônimo "TROCA DE CARCAÇA" a 20%
  // (JUNIOR) e um Tipo "TROCA DE TAMPA IPHONE" a 15% para o qual o dono quer
  // que "carcaça" também caia.
  const catalogo = [
    { id: "t-carcaca", nome: "TROCA DE CARCAÇA" },
    { id: "t-tampa-ip", nome: "TROCA DE TAMPA IPHONE" },
  ];
  const cfgJunior = {
    "t-carcaca": { comissao_tipo: "porcentagem", comissao_valor: 20 },
    "t-tampa-ip": { comissao_tipo: "porcentagem", comissao_valor: 15 },
  };
  // OS-001034 (resumida): "TROCA DE CARCAÇA" R$ 100, aparelho Apple
  const servicos = [{ id: "s-carcaca", nome: "TROCA DE CARCAÇA", preco: 100, custo: 0 }];

  const antes = calcularComissaoPorServico(servicos, "Apple", catalogo, cfgJunior, "faturamento", {});
  check("ANTES (sem vínculo): nome casa exato com 'TROCA DE CARCAÇA' 20% → R$ 20,00", near(antes.total, 20), brl(antes.total));

  const depois = calcularComissaoPorServico(servicos, "Apple", catalogo, cfgJunior, "faturamento", { "s-carcaca": "t-tampa-ip" });
  check("DEPOIS (serviço vinculado a 'TROCA DE TAMPA IPHONE' 15%): R$ 15,00", near(depois.total, 15), brl(depois.total));
  check("re-salvar a OS recomputa pelo vínculo, não pelo nome", depois.itensComissaoAmbigua.length === 0 && depois.itensVinculoSemConfig.length === 0);
}

console.log("");
if (falhas === 0) {
  console.log("✅ TODOS OS TESTES PASSARAM\n");
  process.exit(0);
} else {
  console.log(`❌ ${falhas} FALHA(S)\n`);
  process.exit(1);
}

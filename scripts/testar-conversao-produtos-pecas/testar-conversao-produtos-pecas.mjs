#!/usr/bin/env node
/**
 * Testa a lógica REAL de conversão produto↔peça e de grupo de variações —
 * importa direto de src/lib/produtos/conversaoTipo.ts (mesmas funções que
 * useProdutos.ts chama em produção, sem reescrever nada aqui).
 *
 * Roda contra o banco de PRODUÇÃO via `supabase db query --linked`, usando
 * uma conta de teste vazia (usuarioteste123@gmail.com). Cada cenário cria
 * suas PRÓPRIAS fixtures (nome prefixado "TESTE_CONV_", uuid gerado aqui) —
 * nada de dado real é tocado. Um bloco `finally` apaga TUDO que foi criado,
 * rode o que rodar (sucesso ou falha no meio) — ver supabaseDbShim.mjs pra
 * uma explicação de por que isso é "cleanup garantido por finally" e não uma
 * transação SQL com ROLLBACK de verdade (a ferramenta disponível não
 * garante sessão única entre statements — confirmado nesta mesma sessão).
 *
 * USO:
 *   node scripts/testar-conversao-produtos-pecas/testar-conversao-produtos-pecas.mjs
 */
import { randomUUID } from 'node:crypto';
import {
  executarConversaoTipo,
  verificarBloqueiosConversao,
  renomearVariacao,
  adicionarVariacaoAoGrupo,
  removerDoGrupo,
} from '../../src/lib/produtos/conversaoTipo.ts';
import { supabaseShim, sqlBruto, totalChamadas } from './supabaseDbShim.mjs';

const USER_ID = 'a40e1657-53fa-4b15-9fb0-4be0d1a6f9c6'; // usuarioteste123@gmail.com — conta de teste vazia
const EMPRESA_ID = null;

let falhas = 0;
let passos = 0;
const check = (nome, cond, detalhe = '') => {
  passos++;
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`   [${ok ? 'PASS' : 'FALHA'}] ${nome}${detalhe ? '  — ' + detalhe : ''}`);
};

const secao = (titulo) => {
  console.log('\n' + '='.repeat(78));
  console.log(titulo);
  console.log('='.repeat(78));
};

const brl = (n) => (n === null || n === undefined ? 'null' : 'R$ ' + Number(n).toFixed(2));

async function buscarLinha(tabela, id) {
  const rows = await sqlBruto(`SELECT * FROM ${tabela} WHERE id = '${id}'`);
  return rows[0] || null;
}

async function existeEm(tabela, id) {
  const rows = await sqlBruto(`SELECT id FROM ${tabela} WHERE id = '${id}'`);
  return rows.length > 0;
}

function mostrar(linha, campos) {
  if (!linha) return '(não encontrado)';
  return campos.map((c) => `${c}=${JSON.stringify(linha[c])}`).join(', ');
}

// IDs criados nesta rodada — apagados no finally, tabela por tabela. Ordem
// importa: vendas.produto_id tem FK RESTRICT pra produtos, então vendas
// precisa ser apagada ANTES de produtos, senão o DELETE de produtos falha.
const criados = { vendas: new Set(), produtos: new Set(), pecas: new Set() };
const criar = (tabela, id) => criados[tabela].add(id);

async function main() {
  console.log(`Conta de teste: ${USER_ID} (usuarioteste123@gmail.com)`);

  // ───────────────────────────────────────────────────────────────────────
  // CENÁRIO 1 — Converter produto nunca vendido → confirma preservação de
  // TODOS os campos (o bug original: preco_atacado/exibir_no_catalogo/
  // variacao_label eram perdidos na conversão).
  // ───────────────────────────────────────────────────────────────────────
  secao('CENÁRIO 1 — Converter produto nunca vendido (produto → peça)');
  const idA = randomUUID();
  await supabaseShim.from('produtos').insert({
    id: idA, user_id: USER_ID, empresa_id: EMPRESA_ID,
    nome: 'TESTE_CONV_A', sku: 'SKU-TESTE-A', codigo_barras: 'BARCODE-TESTE-A',
    quantidade: 5, custo: 10, preco: 25, preco_atacado: 20,
    exibir_no_catalogo: false, fotos: [],
  });
  criar('produtos', idA);

  const antesA = await buscarLinha('produtos', idA);
  console.log('ANTES (produtos): ' + mostrar(antesA, ['nome', 'custo', 'preco', 'preco_atacado', 'quantidade', 'codigo_barras', 'exibir_no_catalogo', 'sku']));

  const resultado1 = await executarConversaoTipo(supabaseShim, [{ id: idA, tipo: 'produto' }], 'peca', USER_ID, EMPRESA_ID);
  console.log(`executarConversaoTipo → ok=${resultado1.ok}, convertidos=[${resultado1.convertidos}], bloqueios=${resultado1.bloqueios.size}`);

  const depoisA_produtos = await existeEm('produtos', idA);
  const depoisA = await buscarLinha('pecas', idA);
  console.log('DEPOIS (pecas): ' + mostrar(depoisA, ['nome', 'custo', 'preco', 'preco_atacado', 'quantidade', 'codigo_barras', 'exibir_no_catalogo']));

  check('conversão retornou ok=true', resultado1.ok === true);
  check('saiu de produtos', depoisA_produtos === false);
  check('nome preservado', depoisA?.nome === 'TESTE_CONV_A', `${antesA.nome} → ${depoisA?.nome}`);
  check('custo preservado', Number(depoisA?.custo) === 10, `${brl(antesA.custo)} → ${brl(depoisA?.custo)}`);
  check('preco preservado', Number(depoisA?.preco) === 25, `${brl(antesA.preco)} → ${brl(depoisA?.preco)}`);
  check('preco_atacado preservado (era perdido no bug original)', Number(depoisA?.preco_atacado) === 20, `${brl(antesA.preco_atacado)} → ${brl(depoisA?.preco_atacado)}`);
  check('quantidade preservada', Number(depoisA?.quantidade) === 5, `${antesA.quantidade} → ${depoisA?.quantidade}`);
  check('codigo_barras preservado', depoisA?.codigo_barras === 'BARCODE-TESTE-A');
  check('exibir_no_catalogo preservado (era perdido no bug original)', depoisA?.exibir_no_catalogo === false, `${antesA.exibir_no_catalogo} → ${depoisA?.exibir_no_catalogo}`);
  criados.produtos.delete(idA);
  criar('pecas', idA); // pra limpeza no final, já que agora mora em pecas

  // ───────────────────────────────────────────────────────────────────────
  // CENÁRIO 2 — Produto já vendido → confirma bloqueio ANTES de qualquer
  // tentativa de delete, com mensagem específica (não o genérico antigo).
  // ───────────────────────────────────────────────────────────────────────
  secao('CENÁRIO 2 — Tentar converter produto já vendido');
  const idB = randomUUID();
  const idVendaB = randomUUID();
  await supabaseShim.from('produtos').insert({
    id: idB, user_id: USER_ID, empresa_id: EMPRESA_ID,
    nome: 'TESTE_CONV_B', quantidade: 3, custo: 8, preco: 20, fotos: [],
  });
  criar('produtos', idB);
  await supabaseShim.from('vendas').insert({
    id: idVendaB, user_id: USER_ID, tipo: 'produto', produto_id: idB,
    total: 20, forma_pagamento: 'dinheiro', quantidade: 1,
  });
  criar('vendas', idVendaB);

  const preflight2 = await verificarBloqueiosConversao(supabaseShim, [{ id: idB, tipo: 'produto' }], USER_ID);
  console.log(`verificarBloqueiosConversao → motivo: "${preflight2.bloqueios.get(idB)}"`);

  const resultado2 = await executarConversaoTipo(supabaseShim, [{ id: idB, tipo: 'produto' }], 'peca', USER_ID, EMPRESA_ID);
  const aindaEmProdutosB = await existeEm('produtos', idB);
  const foiParaPecasB = await existeEm('pecas', idB);
  console.log(`executarConversaoTipo → ok=${resultado2.ok}, ainda em produtos=${aindaEmProdutosB}, foi pra pecas=${foiParaPecasB}`);

  check('pré-flight já detecta o bloqueio (não descobre só no delete)', preflight2.bloqueios.has(idB));
  check('mensagem específica menciona "vendido"', /vendido/i.test(preflight2.bloqueios.get(idB) || ''), preflight2.bloqueios.get(idB));
  check('conversão retornou ok=false', resultado2.ok === false);
  check('produto continua em produtos (não foi movido)', aindaEmProdutosB === true);
  check('produto NÃO apareceu em pecas', foiParaPecasB === false);
  check('nenhum delete foi tentado (venda ainda existe, sem erro de FK)', await existeEm('vendas', idVendaB));

  // ───────────────────────────────────────────────────────────────────────
  // CENÁRIO 3 — Raiz de grupo de variação → confirma bloqueio (decisão:
  // bloquear em vez de promover filho a nova raiz, ver comentário em
  // conversaoTipo.ts).
  // ───────────────────────────────────────────────────────────────────────
  secao('CENÁRIO 3 — Tentar converter raiz de grupo de variação');
  const idC_raiz = randomUUID();
  const idC_filha = randomUUID();
  await supabaseShim.from('produtos').insert([
    { id: idC_raiz, user_id: USER_ID, empresa_id: EMPRESA_ID, nome: 'TESTE_CONV_C - Base', produto_pai_id: null, variacao_label: null, quantidade: 1, custo: 5, preco: 10, fotos: [] },
    { id: idC_filha, user_id: USER_ID, empresa_id: EMPRESA_ID, nome: 'TESTE_CONV_C - iPhone 11', produto_pai_id: idC_raiz, variacao_label: 'iPhone 11', quantidade: 2, custo: 6, preco: 12, fotos: [] },
  ]);
  criar('produtos', idC_raiz);
  criar('produtos', idC_filha);

  const preflight3 = await verificarBloqueiosConversao(supabaseShim, [{ id: idC_raiz, tipo: 'produto' }], USER_ID);
  console.log(`verificarBloqueiosConversao(raiz) → motivo: "${preflight3.bloqueios.get(idC_raiz)}"`);

  const resultado3 = await executarConversaoTipo(supabaseShim, [{ id: idC_raiz, tipo: 'produto' }], 'peca', USER_ID, EMPRESA_ID);
  const raizAindaProduto = await existeEm('produtos', idC_raiz);
  const filhaAindaApontaPraRaiz = (await buscarLinha('produtos', idC_filha))?.produto_pai_id === idC_raiz;
  console.log(`executarConversaoTipo(raiz) → ok=${resultado3.ok}; raiz ainda em produtos=${raizAindaProduto}; filha ainda aponta pra raiz=${filhaAindaApontaPraRaiz}`);

  check('pré-flight detecta "raiz de grupo"', /raiz de um grupo/i.test(preflight3.bloqueios.get(idC_raiz) || ''), preflight3.bloqueios.get(idC_raiz));
  check('conversão da raiz retornou ok=false', resultado3.ok === false);
  check('raiz continua em produtos', raizAindaProduto === true);
  check('filha NÃO ficou órfã (produto_pai_id intacto — sem promoção automática nem SET NULL silencioso)', filhaAindaApontaPraRaiz === true);

  // ───────────────────────────────────────────────────────────────────────
  // CENÁRIO 4 — Editar variação existente, renomear label.
  // ───────────────────────────────────────────────────────────────────────
  secao('CENÁRIO 4 — Renomear label de uma variação existente');
  const idD_raiz = randomUUID();
  const idD_filha = randomUUID();
  await supabaseShim.from('produtos').insert([
    { id: idD_raiz, user_id: USER_ID, empresa_id: EMPRESA_ID, nome: 'TESTE_CONV_D - Base', produto_pai_id: null, quantidade: 1, custo: 5, preco: 10, fotos: [] },
    { id: idD_filha, user_id: USER_ID, empresa_id: EMPRESA_ID, nome: 'TESTE_CONV_D - iPhone 11', produto_pai_id: idD_raiz, variacao_label: 'iPhone 11', quantidade: 2, custo: 6, preco: 12, fotos: [] },
  ]);
  criar('produtos', idD_raiz);
  criar('produtos', idD_filha);

  const antesD = await buscarLinha('produtos', idD_filha);
  console.log('ANTES: ' + mostrar(antesD, ['nome', 'variacao_label']));

  const resultado4 = await renomearVariacao(supabaseShim, idD_filha, 'produto', 'iPhone 11 Pro Max', USER_ID);
  const depoisD = await buscarLinha('produtos', idD_filha);
  console.log('DEPOIS: ' + mostrar(depoisD, ['nome', 'variacao_label']));

  check('renomearVariacao retornou ok=true', resultado4.ok === true);
  check('variacao_label mudou pro novo valor', depoisD?.variacao_label === 'iPhone 11 Pro Max', `"${antesD.variacao_label}" → "${depoisD?.variacao_label}"`);
  check('nome do item NÃO mudou (só o label)', depoisD?.nome === antesD.nome);

  // ───────────────────────────────────────────────────────────────────────
  // CENÁRIO 5 — Adicionar nova variação a grupo já existente (grupo D).
  // ───────────────────────────────────────────────────────────────────────
  secao('CENÁRIO 5 — Adicionar nova variação a um grupo já existente');
  const antesGrupoD = await sqlBruto(`SELECT id FROM produtos WHERE produto_pai_id = '${idD_raiz}' OR id = '${idD_raiz}'`);
  console.log(`ANTES: grupo D tem ${antesGrupoD.length} membro(s) (raiz + variações)`);

  const resultado5 = await adicionarVariacaoAoGrupo(
    supabaseShim, idD_raiz, 'produto',
    { nome: 'TESTE_CONV_D - iPhone 13', label: 'iPhone 13', quantidade: 4, custo: 7, preco: 15, preco_atacado: null },
    USER_ID, EMPRESA_ID,
  );
  const idD_nova = resultado5.id;
  if (idD_nova) criar('produtos', idD_nova);

  const depoisGrupoD = await sqlBruto(`SELECT id, nome, variacao_label, produto_pai_id FROM produtos WHERE produto_pai_id = '${idD_raiz}' OR id = '${idD_raiz}' ORDER BY nome`);
  console.log(`DEPOIS: grupo D tem ${depoisGrupoD.length} membro(s):`);
  depoisGrupoD.forEach((m) => console.log(`   - ${m.nome} (label="${m.variacao_label}", pai=${m.produto_pai_id === idD_raiz ? 'raiz D' : m.produto_pai_id})`));

  check('adicionarVariacaoAoGrupo retornou ok=true', resultado5.ok === true);
  check('grupo cresceu de 2 pra 3 membros', antesGrupoD.length === 2 && depoisGrupoD.length === 3, `${antesGrupoD.length} → ${depoisGrupoD.length}`);
  const novaLinha = depoisGrupoD.find((m) => m.id === idD_nova);
  check('nova variação aponta pra raiz correta (produto_pai_id = raiz D)', novaLinha?.produto_pai_id === idD_raiz);
  check('nova variação tem o label certo', novaLinha?.variacao_label === 'iPhone 13');

  // ───────────────────────────────────────────────────────────────────────
  // CENÁRIO 6 — Remover uma variação do grupo → vira item avulso (desvincula,
  // NÃO exclui).
  // ───────────────────────────────────────────────────────────────────────
  secao('CENÁRIO 6 — Remover (desvincular) uma variação do grupo');
  const antesRemover = await buscarLinha('produtos', idD_nova);
  console.log('ANTES: ' + mostrar(antesRemover, ['nome', 'produto_pai_id', 'variacao_label']));

  const resultado6 = await removerDoGrupo(supabaseShim, idD_nova, 'produto', USER_ID);
  const depoisRemover = await buscarLinha('produtos', idD_nova);
  console.log('DEPOIS: ' + mostrar(depoisRemover, ['nome', 'produto_pai_id', 'variacao_label']));

  check('removerDoGrupo retornou ok=true', resultado6.ok === true);
  check('item CONTINUA existindo (não foi excluído)', depoisRemover !== null);
  check('produto_pai_id virou null (desvinculado)', depoisRemover?.produto_pai_id === null, `${antesRemover.produto_pai_id} → ${depoisRemover?.produto_pai_id}`);
  check('variacao_label virou null', depoisRemover?.variacao_label === null, `"${antesRemover.variacao_label}" → ${depoisRemover?.variacao_label}`);
  check('nome do item preservado', depoisRemover?.nome === antesRemover.nome);

  // ───────────────────────────────────────────────────────────────────────
  // CENÁRIO 7 — Item avulso normal → nada relacionado a variação/conversão
  // deveria afetá-lo. Criado no início desta seção e comparado ANTES/DEPOIS
  // de rodar o resto, provando que não há contaminação cruzada entre
  // fixtures.
  // ───────────────────────────────────────────────────────────────────────
  secao('CENÁRIO 7 — Item avulso normal (controle, sem variação nem conversão)');
  const idE = randomUUID();
  await supabaseShim.from('produtos').insert({
    id: idE, user_id: USER_ID, empresa_id: EMPRESA_ID,
    nome: 'TESTE_CONV_E_Avulso', quantidade: 9, custo: 3, preco: 7, fotos: [],
  });
  criar('produtos', idE);
  const antesE = await buscarLinha('produtos', idE);

  // Roda verificarBloqueiosConversao nele (sem executar a conversão de
  // verdade) só pra confirmar que um item sem vínculo nenhum não é bloqueado
  // à toa.
  const preflight7 = await verificarBloqueiosConversao(supabaseShim, [{ id: idE, tipo: 'produto' }], USER_ID);
  const depoisE = await buscarLinha('produtos', idE);
  console.log('Item avulso: ' + mostrar(depoisE, ['nome', 'produto_pai_id', 'variacao_label', 'quantidade', 'custo', 'preco']));

  check('pré-flight não bloqueia item sem vínculo nenhum', !preflight7.bloqueios.has(idE));
  check('não tem produto_pai_id (não é variação)', depoisE?.produto_pai_id === null || depoisE?.produto_pai_id === undefined);
  check('nada mudou nele (mera existência de outros cenários não o afeta)', JSON.stringify(antesE) === JSON.stringify(depoisE));

  console.log(`\n(${totalChamadas()} chamadas ao Postgres via supabase db query --linked nesta rodada)`);
}

async function limpar() {
  secao('LIMPEZA — apagando todas as fixtures desta rodada');
  // Cada tabela num try/catch próprio: uma falha isolada (ex: ordem de FK
  // inesperada) não pode impedir a limpeza das demais tabelas.
  for (const [tabela, ids] of Object.entries(criados)) {
    if (ids.size === 0) continue;
    const idsArr = [...ids];
    try {
      await sqlBruto(`DELETE FROM ${tabela} WHERE id IN (${idsArr.map((i) => `'${i}'`).join(', ')})`);
      console.log(`   ${tabela}: ${idsArr.length} linha(s) apagada(s)`);
    } catch (e) {
      console.error(`   ⚠️  Falha ao limpar ${tabela}: ${e.message}`);
      falhas++;
    }
  }

  // Rede de segurança: se algum cenário falhar de um jeito inesperado e
  // deixar uma linha fora do rastreamento de `criados` (ex: bloqueio que
  // deveria funcionar mas não funcionou, e o item foi parar numa tabela que
  // eu não esperava), apaga por prefixo de nome também — nunca confia só no
  // caminho feliz pra garantir que nada fica pra trás.
  for (const tabela of ['produtos', 'pecas']) {
    try {
      const orfaos = await sqlBruto(`DELETE FROM ${tabela} WHERE user_id = '${USER_ID}' AND nome LIKE 'TESTE_CONV_%' RETURNING id`);
      if (orfaos.length > 0) console.log(`   ⚠️  ${tabela}: ${orfaos.length} linha(s) órfã(s) (fora do rastreamento) também apagada(s)`);
    } catch (e) {
      console.error(`   ⚠️  Falha na limpeza de segurança de ${tabela}: ${e.message}`);
      falhas++;
    }
  }

  // Confirma que a conta de teste voltou a ficar exatamente como estava (vazia).
  const [{ produtos }] = await sqlBruto(`SELECT count(*)::int as produtos FROM produtos WHERE user_id = '${USER_ID}'`);
  const [{ pecas }] = await sqlBruto(`SELECT count(*)::int as pecas FROM pecas WHERE user_id = '${USER_ID}'`);
  const [{ vendas }] = await sqlBruto(`SELECT count(*)::int as vendas FROM vendas WHERE user_id = '${USER_ID}'`);
  console.log(`   Conferência pós-limpeza: produtos=${produtos}, pecas=${pecas}, vendas=${vendas} (devem ser 0)`);
  check('nenhum dado de teste persistido (produtos)', produtos === 0);
  check('nenhum dado de teste persistido (pecas)', pecas === 0);
  check('nenhum dado de teste persistido (vendas)', vendas === 0);
}

try {
  await main();
} catch (e) {
  console.error('\n💥 ERRO NÃO TRATADO:', e);
  falhas++;
} finally {
  await limpar();
}

secao(`RESULTADO FINAL: ${passos - falhas}/${passos} checagens passaram`);
if (falhas > 0) {
  console.log(`❌ ${falhas} falha(s).`);
  process.exit(1);
} else {
  console.log('✅ Tudo passou.');
}

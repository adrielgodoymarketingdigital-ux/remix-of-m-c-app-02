// deno test --no-check --no-lock scripts/testes-os-multi/
// Etapa 5a da OS com vários dispositivos: GRAVAÇÃO dos dispositivos adicionais
// (src/lib/ordemServico/gravacaoDispositivosAdicionaisOS.ts). Banco falso em
// memória; só dados fictícios; nada vai à rede.
import { assertEquals, assertStrictEquals } from "jsr:@std/assert@1";
import {
  adicionalParaFormulario,
  avisosImeiRepetido,
  caminhoFotoOS,
  type ClienteGravacaoAdicionais,
  type DispositivoAdicionalForm,
  executarGravacaoAdicionais,
  type LinhaGravacaoAdicional,
  limparLigacoesOrfas,
  MAX_DISPOSITIVOS_ADICIONAIS,
  montarLinhaAdicional,
  novoDispositivoAdicionalForm,
  planejarGravacaoAdicionais,
  validarDispositivosAdicionais,
} from "../../src/lib/ordemServico/gravacaoDispositivosAdicionaisOS.ts";
import { lerDispositivoAdicional } from "../../src/lib/ordemServico/dispositivosAdicionaisOS.ts";

const OS = "os-1";
const DONO = "dono-1";
const URL_FOTO = (nome: string) =>
  `https://exemplo.supabase.co/storage/v1/object/public/dispositivos-fotos/func-1/${nome}`;

function aparelho(id: string, extra: Partial<DispositivoAdicionalForm> = {}): DispositivoAdicionalForm {
  return {
    ...novoDispositivoAdicionalForm(id),
    dispositivo_tipo: "celular",
    dispositivo_marca: "Marca Teste",
    dispositivo_modelo: `Modelo ${id}`,
    ...extra,
  };
}

// ---------------------------------------------------------------- planejador

Deno.test("planejador: ordem 2..N pela posição, os_id e user_id do contexto", () => {
  const plano = planejarGravacaoAdicionais(
    { dispositivos: [aparelho("c"), aparelho("a"), aparelho("b")], removidos: [] },
    { osId: OS, userId: DONO },
  );
  assertEquals(plano.linhas.map((l) => [l.id, l.ordem]), [["c", 2], ["a", 3], ["b", 4]]);
  assertEquals(new Set(plano.linhas.map((l) => l.os_id)), new Set([OS]));
  assertEquals(new Set(plano.linhas.map((l) => l.user_id)), new Set([DONO]));
  assertEquals(plano.idsRemover, []);
  assertEquals(plano.fotosApagar, []);
});

Deno.test("planejador: user_id do aparelho vindo da tela é ignorado", () => {
  const daTela = { ...aparelho("a"), user_id: "intruso", os_id: "outra-os", ordem: 99 } as DispositivoAdicionalForm;
  const [linha] = planejarGravacaoAdicionais({ dispositivos: [daTela], removidos: [] }, { osId: OS, userId: DONO }).linhas;
  assertEquals([linha.user_id, linha.os_id, linha.ordem], [DONO, OS, 2]);
});

Deno.test("planejador: delete só dos removidos explicitamente; removido que ainda está na lista não sai", () => {
  const plano = planejarGravacaoAdicionais(
    {
      dispositivos: [aparelho("a")],
      removidos: [{ id: "x", fotos_dispositivo: [] }, { id: "a", fotos_dispositivo: [] }, { id: "x", fotos_dispositivo: [] }],
    },
    { osId: OS, userId: DONO },
  );
  assertEquals(plano.idsRemover, ["x"]);
});

Deno.test("planejador: lista vazia e nada removido = plano vazio (nenhum aparelho do banco é apagado)", () => {
  const plano = planejarGravacaoAdicionais({ dispositivos: [], removidos: [] }, { osId: OS, userId: DONO });
  assertEquals([plano.linhas, plano.idsRemover, plano.fotosApagar], [[], [], []]);
});

Deno.test("planejador: fotos do removido (com miniatura v2), sem as que ainda estão em uso", () => {
  const plano = planejarGravacaoAdicionais(
    {
      dispositivos: [aparelho("a", { fotos_dispositivo: [URL_FOTO("os-3.jpg")] })],
      removidos: [{
        id: "x",
        fotos_dispositivo: [
          URL_FOTO("os-1.jpg"),
          URL_FOTO("v2-abc.jpg"),
          URL_FOTO("os-3.jpg"), // ainda no aparelho "a"
          URL_FOTO("os-d1.jpg"), // ainda no dispositivo 1
          "https://outro-site.com/foto.jpg", // fora do bucket
        ],
      }],
    },
    { osId: OS, userId: DONO, fotosDispositivo1: [URL_FOTO("os-d1.jpg")] },
  );
  assertEquals(plano.fotosApagar, ["func-1/os-1.jpg", "func-1/v2-abc.jpg", "func-1/v2-abc_thumb.jpg"]);
});

Deno.test("caminhoFotoOS: só URL pública do bucket dispositivos-fotos", () => {
  assertEquals(caminhoFotoOS(URL_FOTO("os-1.jpg")), "func-1/os-1.jpg");
  assertEquals(caminhoFotoOS(URL_FOTO("os%20x.jpg")), "func-1/os x.jpg");
  assertEquals(caminhoFotoOS("https://x.supabase.co/storage/v1/object/public/outro-bucket/a.jpg"), null);
  assertEquals(caminhoFotoOS("não é url"), null);
});

// ---------------------------------------------------------------- montagem / leitura

Deno.test("montagem: textos vazios viram null; senha criptografada; leitura devolve o original", () => {
  const original = aparelho("a", {
    dispositivo_cor: "Azul",
    dispositivo_imei: "   ",
    senha_desbloqueio: { tipo: "padrao", valor: "", padrao: [1, 5, 9] },
    defeito_relatado: "Não liga",
    checklist: { entrada: { tela: true }, saida: {} },
    avarias_visuais: [{ x: 10, y: 20, tipo: "riscos", lado: "frente" }],
    fotos_dispositivo: [URL_FOTO("os-1.jpg")],
    observacoes: "",
  });
  const linha = montarLinhaAdicional(original, { osId: OS, userId: DONO, ordem: 2 });
  assertEquals(linha.dispositivo_imei, null);
  assertEquals(linha.dispositivo_numero_serie, null);
  assertEquals(linha.observacoes, null);
  assertEquals(linha.dispositivo_cor, "Azul");
  assertEquals(linha.senha_desbloqueio?.padrao, [101, 105, 109]);

  const lido = lerDispositivoAdicional({ ...linha, created_at: "2026-10-24T12:00:00Z" });
  const volta = adicionalParaFormulario(lido!);
  // decryptSenhaDesbloqueio (o de sempre, do dispositivo 1) devolve nao_informada explícito.
  assertEquals(volta, {
    ...original,
    dispositivo_imei: "",
    senha_desbloqueio: { ...original.senha_desbloqueio, nao_informada: undefined },
  });
});

Deno.test("montagem: senha numérica vira OBF: e volta; senha em branco grava null", () => {
  const comSenha = montarLinhaAdicional(aparelho("a", { senha_desbloqueio: { tipo: "numero", valor: "1234", padrao: [] } }), {
    osId: OS, userId: DONO, ordem: 2,
  });
  assertStrictEquals(comSenha.senha_desbloqueio?.valor.startsWith("OBF:"), true);
  const volta = adicionalParaFormulario(lerDispositivoAdicional({ ...comSenha, created_at: "" })!);
  assertEquals(volta.senha_desbloqueio.valor, "1234");

  const semSenha = montarLinhaAdicional(aparelho("b"), { osId: OS, userId: DONO, ordem: 3 });
  assertEquals(semSenha.senha_desbloqueio, null);
  assertEquals(adicionalParaFormulario(lerDispositivoAdicional({ ...semSenha, created_at: "" })!).senha_desbloqueio, {
    tipo: "numero", valor: "", padrao: [],
  });

  const naoInformada = montarLinhaAdicional(
    aparelho("c", { senha_desbloqueio: { tipo: "numero", valor: "", padrao: [], nao_informada: true } }),
    { osId: OS, userId: DONO, ordem: 4 },
  );
  assertEquals(naoInformada.senha_desbloqueio?.nao_informada, true);
});

// ---------------------------------------------------------------- validação

Deno.test("validação: tipo, marca e modelo obrigatórios; defeito é opcional", () => {
  const erros = validarDispositivosAdicionais([
    aparelho("a", { defeito_relatado: "" }),
    aparelho("b", { dispositivo_tipo: "", dispositivo_marca: "  ", dispositivo_modelo: "" }),
  ]);
  assertEquals(erros.map((e) => [e.indice, e.campo]), [
    [1, "dispositivo_tipo"],
    [1, "dispositivo_marca"],
    [1, "dispositivo_modelo"],
  ]);
  assertEquals(erros[0].mensagem, "Dispositivo 3: selecione o tipo de dispositivo.");
});

Deno.test("validação: máximo de 10 aparelhos adicionais", () => {
  const dez = Array.from({ length: MAX_DISPOSITIVOS_ADICIONAIS }, (_, i) => aparelho(`d${i}`));
  assertEquals(validarDispositivosAdicionais(dez), []);
  const onze = [...dez, aparelho("d10")];
  assertEquals(validarDispositivosAdicionais(onze).map((e) => [e.indice, e.campo]), [[null, "quantidade"]]);
});

Deno.test("validação: id vazio ou repetido", () => {
  const erros = validarDispositivosAdicionais([aparelho("a"), aparelho("a"), aparelho("")]);
  assertEquals(erros.map((e) => [e.indice, e.campo]), [[1, "id"], [2, "id"]]);
});

// ---------------------------------------------------------------- IMEI

Deno.test("IMEI repetido: avisa (com o dispositivo 1), ignora vazios e formatação", () => {
  assertEquals(avisosImeiRepetido("", [aparelho("a"), aparelho("b")]), []);
  assertEquals(
    avisosImeiRepetido("356789012345678", [
      aparelho("a", { dispositivo_imei: "111" }),
      aparelho("b", { dispositivo_imei: "35 6789-012345678" }),
    ]),
    ["IMEI 356789012345678 repetido: Dispositivo 1 e Dispositivo 3."],
  );
  assertEquals(
    avisosImeiRepetido(null, [
      aparelho("a", { dispositivo_imei: "9" }),
      aparelho("b", { dispositivo_imei: "9" }),
      aparelho("c", { dispositivo_imei: "9" }),
    ]),
    ["IMEI 9 repetido: Dispositivo 2, Dispositivo 3 e Dispositivo 4."],
  );
});

// ---------------------------------------------------------------- ligações órfãs

Deno.test("ligações órfãs: dispositivo_ref inexistente sai; o resto fica intacto", () => {
  const semCampos = { id: "s0", nome: "Antiga" };
  const ligadaOk = { id: "s1", nome: "A", linha_os: { linha_id: "l1", dispositivo_ref: "a" } };
  const orfaComOutros = { id: "s2", nome: "B", linha_os: { linha_id: "l2", quantidade: 2, dispositivo_ref: "x" } };
  const orfaSo = { id: "s3", nome: "C", linha_os: { dispositivo_ref: "x" } };
  const [r0, r1, r2, r3] = limparLigacoesOrfas([semCampos, ligadaOk, orfaComOutros, orfaSo], ["a"]);
  assertStrictEquals(r0, semCampos);
  assertStrictEquals(r1, ligadaOk);
  assertEquals(r2, { id: "s2", nome: "B", linha_os: { linha_id: "l2", quantidade: 2 } });
  assertEquals(r3, { id: "s3", nome: "C", linha_os: undefined });
  assertEquals(orfaComOutros.linha_os.dispositivo_ref, "x"); // não muta a entrada
});

// ---------------------------------------------------------------- execução

type Chamada = { op: string; arg: unknown };
function bancoFalso(falhas: { upsert?: number; remover?: number; fotos?: number } = {}) {
  const chamadas: Chamada[] = [];
  const restantes = { upsert: falhas.upsert ?? 0, remover: falhas.remover ?? 0, fotos: falhas.fotos ?? 0 };
  const responder = (op: keyof typeof restantes) =>
    Promise.resolve({ error: restantes[op]-- > 0 ? { message: `falha ${op}` } : null });
  const cliente: ClienteGravacaoAdicionais = {
    upsert: (linhas: LinhaGravacaoAdicional[]) => { chamadas.push({ op: "upsert", arg: linhas.map((l) => l.id) }); return responder("upsert"); },
    remover: (osId, ids) => { chamadas.push({ op: "remover", arg: [osId, ids] }); return responder("remover"); },
    apagarFotos: (caminhos) => { chamadas.push({ op: "fotos", arg: caminhos }); return responder("fotos"); },
  };
  return { cliente, chamadas };
}

const planoCompleto = () =>
  planejarGravacaoAdicionais(
    { dispositivos: [aparelho("a"), aparelho("b")], removidos: [{ id: "x", fotos_dispositivo: [URL_FOTO("os-x.jpg")] }] },
    { osId: OS, userId: DONO },
  );

Deno.test("execução: plano vazio não faz nenhum pedido", async () => {
  const { cliente, chamadas } = bancoFalso();
  const r = await executarGravacaoAdicionais(cliente, planejarGravacaoAdicionais({ dispositivos: [], removidos: [] }, { osId: OS, userId: DONO }));
  assertEquals(chamadas, []);
  assertEquals(r, { status: "ok", gravados: 0, removidos: 0, avisos: [] });
});

Deno.test("execução: upsert ANTES do delete, fotos por último", async () => {
  const { cliente, chamadas } = bancoFalso();
  const r = await executarGravacaoAdicionais(cliente, planoCompleto());
  assertEquals(chamadas, [
    { op: "upsert", arg: ["a", "b"] },
    { op: "remover", arg: [OS, ["x"]] },
    { op: "fotos", arg: ["func-1/os-x.jpg"] },
  ]);
  assertEquals(r, { status: "ok", gravados: 2, removidos: 1, avisos: [] });
});

Deno.test("execução: upsert falha 1 vez → nova tentativa e segue", async () => {
  const { cliente, chamadas } = bancoFalso({ upsert: 1 });
  const r = await executarGravacaoAdicionais(cliente, planoCompleto());
  assertEquals(chamadas.map((c) => c.op), ["upsert", "upsert", "remover", "fotos"]);
  assertEquals(r.status, "ok");
});

Deno.test("execução: upsert falha 2 vezes → erro estruturado, sem delete e sem apagar fotos", async () => {
  const { cliente, chamadas } = bancoFalso({ upsert: 2 });
  const r = await executarGravacaoAdicionais(cliente, planoCompleto());
  assertEquals(chamadas.map((c) => c.op), ["upsert", "upsert"]);
  assertEquals(r, { status: "falhou", etapa: "upsert", mensagem: "falha upsert", tentativas: 2 });
});

Deno.test("execução: upsert que lança exceção conta como falha", async () => {
  const { cliente, chamadas } = bancoFalso();
  cliente.upsert = (l) => { chamadas.push({ op: "upsert", arg: l.length }); return Promise.reject(new Error("rede caiu")); };
  const r = await executarGravacaoAdicionais(cliente, planoCompleto());
  assertEquals(chamadas.map((c) => c.op), ["upsert", "upsert"]);
  assertEquals(r, { status: "falhou", etapa: "upsert", mensagem: "rede caiu", tentativas: 2 });
});

Deno.test("execução: delete falha 2 vezes → removidos continuam e as fotos NÃO são apagadas", async () => {
  const { cliente, chamadas } = bancoFalso({ remover: 2 });
  const r = await executarGravacaoAdicionais(cliente, planoCompleto());
  assertEquals(chamadas.map((c) => c.op), ["upsert", "remover", "remover"]);
  assertEquals(r, { status: "remocao_falhou", gravados: 2, idsNaoRemovidos: ["x"], mensagem: "falha remover", avisos: [] });
});

Deno.test("execução: falha ao apagar fotos vira só aviso", async () => {
  const { cliente } = bancoFalso({ fotos: 1 });
  const r = await executarGravacaoAdicionais(cliente, planoCompleto());
  assertEquals(r, { status: "ok", gravados: 2, removidos: 1, avisos: ["Fotos do aparelho removido não foram apagadas: falha fotos"] });
});

Deno.test("execução: só remoção (sem aparelhos atuais) não chama upsert", async () => {
  const { cliente, chamadas } = bancoFalso();
  const plano = planejarGravacaoAdicionais({ dispositivos: [], removidos: [{ id: "x", fotos_dispositivo: [] }] }, { osId: OS, userId: DONO });
  await executarGravacaoAdicionais(cliente, plano);
  assertEquals(chamadas, [{ op: "remover", arg: [OS, ["x"]] }]);
});

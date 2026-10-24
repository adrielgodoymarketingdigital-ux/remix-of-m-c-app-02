// deno test --no-check --no-lock scripts/testes-os-multi/
// Etapa 5b da OS com vários dispositivos: estado dos adicionais no assistente
// (src/lib/ordemServico/formularioDispositivosAdicionaisOS.ts), regra de
// visibilidade e listas do catálogo. Só dados fictícios; nada vai à rede.
import { assertEquals, assertStrictEquals } from "jsr:@std/assert@1";
import {
  aoMudarMarcaAdicional,
  aoMudarTipoAdicional,
  consultarRelatandoErro,
  contarServicosLigados,
  definirDispositivoRefLinha,
  entradaGravacaoParaSalvar,
  estadoAdicionaisCarregados,
  estadoAdicionaisCarregando,
  estadoAdicionaisErro,
  estadoAdicionaisNovaOS,
  estadoAdicionaisVazio,
  estadoAposGravacao,
  opcoesAparelhoServico,
  podeAdicionarAparelho,
  removerAparelhoDoEstado,
  rotuloCartaoAdicional,
  salvarAparelhoNoEstado,
  secaoAdicionaisTravada,
  textoAparelhosPerdidos,
  textosRemoverAparelho,
  valorAparelhoDaLinha,
} from "../../src/lib/ordemServico/formularioDispositivosAdicionaisOS.ts";
import {
  type DispositivoAdicionalForm,
  montarLinhaAdicional,
  novoDispositivoAdicionalForm,
  planejarGravacaoAdicionais,
} from "../../src/lib/ordemServico/gravacaoDispositivosAdicionaisOS.ts";
import { lerDispositivosAdicionais } from "../../src/lib/ordemServico/dispositivosAdicionaisOS.ts";
import { dispositivosAdicionaisOSVisivelPara } from "../../src/lib/ordemServico/visibilidadeDispositivosAdicionais.ts";
import { quantidadeServicoOSVisivelPara } from "../../src/lib/ordemServico/visibilidadeQuantidadeServico.ts";
import { opcoesCatalogoDispositivo } from "../../src/lib/ordemServico/opcoesCatalogoDispositivo.ts";
import { OPCAO_OUTRA } from "../../src/data/catalogoDispositivos.ts";

const FOTO = (n: string) => `https://x.supabase.co/storage/v1/object/public/dispositivos-fotos/u/${n}`;
const aparelho = (id: string, extra: Partial<DispositivoAdicionalForm> = {}): DispositivoAdicionalForm => ({
  ...novoDispositivoAdicionalForm(id),
  dispositivo_tipo: "Celular",
  dispositivo_marca: "Apple",
  dispositivo_modelo: `iPhone ${id}`,
  ...extra,
});
const linha = (nome: string, linha_os?: Record<string, unknown>) => ({ id: `s-${nome}`, nome, ...(linha_os ? { linha_os } : {}) });

// ---------------------------------------------------------------- visibilidade

Deno.test("visibilidade: só admin (mesmo padrão da quantidade)", () => {
  assertEquals(dispositivosAdicionaisOSVisivelPara({ isAdmin: true }), true);
  assertEquals(dispositivosAdicionaisOSVisivelPara({ isAdmin: false }), false);
  for (const isAdmin of [true, false]) {
    assertEquals(dispositivosAdicionaisOSVisivelPara({ isAdmin }), quantidadeServicoOSVisivelPara({ isAdmin }));
  }
});

// ---------------------------------------------------------------- carga / trava

Deno.test("carga: OS nova livre; carregando e erro travam a seção", () => {
  assertEquals(secaoAdicionaisTravada(estadoAdicionaisNovaOS()), false);
  assertEquals(secaoAdicionaisTravada(estadoAdicionaisCarregando()), true);
  assertEquals(secaoAdicionaisTravada(estadoAdicionaisErro()), true);
  assertEquals(podeAdicionarAparelho(estadoAdicionaisErro()), false);
  assertEquals(podeAdicionarAparelho(estadoAdicionaisCarregando()), false);
  assertEquals(podeAdicionarAparelho(estadoAdicionaisNovaOS()), true);
  assertEquals(estadoAdicionaisVazio(estadoAdicionaisNovaOS()), true);
  assertEquals(estadoAdicionaisVazio(estadoAdicionaisErro()), false);
  assertEquals(estadoAdicionaisVazio(salvarAparelhoNoEstado(estadoAdicionaisNovaOS(), aparelho("a"))), false);
});

Deno.test("envio: nada vai para gravar sem visibilidade, carregando ou com erro de leitura", () => {
  const cheio = salvarAparelhoNoEstado(estadoAdicionaisNovaOS(), aparelho("a"));
  assertEquals(entradaGravacaoParaSalvar(false, cheio), undefined);
  assertEquals(entradaGravacaoParaSalvar(true, { ...cheio, carga: "carregando" }), undefined);
  assertEquals(entradaGravacaoParaSalvar(true, { ...cheio, carga: "erro" }), undefined);
  assertEquals(entradaGravacaoParaSalvar(true, estadoAdicionaisNovaOS()), { dispositivos: [], removidos: [] });
  assertEquals(entradaGravacaoParaSalvar(true, cheio)?.dispositivos.map((d) => d.id), ["a"]);
});

Deno.test("consultarRelatandoErro: erro do banco ou exceção = ok:false (não lista vazia)", async () => {
  const ler = (d: unknown) => lerDispositivosAdicionais(d);
  assertEquals(await consultarRelatandoErro(() => Promise.resolve({ data: null, error: { message: "x" } }), ler), { ok: false });
  assertEquals(await consultarRelatandoErro(() => Promise.reject(new Error("rede")), ler), { ok: false });
  assertEquals(await consultarRelatandoErro(() => Promise.resolve({ data: [], error: null }), ler), { ok: true, dados: [] });
});

Deno.test("carregados: senha volta em claro, ids gravados guardados, ordem do banco", () => {
  const banco = [
    { ...montarLinhaAdicional(aparelho("b", { senha_desbloqueio: { tipo: "numero", valor: "4321", padrao: [] } }), { osId: "os", userId: "u", ordem: 3 }), created_at: "" },
    { ...montarLinhaAdicional(aparelho("a"), { osId: "os", userId: "u", ordem: 2 }), created_at: "" },
  ];
  const estado = estadoAdicionaisCarregados(lerDispositivosAdicionais(banco));
  assertEquals(estado.dispositivos.map((d) => d.id), ["a", "b"]);
  assertEquals(estado.idsGravados, ["a", "b"]);
  assertEquals(estado.dispositivos[1].senha_desbloqueio.valor, "4321");
  assertEquals(estado.carga, "ok");
});

// ---------------------------------------------------------------- incluir / editar / ordem

Deno.test("salvar aparelho: novo vai para o fim; editar mantém a posição", () => {
  let e = estadoAdicionaisNovaOS();
  e = salvarAparelhoNoEstado(e, aparelho("a"));
  e = salvarAparelhoNoEstado(e, aparelho("b"));
  e = salvarAparelhoNoEstado(e, aparelho("a", { dispositivo_modelo: "Editado" }));
  assertEquals(e.dispositivos.map((d) => [d.id, d.dispositivo_modelo]), [["a", "Editado"], ["b", "iPhone b"]]);
});

Deno.test("ordem: remover o do meio renumera 2, 3 pela posição ao gravar", () => {
  let e = estadoAdicionaisNovaOS();
  for (const id of ["a", "b", "c"]) e = salvarAparelhoNoEstado(e, aparelho(id));
  e = removerAparelhoDoEstado(e, "b", []).estado;
  const plano = planejarGravacaoAdicionais(entradaGravacaoParaSalvar(true, e)!, { osId: "os", userId: "u" });
  assertEquals(plano.linhas.map((l) => [l.id, l.ordem]), [["a", 2], ["c", 3]]);
});

Deno.test("limite: 10 aparelhos desabilita o botão", () => {
  let e = estadoAdicionaisNovaOS();
  for (let i = 0; i < 9; i++) e = salvarAparelhoNoEstado(e, aparelho(`d${i}`));
  assertEquals(podeAdicionarAparelho(e), true);
  e = salvarAparelhoNoEstado(e, aparelho("d9"));
  assertEquals(podeAdicionarAparelho(e), false);
});

// ---------------------------------------------------------------- remover / órfãos

Deno.test("remover gravado: vai para removidos (com fotos e rótulo) e desliga os serviços", () => {
  const e0 = estadoAdicionaisCarregados(lerDispositivosAdicionais([
    { ...montarLinhaAdicional(aparelho("a", { fotos_dispositivo: [FOTO("1.jpg")] }), { osId: "os", userId: "u", ordem: 2 }), created_at: "" },
  ]));
  const servicos = [linha("A", { linha_id: "l1", dispositivo_ref: "a" }), linha("B", { dispositivo_ref: "a" }), linha("C")];
  const r = removerAparelhoDoEstado(e0, "a", servicos);
  assertEquals(r.estado.dispositivos, []);
  assertEquals(r.estado.removidos, [{ id: "a", fotos_dispositivo: [FOTO("1.jpg")], rotulo: "iPhone a" }]);
  assertEquals(r.servicosDesligados, 2);
  assertEquals(r.servicos, [linha("A", { linha_id: "l1" }), { id: "s-B", nome: "B", linha_os: undefined }, servicos[2]]);
  assertStrictEquals(r.servicos[2], servicos[2]);
  assertEquals(entradaGravacaoParaSalvar(true, r.estado)?.removidos, [{ id: "a", fotos_dispositivo: [FOTO("1.jpg")], rotulo: "iPhone a" }]);
});

Deno.test("remover novo (nunca gravado): sem fotos some; com fotos vai para removidos só para limpar o storage", () => {
  let e = salvarAparelhoNoEstado(estadoAdicionaisNovaOS(), aparelho("n1"));
  e = salvarAparelhoNoEstado(e, aparelho("n2", { fotos_dispositivo: [FOTO("n2.jpg")] }));
  e = removerAparelhoDoEstado(e, "n1", []).estado;
  e = removerAparelhoDoEstado(e, "n2", []).estado;
  assertEquals(e.removidos.map((r) => r.id), ["n2"]);
});

Deno.test("remover id inexistente não muda nada", () => {
  const e = salvarAparelhoNoEstado(estadoAdicionaisNovaOS(), aparelho("a"));
  const r = removerAparelhoDoEstado(e, "zzz", [linha("A")]);
  assertStrictEquals(r.estado, e);
  assertEquals(r.servicosDesligados, 0);
});

Deno.test("depois de gravar: removidos zerados e ids da tela passam a ser gravados", () => {
  let e = estadoAdicionaisCarregados(lerDispositivosAdicionais([
    { ...montarLinhaAdicional(aparelho("a"), { osId: "os", userId: "u", ordem: 2 }), created_at: "" },
  ]));
  e = salvarAparelhoNoEstado(removerAparelhoDoEstado(e, "a", []).estado, aparelho("b"));
  e = estadoAposGravacao(e);
  assertEquals([e.removidos, e.idsGravados], [[], ["b"]]);
});

// ---------------------------------------------------------------- ligação de serviço

Deno.test("definirDispositivoRefLinha: liga, troca, desliga; mesmo objeto sem mudança", () => {
  const sem = linha("A");
  const ligada = definirDispositivoRefLinha(sem, "a");
  assertEquals(ligada.linha_os, { dispositivo_ref: "a" });
  assertStrictEquals(definirDispositivoRefLinha(ligada, "a"), ligada);
  assertEquals(definirDispositivoRefLinha(ligada, "b").linha_os, { dispositivo_ref: "b" });
  assertEquals(definirDispositivoRefLinha(ligada, null).linha_os, undefined);
  const comQtd = linha("Q", { linha_id: "l", quantidade: 3, dispositivo_ref: "a" });
  assertEquals(definirDispositivoRefLinha(comQtd, null).linha_os, { linha_id: "l", quantidade: 3 });
  assertStrictEquals(definirDispositivoRefLinha(sem, null), sem);
});

Deno.test("seletor de aparelho: opções e valor (ref órfão mostra o principal)", () => {
  const ds = [aparelho("a"), aparelho("b", { dispositivo_modelo: "" })];
  assertEquals(opcoesAparelhoServico(ds), [
    { valor: "principal", rotulo: "OS / principal" },
    { valor: "a", rotulo: "Dispositivo 2 (iPhone a)" },
    { valor: "b", rotulo: "Dispositivo 3 (Apple)" },
  ]);
  assertEquals(valorAparelhoDaLinha(linha("A", { dispositivo_ref: "b" }), ds), "b");
  assertEquals(valorAparelhoDaLinha(linha("A", { dispositivo_ref: "x" }), ds), "principal");
  assertEquals(valorAparelhoDaLinha(linha("A"), ds), "principal");
  assertEquals(contarServicosLigados([linha("A", { dispositivo_ref: "a" }), linha("B")], "a"), 1);
});

// ---------------------------------------------------------------- textos

Deno.test("textos: cartão, remover, perdidos", () => {
  assertEquals(rotuloCartaoAdicional(aparelho("a", { dispositivo_imei: "3567" }), 0), "Dispositivo 2 — Apple iPhone a · IMEI 3567");
  assertEquals(rotuloCartaoAdicional(aparelho("a", { dispositivo_numero_serie: "SN9" }), 1), "Dispositivo 3 — Apple iPhone a · Série SN9");
  assertEquals(rotuloCartaoAdicional(aparelho("a"), 0), "Dispositivo 2 — Apple iPhone a");
  assertEquals(textosRemoverAparelho(aparelho("a"), 1, 0), {
    titulo: "Remover o Dispositivo 3 (iPhone a)? As fotos e o checklist dele serão apagados ao salvar a OS.",
    aviso: null,
  });
  assertEquals(textosRemoverAparelho(aparelho("a"), 0, 1).aviso, "1 serviço está ligado a este aparelho e voltará para OS / aparelho principal.");
  assertEquals(textosRemoverAparelho(aparelho("a"), 0, 2).aviso, "2 serviços estão ligados a este aparelho e voltarão para OS / aparelho principal.");
  assertEquals(textoAparelhosPerdidos(1), "o Dispositivo 2 será perdido");
  assertEquals(textoAparelhosPerdidos(3), "os Dispositivos 2 a 4 serão perdidos");
});

// ---------------------------------------------------------------- tipo / marca / catálogo

Deno.test("trocar tipo zera marca, modelo, cor, checklist e avarias; trocar marca zera modelo e cor", () => {
  const d = aparelho("a", { dispositivo_cor: "Azul", checklist: { entrada: { tela: true }, saida: {} }, avarias_visuais: [{ x: 1, y: 1, tipo: "riscos", lado: "frente" }], dispositivo_imei: "1" });
  const t = aoMudarTipoAdicional(d, "Tablet");
  assertEquals([t.dispositivo_tipo, t.dispositivo_marca, t.dispositivo_modelo, t.dispositivo_cor, t.avarias_visuais, t.checklist, t.dispositivo_imei],
    ["Tablet", "", "", "", [], { entrada: {}, saida: {} }, "1"]);
  const m = aoMudarMarcaAdicional(d, "Samsung");
  assertEquals([m.dispositivo_marca, m.dispositivo_modelo, m.dispositivo_cor], ["Samsung", "", ""]);
});

Deno.test("catálogo: mesma regra do aparelho 1 (texto livre sem marcas ou com 'Outra')", () => {
  const vazio = { marcas: [], modelos: [], cores: [] };
  const celApple = opcoesCatalogoDispositivo("Celular", "Apple", vazio);
  assertEquals(celApple.marcaEhTextoLivre, false);
  assertEquals(celApple.marcas.includes("Apple"), true);
  assertEquals(celApple.modelos.length > 0, true);
  const comp = opcoesCatalogoDispositivo("Computador", "", vazio);
  assertEquals([comp.marcaEhTextoLivre, comp.modelos, comp.cores], [true, [], []]);
  const compCustom = opcoesCatalogoDispositivo("Computador", "Minha", { marcas: ["Minha"], modelos: ["M1"], cores: ["Preto"] });
  assertEquals([compCustom.marcaEhTextoLivre, compCustom.modelosCustom, compCustom.coresCustom], [false, ["M1"], ["Preto"]]);
  const outra = opcoesCatalogoDispositivo("Celular", OPCAO_OUTRA, { marcas: [], modelos: ["X"], cores: ["Y"] });
  assertEquals([outra.marcaEhTextoLivre, outra.modelos, outra.modelosCustom, outra.coresCustom], [true, [], [], []]);
});

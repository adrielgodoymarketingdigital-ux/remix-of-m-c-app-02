// Teste de componente da etapa Serviço REAL (EtapaInformacoesServico) com o bloco
// "Técnicos adicionais". Sem banco: o estado fica num componente pai, como no assistente.
import { useState } from "react";
import { render, screen, cleanup, fireEvent, within, act } from "@testing-library/react";
import { EtapaInformacoesServico } from "@/components/ordens/ordem-servico-wizard/EtapaInformacoesServico";
import type { CargaTecnicosAdicionais } from "@/components/ordens/ordem-servico-wizard/BlocoTecnicosAdicionais";
import type { FormData } from "@/components/ordens/ordem-servico-wizard/tipos";
import type { Funcionario } from "@/types/funcionario";

type R = { nome: string; ok: boolean; detalhe: string };
const esperar = (ms = 20) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

const FUNCIONARIOS = [
  { id: "dono", nome: "Adriel", cargo: "Dono", ativo: true },
  { id: "ana", nome: "Ana", cargo: "Técnico", ativo: true },
  { id: "bruno", nome: "Bruno", cargo: null, ativo: true },
  { id: "carla", nome: "Carla", cargo: null, ativo: true },
  { id: "davi", nome: "Davi", cargo: null, ativo: true },
  { id: "edu", nome: "Edu", cargo: null, ativo: true },
  { id: "xico", nome: "Xico", cargo: "Técnico", ativo: false },
] as unknown as Funcionario[];

const FORM = {
  defeitoRelatado: "Tela quebrada", observacoesInternas: "", mostrarObsInternasImpressao: false,
  localizacaoFisica: "", tempoGarantia: 90,
} as unknown as FormData;

interface PaiProps {
  principal?: string | null;
  lista?: string[];
  carga?: CargaTecnicosAdicionais;
  semBloco?: boolean;
}

/** Mesmo encaixe do DialogOrdemServico: principal e lista em estados do pai. */
function Pai({ principal = null, lista: listaInicial = [], carga = "nova", semBloco = false }: PaiProps) {
  const [tecnicoId, setTecnicoId] = useState<string | null>(principal);
  const [lista, setLista] = useState<string[]>(listaInicial);
  const [recargas, setRecargas] = useState(0);
  return (
    <>
      <EtapaInformacoesServico
        formData={FORM}
        setFormData={() => {}}
        campoComErro={null}
        localizacoes={[]}
        podeVerTecnicos
        funcionarios={FUNCIONARIOS}
        tecnicoObrigatorioOS={false}
        tecnicoId={tecnicoId}
        setTecnicoId={setTecnicoId}
        tiposServico={[]}
        tipoServicoId={null}
        setTipoServicoId={() => {}}
        criandoTipoServico={false}
        setCriandoTipoServico={() => {}}
        novoTipoServicoNome=""
        setNovoTipoServicoNome={() => {}}
        criarTipoServico={async () => null}
        tecnicosAdicionais={semBloco ? undefined : { lista, onAlterar: setLista, carga, onTentarCarregarDeNovo: () => setRecargas((n) => n + 1) }}
      />
      <span data-testid="estado-lista">{JSON.stringify(lista)}</span>
      <span data-testid="estado-principal">{String(tecnicoId)}</span>
      <span data-testid="recargas">{recargas}</span>
    </>
  );
}

const bloco = () => screen.getByTestId("bloco-tecnicos-adicionais");
const gatilhoAdicionar = () => within(bloco()).getByRole("combobox") as HTMLButtonElement;
const gatilhoPrincipal = () => {
  const rotulo = screen.getByText("Técnico Principal");
  return rotulo.closest("div.mb-1\\.5")!.parentElement!.querySelector('[role="combobox"]') as HTMLButtonElement;
};
const lista = () => JSON.parse(screen.getByTestId("estado-lista").textContent ?? "[]") as string[];
const contador = () => screen.getByTestId("contador-tecnicos-adicionais").textContent;
const aviso = () => screen.queryByTestId("aviso-tecnicos-adicionais")?.textContent ?? "";
const itensNaTela = () => screen.queryAllByTestId("tecnico-adicional").map((li) => li.textContent?.trim());

/** Abre um Select do Radix pelo teclado e devolve os nomes das opções. */
async function abrir(gatilho: HTMLElement): Promise<HTMLElement[]> {
  gatilho.focus();
  fireEvent.keyDown(gatilho, { key: "Enter" });
  await esperar();
  return screen.queryAllByRole("option");
}
async function escolher(gatilho: HTMLElement, texto: string) {
  const opcoes = await abrir(gatilho);
  const alvo = opcoes.find((o) => (o.textContent ?? "").startsWith(texto));
  if (!alvo) throw new Error(`opção "${texto}" não está na lista: ${opcoes.map((o) => o.textContent).join(" | ")}`);
  alvo.focus();
  fireEvent.keyDown(alvo, { key: "Enter" });
  await esperar();
}
const nomesOpcoes = (opcoes: HTMLElement[]) => opcoes.map((o) => o.textContent ?? "");
async function fecharMenu() {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  await esperar();
}

async function caso(nome: string, fn: () => Promise<string>): Promise<R> {
  try {
    const detalhe = await fn();
    return { nome, ok: true, detalhe };
  } catch (e) {
    return { nome, ok: false, detalhe: String(e instanceof Error ? e.message : e) };
  } finally {
    cleanup();
  }
}
function confere(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

export async function rodar(): Promise<R[]> {
  const r: R[] = [];

  r.push(await caso("freio fechado: sem o bloco, a etapa fica como hoje", async () => {
    render(<Pai semBloco />);
    confere(screen.queryByTestId("bloco-tecnicos-adicionais") === null, "bloco apareceu sem liberação");
    confere(screen.queryByText("Técnicos adicionais") === null, "título apareceu sem liberação");
    confere(!!screen.getByText("Técnico Principal"), "Técnico Principal sumiu");
    return "sem bloco, sem título; Técnico Principal continua";
  }));

  r.push(await caso("sem técnico principal o bloco fica desabilitado", async () => {
    render(<Pai />);
    confere(bloco().dataset.desabilitado === "sim", "bloco habilitado sem principal");
    confere(gatilhoAdicionar().disabled, "botão de adicionar habilitado sem principal");
    confere(aviso() === "Escolha o técnico principal primeiro", `aviso: "${aviso()}"`);
    confere(contador() === "0/4", `contador ${contador()}`);
    await escolher(gatilhoPrincipal(), "Ana");
    confere(screen.getByTestId("estado-principal").textContent === "ana", "principal não foi escolhido");
    confere(bloco().dataset.desabilitado === "nao" && !gatilhoAdicionar().disabled, "bloco continuou desabilitado com principal");
    return `aviso "${"Escolha o técnico principal primeiro"}", botão disabled; com principal Ana: habilitado`;
  }));

  r.push(await caso("limite de 4, sem repetir e sem o principal na lista", async () => {
    render(<Pai principal="ana" />);
    const primeiras = nomesOpcoes(await abrir(gatilhoAdicionar()));
    await fecharMenu();
    confere(!primeiras.some((n) => n.startsWith("Ana")), `principal na lista de adicionar: ${primeiras}`);
    confere(primeiras.some((n) => n.startsWith("Adriel")), `dono-como-funcionário fora da lista: ${primeiras}`);
    for (const nome of ["Bruno", "Carla", "Adriel"]) await escolher(gatilhoAdicionar(), nome);
    const depois3 = nomesOpcoes(await abrir(gatilhoAdicionar()));
    await fecharMenu();
    confere(!depois3.some((n) => /^(Bruno|Carla|Adriel)/.test(n)), `já escolhido aparece de novo: ${depois3}`);
    await escolher(gatilhoAdicionar(), "Davi");
    confere(contador() === "4/4", `contador ${contador()}`);
    confere(gatilhoAdicionar().disabled && bloco().dataset.desabilitado === "sim", "adicionar continua habilitado com 4");
    const avisoCheio = aviso();
    confere(/Limite de 4/.test(avisoCheio), `aviso: "${avisoCheio}"`);
    confere(JSON.stringify(lista()) === JSON.stringify(["bruno", "carla", "dono", "davi"]), `lista ${JSON.stringify(lista())}`);
    // Remover um volta a liberar.
    fireEvent.click(screen.getByRole("button", { name: "Remover Carla" }));
    await esperar();
    confere(contador() === "3/4" && !gatilhoAdicionar().disabled, "remover não liberou");
    return `opções iniciais: ${primeiras.join(", ")}; com 4: botão disabled e "${avisoCheio}"; remover Carla → 3/4`;
  }));

  r.push(await caso("adicional escolhido como principal sai dos adicionais", async () => {
    render(<Pai principal="ana" lista={["bruno", "carla"]} />);
    confere(contador() === "2/4", `contador ${contador()}`);
    await escolher(gatilhoPrincipal(), "Bruno");
    confere(screen.getByTestId("estado-principal").textContent === "bruno", "principal não trocou");
    confere(JSON.stringify(lista()) === JSON.stringify(["carla"]), `lista ${JSON.stringify(lista())}`);
    confere(contador() === "1/4", `contador ${contador()}`);
    const opcoes = nomesOpcoes(await abrir(gatilhoAdicionar()));
    await fecharMenu();
    confere(opcoes.some((n) => n.startsWith("Ana")), "ex-principal não ficou disponível como adicional");
    confere(!opcoes.some((n) => n.startsWith("Bruno")), "novo principal aparece para adicionar");
    return `principal Ana→Bruno: lista ["bruno","carla"] → ${JSON.stringify(lista())}; Ana disponível para adicionar`;
  }));

  r.push(await caso("desativado aparece, pode ser removido e não pode ser readicionado", async () => {
    render(<Pai principal="ana" lista={["xico", "bruno"]} carga="ok" />);
    const itens = itensNaTela();
    confere(itens.includes("Xico (Técnico) (desativado)"), `itens: ${JSON.stringify(itens)}`);
    const opcoes = nomesOpcoes(await abrir(gatilhoAdicionar()));
    await fecharMenu();
    confere(!opcoes.some((n) => n.startsWith("Xico")), `desativado na lista de adicionar: ${opcoes}`);
    fireEvent.click(screen.getByRole("button", { name: "Remover Xico (Técnico) (desativado)" }));
    await esperar();
    confere(JSON.stringify(lista()) === JSON.stringify(["bruno"]), `lista ${JSON.stringify(lista())}`);
    const depois = nomesOpcoes(await abrir(gatilhoAdicionar()));
    await fecharMenu();
    confere(!depois.some((n) => n.startsWith("Xico")), "desativado voltou a ser opção depois de removido");
    return `itens ${JSON.stringify(itens)}; opções sem Xico (${opcoes.join(", ")}); removido → ["bruno"]`;
  }));

  r.push(await caso("tirar o principal com adicionais: lista fica, só remover, adicionar travado", async () => {
    render(<Pai principal="ana" lista={["bruno"]} />);
    await escolher(gatilhoPrincipal(), "Nenhum");
    confere(screen.getByTestId("estado-principal").textContent === "null", "principal não saiu");
    confere(JSON.stringify(lista()) === JSON.stringify(["bruno"]), "lista mudou sozinha");
    confere(gatilhoAdicionar().disabled && aviso() === "Escolha o técnico principal primeiro", "adicionar não travou");
    fireEvent.click(screen.getByRole("button", { name: "Remover Bruno" }));
    await esperar();
    confere(lista().length === 0, "remover não funcionou sem principal");
    return "sem principal: adicionar travado, remover funciona (a validação da etapa barra salvar com adicionais)";
  }));

  r.push(await caso("lista da OS não carregou: tudo travado e botão Tentar de novo", async () => {
    render(<Pai principal="ana" carga="erro" />);
    confere(gatilhoAdicionar().disabled, "adicionar habilitado com erro de carga");
    confere(/Não consegui carregar/.test(aviso()), `aviso: "${aviso()}"`);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await esperar();
    confere(screen.getByTestId("recargas").textContent === "1", "Tentar de novo não chamou a recarga");
    return `aviso "${aviso()}"`;
  }));

  return r;
}

// Teste de componente do campo Quantidade do DialogCadastroDispositivo (Origem → Registrar
// Nova Compra → Novo Dispositivo, e página Dispositivos). Componente real; Supabase simulado.
import { render, screen, within, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogCadastroDispositivo } from "@/components/dispositivos/DialogCadastroDispositivo";
import type { FormularioDispositivo } from "@/types/dispositivo";

type R = { nome: string; ok: boolean; detalhe: string };
const esperar = (ms = 50) => new Promise((r) => setTimeout(r, ms));

function montar(envios: FormularioDispositivo[] = []) {
  const user = userEvent.setup();
  render(
    <DialogCadastroDispositivo
      open
      onOpenChange={() => {}}
      onSubmit={async (d) => { envios.push(d); }}
      dispositivoParaEditar={null}
    />,
  );
  const dialogo = screen.getByRole("dialog");
  const qtd = within(dialogo).getByPlaceholderText("Ex: 5") as HTMLInputElement;
  return { user, dialogo, qtd, envios };
}

const unidades = (d: HTMLElement) => within(d).queryAllByText(/^Unidade \d+$/).length;

/** Preenche o IMEI da unidade i (1-based), abrindo a unidade se preciso. */
async function preencherImei(user: ReturnType<typeof userEvent.setup>, d: HTMLElement, i: number, imei: string) {
  if (i > 1) await user.click(within(d).getByText(`Unidade ${i}`));
  const campo = within(d).getAllByPlaceholderText("Ex: 123456789012345")[0] as HTMLInputElement;
  await user.clear(campo);
  await user.type(campo, imei);
}

/** IMEIs que aparecem nos cabeçalhos das unidades ("IMEI: ..."). */
const imeisNosCabecalhos = (d: HTMLElement) =>
  within(d).queryAllByText(/^IMEI: /).map((el) => el.textContent?.replace("IMEI: ", "") ?? "");

/** Roda um cenário; erro vira FALHA com a mensagem, e a tela é sempre limpa. */
async function cenario(r: R[], fn: () => Promise<void>) {
  const antes = r.length;
  try {
    await fn();
  } catch (e) {
    if (r.length === antes) r.push({ nome: "(cenário interrompido)", ok: false, detalhe: String(e).split("\n")[0] });
  } finally {
    cleanup();
  }
}

export async function rodar(): Promise<R[]> {
  const r: R[] = [];

  // 1) Backspace apaga o "1" e o campo fica vazio; digitar 5 substitui.
  await cenario(r, async () => {
    const { user, qtd } = montar();
    await user.click(qtd);
    await user.keyboard("{End}{Backspace}");
    const vazio = qtd.value;
    await user.keyboard("5");
    r.push({ nome: "Backspace deixa vazio e digitar 5 substitui", ok: vazio === "" && qtd.value === "5", detalhe: `depois do Backspace="${vazio}" depois de digitar 5="${qtd.value}"` });
  });

  // 2) Clicar fora com o campo vazio volta para 1.
  await cenario(r, async () => {
    const { user, qtd, dialogo } = montar();
    await user.click(qtd);
    await user.keyboard("{End}{Backspace}");
    await user.click(within(dialogo).getByPlaceholderText("Ex: Apple"));
    r.push({ nome: "Sair do campo vazio volta para 1", ok: qtd.value === "1", detalhe: `valor="${qtd.value}"` });
  });

  // 3) Zero e texto inválido: só dígitos; 0 vira 1 ao sair.
  await cenario(r, async () => {
    const { user, qtd, dialogo } = montar();
    await user.click(qtd);
    await user.keyboard("{End}{Backspace}");
    await user.keyboard("2a,-.e");
    const soDigitos = qtd.value;
    await user.keyboard("{End}{Backspace}0");
    await user.click(within(dialogo).getByPlaceholderText("Ex: Apple"));
    r.push({ nome: "Só dígitos inteiros; 0 vira 1 ao sair", ok: soDigitos === "2" && qtd.value === "1", detalhe: `digitando "2a,-.e" ficou "${soDigitos}"; 0 ao sair virou "${qtd.value}"` });
  });

  // 4) Quantidade 3 com IMEIs → apagar (unidades preservadas) → 2 → sair: IMEIs 1 e 2 continuam.
  await cenario(r, async () => {
    const { user, qtd, dialogo } = montar();
    await user.click(qtd);
    await user.keyboard("{End}{Backspace}3");
    await user.click(within(dialogo).getByPlaceholderText("Ex: Apple"));
    await esperar();
    const unidadesCom3 = unidades(dialogo);
    await preencherImei(user, dialogo, 1, "350000000000011");
    await preencherImei(user, dialogo, 2, "350000000000022");
    await preencherImei(user, dialogo, 3, "350000000000033");
    const antes = imeisNosCabecalhos(dialogo).join(",");
    await user.click(qtd);
    await user.keyboard("{End}{Backspace}");
    await esperar();
    const unidadesComVazio = unidades(dialogo);
    const imeisComVazio = imeisNosCabecalhos(dialogo).join(",");
    await user.keyboard("2");
    await user.click(within(dialogo).getByPlaceholderText("Ex: Apple"));
    await esperar();
    const depois = imeisNosCabecalhos(dialogo).join(",");
    r.push({
      nome: "3 → apagar → 2 preserva os IMEIs das unidades 1 e 2",
      ok: unidadesCom3 === 3 && unidadesComVazio === 3 && imeisComVazio === antes && unidades(dialogo) === 2 && qtd.value === "2"
        && depois === "350000000000011,350000000000022",
      detalhe: `com 3: ${unidadesCom3} unidades [${antes}]; campo vazio: ${unidadesComVazio} unidades [${imeisComVazio}]; com 2: ${unidades(dialogo)} unidades [${depois}] campo="${qtd.value}"`,
    });
  });

  // 5) Envio com quantidade 2: cada unidade sai com o seu IMEI (nada mais mudou no envio).
  await cenario(r, async () => {
    const envios: FormularioDispositivo[] = [];
    const { user, qtd, dialogo } = montar(envios);
    await user.click(qtd);
    await user.keyboard("{End}{Backspace}2");
    await user.click(within(dialogo).getByText("Celular", { selector: "button" }));
    await user.type(within(dialogo).getByPlaceholderText("Ex: Apple"), "Apple");
    await user.type(within(dialogo).getByPlaceholderText("Ex: iPhone 14 Pro"), "iPhone 15");
    await preencherImei(user, dialogo, 1, "350000000000011");
    await preencherImei(user, dialogo, 2, "350000000000022");
    await user.click(within(dialogo).getByRole("button", { name: "Cadastrar 2 unidades" }));
    await esperar(200);
    r.push({
      nome: "Enviar com quantidade 2 manda as 2 unidades com seus IMEIs",
      ok: envios.length === 2 && envios[0].imei === "350000000000011" && envios[1].imei === "350000000000022" && envios.every((e) => e.quantidade === 1),
      detalhe: `envios=${envios.length} imeis=${envios.map((e) => e.imei).join(",")}`,
    });
  });

  // 6) Enter no campo confirma a quantidade (não envia o formulário com a quantidade antiga).
  await cenario(r, async () => {
    const envios: FormularioDispositivo[] = [];
    const { user, qtd, dialogo } = montar(envios);
    await user.click(qtd);
    await user.keyboard("{End}{Backspace}3{Enter}");
    await esperar();
    r.push({ nome: "Enter confirma a quantidade", ok: unidades(dialogo) === 3 && envios.length === 0, detalhe: `unidades=${unidades(dialogo)} envios=${envios.length}` });
  });

  // 7) Colar um valor com lixo: só os dígitos ficam.
  await cenario(r, async () => {
    const { user, qtd } = montar();
    await user.click(qtd);
    await user.keyboard("{End}{Backspace}");
    fireEvent.change(qtd, { target: { value: " 4 un" } });
    r.push({ nome: "Colar ' 4 un' fica 4", ok: qtd.value === "4", detalhe: `valor="${qtd.value}"` });
  });
  return r;
}

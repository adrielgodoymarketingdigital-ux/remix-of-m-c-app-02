// Teste de componente do InputDecimal: os mesmos jeitos que as telas usam o campo
// (estado string, estado `Number(v) || 0`, react-hook-form + zod coerce, reset de fora).
import { useState } from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { InputDecimal } from "@/components/ui/input-decimal";
import { Input } from "@/components/ui/input";

type R = { nome: string; ok: boolean; detalhe: string };
const esperar = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const campo = () => screen.getByTestId("campo") as HTMLInputElement;
const estado = () => screen.getByTestId("estado").textContent ?? "";

/** Tela que guarda a string emitida (Sangria, Venda avulsa, Pedidos...). */
function PaiString({ inicial = "" }: { inicial?: string }) {
  const [v, setV] = useState(inicial);
  return (
    <>
      <InputDecimal data-testid="campo" value={v} onChange={setV} />
      <span data-testid="estado">{JSON.stringify(v)}</span>
      <button onClick={() => setV("10")}>trocar</button>
      <button onClick={() => setV("")}>limpar</button>
    </>
  );
}

/** Tela que guarda número com `Number(v) || 0` (abertura/fechamento do caixa). */
function PaiNumero({ max }: { max?: number }) {
  const [v, setV] = useState(0);
  return (
    <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
      <InputDecimal data-testid="campo" value={v} min={0} max={max} onChange={(t) => setV(Number(t) || 0)} />
      <span data-testid="estado">{JSON.stringify(v)}</span>
    </form>
  );
}

/** Tela com react-hook-form + zod coerce e {...field} (cadastro de serviço/conta). */
function PaiForm({ aoEnviar }: { aoEnviar: (d: { preco: number }) => void }) {
  const form = useForm<{ preco: number }>({
    resolver: zodResolver(z.object({ preco: z.coerce.number().min(0) })),
    defaultValues: { preco: 0 },
  });
  return (
    <form onSubmit={form.handleSubmit(aoEnviar)}>
      <Controller
        control={form.control}
        name="preco"
        render={({ field }) => <InputDecimal data-testid="campo" {...field} />}
      />
      <button type="submit">salvar</button>
      <button type="button" onClick={() => form.reset({ preco: 25.9 })}>reset</button>
    </form>
  );
}

/** Controle: o campo antigo, para provar a causa do bug no DOM simulado. */
function PaiAntigo() {
  const [v, setV] = useState("");
  return (
    <>
      <Input data-testid="campo" type="number" step="0.01" value={v} onChange={(e) => setV(e.target.value)} />
      <span data-testid="estado">{JSON.stringify(v)}</span>
    </>
  );
}

export async function rodar(): Promise<R[]> {
  const r: R[] = [];
  async function cenario(nome: string, fn: () => Promise<string>) {
    try {
      r.push({ nome, ok: true, detalhe: await fn() });
    } catch (e) {
      r.push({ nome, ok: false, detalhe: e instanceof Error ? e.message : String(e) });
    } finally {
      cleanup();
    }
  }
  const igual = (a: unknown, b: unknown, o: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${o}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
  };

  await cenario("controle: type=number antigo zera ao receber \"39,\" (causa do bug)", async () => {
    render(<PaiAntigo />);
    fireEvent.change(campo(), { target: { value: "39," } });
    await esperar();
    igual(campo().value, "", "campo antigo");
    return `campo="${campo().value}" estado=${estado()}`;
  });

  await cenario("estado string: digitar 39,50 mostra 39,50 e emite \"39.50\"", async () => {
    const user = userEvent.setup();
    render(<PaiString />);
    await user.type(campo(), "39,");
    igual(campo().value, "39,", "após a vírgula");
    igual(estado(), '"39."', "estado após a vírgula");
    await user.type(campo(), "50");
    igual(campo().value, "39,50", "campo");
    igual(estado(), '"39.50"', "estado");
    igual(campo().getAttribute("inputmode"), "decimal", "inputmode");
    igual(campo().type, "text", "type");
    return `campo="${campo().value}" estado=${estado()}`;
  });

  await cenario("estado Number(v)||0: \"39,\" não zera; \"39,5\" vira 39.5; apagar não traz o 0 de volta", async () => {
    const user = userEvent.setup();
    render(<PaiNumero />);
    igual(campo().value, "0", "inicial");
    await user.clear(campo());
    igual(campo().value, "", "após apagar");
    await user.type(campo(), "39,");
    igual(campo().value, "39,", "após a vírgula");
    igual(estado(), "39", "estado");
    await user.type(campo(), "5");
    igual(estado(), "39.5", "estado final");
    return `campo="${campo().value}" estado=${estado()}`;
  });

  await cenario("letras, segunda vírgula e 3ª casa são ignoradas", async () => {
    const user = userEvent.setup();
    render(<PaiString />);
    await user.type(campo(), "3a9,,5x05");
    igual(campo().value, "39,50", "campo");
    igual(estado(), '"39.50"', "estado");
    return `campo="${campo().value}"`;
  });

  await cenario("colar \"R$ 1.234,56\" vira 1234,56 / \"1234.56\"", async () => {
    const user = userEvent.setup();
    render(<PaiString />);
    await user.click(campo());
    await user.paste("R$ 1.234,56");
    igual(campo().value, "1234,56", "campo");
    igual(estado(), '"1234.56"', "estado");
    return `campo="${campo().value}" estado=${estado()}`;
  });

  await cenario("valor trocado de fora (edição de outro item / reset) atualiza o texto", async () => {
    const user = userEvent.setup();
    render(<PaiString inicial="5.5" />);
    igual(campo().value, "5.5", "inicial");
    await user.click(screen.getByText("trocar"));
    igual(campo().value, "10", "trocado");
    await user.click(screen.getByText("limpar"));
    igual(campo().value, "", "limpo");
    return "5.5 → 10 → vazio";
  });

  await cenario("react-hook-form + zod coerce: digita 39,5 e salva 39.5; reset mostra 25.9", async () => {
    const user = userEvent.setup();
    const enviados: { preco: number }[] = [];
    render(<PaiForm aoEnviar={(d) => enviados.push(d)} />);
    await user.clear(campo());
    await user.type(campo(), "39,5");
    igual(campo().value, "39,5", "campo");
    await user.click(screen.getByText("salvar"));
    await esperar();
    igual(enviados, [{ preco: 39.5 }], "enviado");
    await user.click(screen.getByText("reset"));
    await esperar();
    igual(campo().value, "25.9", "após reset");
    return `enviado=${JSON.stringify(enviados)}`;
  });

  await cenario("max como no type=number: acima do máximo bloqueia o envio nativo do form", async () => {
    const user = userEvent.setup();
    render(<PaiNumero max={100} />);
    await user.clear(campo());
    await user.type(campo(), "150");
    await esperar();
    igual(campo().validity.valid, false, "150 com max=100");
    await user.clear(campo());
    await user.type(campo(), "99,9");
    await esperar();
    igual(campo().validity.valid, true, "99,9 com max=100");
    return "150 inválido, 99,9 válido";
  });

  return r;
}

// relogioServidor.ts: importar não chama o banco; a volta à tela atualiza a hora.
import assert from "node:assert/strict";
import { servidor } from "@/integrations/supabase/client";

const alvo = new EventTarget() as EventTarget & { visibilityState: string };
alvo.visibilityState = "visible";
(globalThis as { document?: unknown }).document = alvo;

const { relogioServidor } = await import("../../src/lib/horaBrasilia/relogioServidor.ts");

Deno.test("importar o módulo não chama a função; a volta à tela atualiza depois do 1º uso", async () => {
  servidor.agoraMs = Date.parse("2026-11-17T15:00:00Z");
  alvo.dispatchEvent(new Event("visibilitychange"));
  assert.equal(servidor.chamadasRpc, 0, "tela pública não chama o banco");

  await relogioServidor.sincronizar();
  assert.equal(servidor.chamadasRpc, 1);

  alvo.visibilityState = "hidden";
  alvo.dispatchEvent(new Event("visibilitychange"));
  assert.equal(servidor.chamadasRpc, 1, "tela escondida não atualiza");

  alvo.visibilityState = "visible";
  alvo.dispatchEvent(new Event("visibilitychange"));
  await relogioServidor.sincronizar();
  assert.equal(servidor.chamadasRpc, 2);
});

// Mede as requisições do OSStatusConfigProvider REAL com 7 consumidores (como a tela de OS).
import { render, act, cleanup } from "@testing-library/react";
import { OSStatusConfigProvider, useOSStatusConfigContext } from "@/contexts/OSStatusConfigContext";
import { contagem, zerarContagem, emitir, banco } from "@/integrations/supabase/client";

type R = { nome: string; ok: boolean; detalhe: string };
const esperar = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
let api: ReturnType<typeof useOSStatusConfigContext> | null = null;
const vistos: string[][] = [];

// eslint-disable-next-line react-refresh/only-export-components -- arquivo de teste, não é tela
function Consumidor({ i }: { i: number }) {
  const ctx = useOSStatusConfigContext();
  if (i === 0) api = ctx;
  vistos[i] = ctx.statusList.map((s) => `${s.ordem}|${s.slug}|${s.nome}|${s.cor}|${s.ativo}`);
  return null;
}
const snap = () => ({ ...contagem });
const fmt = (c: Record<string, number>) => {
  const k = ["os_status_config:select", "loja_funcionarios:select", "empresa_usuarios:select", "auth/v1/user"];
  return k.map((x) => `${x.split(":")[0]}=${c[x] ?? 0}`).join(" ");
};

export async function rodar(): Promise<{ r: R[]; medidas: string[] }> {
  const r: R[] = []; const medidas: string[] = [];
  zerarContagem();
  render(<OSStatusConfigProvider>{Array.from({ length: 7 }, (_, i) => <Consumidor key={i} i={i} />)}</OSStatusConfigProvider>);
  await esperar(3500); // inclui a retentativa de 3s do hook
  const abrir = snap();
  medidas.push(`Abrir a tela (provider + 7 consumidores): ${fmt(abrir)}`);
  const esperado = "1|pendente|Aguardando peça|#111111|true,2|em_andamento|Na bancada|#222222|true,3|orcamento|Orçamento|#333333|false";
  r.push({ nome: "Todos os consumidores veem a mesma lista (nomes, cores, ordem)", ok: vistos.every((v) => v.join(",") === esperado), detalhe: vistos[6]?.join(" / ") ?? "" });

  zerarContagem();
  for (let i = 0; i < 3; i++) { await act(async () => { emitir("SIGNED_IN"); }); await esperar(50); }
  const foco = snap();
  medidas.push(`Voltar à aba 3× (SIGNED_IN mesmo usuário): ${fmt(foco)}`);

  zerarContagem();
  await act(async () => { emitir("TOKEN_REFRESHED"); }); await esperar(50);
  medidas.push(`Renovação de token: ${fmt(snap())}`);

  zerarContagem();
  await act(async () => { await api!.atualizarStatusConfig("a2", { nome: "Em conserto", cor: "#00ff00" }); });
  await esperar(50);
  const mudou = vistos.every((v) => v.some((x) => x.includes("|em_andamento|Em conserto|#00ff00|")));
  medidas.push(`Admin altera um status: ${fmt(snap())}`);
  r.push({ nome: "Alterar status em Configurações reflete em todos os consumidores", ok: mudou, detalhe: vistos[3]?.join(" / ") ?? "" });

  zerarContagem();
  await act(async () => { emitir("SIGNED_IN", { user: { id: "dono-B" } }); }); await esperar(100);
  const trocou = vistos.every((v) => v.join(",") === "1|pendente|Fila da loja B|#bbbbbb|true");
  medidas.push(`Troca real de usuário (dono-B): ${fmt(snap())}`);
  r.push({ nome: "Troca real de usuário recarrega e mostra os status do novo dono", ok: trocou, detalhe: vistos[0]?.join(" / ") ?? "" });

  await act(async () => { emitir("SIGNED_OUT", null); }); await esperar(50);
  r.push({ nome: "Logout volta para os status padrão", ok: vistos[0]?.[0]?.startsWith("0|aguardando_aprovacao|Aguardando Aprovação|") ?? false, detalhe: vistos[0]?.slice(0, 2).join(" / ") ?? "" });

  // Reset do banco para o próximo run
  Object.assign(banco["dono-A"][1], { nome: "Na bancada", cor: "#222222" });
  cleanup();
  return { r, medidas };
}

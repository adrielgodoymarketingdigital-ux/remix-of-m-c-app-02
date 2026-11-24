// Radix Select atualiza estado em timers: o aviso "not wrapped in act(...)" do React é só ruído aqui.
const erroOriginal = console.error;
console.error = (...a: unknown[]) => {
  if (typeof a[0] === "string" && a[0].includes("not wrapped in act(")) return;
  erroOriginal(...a);
};
import { rodar } from "./tela.componente";
rodar().then((r) => {
  for (const x of r) console.log(`${x.ok ? "OK  " : "FALHA"} ${x.nome}\n      ${x.detalhe}`);
  process.exit(r.every((x) => x.ok) ? 0 : 1);
}).catch((e) => { console.error("ERRO", e); process.exit(2); });

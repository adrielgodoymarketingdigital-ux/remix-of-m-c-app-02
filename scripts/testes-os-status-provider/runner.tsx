import { rodar } from "./componente";
rodar().then(({ r, medidas }) => {
  for (const m of medidas) console.log("MEDIDA " + m);
  for (const x of r) console.log(`${x.ok ? "OK  " : "FALHA"} ${x.nome}\n      ${x.detalhe}`);
  process.exit(r.every((x) => x.ok) ? 0 : 1);
}).catch((e) => { console.error("ERRO", e); process.exit(2); });

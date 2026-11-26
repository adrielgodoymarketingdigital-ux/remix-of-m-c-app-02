// Servidor só da página de teste (porta 8104; a cópia da main usa 8105 com PORTA=8105).
import { defineConfig, mergeConfig } from "vite";
import base from "../vite.config";

const porta = Number(process.env.PORTA ?? 8104);
export default defineConfig((env) =>
  mergeConfig(base(env), {
    cacheDir: `node_modules/.vite-teste-local-${porta}`,
    server: { host: "localhost", port: porta, strictPort: true },
  })
);

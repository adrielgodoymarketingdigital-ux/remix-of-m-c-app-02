// Adaptador só para os scripts Deno: o build CommonJS do jsPDF não expõe o
// construtor como "default" (o app, via Vite, usa `import jsPDF from "jspdf"`).
import pkg from "../../node_modules/jspdf/dist/jspdf.node.min.js";
const mod = pkg as unknown as { jsPDF: unknown; default?: unknown };
export default (mod.jsPDF ?? mod.default) as typeof import("jspdf").default;
export * from "../../node_modules/jspdf/dist/jspdf.node.min.js";

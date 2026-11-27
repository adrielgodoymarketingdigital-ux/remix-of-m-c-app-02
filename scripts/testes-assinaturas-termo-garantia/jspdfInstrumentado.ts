// Adaptador só para os scripts Deno: o jsPDF do node_modules (o build CommonJS
// não expõe o construtor como "default") com um registro de cada texto
// desenhado — página, posição X/Y (mm) e tamanho da fonte (pt) —, para os
// scripts saberem em que folha caem o termo e as assinaturas.
import pkg from "../../node_modules/jspdf/dist/jspdf.node.min.js";
const mod = pkg as unknown as { jsPDF: unknown; default?: unknown };
const Base = (mod.jsPDF ?? mod.default) as typeof import("jspdf").default;

export interface TextoDesenhado {
  pagina: number;
  x: number;
  y: number;
  fontePt: number;
  texto: string;
}
export interface DocRegistrado {
  alturaPaginaMm: number;
  textos: TextoDesenhado[];
}

/** Todo jsPDF criado desde o último limparRegistro(), em ordem (medição primeiro, definitivo por último). */
export const docsCriados: DocRegistrado[] = [];
export const limparRegistro = () => { docsCriados.length = 0; };

class JsPDFInstrumentado extends Base {
  constructor(...args: ConstructorParameters<typeof Base>) {
    super(...args);
    const registro: DocRegistrado = { alturaPaginaMm: this.internal.pageSize.getHeight(), textos: [] };
    docsCriados.push(registro);
    const original = this.text.bind(this);
    // deno-lint-ignore no-explicit-any
    (this as any).text = (texto: string | string[], x: number, y: number, ...resto: unknown[]) => {
      const lista = Array.isArray(texto) ? texto : [texto];
      for (const t of lista) {
        registro.textos.push({ pagina: this.internal.getCurrentPageInfo().pageNumber, x, y, fontePt: this.getFontSize(), texto: String(t) });
      }
      // deno-lint-ignore no-explicit-any
      return (original as any)(texto, x, y, ...resto);
    };
  }
}

export default JsPDFInstrumentado as unknown as typeof Base;

/**
 * Formulário "Dispositivo de Entrada (Troca)" (DialogDispositivoEntrada): a
 * montagem e a validação do que o botão "Usar" entrega ao PDV, sem React e sem
 * Supabase (testado com Deno em scripts/testes-troca-pdv/entradaTrocaForm.test.ts).
 *
 * Regra de ouro: sem IMEI 2 (campo ausente), o resultado é exatamente o de
 * antes desta extração — mesmas validações, na mesma ordem, e o mesmo objeto.
 */
import { duplicadoNaCompra } from "../origem/itensCompra.ts";
import { documentoDoCliente } from "../clientes/dadosCliente.ts";
import type { DadosEntradaTroca } from "./trocaPDV.ts";

/** Os campos do diálogo como estão na tela (texto cru, sem trim). */
export interface CamposEntradaTroca {
  vendedorNome: string;
  vendedorCpf: string;
  vendedorTelefone: string;
  marca: string;
  modelo: string;
  imei: string;
  /** IMEI 2 (dual chip). Ausente = tela sem o campo: o resultado não ganha `imei2`. */
  imei2?: string;
  numeroSerie: string;
  cor: string;
  capacidadeGb: string;
  condicao: string;
  /** checklist.entrada do ChecklistDispositivo. */
  checklistEntrada: Record<string, boolean> | null | undefined;
  valorCusto: string;
  valorVenda: string;
  observacoes: string;
}

/**
 * Motivo da recusa = chave do toast em `pdv` → `entradaTroca.toast.<erro>`.
 * As quatro primeiras são as de sempre; `imeiRepetido` só acontece com IMEI 2.
 */
export type ErroEntradaTroca =
  | "informeVendedor"
  | "informeMarcaModelo"
  | "imeiRepetido"
  | "custoInvalido"
  | "vendaInvalido";

export type ResultadoEntradaTrocaForm =
  | { ok: true; dados: DadosEntradaTroca; erro?: undefined }
  | { ok: false; erro: ErroEntradaTroca; dados?: undefined };

/**
 * IMEI 1 igual ao IMEI 2 do mesmo aparelho (ignorando espaços, pontos e traços).
 * Mesma regra da compra (duplicadoNaCompra): só vale com os dois preenchidos.
 */
export function imeisRepetidos(imei: string | null | undefined, imei2: string | null | undefined): boolean {
  return duplicadoNaCompra({ imei, imei2 }, []) !== null;
}

/** Valida e monta os dados da entrada. Nada é gravado aqui. */
export function montarEntradaTroca(c: CamposEntradaTroca): ResultadoEntradaTrocaForm {
  if (!c.vendedorNome.trim()) return { ok: false, erro: "informeVendedor" };
  if (!c.marca.trim() || !c.modelo.trim()) return { ok: false, erro: "informeMarcaModelo" };
  if (c.imei2 !== undefined && imeisRepetidos(c.imei, c.imei2)) return { ok: false, erro: "imeiRepetido" };

  const custo = parseFloat(c.valorCusto.replace(",", "."));
  if (isNaN(custo) || custo <= 0) return { ok: false, erro: "custoInvalido" };
  const venda = parseFloat(c.valorVenda.replace(",", "."));
  if (isNaN(venda) || venda <= 0) return { ok: false, erro: "vendaInvalido" };

  const capacidade = c.capacidadeGb ? parseInt(c.capacidadeGb) : NaN;
  const checklistEntrada =
    c.checklistEntrada && Object.keys(c.checklistEntrada).length > 0 ? c.checklistEntrada : null;

  return {
    ok: true,
    dados: {
      vendedor: {
        nome: c.vendedorNome.trim(),
        cpf: c.vendedorCpf.trim() || null,
        telefone: c.vendedorTelefone.trim() || null,
      },
      aparelho: {
        marca: c.marca.trim(),
        modelo: c.modelo.trim(),
        imei: c.imei.trim() || null,
        ...(c.imei2 !== undefined ? { imei2: c.imei2.trim() || null } : {}),
        numeroSerie: c.numeroSerie.trim() || null,
        cor: c.cor.trim() || null,
        capacidadeGb: Number.isFinite(capacidade) ? capacidade : null,
        condicao: c.condicao,
        checklistEntrada,
      },
      // Centavos: o mesmo valor vai para vendas.valor_troca, compra e vendas_trocas (numeric(12,2)).
      valorEntrada: Math.round(custo * 100) / 100,
      valorVenda: Math.round(venda * 100) / 100,
      observacoes: c.observacoes.trim() || null,
    },
  };
}

/**
 * Colunas imei/imei2 de `dispositivos` para a entrada. Troca pendente antiga
 * (salva no navegador antes do IMEI 2) não tem `imei2`: grava null.
 */
export function colunasImeiDaEntrada(aparelho: DadosEntradaTroca["aparelho"]): { imei: string | null; imei2: string | null } {
  return { imei: aparelho.imei, imei2: aparelho.imei2 ?? null };
}

/** Cliente já cadastrado → campos do vendedor do aparelho, copiados como estão no cadastro. */
export function vendedorDoCliente(cliente: {
  nome?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
}): { nome: string; documento: string; telefone: string } {
  return {
    nome: cliente.nome ?? "",
    documento: documentoDoCliente(cliente),
    telefone: cliente.telefone ?? "",
  };
}

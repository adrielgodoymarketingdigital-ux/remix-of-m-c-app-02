// Orquestrador ÚNICO do "Gerar recibo legal" (Origem de Dispositivos e Dispositivos).
// Ordem: compra atual do banco → dados da loja → imagens atuais (uma por vez) →
// PDF com as imagens preparadas → storage (arquivo NOVO; o antigo fica intacto) →
// termo_pdf_url aponta para o novo. Se algo falhar antes de salvar, nada é gravado
// e o termo_pdf_url antigo continua. As dependências entram por parâmetro (testes
// em Deno); as reais ficam em dependenciasReciboLegal.ts.
import type { gerarReciboLegalPDF, ImagensPreparadasRecibo } from "@/lib/gerarReciboLegalPDF";
import type { ImagensReciboPreparadas, EntradaImagensRecibo } from "./carregarImagensRecibo";
import type { DadosCompraParaRecibo } from "./buscarCompraParaRecibo";
import { MAX_FOTOS_RECIBO, type ResumoFalhas } from "./imagensRecibo";
import { ErroReciboLegal } from "./erroReciboLegal";

type GerarPdf = typeof gerarReciboLegalPDF;
type DadosLoja = Parameters<GerarPdf>[0]["loja"];
type PdfGerado = Awaited<ReturnType<GerarPdf>>;

/** Campos da configuração da loja usados no recibo (ConfiguracaoLoja tem estes e mais). */
export interface LojaParaRecibo {
  nome_loja?: string | null;
  razao_social?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  site?: string | null;
}

export interface DependenciasReciboLegal {
  buscarCompra: (compraId: string) => Promise<DadosCompraParaRecibo>;
  buscarLoja: (empresaId: string | null) => Promise<LojaParaRecibo | null>;
  validarLoja: (loja: LojaParaRecibo | null) => { valido: boolean; camposFaltando: string[] };
  carregarImagens: (entrada: EntradaImagensRecibo) => Promise<ImagensReciboPreparadas>;
  gerarPdf: GerarPdf;
  salvar: (pdf: PdfGerado, compraId: string) => Promise<string>;
  /** Devolve quantas linhas foram atualizadas. */
  atualizarTermo: (compraId: string, url: string) => Promise<number>;
}

export interface ResumoImagensRecibo {
  fotos: ResumoFalhas;
  documentos: ResumoFalhas;
  fotosIgnoradas: number;
}

export interface ResultadoReciboLegal {
  url: string;
  /** A compra já tinha um recibo (que continua guardado no storage). */
  tinhaReciboAnterior: boolean;
  resumoImagens: ResumoImagensRecibo;
}

/** Aviso já com a chave do namespace "comum" e os valores da interpolação. */
export interface AvisoReciboLegal {
  chave: string;
  valores?: Record<string, number>;
}

const texto = (v: string | null | undefined) => (v ?? undefined) || undefined;

function lojaParaPdf(loja: LojaParaRecibo): DadosLoja {
  return {
    nome_loja: loja.nome_loja ?? "",
    razao_social: texto(loja.razao_social),
    cnpj: texto(loja.cnpj),
    endereco: texto(loja.endereco),
    telefone: texto(loja.telefone),
    whatsapp: texto(loja.whatsapp),
    email: texto(loja.email),
    cep: texto(loja.cep),
    logradouro: texto(loja.logradouro),
    numero: texto(loja.numero),
    complemento: texto(loja.complemento),
    bairro: texto(loja.bairro),
    cidade: texto(loja.cidade),
    estado: texto(loja.estado),
    inscricao_estadual: texto(loja.inscricao_estadual),
    inscricao_municipal: texto(loja.inscricao_municipal),
    site: texto(loja.site),
  };
}

export function imagensParaGerador(prep: ImagensReciboPreparadas): ImagensPreparadasRecibo {
  return {
    fotos: prep.fotos.map((f) => f.dataUrl),
    documentoFrente: prep.documentoFrente?.dataUrl ?? null,
    documentoVerso: prep.documentoVerso?.dataUrl ?? null,
  };
}

async function executar(compraId: string, deps: DependenciasReciboLegal): Promise<ResultadoReciboLegal> {
  // 1) Tudo lido do banco agora — nunca do objeto da lista.
  const { compra, dispositivo } = await deps.buscarCompra(compraId);

  const faltaDispositivo = [
    !dispositivo.marca && "Marca",
    !dispositivo.modelo && "Modelo",
    !dispositivo.tipo && "Tipo",
  ].filter((c): c is string => !!c);
  if (faltaDispositivo.length) throw new ErroReciboLegal("dispositivo_incompleto", faltaDispositivo);

  const pessoa = compra.pessoa_id ? compra.origem_pessoas : null;
  const vendedor = pessoa?.nome
    ? { ...pessoa, nome: pessoa.nome }
    : compra.fornecedor_id
      ? { nome: compra.fornecedores?.nome || "Fornecedor não identificado", cpf_cnpj: "", endereco: "", telefone: "" }
      : null;
  if (!vendedor) throw new ErroReciboLegal("sem_vendedor");

  const loja = await deps.buscarLoja(compra.empresa_id ?? dispositivo.empresa_id ?? null);
  const validacao = deps.validarLoja(loja);
  if (!loja || !validacao.valido) throw new ErroReciboLegal("loja_incompleta", validacao.camposFaltando);

  // 2) Imagens atuais, uma por vez; falha de uma não derruba o recibo.
  const imagens = await deps.carregarImagens({
    fotos: compra.fotos ?? [],
    documentoFrente: compra.documento_vendedor_frente ?? null,
    documentoVerso: compra.documento_vendedor_verso ?? null,
  });

  const checklist = (dispositivo.checklist as { entrada?: Record<string, boolean> } | null)?.entrada;
  const pdf = await deps.gerarPdf({
    loja: lojaParaPdf(loja),
    vendedor,
    dispositivo: {
      tipo: dispositivo.tipo ?? "",
      marca: dispositivo.marca ?? "",
      modelo: dispositivo.modelo ?? "",
      cor: texto(dispositivo.cor),
      imei: texto(dispositivo.imei),
      numero_serie: texto(dispositivo.numero_serie),
      capacidade_gb: dispositivo.capacidade_gb ?? undefined,
      condicao: dispositivo.condicao ?? "",
      checklist,
    },
    compra,
    imagens: imagensParaGerador(imagens),
  });

  // 3) Daqui em diante grava: arquivo novo no storage, depois o link na compra.
  const url = await deps.salvar(pdf, compraId);
  const linhas = await deps.atualizarTermo(compraId, url);
  if (linhas !== 1) throw new ErroReciboLegal("termo_nao_atualizado");

  return {
    url,
    tinhaReciboAnterior: !!compra.termo_pdf_url,
    resumoImagens: { fotos: imagens.resumoFotos, documentos: imagens.resumoDocumentos, fotosIgnoradas: imagens.fotosIgnoradas },
  };
}

const emAndamento = new Map<string, Promise<ResultadoReciboLegal>>();

/**
 * Gera um recibo NOVO com as fotos e anexos atuais da compra. Clique duplo (ou
 * duas telas ao mesmo tempo) para a mesma compra recebe a mesma promessa: um PDF só.
 */
export function gerarEBaixarReciboLegal(compraId: string, deps: DependenciasReciboLegal): Promise<ResultadoReciboLegal> {
  const atual = emAndamento.get(compraId);
  if (atual) return atual;
  const promessa = executar(compraId, deps).finally(() => emAndamento.delete(compraId));
  emAndamento.set(compraId, promessa);
  return promessa;
}

export function reciboLegalEmAndamento(compraId: string): boolean {
  return emAndamento.has(compraId);
}

/** Avisos do resultado, na ordem em que aparecem. Chaves de reciboLegal no namespace "comum". */
export function avisosDoRecibo(r: ResultadoReciboLegal): AvisoReciboLegal[] {
  const avisos: AvisoReciboLegal[] = [];
  const { fotos, documentos, fotosIgnoradas } = r.resumoImagens;
  if (fotos.falhas > 0) avisos.push({ chave: "reciboLegal.falhasFotos", valores: { count: fotos.falhas, total: fotos.total } });
  if (fotosIgnoradas > 0) avisos.push({ chave: "reciboLegal.fotosIgnoradas", valores: { max: MAX_FOTOS_RECIBO } });
  if (documentos.falhas > 0) avisos.push({ chave: "reciboLegal.falhasDocumentos", valores: { count: documentos.falhas, total: documentos.total } });
  if (r.tinhaReciboAnterior) avisos.push({ chave: "reciboLegal.anteriorGuardado" });
  return avisos;
}

/** true quando algum aviso é de problema (pede toast de alerta, não de sucesso). */
export function reciboComProblema(r: ResultadoReciboLegal): boolean {
  const { fotos, documentos, fotosIgnoradas } = r.resumoImagens;
  return fotos.falhas > 0 || documentos.falhas > 0 || fotosIgnoradas > 0;
}

// Orquestrador ÚNICO do "Gerar recibo legal" (Origem de Dispositivos e Dispositivos).
// Ordem: compra atual do banco → loja e vendedor validados pelas REGRAS DO PONTO que
// chamou (regrasReciboLegal.ts, iguais às da origin/main em cada tela) → imagens
// atuais (uma por vez) → PDF com as imagens preparadas → storage (arquivo NOVO; o
// antigo fica intacto) → termo_pdf_url aponta para o novo. Se algo falhar antes de
// salvar, nada é gravado e o termo_pdf_url antigo continua. As dependências entram
// por parâmetro (testes em Deno); as reais ficam em dependenciasReciboLegal.ts.
import type { gerarReciboLegalPDF, ImagensPreparadasRecibo } from "@/lib/gerarReciboLegalPDF";
import type { ImagensReciboPreparadas, EntradaImagensRecibo } from "./carregarImagensRecibo";
import type { DadosCompraParaRecibo } from "./buscarCompraParaRecibo";
import { MAX_FOTOS_RECIBO, type ResumoFalhas } from "./imagensRecibo";
import { ErroReciboLegal } from "./erroReciboLegal";
import type { FalhaRecibo, RegrasReciboLegal } from "./regrasReciboLegal";

/** Bloqueio com a mensagem exata da tela (loja/vendedor/dispositivo incompletos, compra não encontrada...). */
export class BloqueioReciboLegal extends Error {
  readonly falha: FalhaRecibo;
  constructor(falha: FalhaRecibo) {
    super(falha.descricao ? `${falha.titulo}: ${falha.descricao}` : falha.titulo);
    this.name = "BloqueioReciboLegal";
    this.falha = falha;
  }
}

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

function lojaParaPdf(loja: LojaParaRecibo, campos: RegrasReciboLegal["lojaNoPdf"]): DadosLoja {
  if (campos === "basica") {
    // Os 5 campos que o diálogo de detalhes mandava (sem endereço por partes nem cidade).
    return {
      nome_loja: loja.nome_loja ?? "",
      razao_social: texto(loja.razao_social),
      cnpj: texto(loja.cnpj),
      endereco: texto(loja.endereco),
      telefone: texto(loja.telefone),
    };
  }
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

async function executar(compraId: string, deps: DependenciasReciboLegal, regras: RegrasReciboLegal): Promise<ResultadoReciboLegal> {
  // 1) Tudo lido do banco agora — nunca do objeto da lista.
  let dados: Awaited<ReturnType<DependenciasReciboLegal["buscarCompra"]>>;
  try {
    dados = await deps.buscarCompra(compraId);
  } catch (erro) {
    if (erro instanceof ErroReciboLegal && erro.codigo === "compra_nao_encontrada") throw new BloqueioReciboLegal(regras.falhaCompraNaoEncontrada);
    if (erro instanceof ErroReciboLegal && erro.codigo === "dispositivo_nao_encontrado") throw new BloqueioReciboLegal(regras.falhaDispositivoNaoEncontrado);
    throw erro;
  }
  const { compra, dispositivo } = dados;

  // Mesma ordem das telas: loja, depois vendedor, depois dispositivo (só o diálogo de detalhes valida).
  const empresaId = regras.empresaDa === "dispositivo" ? dispositivo.empresa_id ?? null : compra.empresa_id ?? null;
  const loja = await deps.buscarLoja(empresaId);
  const falhaLoja = regras.validarLoja(loja);
  if (falhaLoja || !loja) throw new BloqueioReciboLegal(falhaLoja ?? regras.falhaInesperada(undefined));

  const resolvido = regras.resolverVendedor(compra);
  if ("falha" in resolvido) throw new BloqueioReciboLegal(resolvido.falha);
  const vendedor = resolvido.vendedor;

  const falhaDispositivo = regras.validarDispositivo(dispositivo);
  if (falhaDispositivo) throw new BloqueioReciboLegal(falhaDispositivo);

  // 2) Imagens atuais, uma por vez; falha de uma não derruba o recibo.
  const imagens = await deps.carregarImagens({
    fotos: compra.fotos ?? [],
    documentoFrente: compra.documento_vendedor_frente ?? null,
    documentoVerso: compra.documento_vendedor_verso ?? null,
  });

  const checklist = (dispositivo.checklist as { entrada?: Record<string, boolean> } | null)?.entrada;
  const pdf = await deps.gerarPdf({
    loja: lojaParaPdf(loja, regras.lojaNoPdf),
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
    resumoImagens: resumoDasImagens(imagens),
  };
}

const emAndamento = new Map<string, Promise<ResultadoReciboLegal>>();

/**
 * Gera um recibo NOVO com as fotos e anexos atuais da compra. Clique duplo (ou
 * duas telas ao mesmo tempo) para a mesma compra recebe a mesma promessa: um PDF só.
 */
export function gerarEBaixarReciboLegal(
  compraId: string,
  deps: DependenciasReciboLegal,
  regras: RegrasReciboLegal,
): Promise<ResultadoReciboLegal> {
  const atual = emAndamento.get(compraId);
  if (atual) return atual;
  const promessa = executar(compraId, deps, regras).finally(() => emAndamento.delete(compraId));
  emAndamento.set(compraId, promessa);
  return promessa;
}

export function reciboLegalEmAndamento(compraId: string): boolean {
  return emAndamento.has(compraId);
}

/** Resumo das imagens preparadas (o mesmo formato do resultado do orquestrador). */
export function resumoDasImagens(prep: ImagensReciboPreparadas): ResumoImagensRecibo {
  return { fotos: prep.resumoFotos, documentos: prep.resumoDocumentos, fotosIgnoradas: prep.fotosIgnoradas };
}

/** Avisos só das imagens (fotos que falharam, mais de 5, documentos). Usado também no cadastro. */
export function avisosDasImagens(resumo: ResumoImagensRecibo): AvisoReciboLegal[] {
  const avisos: AvisoReciboLegal[] = [];
  const { fotos, documentos, fotosIgnoradas } = resumo;
  if (fotos.falhas > 0) avisos.push({ chave: "reciboLegal.falhasFotos", valores: { count: fotos.falhas, total: fotos.total } });
  if (fotosIgnoradas > 0) avisos.push({ chave: "reciboLegal.fotosIgnoradas", valores: { max: MAX_FOTOS_RECIBO } });
  if (documentos.falhas > 0) avisos.push({ chave: "reciboLegal.falhasDocumentos", valores: { count: documentos.falhas, total: documentos.total } });
  return avisos;
}

/** Avisos do resultado, na ordem em que aparecem. Chaves de reciboLegal no namespace "comum". */
export function avisosDoRecibo(r: ResultadoReciboLegal): AvisoReciboLegal[] {
  const avisos = avisosDasImagens(r.resumoImagens);
  if (r.tinhaReciboAnterior) avisos.push({ chave: "reciboLegal.anteriorGuardado" });
  return avisos;
}

/** true quando algum aviso é de problema (pede toast de alerta, não de sucesso). */
export function imagensComProblema(resumo: ResumoImagensRecibo): boolean {
  return resumo.fotos.falhas > 0 || resumo.documentos.falhas > 0 || resumo.fotosIgnoradas > 0;
}

export function reciboComProblema(r: ResultadoReciboLegal): boolean {
  return imagensComProblema(r.resumoImagens);
}

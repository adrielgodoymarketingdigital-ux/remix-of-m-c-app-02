/**
 * Gera scripts/seed_compatibilidade_vidro.sql a partir da planilha de
 * compatibilidade de vidros (troca de vidro da tela).
 *
 *   deno run --allow-read --allow-write scripts/gerar_seed_compatibilidade_vidro.ts
 *   deno run --allow-read --allow-write scripts/gerar_seed_compatibilidade_vidro.ts --arquivo=/caminho/planilha.xlsx
 *
 * Sem --arquivo, procura "compatibilidade_vidros*.xlsx" no projeto (ignorando
 * node_modules, dist* e .git). Lê só a aba "Compatibilidade" (a aba "Preços" é
 * ignorada): colunas Marca, Modelo e "Compatíveis com o mesmo vidro" (modelos
 * da mesma marca separados por " | "). Marca e modelo vão exatamente como estão
 * na planilha. Qualquer problema de validação ABORTA sem gerar o SQL.
 *
 * O SQL gerado NÃO é migration: aplicar uma vez, à mão, no SQL Editor, depois
 * da migration 20261005150000_compatibilidade_tipo_vidro.sql.
 */
import * as XLSX from "xlsx";

export const ABA = "Compatibilidade";
const CABECALHO = ["Marca", "Modelo", "Compatíveis com o mesmo vidro"];
const SEPARADOR = " | ";

export interface LinhaPlanilha {
  /** Número da linha na planilha (1 = cabeçalho). */
  linha: number;
  marca: string;
  modelo: string;
  compativeis: string[];
}

export interface GrupoImportado {
  nome: string;
  modelos: { marca: string; modelo: string }[];
}

export class ErroImportacao extends Error {
  constructor(public problemas: string[]) {
    super(`Planilha inválida (${problemas.length} problema(s)):\n- ${problemas.join("\n- ")}`);
    this.name = "ErroImportacao";
  }
}

const texto = (v: unknown) => (v == null ? "" : String(v).trim());

/** Matriz da aba (sheet_to_json com header: 1) → linhas; confere o cabeçalho. */
export function lerLinhasDaMatriz(matriz: unknown[][]): LinhaPlanilha[] {
  const cab = (matriz[0] ?? []).map(texto);
  if (CABECALHO.some((c, i) => cab[i] !== c)) {
    throw new ErroImportacao([`cabeçalho esperado ${JSON.stringify(CABECALHO)}, encontrado ${JSON.stringify(cab.slice(0, 3))}`]);
  }
  const linhas: LinhaPlanilha[] = [];
  matriz.slice(1).forEach((cols, i) => {
    if (!cols || cols.every((c) => texto(c) === "")) return; // linha totalmente em branco
    const brutos = texto(cols[2]);
    linhas.push({
      linha: i + 2,
      marca: texto(cols[0]),
      modelo: texto(cols[1]),
      compativeis: brutos === "" ? [] : brutos.split(SEPARADOR.trim()).map((s) => s.trim()),
    });
  });
  return linhas;
}

/**
 * Valida e agrupa. Grupos = componentes conexos (por marca), na ordem em que o
 * primeiro modelo aparece; modelos na ordem da planilha; nome = modelos unidos por "/".
 */
export function validarEAgrupar(linhas: LinhaPlanilha[]): GrupoImportado[] {
  const problemas: string[] = [];
  const chave = (marca: string, modelo: string) => `${marca}\u0000${modelo}`;
  const porChave = new Map<string, LinhaPlanilha>();

  for (const l of linhas) {
    const onde = `linha ${l.linha}`;
    if (!l.marca) problemas.push(`${onde}: marca vazia`);
    if (!l.modelo) problemas.push(`${onde}: modelo vazio`);
    if (l.compativeis.length === 0) problemas.push(`${onde}: "${l.marca} ${l.modelo}" sem compatíveis (coluna vazia)`);
    if (l.compativeis.some((c) => c === "")) problemas.push(`${onde}: item vazio na lista de compatíveis`);
    if (!l.marca || !l.modelo) continue;
    const k = chave(l.marca, l.modelo);
    const anterior = porChave.get(k);
    if (anterior) problemas.push(`${onde}: "${l.marca} ${l.modelo}" duplicado (já na linha ${anterior.linha})`);
    else porChave.set(k, l);
    if (l.compativeis.includes(l.modelo)) problemas.push(`${onde}: "${l.marca} ${l.modelo}" compatível consigo mesmo`);
    const repetidos = l.compativeis.filter((c, i) => c && l.compativeis.indexOf(c) !== i);
    if (repetidos.length) problemas.push(`${onde}: compatível repetido na lista (${[...new Set(repetidos)].join(", ")})`);
  }
  for (const l of porChave.values()) {
    for (const c of l.compativeis) {
      if (c && c !== l.modelo && !porChave.has(chave(l.marca, c))) {
        problemas.push(`linha ${l.linha}: "${l.marca} ${l.modelo}" cita "${c}", que não tem linha própria na marca ${l.marca}`);
      }
    }
  }
  if (problemas.length) throw new ErroImportacao(problemas);

  // Simetria: A lista B ⇒ B lista A.
  for (const l of porChave.values()) {
    for (const c of l.compativeis) {
      const outro = porChave.get(chave(l.marca, c))!;
      if (!outro.compativeis.includes(l.modelo)) {
        problemas.push(`assimetria: linha ${l.linha} "${l.marca} ${l.modelo}" lista "${c}", mas a linha ${outro.linha} não lista "${l.modelo}"`);
      }
    }
  }
  if (problemas.length) throw new ErroImportacao(problemas);

  // Componentes conexos; cada um precisa ser fechado (todos compatíveis com todos).
  const grupos: GrupoImportado[] = [];
  const visitado = new Set<string>();
  for (const l of porChave.values()) {
    const k0 = chave(l.marca, l.modelo);
    if (visitado.has(k0)) continue;
    const componente = new Set<string>();
    const pilha = [l.modelo];
    while (pilha.length) {
      const modelo = pilha.pop()!;
      if (componente.has(modelo)) continue;
      componente.add(modelo);
      pilha.push(...porChave.get(chave(l.marca, modelo))!.compativeis);
    }
    const membros = linhas.filter((x) => x.marca === l.marca && componente.has(x.modelo) && porChave.get(chave(x.marca, x.modelo)) === x);
    for (const m of membros) {
      visitado.add(chave(m.marca, m.modelo));
      const faltando = [...componente].filter((o) => o !== m.modelo && !m.compativeis.includes(o));
      if (faltando.length) {
        problemas.push(`grupo não fechado: linha ${m.linha} "${m.marca} ${m.modelo}" não lista ${faltando.map((f) => `"${f}"`).join(", ")} (mesmo grupo por outros modelos)`);
      }
    }
    grupos.push({ nome: membros.map((m) => m.modelo).join("/"), modelos: membros.map((m) => ({ marca: m.marca, modelo: m.modelo })) });
  }
  if (problemas.length) throw new ErroImportacao(problemas);
  return grupos;
}

const sql = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function montarSqlSeed(grupos: GrupoImportado[], origem: string): string {
  const totalGrupos = grupos.length;
  const totalVinculos = grupos.reduce((acc, g) => acc + g.modelos.length, 0);
  const porMarca = new Map<string, number>();
  for (const g of grupos) porMarca.set(g.modelos[0].marca, (porMarca.get(g.modelos[0].marca) ?? 0) + 1);

  const partes: string[] = [];
  partes.push(`-- Seed de dados: Compatibilidade de Vidros (troca de vidro da tela)
-- GERADO por scripts/gerar_seed_compatibilidade_vidro.ts a partir de "${origem}"
-- (aba "${ABA}"). Não editar à mão: corrigir a planilha e gerar de novo.
--
-- Aplicar UMA VEZ manualmente no SQL Editor do Supabase (não é migration),
-- DEPOIS da migration 20261005150000_compatibilidade_tipo_vidro.sql.
-- Tudo numa transação: aborta se a coluna tipo não existir, se já houver grupos
-- de vidro, se as contagens finais não baterem ou se os dados de película mudarem.
--
-- ${totalGrupos} grupos, ${totalVinculos} vínculos de modelo. Marca e modelo exatamente como na planilha.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'grupos_compatibilidade_pelicula' AND column_name = 'tipo'
  ) THEN
    RAISE EXCEPTION 'Coluna tipo não existe: aplique antes a migration 20261005150000_compatibilidade_tipo_vidro.sql';
  END IF;
  IF EXISTS (SELECT 1 FROM public.grupos_compatibilidade_pelicula WHERE tipo = 'vidro') THEN
    RAISE EXCEPTION 'Já existem grupos com tipo = vidro: seed de vidros não será aplicado de novo';
  END IF;
END $$;

-- Foto das películas antes, para a conferência final.
CREATE TEMP TABLE _conferencia_peliculas ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public.grupos_compatibilidade_pelicula WHERE tipo = 'pelicula') AS grupos,
  (SELECT count(*) FROM public.grupo_compatibilidade_modelos m
     JOIN public.grupos_compatibilidade_pelicula g ON g.id = m.grupo_id
    WHERE g.tipo = 'pelicula') AS vinculos;
`);

  let marcaAtual = "";
  for (const g of grupos) {
    const marca = g.modelos[0].marca;
    if (marca !== marcaAtual) {
      marcaAtual = marca;
      partes.push(`-- ============================================================
-- ${marca.toUpperCase()} — ${porMarca.get(marca)} grupos
-- ============================================================
`);
    }
    partes.push(`-- Grupo: ${g.nome}
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES (${sql(g.nome)}, 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
${g.modelos.map((m) => `  (${sql(m.marca)}, ${sql(m.modelo)})`).join(",\n")}
) AS v(marca, modelo);
`);
  }

  partes.push(`-- ============================================================
-- Conferência final (aborta a transação se algo não bater)
-- ============================================================
DO $$
DECLARE
  v_grupos integer;
  v_vinculos integer;
  v_pel_grupos integer;
  v_pel_vinculos integer;
  v_pel_grupos_antes integer;
  v_pel_vinculos_antes integer;
BEGIN
  SELECT count(*) INTO v_grupos FROM public.grupos_compatibilidade_pelicula WHERE tipo = 'vidro';
  SELECT count(*) INTO v_vinculos FROM public.grupo_compatibilidade_modelos m
    JOIN public.grupos_compatibilidade_pelicula g ON g.id = m.grupo_id
   WHERE g.tipo = 'vidro';
  IF v_grupos <> ${totalGrupos} OR v_vinculos <> ${totalVinculos} THEN
    RAISE EXCEPTION 'Conferência falhou: % grupos e % vínculos de vidro (esperado ${totalGrupos} e ${totalVinculos})', v_grupos, v_vinculos;
  END IF;

  SELECT count(*) INTO v_pel_grupos FROM public.grupos_compatibilidade_pelicula WHERE tipo = 'pelicula';
  SELECT count(*) INTO v_pel_vinculos FROM public.grupo_compatibilidade_modelos m
    JOIN public.grupos_compatibilidade_pelicula g ON g.id = m.grupo_id
   WHERE g.tipo = 'pelicula';
  SELECT grupos, vinculos INTO v_pel_grupos_antes, v_pel_vinculos_antes FROM _conferencia_peliculas;
  IF v_pel_grupos <> v_pel_grupos_antes OR v_pel_vinculos <> v_pel_vinculos_antes THEN
    RAISE EXCEPTION 'Conferência falhou: dados de película mudaram durante o seed';
  END IF;

  RAISE NOTICE 'OK: % grupos e % vínculos de vidro; películas intactas (% grupos, % vínculos)', v_grupos, v_vinculos, v_pel_grupos, v_pel_vinculos;
END $$;

COMMIT;
`);
  return partes.join("\n");
}

/** Procura compatibilidade_vidros*.xlsx a partir da raiz (src/assets primeiro). */
export function encontrarPlanilha(raiz: string): string | null {
  const achados: string[] = [];
  const ignorar = (nome: string) => nome === "node_modules" || nome === ".git" || nome.startsWith("dist");
  const andar = (dir: string) => {
    for (const e of Deno.readDirSync(dir)) {
      const caminho = `${dir}/${e.name}`;
      if (e.isDirectory && !ignorar(e.name)) andar(caminho);
      else if (e.isFile && /^compatibilidade_vidros.*\.xlsx$/i.test(e.name)) achados.push(caminho);
    }
  };
  andar(raiz);
  achados.sort((a, b) => Number(!a.includes("/src/assets/")) - Number(!b.includes("/src/assets/")) || a.localeCompare(b));
  return achados[0] ?? null;
}

export function lerPlanilha(caminho: string): LinhaPlanilha[] {
  const wb = XLSX.read(Deno.readFileSync(caminho));
  const aba = wb.Sheets[ABA];
  if (!aba) throw new ErroImportacao([`aba "${ABA}" não encontrada (abas: ${wb.SheetNames.join(", ")})`]);
  return lerLinhasDaMatriz(XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, defval: "" }));
}

if (import.meta.main) {
  const dirScripts = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
  const raiz = dirScripts.replace(/\/scripts$/, "");
  const arg = Deno.args.find((a) => a.startsWith("--arquivo="));
  const caminho = arg ? arg.slice("--arquivo=".length) : encontrarPlanilha(raiz);
  if (!caminho) {
    console.error(`Planilha compatibilidade_vidros*.xlsx não encontrada em ${raiz} (use --arquivo=...)`);
    Deno.exit(1);
  }
  try {
    const linhas = lerPlanilha(caminho);
    const grupos = validarEAgrupar(linhas);
    const origem = caminho.split("/").pop()!;
    const destino = `${dirScripts}/seed_compatibilidade_vidro.sql`;
    Deno.writeTextFileSync(destino, montarSqlSeed(grupos, origem));
    const vinculos = grupos.reduce((acc, g) => acc + g.modelos.length, 0);
    console.log(`Planilha: ${caminho}\n${linhas.length} linhas → ${grupos.length} grupos, ${vinculos} vínculos\nGerado: ${destino}`);
  } catch (e) {
    console.error(e instanceof ErroImportacao ? e.message : e);
    Deno.exit(1);
  }
}

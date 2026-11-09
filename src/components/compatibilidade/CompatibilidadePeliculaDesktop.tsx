import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, HelpCircle, Layers, Loader2, Search, ShieldCheck, Smartphone, Tag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ComboboxDados } from "@/components/compatibilidade/SeletorMarcaModeloDados";
import { AbasTipoCompatibilidadeDesktop } from "@/components/compatibilidade/AbasTipoCompatibilidadeDesktop";
import { useCompatibilidadePelicula } from "@/hooks/useCompatibilidadePelicula";
import {
  TipoCompatibilidade,
  encontrarCompativeis,
  montarOpcoesMarcaModelo,
} from "@/lib/compatibilidade/compatibilidade";
import { gruposDosCompativeis } from "@/lib/compatibilidade/gruposDosCompativeis";

/** Textos que dependem do tipo: os mesmos do celular (TEXTOS de pages/CompatibilidadePelicula). */
export interface TextosDoTipoCompatibilidade {
  descricaoBusca: string;
  tituloResultado: string;
  usaOMesmo: string;
  semDados: string;
}

const SEPARADOR_GRUPOS = " · ";
const CARTAO = "rounded-2xl p-7 shadow-sm";
const CAIXA_ICONE = "grid h-14 w-14 shrink-0 place-items-center rounded-2xl";
const CAMPO = "h-12 rounded-xl bg-background px-4 text-[15px] font-medium shadow-sm";

/** Ilustração decorativa (só CSS): celular com o vidro/película ao lado. */
function IlustracaoCelular() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[340px] xl:block">
      <div className="absolute inset-0 bg-gradient-to-l from-indigo-100/80 via-indigo-50/40 to-transparent dark:from-indigo-500/15 dark:via-indigo-500/5" />
      {/* vidro / película */}
      <div className="absolute -bottom-6 right-28 h-[230px] w-[130px] rotate-[9deg] rounded-[26px] border-2 border-blue-300/80 bg-white/30 dark:border-blue-400/40 dark:bg-white/5" />
      {/* celular */}
      <div className="absolute -bottom-20 right-12 h-[260px] w-[150px] rotate-[13deg] rounded-[32px] border-[7px] border-slate-900 bg-gradient-to-br from-sky-300 via-indigo-500 to-violet-900 shadow-xl shadow-indigo-900/20 ring-2 ring-blue-500/60 dark:border-slate-950">
        <div className="mx-auto mt-1.5 h-3 w-14 rounded-b-xl rounded-t-sm bg-slate-900 dark:bg-slate-950" />
      </div>
    </div>
  );
}

/** Bloco centralizado dos estados sem resultado (carregando, erro, sem dados). */
function Aviso({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 rounded-2xl px-6 py-16 text-center shadow-sm">
      <div className="rounded-full bg-muted p-4">{icone}</div>
      <p className="max-w-xl font-semibold text-foreground">{children}</p>
    </Card>
  );
}

/** Cabeçalho dos cartões: ícone, título e descrição, e algo à direita (o contador). */
function CabecalhoCartao({ icone, titulo, descricao, direita }: { icone: ReactNode; titulo: string; descricao: string; direita?: ReactNode }) {
  return (
    <div className="flex items-center gap-5">
      {icone}
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold tracking-tight">{titulo}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      </div>
      {direita}
    </div>
  );
}

function PainelDesktop({ tipo, textos }: { tipo: TipoCompatibilidade; textos: TextosDoTipoCompatibilidade }) {
  const { t } = useTranslation("comum");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");

  const { data: grupos = [], isLoading, isError } = useCompatibilidadePelicula(tipo);
  const opcoes = useMemo(() => montarOpcoesMarcaModelo(grupos), [grupos]);
  const modelos = marca ? opcoes.modelosPorMarca[marca] ?? [] : [];

  const buscou = !!marca && !!modelo;
  const resultado = buscou ? encontrarCompativeis(grupos, marca, modelo) : null;
  const encontrado = !!resultado && resultado.grupos.length > 0;
  const linhas = resultado ? gruposDosCompativeis(resultado) : [];

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center gap-2 rounded-2xl py-16 text-muted-foreground shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">{t("compatibilidade.carregando")}</span>
      </Card>
    );
  }

  if (isError || grupos.length === 0) {
    return (
      <Aviso icone={isError ? <AlertTriangle className="h-8 w-8 text-muted-foreground" /> : <HelpCircle className="h-8 w-8 text-muted-foreground" />}>
        {isError ? t("compatibilidade.erro") : textos.semDados}
      </Aviso>
    );
  }

  const iconeNeutro = (
    <div className={cn(CAIXA_ICONE, "bg-muted text-muted-foreground")}>
      <HelpCircle className="h-7 w-7" aria-hidden="true" />
    </div>
  );

  return (
    <>
      <Card className={cn(CARTAO, "relative overflow-hidden")}>
        <IlustracaoCelular />
        <div className="relative space-y-7 xl:pr-[340px]">
          <CabecalhoCartao
            icone={
              <div className={cn(CAIXA_ICONE, "bg-blue-500/10 text-blue-600 dark:text-blue-400")}>
                <Search className="h-7 w-7" aria-hidden="true" />
              </div>
            }
            titulo={t("compatibilidade.buscarModelo")}
            descricao={textos.descricaoBusca}
          />
          <div className="grid max-w-[1050px] grid-cols-2 gap-6">
            <div className="min-w-0 space-y-2.5">
              <Label htmlFor="compat-marca" className="text-muted-foreground">{t("compatibilidade.rotuloMarca")}</Label>
              <ComboboxDados
                id="compat-marca"
                icone={Tag}
                classeBotao={CAMPO}
                value={marca}
                opcoes={opcoes.marcas}
                placeholder={t("compatibilidade.selecioneMarca")}
                buscaPlaceholder={t("compatibilidade.buscaMarca")}
                onChange={(novaMarca) => {
                  setMarca(novaMarca);
                  setModelo("");
                }}
              />
            </div>
            <div className="min-w-0 space-y-2.5">
              <Label htmlFor="compat-modelo" className="text-muted-foreground">{t("compatibilidade.rotuloModelo")}</Label>
              <ComboboxDados
                id="compat-modelo"
                icone={Smartphone}
                classeBotao={CAMPO}
                value={modelo}
                opcoes={modelos}
                placeholder={t("compatibilidade.selecioneModelo")}
                buscaPlaceholder={t("compatibilidade.buscaModelo")}
                onChange={setModelo}
                disabled={!marca}
              />
            </div>
          </div>
        </div>
      </Card>

      {buscou && !encontrado && (
        <Card className={CARTAO}>
          <CabecalhoCartao icone={iconeNeutro} titulo={t("compatibilidade.semCadastro")} descricao={`${marca} ${modelo}`} />
        </Card>
      )}

      {buscou && encontrado && resultado && (
        <Card className={cn(CARTAO, "space-y-6")}>
          <CabecalhoCartao
            icone={
              linhas.length > 0 ? (
                <div className={cn(CAIXA_ICONE, "bg-emerald-500/10")}>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-white">
                    <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
                  </span>
                </div>
              ) : (
                iconeNeutro
              )
            }
            titulo={textos.tituloResultado}
            descricao={`${marca} ${modelo} ${textos.usaOMesmo}:`}
            direita={
              <span
                className={cn(
                  "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-xs font-semibold",
                  linhas.length > 0
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Layers className="h-4 w-4" aria-hidden="true" />
                {t("compatibilidade.encontrados", { count: linhas.length })}
              </span>
            }
          />

          {linhas.length === 0 ? (
            <div className="space-y-2 rounded-2xl border border-dashed px-6 py-8 text-center">
              <p className="font-medium text-foreground">{t("compatibilidade.nenhumaEquivalencia")}</p>
              <p className="text-sm text-muted-foreground">
                {t("compatibilidade.grupos", { count: resultado.grupos.length, nomes: resultado.grupos.map((g) => g.nome).join(SEPARADOR_GRUPOS) })}
              </p>
            </div>
          ) : (
            // grid-cols-1 (minmax(0,1fr)): nome comprido corta com reticências em vez de esticar a linha
            <ul className="grid grid-cols-1 gap-3">
              {linhas.map((m) => (
                <li key={`${m.marca}|${m.modelo}`} className="flex items-center gap-5 rounded-2xl border bg-background p-4 shadow-sm">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                    <Smartphone className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{m.marca === marca ? m.modelo : `${m.marca} ${m.modelo}`}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {t("compatibilidade.grupos", { count: m.grupos.length, nomes: m.grupos.join(SEPARADOR_GRUPOS) })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

interface CompatibilidadePeliculaDesktopProps {
  tipo: TipoCompatibilidade;
  onTipoChange: (tipo: TipoCompatibilidade) => void;
  textos: TextosDoTipoCompatibilidade;
}

/** Layout de computador (>= 1024px) da tela Compatibilidade de Películas e Vidros. */
export function CompatibilidadePeliculaDesktop({ tipo, onTipoChange, textos }: CompatibilidadePeliculaDesktopProps) {
  const { t } = useTranslation("comum");
  return (
    <main className="flex-1 space-y-6 p-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-blue-500/20">
          <ShieldCheck className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-9 tracking-tight">{t("compatibilidade.titulo")}</h1>
          <p className="text-sm leading-5 text-muted-foreground">{t("compatibilidade.subtitulo")}</p>
        </div>
      </div>

      <AbasTipoCompatibilidadeDesktop tipo={tipo} onChange={onTipoChange} />

      {/* key: trocar de aba limpa marca/modelo escolhidos (igual ao celular). */}
      <PainelDesktop key={tipo} tipo={tipo} textos={textos} />
    </main>
  );
}

/**
 * FASE B de "Minhas garantias": seletor ÚNICO de garantia na venda de um
 * aparelho (nome + prazo + texto juntos). Substitui "tempo de garantia" +
 * "modelo do termo" só para quem o freio libera (CampoGarantiaVenda).
 *
 * Lista as garantias ATIVAS da loja (ou as padrão virtuais), mais
 * "Personalizada" (só o prazo; o texto é o padrão da lib para esse prazo).
 * Já vem marcada a garantia com o prazo do aparelho (preSelecionarGarantia).
 * Sem lista (erro ao ler, ou nada em 8 s) → só "Personalizada": nunca impede a venda.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGarantias } from "@/hooks/useGarantias";
import { previaTextoGarantia, rotuloPrazo } from "@/lib/garantias/previa";
import {
  type EscolhaGarantia,
  escolhaDeGarantia,
  escolhaPersonalizada,
  MESES_MAX_VENDA,
  OPCAO_PERSONALIZADA,
  preSelecionarGarantia,
} from "@/lib/garantias/vendaGarantia";

const ESPERA_MAXIMA_MS = 8000;

export interface SeletorGarantiaProps {
  /** Prazo cadastrado no aparelho, para já vir marcado. */
  dispositivo: { garantia?: boolean | null; tempo_garantia?: number | null };
  onEscolha: (escolha: EscolhaGarantia | null) => void;
}

export function SeletorGarantia({ dispositivo, onEscolha }: SeletorGarantiaProps) {
  const { lista, carregando: carregandoLista, erro: erroLista } = useGarantias(true);
  // A venda nunca fica presa: lista que não chega em 8 s = como erro (só "Personalizada").
  const [esgotado, setEsgotado] = useState(false);
  useEffect(() => {
    if (!carregandoLista) return;
    const t = setTimeout(() => setEsgotado(true), ESPERA_MAXIMA_MS);
    return () => clearTimeout(t);
  }, [carregandoLista]);
  const carregando = carregandoLista && !esgotado;
  const erro = !!erroLista || (carregandoLista && esgotado);
  // A lista vem nova a cada render (garantiasParaExibir): estabiliza pelo conteúdo.
  const chaveLista = JSON.stringify(lista);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ativas = useMemo(() => (erro ? [] : lista.filter((g) => g.ativo)), [chaveLista, erro]);
  const [valor, setValor] = useState<string | null>(null);
  const [mesesTexto, setMesesTexto] = useState("");
  const [verTexto, setVerTexto] = useState(false);
  // Pré-seleção quando a lista chega (ou falha) — e de novo se a opção marcada
  // deixar de existir na lista (ex.: a lista mudou). "Personalizada" fica.
  useEffect(() => {
    if (carregando) return;
    if (valor === OPCAO_PERSONALIZADA) return;
    if (valor !== null && ativas.some((g) => g.chave === valor)) return;
    const pre = preSelecionarGarantia(ativas, dispositivo);
    if (pre.tipo === "garantia") setValor(pre.chave);
    else {
      setValor(OPCAO_PERSONALIZADA);
      setMesesTexto(String(pre.meses));
    }
  }, [carregando, erro, ativas, dispositivo, valor]);

  const escolha: EscolhaGarantia | null = useMemo(() => {
    if (valor === null) return null;
    if (valor === OPCAO_PERSONALIZADA) {
      return mesesTexto.trim() === "" ? null : escolhaPersonalizada(Number(mesesTexto));
    }
    const g = ativas.find((x) => x.chave === valor);
    return g ? escolhaDeGarantia(g) : null;
  }, [valor, mesesTexto, ativas]);

  // Avisa o pai só quando a escolha muda de conteúdo (nunca em todo render).
  const chaveEscolha = JSON.stringify(escolha);
  useEffect(() => {
    onEscolha(escolha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveEscolha]);

  if (carregando || valor === null) {
    return <p className="text-sm text-muted-foreground">Carregando garantias…</p>;
  }

  return (
    <div className="space-y-2" data-seletor-garantia="novo">
      <Label className="text-sm font-medium">Garantia</Label>
      <Select value={valor} onValueChange={setValor}>
        <SelectTrigger id="seletor-garantia" aria-label="Garantia">
          <SelectValue placeholder="Escolha a garantia" />
        </SelectTrigger>
        <SelectContent>
          {ativas.map((g) => (
            <SelectItem key={g.chave} value={g.chave}>
              {g.nome} · {g.meses > 0 ? rotuloPrazo(g.meses) : "sem prazo"}
            </SelectItem>
          ))}
          <SelectItem value={OPCAO_PERSONALIZADA}>Personalizada (só o prazo)</SelectItem>
        </SelectContent>
      </Select>
      {erro && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Não foi possível carregar as garantias da loja. Use "Personalizada".
        </p>
      )}
      {valor === OPCAO_PERSONALIZADA && (
        <div className="space-y-1">
          <Input
            id="garantia-meses-personalizada"
            type="number"
            inputMode="numeric"
            min={0}
            max={MESES_MAX_VENDA}
            placeholder="Meses de garantia (0 = sem garantia)"
            value={mesesTexto}
            onChange={(e) => setMesesTexto(e.target.value)}
          />
          {!escolha && <p className="text-xs text-destructive">Prazo entre 0 e {MESES_MAX_VENDA} meses.</p>}
        </div>
      )}
      {escolha && escolha.meses > 0 && escolha.texto && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setVerTexto((v) => !v)}
          >
            {verTexto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {verTexto ? "Esconder o texto do termo" : "Ver o texto do termo"}
          </button>
          {verTexto && (
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-2 font-mono text-[10px] leading-relaxed">
              {previaTextoGarantia(escolha.texto, escolha.meses)}
            </pre>
          )}
        </div>
      )}
      {escolha && escolha.meses === 0 && <p className="text-xs text-muted-foreground">Venda sem garantia contratual.</p>}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LIMITES_PADRAO,
  PadraoEtiqueta,
  calcularAlturaFolha,
  calcularLayoutFolha,
} from '@/lib/etiquetas/etiquetasProduto';

function parseNumero(texto: string): number {
  const n = parseFloat(texto.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

const formatarNumero = (v: number | null) => (v === null ? '' : String(Number(v.toFixed(2))).replace('.', ','));

// Input numérico que aceita vírgula e só confirma o valor ao sair do campo
// (evita "pular" o valor enquanto a pessoa ainda está digitando). Com
// `opcional`, apagar o campo confirma null.
export function CampoNumeroOpcional({ valor, onChange, min, max, inteiro = false, opcional = false, id, className, placeholder }: {
  valor: number | null;
  onChange: (valor: number | null) => void;
  min: number;
  max: number;
  inteiro?: boolean;
  opcional?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState(formatarNumero(valor));
  useEffect(() => { setTexto(formatarNumero(valor)); }, [valor]);

  const confirmar = () => {
    if (opcional && texto.trim() === '') {
      setTexto('');
      if (valor !== null) onChange(null);
      return;
    }
    let n = parseNumero(texto);
    if (!Number.isFinite(n)) {
      if (valor === null) {
        setTexto('');
        return;
      }
      n = valor;
    }
    if (inteiro) n = Math.round(n);
    n = Math.min(Math.max(n, min), max);
    setTexto(formatarNumero(n));
    if (n !== valor) onChange(n);
  };

  return (
    <Input
      id={id}
      inputMode={inteiro ? 'numeric' : 'decimal'}
      value={texto}
      placeholder={placeholder}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); }}
      className={className ?? 'h-9'}
    />
  );
}

export function CampoNumero({ onChange, ...props }: Omit<Parameters<typeof CampoNumeroOpcional>[0], 'valor' | 'onChange' | 'opcional'> & {
  valor: number;
  onChange: (valor: number) => void;
}) {
  return <CampoNumeroOpcional {...props} onChange={(n) => { if (n !== null) onChange(n); }} />;
}

// A tela trabalha em cm (o que a pessoa mede na régua); o padrão guarda mm.
const paraCm = (mm: number) => mm / 10;
const paraMm = (cm: number) => Math.round(cm * 100) / 10;
const L = LIMITES_PADRAO;

/** Campos de medida de um padrão de folha/rolo (em cm). */
export function CamposPadraoEtiqueta({ padrao, onChange, idPrefixo }: {
  padrao: PadraoEtiqueta;
  onChange: (parcial: Partial<PadraoEtiqueta>) => void;
  idPrefixo: string;
}) {
  const campoCm = (chave: 'larguraFolhaMm' | 'alturaFolhaMm' | 'espacoFileiraMm' | 'larguraMm' | 'alturaMm', rotulo: string, dica: string) => (
    <div className="space-y-1">
      <Label htmlFor={`${idPrefixo}-${chave}`} className="text-xs">{rotulo}</Label>
      <CampoNumero
        id={`${idPrefixo}-${chave}`}
        valor={paraCm(padrao[chave])}
        min={paraCm(L[chave].min)}
        max={paraCm(L[chave].max)}
        onChange={(n) => onChange({ [chave]: paraMm(n) })}
      />
      <p className="text-[11px] text-muted-foreground leading-tight">{dica}</p>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-3">
      {campoCm('larguraFolhaMm', 'Largura da folha/papel (cm)', 'Largura total do papel, de uma borda à outra.')}
      {/* Rolo contínuo (1 fileira): a "folha" é etiqueta + espaço até a próxima — mede-se o espaço, não a folha. */}
      {padrao.linhas === 1
        ? campoCm('espacoFileiraMm', 'Espaço entre fileiras (cm)', 'Distância da borda de uma etiqueta até a próxima. Se forem coladas uma na outra sem espaço, deixe 0.')
        : campoCm('alturaFolhaMm', 'Altura da folha/papel (cm)', 'Altura real da folha (A4 = 29,7).')}
      {campoCm('larguraMm', 'Largura da etiqueta (cm)', 'De uma única etiqueta.')}
      {campoCm('alturaMm', 'Altura da etiqueta (cm)', 'De uma única etiqueta.')}
      <div className="space-y-1">
        <Label htmlFor={`${idPrefixo}-colunas`} className="text-xs">Colunas por folha</Label>
        <CampoNumero id={`${idPrefixo}-colunas`} valor={padrao.colunas} min={L.colunas.min} max={L.colunas.max} inteiro onChange={(n) => onChange({ colunas: n })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefixo}-linhas`} className="text-xs">Linhas por folha</Label>
        <CampoNumeroOpcional
          id={`${idPrefixo}-linhas`}
          valor={padrao.linhas}
          min={L.linhas.min}
          max={L.linhas.max}
          inteiro
          opcional
          placeholder="Automático"
          onChange={(n) => onChange({ linhas: n })}
        />
      </div>
      <p className="col-span-2 text-[11px] text-muted-foreground leading-tight">
        Linhas: deixe vazio para calcular pela quantidade de etiquetas. Informe quando a folha já vem cortada com um número fixo de linhas — o bloco fica centralizado na altura da folha. Rolo contínuo: use 1 linha e informe o espaço entre fileiras.
      </p>
    </div>
  );
}

const mmTexto = (mm: number) => `${Number(mm.toFixed(1)).toString().replace('.', ',')}mm`;

/** Margens calculadas e capacidade da folha (ou o motivo de não caber). */
export function ResumoLayoutFolha({ padrao }: { padrao: PadraoEtiqueta }) {
  const layout = calcularLayoutFolha(padrao);
  if (layout.erro) {
    return (
      <p className="text-xs text-destructive flex items-start gap-1">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
        <span>{layout.erro}</span>
      </p>
    );
  }
  return (
    <p className="text-[11px] text-muted-foreground">
      Margem lateral e espaço entre colunas: <strong className="text-foreground">{mmTexto(layout.margemLateralMm)}</strong>
      {' · '}
      {padrao.linhas === null
        ? <>linhas conforme a quantidade (até {layout.linhasPorFolha} por folha)</>
        : <>{padrao.colunas}×{padrao.linhas} = {layout.etiquetasPorFolha} por folha</>}
    </p>
  );
}

/**
 * Desenho em escala da primeira folha: posições puladas ("começar na posição")
 * tracejadas e as etiquetas que vão sair preenchidas.
 */
export function MiniaturaFolha({ padrao, vazias, ocupadas, larguraPx = 150, alturaMaxPx = 220 }: {
  padrao: PadraoEtiqueta;
  vazias: number;
  ocupadas: number;
  larguraPx?: number;
  /** Teto da altura do desenho — rolos longos encolhem em vez de esticar a tela. */
  alturaMaxPx?: number;
}) {
  const layout = calcularLayoutFolha(padrao);
  if (layout.erro) return null;
  const alturaFolhaMm = calcularAlturaFolha(padrao);
  const escala = Math.min(larguraPx / padrao.larguraFolhaMm, alturaMaxPx / alturaFolhaMm);
  const usadas = Math.min(vazias + ocupadas, layout.etiquetasPorFolha);
  // Folha corrida: desenha só as linhas que vão ser usadas (ex.: 12 etiquetas ÷ 3 colunas = 4 linhas).
  const linhas = padrao.linhas ?? Math.max(1, Math.ceil(usadas / padrao.colunas));
  const celulas = Array.from({ length: Math.min(linhas * padrao.colunas, layout.etiquetasPorFolha) }, (_, i) => i);

  return (
    <div
      className="relative bg-white border border-border shadow-sm shrink-0"
      style={{ width: padrao.larguraFolhaMm * escala, height: alturaFolhaMm * escala }}
      aria-label="Miniatura da primeira folha"
    >
      {celulas.map((i) => {
        const col = i % padrao.colunas;
        const lin = Math.floor(i / padrao.colunas);
        const estado = i < vazias ? 'vazia' : i < usadas ? 'usada' : 'livre';
        return (
          <div
            key={i}
            className={
              estado === 'usada'
                ? 'absolute bg-primary/70'
                : estado === 'vazia'
                  ? 'absolute border border-dashed border-muted-foreground/60'
                  : 'absolute border border-muted-foreground/30'
            }
            style={{
              left: (layout.margemLateralMm + col * (padrao.larguraMm + layout.margemLateralMm)) * escala,
              top: (layout.margemSuperiorMm + lin * (padrao.alturaMm + layout.espacoLinhasMm)) * escala,
              width: padrao.larguraMm * escala,
              height: padrao.alturaMm * escala,
            }}
          />
        );
      })}
    </div>
  );
}

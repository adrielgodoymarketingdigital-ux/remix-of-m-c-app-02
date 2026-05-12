import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Calculator,
  Settings,
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TaxasParcelado {
  p2: number; p3: number; p4: number; p5: number; p6: number;
  p7: number; p8: number; p9: number; p10: number; p11: number; p12: number;
}

interface Maquininha {
  id: string;
  nome: string;
  taxa_pix: number;
  taxa_debito: number;
  taxa_credito_1x: number;
  taxas_parcelado: TaxasParcelado;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "mec_precificador_maquininhas";

const ESTADOS_INTERESTADUAL: { label: string; aliquota: number; value: string }[] = [
  { value: "norte_nordeste_co", label: "Norte / Nordeste / Centro-Oeste", aliquota: 7 },
  { value: "sul_sudeste", label: "Sul / Sudeste (exceto SP)", aliquota: 12 },
  { value: "importado", label: "Produto importado", aliquota: 4 },
];

const ALIQ_SP = 18; // alíquota interna SP

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPct = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const parseNum = (v: string) => parseFloat(v.replace(",", ".")) || 0;

function calcularDifal(valorNota: number, frete: number, aliqInter: number) {
  const aliqDifal = ALIQ_SP - aliqInter;
  const baseDifal = valorNota + frete;
  const difal = baseDifal * (aliqDifal / 100);
  return { aliqDifal, baseDifal, difal };
}

function maquininhaNova(): Omit<Maquininha, "id"> {
  return {
    nome: "",
    taxa_pix: 0,
    taxa_debito: 0,
    taxa_credito_1x: 0,
    taxas_parcelado: { p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, p7: 0, p8: 0, p9: 0, p10: 0, p11: 0, p12: 0 },
  };
}

// ─── Componente de linha de taxas de cartão ───────────────────────────────────

interface LinhaCartaoProps {
  label: string;
  taxa: number;
  precoVenda: number;
  parcelas?: number;
}

function LinhaCartao({ label, taxa, precoVenda, parcelas }: LinhaCartaoProps) {
  const recebe = precoVenda * (1 - taxa / 100);
  const sugerido = taxa < 100 ? precoVenda / (1 - taxa / 100) : 0;
  const valorParcela = parcelas && parcelas > 1 ? sugerido / parcelas : null;

  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className="font-mono text-xs">
          {fmtPct(taxa)}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-emerald-400">
        {fmt(recebe)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-blue-400">
        {fmt(sugerido)}
      </TableCell>
      {valorParcela !== null ? (
        <TableCell className="text-right font-mono text-sm text-slate-400">
          {fmt(valorParcela)}/parcela
        </TableCell>
      ) : (
        <TableCell />
      )}
    </TableRow>
  );
}

// ─── Modal de maquininha ──────────────────────────────────────────────────────

interface ModalMaquininhaProps {
  open: boolean;
  onClose: () => void;
  onSalvar: (m: Omit<Maquininha, "id">) => void;
  inicial?: Maquininha | null;
}

function ModalMaquininha({ open, onClose, onSalvar, inicial }: ModalMaquininhaProps) {
  const [form, setForm] = useState<Omit<Maquininha, "id">>(maquininhaNova);

  useEffect(() => {
    setForm(inicial ? { ...inicial } : maquininhaNova());
  }, [inicial, open]);

  const setField = (field: keyof Omit<Maquininha, "id" | "taxas_parcelado">, val: string) =>
    setForm(f => ({ ...f, [field]: parseNum(val) }));

  const setParcelado = (key: keyof TaxasParcelado, val: string) =>
    setForm(f => ({ ...f, taxas_parcelado: { ...f.taxas_parcelado, [key]: parseNum(val) } }));

  const parcelas = ["p2","p3","p4","p5","p6","p7","p8","p9","p10","p11","p12"] as const;

  const handleSalvar = () => {
    if (!form.nome.trim()) return;
    onSalvar(form);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-400" />
            {inicial ? "Editar maquininha" : "Nova maquininha"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome da maquininha</Label>
            <Input
              placeholder="Ex: Cielo, Stone, PagSeguro..."
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Taxa Pix (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.taxa_pix || ""}
                onChange={e => setField("taxa_pix", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Taxa Débito (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.taxa_debito || ""}
                onChange={e => setField("taxa_debito", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Crédito 1x (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.taxa_credito_1x || ""}
                onChange={e => setField("taxa_credito_1x", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Crédito parcelado (taxa por número de parcelas)
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {parcelas.map((p, i) => (
                <div key={p} className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{i + 2}x (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    className="h-8 text-sm"
                    value={form.taxas_parcelado[p] || ""}
                    onChange={e => setParcelado(p, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={!form.nome.trim()}>
            Salvar maquininha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Precificador() {
  // ── Estado: calculadora ────────────────────────────────────────────────────
  const [valorNota, setValorNota] = useState("");
  const [fornecedorForaSP, setFornecedorForaSP] = useState(false);
  const [frete, setFrete] = useState("");
  const [estadoFornecedor, setEstadoFornecedor] = useState(ESTADOS_INTERESTADUAL[0].value);
  const [margem, setMargem] = useState("");
  const [maquininhaId, setMaquininhaId] = useState<string>("");

  // ── Estado: maquininhas ────────────────────────────────────────────────────
  const [maquininhas, setMaquininhas] = useState<Maquininha[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Maquininha | null>(null);

  // ── Persistência localStorage ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMaquininhas(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const persistir = useCallback((lista: Maquininha[]) => {
    setMaquininhas(lista);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  }, []);

  const salvarMaquininha = (dados: Omit<Maquininha, "id">) => {
    if (editando) {
      persistir(maquininhas.map(m => m.id === editando.id ? { ...dados, id: editando.id } : m));
    } else {
      const nova: Maquininha = { ...dados, id: crypto.randomUUID() };
      persistir([...maquininhas, nova]);
      if (!maquininhaId) setMaquininhaId(nova.id);
    }
    setEditando(null);
  };

  const excluirMaquininha = (id: string) => {
    persistir(maquininhas.filter(m => m.id !== id));
    if (maquininhaId === id) setMaquininhaId("");
  };

  // ── Cálculos ───────────────────────────────────────────────────────────────
  const vNota = parseNum(valorNota);
  const vFrete = fornecedorForaSP ? parseNum(frete) : 0;
  const vMargem = parseNum(margem);
  const estadoInfo = ESTADOS_INTERESTADUAL.find(e => e.value === estadoFornecedor)!;
  const aliqInter = fornecedorForaSP ? estadoInfo.aliquota : 0;

  const { aliqDifal, baseDifal, difal } = calcularDifal(vNota, vFrete, aliqInter);
  const custo = fornecedorForaSP ? baseDifal + difal : vNota;
  const precoVenda = vMargem > 0 && custo > 0 ? custo * (1 + vMargem / 100) : custo;

  // Comparativo SP vs Fora
  const custoSP = vNota;
  const { baseDifal: baseFora, difal: difalFora } = calcularDifal(vNota, vFrete, aliqInter);
  const custoFora = baseFora + difalFora;
  const spMaisBarato = custoSP <= custoFora;
  // Preço máximo que fornecedor de fora pode cobrar para compensar vs SP
  const aliqDifalNum = ALIQ_SP - aliqInter;
  const precoMaxFora = aliqDifalNum > 0
    ? (custoSP / (1 + aliqDifalNum / 100)) - vFrete
    : custoSP - vFrete;

  const maquininhaSel = maquininhas.find(m => m.id === maquininhaId) ?? null;

  const parcelas = ["p2","p3","p4","p5","p6","p7","p8","p9","p10","p11","p12"] as const;

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">

          {/* Cabeçalho */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Calculator className="h-7 w-7 text-blue-400" />
              Precificador
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Calcule preços, DIFAL e taxas de cartão em segundos
            </p>
          </div>

          <Tabs defaultValue="calculadora" className="w-full">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="calculadora" className="flex items-center gap-2 flex-1 sm:flex-none">
                <Calculator className="h-4 w-4" />
                Calculadora
              </TabsTrigger>
              <TabsTrigger value="configuracoes" className="flex items-center gap-2 flex-1 sm:flex-none">
                <Settings className="h-4 w-4" />
                Configurações
              </TabsTrigger>
            </TabsList>

            {/* ════════════════════════════════════════════════════════════
                ABA: CALCULADORA
            ════════════════════════════════════════════════════════════ */}
            <TabsContent value="calculadora" className="space-y-4 mt-4">

              {/* ── Seção A: Custo de compra ───────────────────────────── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Custo de compra</CardTitle>
                  <CardDescription>Informe o valor da nota e a origem do fornecedor</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Valor da nota fiscal (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={valorNota}
                        onChange={e => setValorNota(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Margem de lucro desejada (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0,0"
                        value={margem}
                        onChange={e => setMargem(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-white/10 p-3">
                    <Switch
                      checked={fornecedorForaSP}
                      onCheckedChange={setFornecedorForaSP}
                      id="fora-sp"
                    />
                    <Label htmlFor="fora-sp" className="cursor-pointer select-none">
                      Fornecedor fora de SP
                    </Label>
                  </div>

                  {fornecedorForaSP && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-200">
                      <div className="space-y-1.5">
                        <Label>Frete (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={frete}
                          onChange={e => setFrete(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Estado do fornecedor</Label>
                        <Select value={estadoFornecedor} onValueChange={setEstadoFornecedor}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ESTADOS_INTERESTADUAL.map(e => (
                              <SelectItem key={e.value} value={e.value}>
                                {e.label} — {e.aliquota}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Cards de resultado */}
                  {vNota > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <Card className="bg-slate-800/40 border-white/10">
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground mb-1">DIFAL</p>
                          <p className="text-xl font-bold font-mono text-amber-400">{fmt(difal)}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {fornecedorForaSP
                              ? `Alíquota: ${fmtPct(aliqDifal)} (${ALIQ_SP}% − ${aliqInter}%)`
                              : "Fornecedor em SP — sem DIFAL"}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-slate-800/40 border-white/10">
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground mb-1">Custo total</p>
                          <p className="text-xl font-bold font-mono text-red-400">{fmt(custo)}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Nota + Frete + DIFAL
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-slate-800/40 border-white/10">
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground mb-1">Preço de venda sugerido</p>
                          <p className="text-xl font-bold font-mono text-emerald-400">{fmt(precoVenda)}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Margem de {vMargem > 0 ? fmtPct(vMargem) : "0%"} sobre o custo
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Detalhamento linha a linha */}
                  {vNota > 0 && (
                    <div className="rounded-lg border border-white/10 bg-slate-800/20 p-4 space-y-2 text-sm">
                      <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-3">
                        Detalhamento
                      </p>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor da nota</span>
                        <span className="font-mono">{fmt(vNota)}</span>
                      </div>
                      {fornecedorForaSP && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frete</span>
                          <span className="font-mono">{fmt(vFrete)}</span>
                        </div>
                      )}
                      {fornecedorForaSP && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Base de cálculo DIFAL
                          </span>
                          <span className="font-mono">{fmt(baseDifal)}</span>
                        </div>
                      )}
                      {fornecedorForaSP && (
                        <div className="flex justify-between text-amber-400">
                          <span>DIFAL ({fmtPct(aliqDifal)})</span>
                          <span className="font-mono">+ {fmt(difal)}</span>
                        </div>
                      )}
                      <Separator className="my-1 opacity-20" />
                      <div className="flex justify-between font-semibold">
                        <span>Custo total</span>
                        <span className="font-mono text-red-400">{fmt(custo)}</span>
                      </div>
                      {vMargem > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Lucro ({fmtPct(vMargem)})</span>
                          <span className="font-mono">+ {fmt(precoVenda - custo)}</span>
                        </div>
                      )}
                      <Separator className="my-1 opacity-20" />
                      <div className="flex justify-between font-bold text-base">
                        <span>Preço de venda</span>
                        <span className="font-mono text-emerald-400">{fmt(precoVenda)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Seção B: Comparativo SP vs Fora ───────────────────── */}
              {vNota > 0 && fornecedorForaSP && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Comparativo: SP vs Fora do estado</CardTitle>
                    <CardDescription>Qual origem é mais vantajosa para este produto?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Card className={`border ${spMaisBarato ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/10 bg-slate-800/30"}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Fornecedor em SP</span>
                            {spMaisBarato && (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Mais barato
                              </Badge>
                            )}
                          </div>
                          <p className="text-2xl font-bold font-mono">{fmt(custoSP)}</p>
                          <p className="text-xs text-muted-foreground mt-1">Sem DIFAL, sem frete</p>
                        </CardContent>
                      </Card>

                      <Card className={`border ${!spMaisBarato ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/10 bg-slate-800/30"}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Fornecedor fora de SP</span>
                            {!spMaisBarato && (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Mais barato
                              </Badge>
                            )}
                          </div>
                          <p className="text-2xl font-bold font-mono">{fmt(custoFora)}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Com frete ({fmt(vFrete)}) + DIFAL ({fmt(difalFora)})
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
                      <TrendingDown className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-300">
                          Preço máximo para o fornecedor de fora compensar
                        </p>
                        <p className="text-xl font-bold font-mono mt-1">
                          {precoMaxFora > 0 ? fmt(precoMaxFora) : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Se o fornecedor de fora cobrar até esse valor na nota, o custo final fica igual ou menor ao de SP.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Seção C: Taxas de cartão ───────────────────────────── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-400" />
                    Taxas de cartão
                  </CardTitle>
                  <CardDescription>
                    Simule o que você recebe e o preço ideal para cada modalidade
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {maquininhas.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 p-6 text-center">
                      <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium">Nenhuma maquininha cadastrada</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Vá para a aba <strong>Configurações</strong> e cadastre sua maquininha.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <Label className="text-sm shrink-0">Maquininha:</Label>
                        <Select value={maquininhaId} onValueChange={setMaquininhaId}>
                          <SelectTrigger className="w-full sm:w-64">
                            <SelectValue placeholder="Selecione uma maquininha" />
                          </SelectTrigger>
                          <SelectContent>
                            {maquininhas.map(m => (
                              <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {maquininhaSel && precoVenda > 0 ? (
                        <div className="rounded-md border border-white/10 overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent border-white/10">
                                <TableHead>Modalidade</TableHead>
                                <TableHead className="text-center">Taxa</TableHead>
                                <TableHead className="text-right">Você recebe</TableHead>
                                <TableHead className="text-right">Preço sugerido</TableHead>
                                <TableHead />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <LinhaCartao label="Pix" taxa={maquininhaSel.taxa_pix} precoVenda={precoVenda} />
                              <LinhaCartao label="Débito" taxa={maquininhaSel.taxa_debito} precoVenda={precoVenda} />
                              <LinhaCartao label="Crédito 1x" taxa={maquininhaSel.taxa_credito_1x} precoVenda={precoVenda} />
                              {parcelas.map((p, i) => (
                                <LinhaCartao
                                  key={p}
                                  label={`Crédito ${i + 2}x`}
                                  taxa={maquininhaSel.taxas_parcelado[p]}
                                  precoVenda={precoVenda}
                                  parcelas={i + 2}
                                />
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : maquininhaSel && precoVenda === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg border border-white/10 bg-slate-800/20">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          Informe o valor da nota e a margem para ver os valores por modalidade.
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Nota de rodapé */}
              <p className="text-xs text-muted-foreground text-center pb-2">
                Valores estimados. Confirme DIFAL e obrigações fiscais com seu contador.
              </p>
            </TabsContent>

            {/* ════════════════════════════════════════════════════════════
                ABA: CONFIGURAÇÕES
            ════════════════════════════════════════════════════════════ */}
            <TabsContent value="configuracoes" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-400" />
                        Maquininhas
                      </CardTitle>
                      <CardDescription>
                        Gerencie as taxas de cada maquininha que você usa
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => { setEditando(null); setModalAberto(true); }}
                      className="gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      Nova maquininha
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {maquininhas.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 p-8 text-center">
                      <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="font-medium">Nenhuma maquininha cadastrada</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Clique em "Nova maquininha" para adicionar suas taxas.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {maquininhas.map(m => (
                        <Card key={m.id} className="bg-slate-800/30 border-white/10">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-base truncate">{m.nome}</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs font-mono">
                                    Pix {fmtPct(m.taxa_pix)}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs font-mono">
                                    Débito {fmtPct(m.taxa_debito)}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs font-mono">
                                    1x {fmtPct(m.taxa_credito_1x)}
                                  </Badge>
                                  {parcelas.map((p, i) => (
                                    <Badge key={p} variant="outline" className="text-xs font-mono">
                                      {i + 2}x {fmtPct(m.taxas_parcelado[p])}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-white"
                                  onClick={() => { setEditando(m); setModalAberto(true); }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-red-400"
                                  onClick={() => excluirMaquininha(m.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground text-center pb-2">
                Valores estimados. Confirme DIFAL e obrigações fiscais com seu contador.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <ModalMaquininha
        open={modalAberto}
        onClose={() => { setModalAberto(false); setEditando(null); }}
        onSalvar={salvarMaquininha}
        inicial={editando}
      />
    </AppLayout>
  );
}

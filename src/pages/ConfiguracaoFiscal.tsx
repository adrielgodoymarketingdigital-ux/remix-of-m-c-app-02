import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AlertTriangle, BadgeCheck, ChevronRight, KeyRound, Loader2, PlugZap, ShieldAlert } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AVISO_RESPONSABILIDADE_FISCAL } from "@/components/fiscal/SecaoDadosFiscais";
import { useFiscalVisivelStatus } from "@/hooks/useFiscalVisivel";
import { useConfigFiscal, type ConfigFiscal, type DadosConfigFiscal } from "@/hooks/useConfigFiscal";
import { useIdentidade } from "@/hooks/useResolvedUserId";
import { toast } from "sonner";

const REGIMES: { value: string; label: string }[] = [
  { value: "mei", label: "MEI" },
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
];
const SEM_REGIME = "__sem_regime__";

type CamposForm = Record<keyof DadosConfigFiscal, string>;

const FORM_VAZIO: CamposForm = {
  regime_tributario: "",
  cnae: "",
  codigo_ibge_municipio: "",
  serie_nfse: "",
  serie_nfe: "",
  serie_nfce: "",
};

const formDaConfig = (c: ConfigFiscal | null): CamposForm => ({
  regime_tributario: c?.regime_tributario ?? "",
  cnae: c?.cnae ?? "",
  codigo_ibge_municipio: c?.codigo_ibge_municipio ?? "",
  serie_nfse: c?.serie_nfse ?? "",
  serie_nfe: c?.serie_nfe ?? "",
  serie_nfce: c?.serie_nfce ?? "",
});

/** Texto vazio vira null; a Edge Function valida e normaliza o resto. */
const paraEnvio = (f: CamposForm): DadosConfigFiscal => {
  const n = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    regime_tributario: n(f.regime_tributario),
    cnae: n(f.cnae),
    codigo_ibge_municipio: n(f.codigo_ibge_municipio),
    serie_nfse: n(f.serie_nfse),
    serie_nfe: n(f.serie_nfe),
    serie_nfce: n(f.serie_nfce),
  };
};

/**
 * Configurações › Fiscal (etapa 2B): só admin (useFiscalVisivel), só a matriz
 * (fiscal_config com empresa_id nulo). Lê direto do Supabase (RLS) e grava
 * pela Edge Function fiscal-config-salvar. Ambiente fica em homologação e
 * "ativo" desligado; certificado e Spedy são só informativos nesta etapa.
 */
export default function ConfiguracaoFiscal() {
  const { visivel, carregando: carregandoVisibilidade } = useFiscalVisivelStatus();
  const { isFilial, carregando: carregandoIdentidade } = useIdentidade();
  const { config, carregando, erro, salvar } = useConfigFiscal(visivel);
  const [form, setForm] = useState<CamposForm>(FORM_VAZIO);

  useEffect(() => {
    setForm(formDaConfig(config));
  }, [config]);

  if (carregandoVisibilidade) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!visivel) return <Navigate to="/dashboard" replace />;

  // Filial: não lê nem grava aqui (evita a matriz gravar e a filial ler outra linha).
  const bloqueadoFilial = !carregandoIdentidade && isFilial;
  const desabilitado = bloqueadoFilial || carregandoIdentidade || carregando || salvar.isPending;
  const alterar = (campo: keyof CamposForm, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bloqueadoFilial) return;
    try {
      const salva = await salvar.mutateAsync(paraEnvio(form));
      setForm(formDaConfig(salva));
      toast.success("Configuração fiscal salva.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a configuração fiscal.");
    }
  };

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6">
          <div className="lg:pt-6">
            <nav aria-label="Caminho" className="flex items-center gap-1 text-sm text-muted-foreground">
              <Link to="/configuracoes" className="hover:text-foreground">Configurações</Link>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              <span className="text-foreground">Fiscal</span>
            </nav>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-[28px]">Fiscal</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dados da loja para emissão de notas fiscais. Nada é emitido nesta etapa.
            </p>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Responsabilidade</AlertTitle>
            <AlertDescription>{AVISO_RESPONSABILIDADE_FISCAL}</AlertDescription>
          </Alert>

          {bloqueadoFilial && (
            <Alert variant="destructive" data-testid="aviso-filial-fiscal">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Você está operando uma filial</AlertTitle>
              <AlertDescription>
                Por enquanto a configuração fiscal é só da matriz. Volte para a matriz para editar; nada é gravado a
                partir da filial.
              </AlertDescription>
            </Alert>
          )}

          {erro && (
            <Alert variant="destructive">
              <AlertDescription>Não foi possível carregar a configuração fiscal.</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSalvar} className="space-y-5 sm:space-y-6">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Dados da empresa</CardTitle>
                <CardDescription>Matriz. Confira com o seu contador.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fiscal-regime">Regime tributário</Label>
                  <Select
                    value={form.regime_tributario || SEM_REGIME}
                    onValueChange={(v) => alterar("regime_tributario", v === SEM_REGIME ? "" : v)}
                    disabled={desabilitado}
                  >
                    <SelectTrigger id="fiscal-regime"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_REGIME}>Não informado</SelectItem>
                      {REGIMES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fiscal-cnae">CNAE</Label>
                    <Input id="fiscal-cnae" inputMode="numeric" placeholder="9511-8/00" maxLength={12}
                      value={form.cnae} disabled={desabilitado} onChange={(e) => alterar("cnae", e.target.value)} />
                    <p className="text-xs text-muted-foreground">7 dígitos, com ou sem pontuação.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fiscal-ibge">Código IBGE do município</Label>
                    <Input id="fiscal-ibge" inputMode="numeric" placeholder="3550308" maxLength={7}
                      value={form.codigo_ibge_municipio} disabled={desabilitado}
                      onChange={(e) => alterar("codigo_ibge_municipio", e.target.value)} />
                    <p className="text-xs text-muted-foreground">7 dígitos (ex.: São Paulo = 3550308).</p>
                  </div>
                </div>
                <div className="grid gap-4 grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fiscal-serie-nfse">Série NFS-e</Label>
                    <Input id="fiscal-serie-nfse" maxLength={5} value={form.serie_nfse} disabled={desabilitado}
                      onChange={(e) => alterar("serie_nfse", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fiscal-serie-nfe">Série NF-e</Label>
                    <Input id="fiscal-serie-nfe" inputMode="numeric" maxLength={3} value={form.serie_nfe}
                      disabled={desabilitado} onChange={(e) => alterar("serie_nfe", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fiscal-serie-nfce">Série NFC-e</Label>
                    <Input id="fiscal-serie-nfce" inputMode="numeric" maxLength={3} value={form.serie_nfce}
                      disabled={desabilitado} onChange={(e) => alterar("serie_nfce", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Ambiente e status</CardTitle>
                <CardDescription>Produção e ativação ainda não estão disponíveis.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fiscal-ambiente">Ambiente</Label>
                  <Select value="homologacao" disabled>
                    <SelectTrigger id="fiscal-ambiente" data-testid="fiscal-ambiente"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologacao">Homologação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <Label htmlFor="fiscal-ativo" className="font-normal">Emissão ativa</Label>
                  <Switch id="fiscal-ativo" checked={false} disabled aria-readonly="true" />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="rounded-2xl">
                <CardContent className="flex gap-3 pt-6">
                  <KeyRound className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="font-medium">Certificado digital: não configurado</p>
                    <p className="text-sm text-muted-foreground">
                      O certificado (.pfx) e a senha dele NÃO são guardados no MecApp.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardContent className="flex gap-3 pt-6">
                  <PlugZap className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="font-medium">Spedy: não conectado</p>
                    <p className="text-sm text-muted-foreground">A conexão com a emissora vem numa próxima etapa.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-end gap-3">
              {config && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Configuração salva
                </span>
              )}
              <Button type="submit" disabled={desabilitado} className="w-full sm:w-auto">
                {salvar.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </AppLayout>
  );
}

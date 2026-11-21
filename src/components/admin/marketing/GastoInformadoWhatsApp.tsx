import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";
import { validarGastoInformado } from "@/lib/marketing/custoWhatsApp";
import {
  formatarCentavos,
  formatarDataBR,
  mensagemRecusaGasto,
  type LancamentoGasto,
} from "@/lib/marketing/funilWhatsApp";
import {
  useAdminCrmGastos,
  useInformarGastoWhatsApp,
  useRemoverGastoWhatsApp,
  type ErroFunilWhatsApp,
} from "@/hooks/useAdminCrmFunil";

const MAX_DESCRICAO = 200;

/**
 * Gasto de anúncios de WhatsApp informado à mão. Grava SÓ pelas funções
 * admin_crm_gasto_informar / admin_crm_gasto_remover (conferem has_role).
 * A validação local é a mesma da função (validarGastoInformado); a função
 * também recusa sobreposição de período.
 */
export function GastoInformadoWhatsApp({ habilitado, comGastoAutomatico = false }: { habilitado: boolean; comGastoAutomatico?: boolean }) {
  const hoje = dataBrasiliaISO();
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState(hoje);
  const [valor, setValor] = useState("");
  const [adId, setAdId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [remover, setRemover] = useState<LancamentoGasto | null>(null);

  const gastos = useAdminCrmGastos(habilitado);
  const informar = useInformarGastoWhatsApp();
  const removerGasto = useRemoverGastoWhatsApp();

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (descricao.trim().length > MAX_DESCRICAO) { setErro(mensagemRecusaGasto("descricao_longa")); return; }
    const v = validarGastoInformado({ inicio, fim, valor, adId }, hoje);
    if ("erro" in v) { setErro(mensagemRecusaGasto(v.erro)); return; }
    informar.mutate(
      { inicio: v.inicio, fim: v.fim, valorCentavos: v.valorCentavos, adId: v.adId, descricao: descricao.trim() || null },
      {
        onSuccess: () => {
          toast.success("Gasto informado.");
          setValor(""); setAdId(""); setDescricao("");
        },
        onError: (err) => setErro(mensagemRecusaGasto(err as ErroFunilWhatsApp)),
      },
    );
  };

  const confirmarRemocao = () => {
    if (!remover) return;
    removerGasto.mutate(remover.id, {
      onSuccess: (ok) => {
        if (ok) toast.success("Lançamento removido.");
        else toast.error("Esse lançamento já tinha sido removido.");
        setRemover(null);
      },
      onError: () => { toast.error("Não foi possível remover. Tente de novo."); setRemover(null); },
    });
  };

  return (
    <div className="space-y-4" data-testid="gasto-informado-whatsapp">
      <form onSubmit={salvar} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div className="space-y-1">
          <Label htmlFor="gasto-inicio" className="text-xs">Início</Label>
          <Input id="gasto-inicio" type="date" value={inicio} max={hoje} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gasto-fim" className="text-xs">Fim</Label>
          <Input id="gasto-fim" type="date" value={fim} max={hoje} onChange={(e) => setFim(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gasto-valor" className="text-xs">Valor (R$)</Label>
          <Input id="gasto-valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gasto-anuncio" className="text-xs">ID do anúncio (opcional)</Label>
          <Input id="gasto-anuncio" placeholder="geral" value={adId} onChange={(e) => setAdId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gasto-obs" className="text-xs">Observação</Label>
          <Input id="gasto-obs" maxLength={MAX_DESCRICAO} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <Button type="submit" disabled={!habilitado || informar.isPending} className="gap-2">
          {informar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Informar gasto
        </Button>
      </form>
      {erro && <p className="text-sm text-destructive" role="alert" data-testid="erro-gasto">{erro}</p>}
      <p className="text-xs text-muted-foreground">
        Sem ID do anúncio = gasto geral das campanhas de WhatsApp. O período não pode se sobrepor a outro lançamento do
        mesmo anúncio, nem a um lançamento geral.
      </p>
      {comGastoAutomatico && (
        <p className="text-xs text-muted-foreground" data-testid="aviso-informado-ignorado">
          Nos dias em que a Meta mandou gasto do anúncio, o informado dele é ignorado; o geral é ignorado em todo dia com
          dado da Meta. Nunca se somam os dois.
        </p>
      )}

      {gastos.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : gastos.isError ? (
        <p className="text-sm text-muted-foreground">Não foi possível carregar os lançamentos.</p>
      ) : (gastos.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum gasto informado.</p>
      ) : (
        <ul className="divide-y rounded-lg border" data-testid="lista-gastos">
          {(gastos.data ?? []).map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium tabular-nums">{formatarCentavos(g.valorCentavos)}</span>
                <span className="text-muted-foreground"> · {formatarDataBR(g.inicio)} a {formatarDataBR(g.fim)}</span>
                <span className="text-muted-foreground"> · {g.adId ? `anúncio ${g.adId}` : "geral"}</span>
                {g.descricao && <span className="block truncate text-xs text-muted-foreground" title={g.descricao}>{g.descricao}</span>}
              </div>
              <Button variant="ghost" size="icon" aria-label="Remover lançamento" onClick={() => setRemover(g)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={remover !== null} onOpenChange={(aberto) => !aberto && setRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento de gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              {remover && `${formatarCentavos(remover.valorCentavos)} de ${formatarDataBR(remover.inicio)} a ${formatarDataBR(remover.fim)} (${remover.adId ? `anúncio ${remover.adId}` : "geral"}). `}
              Os custos do funil passam a ser calculados sem ele. O registro fica no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removerGasto.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmarRemocao(); }}
              disabled={removerGasto.isPending}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

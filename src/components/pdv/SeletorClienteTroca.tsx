import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, User, UserCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { documentoDoCliente } from "@/lib/clientes/dadosCliente";
import { filtrarClientesTroca, secaoClienteTroca } from "@/lib/vendas/entradaTrocaForm";
import type { Cliente } from "@/types/cliente";

interface SeletorClienteTrocaProps {
  /** Lista já carregada pelo PDV (useClientes). Ausente = sem campo de busca. */
  clientes?: Cliente[];
  /** Cliente da venda no PDV: botão "Usar cliente da venda". */
  clienteVenda?: Cliente | null;
  busca: string;
  onBuscaChange: (valor: string) => void;
  /** Nome do cliente cujos dados foram copiados (só para o aviso). */
  escolhido: string | null;
  onEscolher: (cliente: Cliente) => void;
  onLimparEscolha: () => void;
}

/**
 * Busca de cliente cadastrado para preencher quem ENTREGA o aparelho na troca.
 * Só filtra a lista recebida (nada vai ao banco, nada é gravado, não cria
 * cliente). A lista de sugestões fica no fluxo do diálogo (sem portal), para
 * rolar junto com ele no celular.
 */
export function SeletorClienteTroca({
  clientes,
  clienteVenda,
  busca,
  onBuscaChange,
  escolhido,
  onEscolher,
  onLimparEscolha,
}: SeletorClienteTrocaProps) {
  const { t } = useTranslation("pdv");
  const secao = secaoClienteTroca({ clientes, clienteVenda });
  const sugestoes = useMemo(() => (clientes ? filtrarClientesTroca(clientes, busca) : []), [clientes, busca]);

  if (!secao.busca && !secao.usarClienteVenda) return null;

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3" data-secao="cliente-troca">
      <p className="text-xs font-medium text-muted-foreground">{t("entradaTroca.clienteTitulo")}</p>

      {secao.usarClienteVenda && clienteVenda && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 h-auto min-h-9 whitespace-normal text-left"
          onClick={() => onEscolher(clienteVenda)}
        >
          <UserCheck className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{t("entradaTroca.usarClienteVenda", { nome: clienteVenda.nome })}</span>
        </Button>
      )}

      {secao.busca && (
        <div className="space-y-1">
          <Label htmlFor="busca-cliente-troca" className="text-xs">{t("entradaTroca.clienteBuscaRotulo")}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="busca-cliente-troca"
              className="pl-9"
              placeholder={t("entradaTroca.clienteBuscaPlaceholder")}
              value={busca}
              onChange={(e) => onBuscaChange(e.target.value)}
              autoComplete="off"
              maxLength={100}
            />
          </div>
          {busca.trim() && (
            <div className="rounded-md border bg-background p-1" role="listbox" aria-label={t("entradaTroca.clienteBuscaRotulo")}>
              {sugestoes.length > 0 ? (
                sugestoes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-muted"
                    onClick={() => onEscolher(c)}
                  >
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.nome}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[c.telefone, documentoDoCliente(c)].filter(Boolean).join(" • ")}
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="p-2 text-sm text-muted-foreground">{t("entradaTroca.clienteNenhum")}</p>
              )}
            </div>
          )}
        </div>
      )}

      {escolhido && (
        <div className="flex items-start justify-between gap-2 rounded-md bg-primary/5 p-2 text-xs">
          <span className="min-w-0 break-words" data-aviso="cliente-copiado">{t("entradaTroca.clienteCopiado", { nome: escolhido })}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onLimparEscolha}
            aria-label={t("entradaTroca.clienteLimparAviso")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

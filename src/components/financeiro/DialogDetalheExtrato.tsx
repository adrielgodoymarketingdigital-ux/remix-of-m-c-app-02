import { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Loader2 } from "lucide-react";
import { formatDataVenda, formatPhone } from "@/lib/formatters";
import { nomeFormaPagamento } from "@/lib/formaPagamento";
import { getNomeItem } from "@/lib/vendas/itensVenda";
import { valorLinhaServico } from "@/lib/ordemServico/totaisPecasOS";
import type { Venda } from "@/types/venda";
import type { EventoExtrato } from "@/hooks/useExtratoFinanceiro";
import { OrdemDetalheExtrato, TrocaDetalheExtrato, useDetalheExtrato } from "@/hooks/useDetalheExtrato";

interface DialogDetalheExtratoProps {
  /** Linha do Extrato cujo detalhe é mostrado; null = fechado. */
  evento: EventoExtrato | null;
  onOpenChange: (open: boolean) => void;
}

const Secao = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <section className="space-y-1.5">
    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{titulo}</h3>
    {children}
  </section>
);

const LinhaValor = ({ rotulo, valor, destaque = false, negativo = false }: { rotulo: ReactNode; valor: number; destaque?: boolean; negativo?: boolean }) => (
  <div className={`flex items-start justify-between gap-3 text-sm ${destaque ? "font-semibold" : ""}`}>
    <span className="min-w-0 break-words">{rotulo}</span>
    <span className="shrink-0">
      {negativo && "− "}
      <ValorMonetario valor={valor} />
    </span>
  </div>
);

const Cliente = ({ cliente }: { cliente?: { nome: string; telefone: string | null } | null }) => (
  <Secao titulo="Cliente">
    {cliente ? (
      <p className="text-sm">
        {cliente.nome}
        {cliente.telefone && <span className="text-muted-foreground"> · {formatPhone(cliente.telefone)}</span>}
      </p>
    ) : (
      <p className="text-sm text-muted-foreground">Não informado</p>
    )}
  </Secao>
);

const num = (v: unknown) => Number(v) || 0;

function DetalheVenda({ linhas, troca }: { linhas: Venda[]; troca: TrocaDetalheExtrato | null }) {
  const primeira = linhas[0];
  // Parcelado "a receber" grava uma linha por parcela de cada item: junta as parcelas do mesmo item.
  const itens = new Map<string, { nome: string; quantidade: number; total: number }>();
  for (const v of linhas) {
    const chave = v.dispositivo_id ?? v.produto_id ?? v.peca_id ?? getNomeItem(v);
    const item = itens.get(chave);
    if (item) item.total += num(v.total);
    else itens.set(chave, { nome: getNomeItem(v), quantidade: num(v.quantidade) || 1, total: num(v.total) });
  }

  const subtotal = linhas.reduce((acc, v) => acc + num(v.total), 0);
  const desconto = linhas.reduce((acc, v) => acc + num(v.valor_desconto_manual) + num(v.valor_desconto_cupom), 0);
  const total = Math.max(0, subtotal - desconto);

  // A 2ª forma (pagamento duplo) é repetida em todas as linhas da venda — vale a de uma só.
  // Venda com troca grava a fatia de cada item (ver planejarTroca): aí a 2ª forma é a soma.
  const segundaForma = primeira.segunda_forma_pagamento;
  const comTroca = linhas.some((v) => v.valor_troca != null);
  const valorSegundaGravado = comTroca
    ? linhas.reduce((acc, v) => acc + num(v.valor_segunda_forma), 0)
    : num(primeira.valor_segunda_forma);
  const valorSegunda = segundaForma ? Math.min(valorSegundaGravado, total) : 0;
  const parcelas = primeira.total_parcelas && primeira.total_parcelas > 1 ? primeira.total_parcelas : null;
  const porCompetencia = primeira.forma_pagamento === "a_receber" || primeira.forma_pagamento === "a_prazo";
  const parcelasRecebidas = new Set(linhas.filter((v) => v.recebido).map((v) => v.parcela_numero ?? 1)).size;

  return (
    <div className="space-y-4">
      <Cliente cliente={primeira.clientes} />

      <Secao titulo="Itens">
        {[...itens.entries()].map(([chave, item]) => (
          <LinhaValor
            key={chave}
            rotulo={<>{item.quantidade > 1 && <span className="text-muted-foreground">{item.quantidade}× </span>}{item.nome}</>}
            valor={item.total}
          />
        ))}
      </Secao>

      <Secao titulo="Valores">
        {desconto > 0 && (
          <>
            <LinhaValor rotulo="Subtotal" valor={subtotal} />
            <LinhaValor rotulo="Desconto" valor={desconto} negativo />
          </>
        )}
        <LinhaValor rotulo="Total" valor={total} destaque />
      </Secao>

      <Secao titulo="Pagamento">
        <LinhaValor
          rotulo={<>{nomeFormaPagamento(primeira.forma_pagamento, primeira.observacoes)}{parcelas && ` em ${parcelas}×`}</>}
          valor={total - valorSegunda}
        />
        {segundaForma && valorSegunda > 0 && (
          <LinhaValor rotulo={nomeFormaPagamento(segundaForma)} valor={valorSegunda} />
        )}
        {porCompetencia && (
          <p className="text-xs text-muted-foreground">
            {parcelas
              ? `${parcelasRecebidas} de ${parcelas} parcelas recebidas`
              : parcelasRecebidas > 0 ? "Recebido" : "Ainda não recebido"}
          </p>
        )}
      </Secao>

      {troca && (
        <Secao titulo="Troca de aparelho">
          <LinhaValor rotulo="Aparelho recebido" valor={troca.valorEntrada} />
          {troca.valorDevolvido > 0 && (
            <LinhaValor
              rotulo={`Devolvido ao cliente (${troca.formaDevolucao === "pix" ? "Pix" : "Dinheiro"})`}
              valor={troca.valorDevolvido}
            />
          )}
          {troca.cancelada && <p className="text-xs text-muted-foreground">Troca cancelada junto com a venda.</p>}
        </Secao>
      )}
    </div>
  );
}

function DetalheOrdem({ ordem }: { ordem: OrdemDetalheExtrato }) {
  const servicos = ordem.avarias?.servicos_realizados ?? [];
  const pecas = ordem.avarias?.produtos_utilizados ?? [];
  const custosRepassados = (ordem.avarias?.custos_adicionais ?? []).filter((c) => c.repassar_cliente);
  const pagamento = ordem.avarias?.dados_pagamento;
  const forma = pagamento?.forma ?? ordem.forma_pagamento;
  const entrada = num(pagamento?.entrada);
  const temItens = servicos.length + pecas.length + custosRepassados.length > 0;

  return (
    <div className="space-y-4">
      <Cliente cliente={ordem.cliente} />

      <Secao titulo="Aparelho">
        <p className="text-sm">{`${ordem.dispositivo_marca} ${ordem.dispositivo_modelo}`.trim()}</p>
        {ordem.defeito_relatado && <p className="text-xs text-muted-foreground break-words">{ordem.defeito_relatado}</p>}
      </Secao>

      <Secao titulo="Serviços e peças">
        {!temItens && <p className="text-sm text-muted-foreground">Nenhum item detalhado nesta OS.</p>}
        {servicos.map((s, i) => (
          <LinhaValor key={`s-${s.id}-${i}`} rotulo={s.nome} valor={valorLinhaServico(s)} />
        ))}
        {pecas.map((p, i) => (
          <LinhaValor
            key={`p-${p.id}-${i}`}
            rotulo={<>{p.quantidade > 1 && <span className="text-muted-foreground">{p.quantidade}× </span>}{p.nome}</>}
            valor={num(p.preco_total)}
          />
        ))}
        {custosRepassados.map((c) => (
          <LinhaValor key={`c-${c.id}`} rotulo={c.descricao || "Custo adicional"} valor={num(c.valor)} />
        ))}
      </Secao>

      <Secao titulo="Valores">
        {num(pagamento?.desconto) > 0 && (
          <>
            <LinhaValor rotulo="Subtotal" valor={num(pagamento?.subtotal)} />
            <LinhaValor rotulo="Desconto" valor={num(pagamento?.desconto)} negativo />
          </>
        )}
        <LinhaValor rotulo="Total" valor={num(ordem.total)} destaque />
      </Secao>

      <Secao titulo="Pagamento">
        <p className="text-sm">
          {nomeFormaPagamento(forma)}
          {pagamento?.parcelas && pagamento.parcelas > 1 && ` em ${pagamento.parcelas}×`}
        </p>
        {entrada > 0 && (
          <>
            <LinhaValor rotulo="Entrada" valor={entrada} />
            <LinhaValor
              rotulo={pagamento?.saldo_cancelado ? "Saldo (cancelado)" : "Saldo"}
              valor={num(pagamento?.saldo)}
            />
          </>
        )}
      </Secao>
    </div>
  );
}

/** Popup resumido de uma linha do Extrato (venda ou OS): itens, valores, pagamento e cliente. */
export function DialogDetalheExtrato({ evento, onOpenChange }: DialogDetalheExtratoProps) {
  const { data, isLoading, isError } = useDetalheExtrato(evento);

  const titulo = data?.tipo === "os"
    ? `OS ${data.ordem.numero_os}`
    : data?.tipo === "venda"
      ? (data.linhas[0]?.numero_venda ? `Venda ${data.linhas[0].numero_venda}` : "Venda")
      : evento?.origem === "ordem_servico" ? "Ordem de Serviço" : "Venda";
  const dataRegistro = data?.tipo === "venda" && data.linhas[0] ? formatDataVenda(data.linhas[0].data) : null;

  return (
    <Dialog open={!!evento} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {dataRegistro ?? (evento ? `Lançado no extrato em ${evento.data.split("-").reverse().join("/")}` : "")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive py-4">Não foi possível carregar os detalhes.</p>
        ) : !data || (data.tipo === "venda" && data.linhas.length === 0) ? (
          <p className="text-sm text-muted-foreground py-4">Registro não encontrado.</p>
        ) : data.tipo === "os" ? (
          <DetalheOrdem ordem={data.ordem} />
        ) : (
          <DetalheVenda linhas={data.linhas} troca={data.troca} />
        )}
      </DialogContent>
    </Dialog>
  );
}

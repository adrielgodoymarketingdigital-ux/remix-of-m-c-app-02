import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Smartphone,
  User,
  Building2,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  FileText,
  ChevronRight,
} from "lucide-react";
import { CompraDispositivo } from "@/types/origem";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { downloadPDFRobust } from "@/lib/downloadPDF";

interface ListaComprasMobileProps {
  compras: CompraDispositivo[];
  loading: boolean;
  onVerDetalhes: (compra: CompraDispositivo) => void;
  onEditar: (compra: CompraDispositivo) => void;
  onExcluir: (id: string) => Promise<void>;
  onEditarDispositivo?: (dispositivoId: string) => void;
  onExcluirDispositivo?: (dispositivoId: string) => void;
}

const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_debito: "Débito",
  cartao_credito: "Crédito",
  transferencia: "Transferência",
  boleto: "Boleto",
};

/**
 * Versão em cards da lista de compras, só pro mobile (< 768px) —
 * TabelaCompras.tsx (a <table>) continua sendo o que o desktop usa, sem
 * nenhuma mudança. Mesma interface de props, drop-in: quem chama não sabe
 * qual das duas está renderizando.
 */
export function ListaComprasMobile({
  compras,
  loading,
  onVerDetalhes,
  onEditar,
  onExcluir,
  onEditarDispositivo,
  onExcluirDispositivo,
}: ListaComprasMobileProps) {
  const [compraParaExcluir, setCompraParaExcluir] = useState<CompraDispositivo | null>(null);
  const [dispositivoParaExcluir, setDispositivoParaExcluir] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    );
  }

  if (compras.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-base">Nenhuma compra registrada</p>
        <p className="text-sm mt-2">Toque em "Nova Compra" para começar</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {compras.map((compra) => {
          const nome = compra.origem_pessoas?.nome || compra.fornecedores?.nome || "N/A";
          const isFornecedor = !compra.pessoa_id && !!compra.fornecedor_id;
          const tipoPessoa = compra.origem_pessoas?.tipo;

          return (
            <article
              key={compra.id}
              className="bg-card border rounded-2xl p-3 shadow-sm active:bg-muted/40 transition-colors"
            >
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onVerDetalhes(compra)}
                  className="flex gap-3 flex-1 min-w-0 text-left"
                >
                  <div className="w-16 h-[72px] shrink-0 rounded-xl bg-muted grid place-items-center">
                    <Smartphone className="h-7 w-7 text-muted-foreground" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground mb-0.5">
                      {format(new Date(compra.data_compra), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                    <h3 className="font-semibold text-sm truncate mb-0.5">{nome}</h3>
                    {compra.origem_pessoas?.cpf_cnpj && (
                      <div className="text-xs text-muted-foreground mb-1.5">
                        {compra.origem_pessoas.cpf_cnpj}
                      </div>
                    )}

                    {tipoPessoa && (
                      <Badge variant="secondary" className="gap-1 font-normal text-[10px] h-5 mb-2">
                        {tipoPessoa === "juridica" ? (
                          <Building2 className="h-3 w-3" />
                        ) : (
                          <User className="h-3 w-3" />
                        )}
                        {tipoPessoa === "juridica" ? "Pessoa Jurídica" : "Pessoa Física"}
                      </Badge>
                    )}

                    <div className="text-sm font-semibold mb-1">
                      {compra.dispositivos?.marca} {compra.dispositivos?.modelo}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isFornecedor ? "bg-orange-500" : "bg-blue-500"
                        }`}
                      />
                      Origem: {isFornecedor ? "Fornecedor" : "Pessoa"}
                      <span className="text-muted-foreground/50">•</span>
                      <ValorMonetario valor={compra.valor_pago} tipo="preco" />
                      <span className="text-muted-foreground/50">•</span>
                      {FORMA_PAGAMENTO_LABEL[compra.forma_pagamento] || compra.forma_pagamento}
                    </div>
                  </div>
                </button>

                <div className="flex flex-col items-center justify-between shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1.5 -mt-1">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onVerDetalhes(compra)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEditar(compra)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar compra
                      </DropdownMenuItem>
                      {compra.termo_pdf_url && (
                        <DropdownMenuItem
                          onClick={() =>
                            downloadPDFRobust({
                              url: compra.termo_pdf_url!,
                              filename: `recibo-legal-${compra.id}.pdf`,
                            })
                          }
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Baixar recibo
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {onEditarDispositivo && (
                        <DropdownMenuItem onClick={() => onEditarDispositivo(compra.dispositivo_id)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar dispositivo
                        </DropdownMenuItem>
                      )}
                      {onExcluirDispositivo && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDispositivoParaExcluir(compra.dispositivo_id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir dispositivo
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setCompraParaExcluir(compra)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir compra
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button type="button" onClick={() => onVerDetalhes(compra)} className="p-1.5">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <AlertDialog open={!!compraParaExcluir} onOpenChange={(open) => !open && setCompraParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta compra? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                if (compraParaExcluir) await onExcluir(compraParaExcluir.id);
                setCompraParaExcluir(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!dispositivoParaExcluir} onOpenChange={(open) => !open && setDispositivoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir dispositivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Atenção: este dispositivo está vinculado a uma compra. Você deve excluir a compra primeiro antes de
              excluir o dispositivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (dispositivoParaExcluir && onExcluirDispositivo) onExcluirDispositivo(dispositivoParaExcluir);
                setDispositivoParaExcluir(null);
              }}
            >
              Tentar Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

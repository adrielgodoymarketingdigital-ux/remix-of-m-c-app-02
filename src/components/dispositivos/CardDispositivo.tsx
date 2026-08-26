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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShoppingCart, Pencil, Trash2, ImageIcon, FileText, Download, Loader2, Lock, Smartphone, Eye, EyeOff, MoreVertical } from "lucide-react";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { Dispositivo } from "@/types/dispositivo";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { gerarReciboLegalPDF, salvarReciboStorage } from "@/lib/gerarReciboLegalPDF";
import { buscarConfiguracaoLojaPorEmpresa, validarConfiguracaoParaRecibos } from "@/hooks/useConfiguracaoLoja";
import { useNavigate } from "react-router-dom";
import { SeletorTempoGarantia } from "@/components/dispositivos/SeletorTempoGarantia";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DialogDispositivoEntrada } from "@/components/pdv/DialogDispositivoEntrada";
import { BadgeSaudeBateria } from "@/components/dispositivos/BadgeSaudeBateria";

// Gradientes da referência visual (mobile) — mantidos como constantes para não
// hardcodar cor de fundo de página nenhuma, apenas elementos pontuais (badges/botão).
const GRADIENTE_BADGE_TIPO = "linear-gradient(110deg,#2446d8 0%,#1768f2 54%,#0ba9c7 100%)";
const GRADIENTE_BOTAO_PDV = "linear-gradient(110deg,#2443d9 0%,#1769f5 55%,#2057f5 100%)";

const getCondicaoPillClasses = (condicao: string) => {
  switch (condicao) {
    case "novo":
      return "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300";
    case "semi_novo":
      return "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300";
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  }
};

const getCondicaoLabel = (condicao: string) =>
  condicao === "novo" ? "Novo" : condicao === "semi_novo" ? "Semi Novo" : "Usado";

interface CardDispositivoProps {
  dispositivo: Dispositivo;
  onEditar: (dispositivo: Dispositivo) => void;
  onExcluir: (id: string) => void;
}

export function CardDispositivo({
  dispositivo,
  onEditar,
  onExcluir,
}: CardDispositivoProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { podeVerCustos, podeVerLucros } = useFuncionarioPermissoes();
  const [temRecibo, setTemRecibo] = useState(false);
  const [compraId, setCompraId] = useState<string | null>(null);
  const [gerandoRecibo, setGerandoRecibo] = useState(false);
  const [exibirNoCatalogo, setExibirNoCatalogo] = useState(dispositivo.exibir_no_catalogo !== false);
  const [atualizandoCatalogo, setAtualizandoCatalogo] = useState(false);
  // Confirmação de exclusão controlada (compartilhada entre o layout desktop
  // e o menu "⋮" do layout mobile, para não duplicar o AlertDialog).
  const [alertExcluirAberto, setAlertExcluirAberto] = useState(false);
  // Margem de lucro (%) sobre o preço de venda — mesma fórmula já usada em
  // Dashboard.tsx (lucro / faturamento * 100), aqui aplicada ao preço unitário.
  const margemLucroPct =
    dispositivo.preco && dispositivo.preco > 0 && dispositivo.lucro !== undefined && dispositivo.lucro !== null
      ? (dispositivo.lucro / dispositivo.preco) * 100
      : null;

  useEffect(() => {
    const verificarRecibo = async () => {
      if (dispositivo.origem_tipo === 'terceiro') {
        const { data, error } = await supabase
          .from('compras_dispositivos')
          .select('id, termo_pdf_url')
          .eq('dispositivo_id', dispositivo.id)
          .maybeSingle();
        
        if (!error && data) {
          setCompraId(data.id);
          setTemRecibo(!!data.termo_pdf_url);
        }
      }
    };

    verificarRecibo();
  }, [dispositivo.id, dispositivo.origem_tipo]);

  const handleGerarReciboLegal = async () => {
    if (!compraId) {
      toast({
        title: "Erro",
        description: "Compra não encontrada para este dispositivo",
        variant: "destructive",
      });
      return;
    }

    setGerandoRecibo(true);
    try {
      // Validar configuração da loja (da filial do dispositivo, com fallback para a matriz)
      const config = await buscarConfiguracaoLojaPorEmpresa(dispositivo.empresa_id);
      const validacao = validarConfiguracaoParaRecibos(config);
      if (!validacao.valido) {
        toast({
          title: "Dados da loja incompletos",
          description: `Complete os seguintes campos: ${validacao.camposFaltando.join(", ")}. Acesse Configurações para preencher.`,
          variant: "destructive",
        });
        setGerandoRecibo(false);
        return;
      }

      // Buscar dados da compra
      const { data: compra, error: compraError } = await supabase
        .from("compras_dispositivos")
        .select("*, origem_pessoas(*)")
        .eq("id", compraId)
        .single();

      if (compraError || !compra) {
        toast({
          title: "Erro",
          description: "Não foi possível encontrar os dados da compra",
          variant: "destructive",
        });
        setGerandoRecibo(false);
        return;
      }

      // Validar vendedor
      if (!compra.origem_pessoas?.nome || !compra.origem_pessoas?.cpf_cnpj) {
        toast({
          title: "Dados do vendedor incompletos",
          description: "Por favor, complete os dados do vendedor (Nome e CPF/CNPJ)",
          variant: "destructive",
        });
        setGerandoRecibo(false);
        return;
      }

      // Gerar PDF
      toast({
        title: "Gerando recibo...",
        description: "Por favor, aguarde",
      });

      const pdf = await gerarReciboLegalPDF({
        loja: config!,
        vendedor: compra.origem_pessoas as any,
        dispositivo: {
          tipo: dispositivo.tipo,
          marca: dispositivo.marca,
          modelo: dispositivo.modelo,
          cor: dispositivo.cor,
          imei: dispositivo.imei,
          numero_serie: dispositivo.numero_serie,
          capacidade_gb: dispositivo.capacidade_gb,
          condicao: dispositivo.condicao,
          checklist: (dispositivo.checklist as any)?.entrada,
        },
        compra: compra as any,
      });

      // Salvar no storage
      const pdfUrl = await salvarReciboStorage(pdf, compraId);

      if (!pdfUrl) {
        throw new Error("Erro ao salvar PDF no storage");
      }

      // Atualizar registro da compra
      const { error: updateError } = await supabase
        .from("compras_dispositivos")
        .update({ termo_pdf_url: pdfUrl })
        .eq("id", compraId);

      if (updateError) {
        throw updateError;
      }

      setTemRecibo(true);

      toast({
        title: "Sucesso!",
        description: "Recibo legal gerado com sucesso",
      });

      // Abrir PDF em nova aba
      window.open(pdfUrl, "_blank");
    } catch (error) {
      console.error("Erro ao gerar recibo:", error);
      toast({
        title: "Erro ao gerar recibo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setGerandoRecibo(false);
    }
  };

  const [dialogGarantiaAberto, setDialogGarantiaAberto] = useState(false);
  const [garantiaMeses, setGarantiaMeses] = useState<number | undefined>(
    dispositivo.garantia ? dispositivo.tempo_garantia : undefined
  );
  const [dialogEntradaAberto, setDialogEntradaAberto] = useState(false);
  const [valorEntrada, setValorEntrada] = useState(0);

  const handleVender = () => {
    setGarantiaMeses(dispositivo.garantia ? dispositivo.tempo_garantia : undefined);
    setDialogGarantiaAberto(true);
  };

  const handleConfirmarVenda = () => {
    setDialogGarantiaAberto(false);
    navigate('/pdv', {
      state: {
        dispositivoSelecionado: {
          ...dispositivo,
          tempo_garantia: garantiaMeses,
        },
        valorEntradaInicial: valorEntrada,
      }
    });
  };

  const handleToggleExibirNoCatalogo = async () => {
    const novoValor = !exibirNoCatalogo;
    setAtualizandoCatalogo(true);
    try {
      const { error } = await supabase
        .from("dispositivos")
        .update({ exibir_no_catalogo: novoValor })
        .eq("id", dispositivo.id);

      if (error) throw error;

      setExibirNoCatalogo(novoValor);
      toast({
        title: novoValor ? "Dispositivo visível no catálogo" : "Dispositivo ocultado do catálogo",
      });
    } catch (error) {
      console.error("Erro ao atualizar exibição no catálogo:", error);
      toast({
        title: "Erro ao atualizar exibição no catálogo",
        variant: "destructive",
      });
    } finally {
      setAtualizandoCatalogo(false);
    }
  };

  const handleBaixarRecibo = async () => {
    if (!compraId) return;

    try {
      const { data } = await supabase
        .from("compras_dispositivos")
        .select("termo_pdf_url")
        .eq("id", compraId)
        .single();

      if (data?.termo_pdf_url) {
        window.open(data.termo_pdf_url, "_blank");
      }
    } catch (error) {
      console.error("Erro ao baixar recibo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível abrir o recibo",
        variant: "destructive",
      });
    }
  };

  // Diálogos e alertas compartilhados entre o layout desktop e o layout
  // mobile (mesma lógica/estado — só o visual do card muda por breakpoint).
  const dialogsCompartilhados = (
    <>
      <Dialog open={dialogGarantiaAberto} onOpenChange={setDialogGarantiaAberto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Garantia para o Recibo</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione o tempo de garantia que aparecerá no termo de garantia do recibo.
            </p>
            <SeletorTempoGarantia
              value={garantiaMeses}
              onChange={setGarantiaMeses}
            />
          </div>
          <DialogFooter className="flex-col gap-2">
            <div className="flex items-center justify-between w-full text-sm">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogEntradaAberto(true)}
                className="gap-1.5 text-xs border-amber-500/40 text-amber-600 hover:bg-amber-500/5"
              >
                <Smartphone className="h-3.5 w-3.5" />
                {valorEntrada > 0 ? `Entrada: R$ ${valorEntrada.toFixed(2)}` : "Dispositivo de Entrada"}
              </Button>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setDialogGarantiaAberto(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleConfirmarVenda}>
                Ir para o PDV
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogDispositivoEntrada
        open={dialogEntradaAberto}
        onOpenChange={setDialogEntradaAberto}
        empresaId={dispositivo.empresa_id || null}
        onConfirmar={(valor) => {
          setValorEntrada(valor);
          setDialogEntradaAberto(false);
        }}
      />

      <AlertDialog open={alertExcluirAberto} onOpenChange={setAlertExcluirAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{dispositivo.marca} {dispositivo.modelo}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onExcluir(dispositivo.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  // ==========================================================================
  // Layout MOBILE — restilização visual (mesmos dados/handlers do desktop).
  // Ativo apenas abaixo do breakpoint mobile do app (useIsMobile, <768px);
  // a versão desktop abaixo permanece 100% inalterada.
  // ==========================================================================
  if (isMobile) {
    const condicaoLabel = getCondicaoLabel(dispositivo.condicao);
    const origemTipo = dispositivo.origem_tipo;
    const temOrigem = Boolean(origemTipo);

    return (
      <div className="rounded-[18px] border border-border bg-card shadow-sm overflow-hidden">
        {/* Área de imagem */}
        <div className="relative h-32 bg-gradient-to-br from-muted/60 to-muted flex items-center justify-center p-3">
          {(dispositivo.fotos && dispositivo.fotos.length > 0) || dispositivo.foto_url ? (
            <>
              <img
                src={dispositivo.fotos?.[0] || dispositivo.foto_url || ''}
                alt={`${dispositivo.marca} ${dispositivo.modelo}`}
                className="max-w-full max-h-full object-contain"
              />
              {dispositivo.fotos && dispositivo.fotos.length > 1 && (
                <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <ImageIcon className="h-2.5 w-2.5" />
                  <span>{dispositivo.fotos.length}</span>
                </div>
              )}
            </>
          ) : (
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
          )}

          {/* Badges sobrepostos — tipo + condição */}
          <div className="absolute top-1.5 left-1.5 flex flex-col items-start gap-1">
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm"
              style={{ background: GRADIENTE_BADGE_TIPO }}
            >
              {dispositivo.tipo}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${getCondicaoPillClasses(dispositivo.condicao)}`}>
              {condicaoLabel}
            </span>
            {dispositivo.garantia && (
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
                Garantia {dispositivo.tempo_garantia}m
              </span>
            )}
          </div>

          {/* Menu "mais opções" — concentra as ações secundárias do card */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Mais opções"
                className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-sm text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditar(dispositivo)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleExibirNoCatalogo} disabled={atualizandoCatalogo}>
                {exibirNoCatalogo ? (
                  <EyeOff className="h-4 w-4 mr-2" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                {exibirNoCatalogo ? "Ocultar do catálogo" : "Exibir no catálogo"}
              </DropdownMenuItem>
              {dispositivo.origem_tipo === 'terceiro' && compraId && (
                temRecibo ? (
                  <DropdownMenuItem onClick={handleBaixarRecibo}>
                    <Download className="h-4 w-4 mr-2" />
                    Ver Recibo Legal
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleGerarReciboLegal} disabled={gerandoRecibo}>
                    {gerandoRecibo ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Gerar Recibo Legal
                  </DropdownMenuItem>
                )
              )}
              <DropdownMenuItem
                onClick={() => setAlertExcluirAberto(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="p-3 space-y-2.5">
          <div className="min-w-0">
            <h3 className="font-bold text-[15px] leading-tight truncate">{dispositivo.modelo}</h3>
            <p className="text-xs text-muted-foreground truncate">{dispositivo.marca}</p>
            {dispositivo.subtipo_computador && (
              <p className="text-[11px] text-muted-foreground truncate">{dispositivo.subtipo_computador}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Qtd: {dispositivo.quantidade} unid.
            </span>
            {dispositivo.origem_tipo === 'terceiro' && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                {temRecibo ? "✓ Recibo" : "Sem Recibo"}
              </span>
            )}
          </div>

          {(dispositivo.capacidade_gb || dispositivo.imei || (dispositivo.saude_bateria !== undefined && dispositivo.saude_bateria !== null)) && (
            <div className="space-y-1 text-[11px]">
              {dispositivo.capacidade_gb && (
                <div className="flex justify-between min-w-0">
                  <span className="text-muted-foreground">Capacidade</span>
                  <span className="font-medium truncate ml-2">{dispositivo.capacidade_gb} GB</span>
                </div>
              )}
              {dispositivo.imei && (
                <div className="flex justify-between min-w-0">
                  <span className="text-muted-foreground">IMEI</span>
                  <span className="font-medium truncate ml-2">{dispositivo.imei}</span>
                </div>
              )}
              {dispositivo.saude_bateria !== undefined && dispositivo.saude_bateria !== null && (
                <div className="flex justify-between items-center min-w-0">
                  <span className="text-muted-foreground">Bateria</span>
                  <BadgeSaudeBateria saudeBateria={dispositivo.saude_bateria} />
                </div>
              )}
            </div>
          )}

          {temOrigem && (
            <Badge
              className={`text-[10px] px-2 py-0 h-5 ${origemTipo === 'troca_pdv' ? 'bg-cyan-600 text-white hover:bg-cyan-600' : ''}`}
              variant={
                origemTipo === 'terceiro' ? 'default' :
                origemTipo === 'fornecedor' ? 'secondary' :
                origemTipo === 'troca_pdv' ? 'default' :
                'outline'
              }
            >
              {origemTipo === 'terceiro' && '👤 Terceiro'}
              {origemTipo === 'fornecedor' && '🏢 Fornecedor'}
              {origemTipo === 'estoque_proprio' && '📦 Estoque'}
              {origemTipo === 'troca_pdv' && '🔄 Entrada (Troca)'}
            </Badge>
          )}

          {/* Bloco de preços com divisórias sutis */}
          <div className="divide-y divide-border border-t border-border text-xs">
            <div className="flex justify-between items-center py-1.5">
              <span className="text-muted-foreground">Custo</span>
              <span className="font-medium">
                {podeVerCustos
                  ? (dispositivo.custo ? <ValorMonetario valor={dispositivo.custo} /> : "-")
                  : <Lock className="inline h-3 w-3 text-muted-foreground" />
                }
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-muted-foreground">Preço de venda</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {dispositivo.preco ? <ValorMonetario valor={dispositivo.preco} tipo="preco" /> : "-"}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-muted-foreground">Lucro</span>
              <span className="flex items-center gap-1.5">
                <span className={dispositivo.lucro && dispositivo.lucro >= 0 ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-red-600 dark:text-red-400"}>
                  {podeVerLucros
                    ? (dispositivo.lucro !== undefined && dispositivo.lucro !== null
                        ? <ValorMonetario valor={dispositivo.lucro} />
                        : "-")
                    : <Lock className="inline h-3 w-3 text-muted-foreground" />
                  }
                </span>
                {podeVerLucros && margemLucroPct !== null && (
                  <span
                    className={
                      margemLucroPct >= 0
                        ? "rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 font-semibold"
                        : "rounded-full bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-[10px] px-1.5 py-0.5 font-semibold"
                    }
                  >
                    {margemLucroPct.toFixed(0)}%
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Botão principal — Vender no PDV (mesmo handler do desktop) */}
          <button
            type="button"
            onClick={handleVender}
            disabled={dispositivo.quantidade === 0}
            className="w-full flex flex-col items-center justify-center gap-0.5 rounded-2xl py-2.5 text-white shadow-sm transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: GRADIENTE_BOTAO_PDV }}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <ShoppingCart className="h-4 w-4" />
              Vender no PDV
            </span>
            <span className="text-[10px] font-normal text-white/75">1 toque</span>
          </button>
        </div>

        {dialogsCompartilhados}
      </div>
    );
  }

  // ==========================================================================
  // Layout DESKTOP — restilização visual conforme referência (mesmos dados/
  // handlers do mobile, só o layout muda: imagem à esquerda, infos à
  // direita, menu "⋮" concentra as ações secundárias).
  // ==========================================================================
  const condicaoLabelDesktop = getCondicaoLabel(dispositivo.condicao);
  const origemTipoDesktop = dispositivo.origem_tipo;
  const temOrigemDesktop = Boolean(origemTipoDesktop);

  const menuAcoesDesktop = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Mais opções"
          className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-sm text-foreground"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEditar(dispositivo)}>
          <Pencil className="h-4 w-4 mr-2" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleToggleExibirNoCatalogo} disabled={atualizandoCatalogo}>
          {exibirNoCatalogo ? (
            <EyeOff className="h-4 w-4 mr-2" />
          ) : (
            <Eye className="h-4 w-4 mr-2" />
          )}
          {exibirNoCatalogo ? "Ocultar do catálogo" : "Exibir no catálogo"}
        </DropdownMenuItem>
        {dispositivo.origem_tipo === 'terceiro' && compraId && (
          temRecibo ? (
            <DropdownMenuItem onClick={handleBaixarRecibo}>
              <Download className="h-4 w-4 mr-2" />
              Ver Recibo Legal
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleGerarReciboLegal} disabled={gerandoRecibo}>
              {gerandoRecibo ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Gerar Recibo Legal
            </DropdownMenuItem>
          )
        )}
        <DropdownMenuItem
          onClick={() => setAlertExcluirAberto(true)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden hover:shadow-lg transition-shadow max-w-full">
      <div className="relative grid grid-cols-[46%_54%] gap-3 border-b border-border/70 p-3.5 min-h-[185px]">
        {menuAcoesDesktop}

        <div className="relative flex items-center justify-center min-w-0">
          <div className="absolute top-0 left-0 z-[1] flex flex-col items-start gap-1">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold text-white shadow-sm"
              style={{ background: GRADIENTE_BADGE_TIPO }}
            >
              {dispositivo.tipo}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${getCondicaoPillClasses(dispositivo.condicao)}`}>
              {condicaoLabelDesktop}
            </span>
            {dispositivo.garantia && (
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                Garantia {dispositivo.tempo_garantia}m
              </span>
            )}
          </div>

          {(dispositivo.fotos && dispositivo.fotos.length > 0) || dispositivo.foto_url ? (
            <>
              <img
                src={dispositivo.fotos?.[0] || dispositivo.foto_url || ''}
                alt={`${dispositivo.marca} ${dispositivo.modelo}`}
                className="max-w-full h-[155px] object-contain"
              />
              {dispositivo.fotos && dispositivo.fotos.length > 1 && (
                <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <ImageIcon className="h-2.5 w-2.5" />
                  <span>{dispositivo.fotos.length}</span>
                </div>
              )}
            </>
          ) : (
            <ImageIcon className="h-16 w-16 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-col justify-center min-w-0 pl-1">
          <span className="text-[13px] font-bold text-foreground truncate">{dispositivo.marca}</span>
          <span className="text-[13px] text-muted-foreground truncate">{dispositivo.modelo}</span>
          {dispositivo.subtipo_computador && (
            <span className="text-[11px] text-muted-foreground truncate">{dispositivo.subtipo_computador}</span>
          )}

          <div className="flex items-center gap-1.5 flex-wrap mt-2 mb-1.5">
            <span className="inline-flex items-center rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
              Qtd: {dispositivo.quantidade} unid.
            </span>
            {dispositivo.origem_tipo === 'terceiro' && (
              <span className="inline-flex items-center rounded-lg bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                {temRecibo ? "✓ Recibo" : "Sem Recibo"}
              </span>
            )}
          </div>

          {(dispositivo.capacidade_gb || dispositivo.imei || (dispositivo.saude_bateria !== undefined && dispositivo.saude_bateria !== null)) && (
            <div className="space-y-1 text-[11px] mb-1.5">
              {dispositivo.capacidade_gb && (
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="text-muted-foreground shrink-0">Capacidade:</span>
                  <span className="font-medium truncate">{dispositivo.capacidade_gb} GB</span>
                </div>
              )}
              {dispositivo.imei && (
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="text-muted-foreground shrink-0">IMEI:</span>
                  <span className="font-medium truncate">{dispositivo.imei}</span>
                </div>
              )}
              {dispositivo.saude_bateria !== undefined && dispositivo.saude_bateria !== null && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-muted-foreground shrink-0">Bateria:</span>
                  <BadgeSaudeBateria saudeBateria={dispositivo.saude_bateria} />
                </div>
              )}
            </div>
          )}

          {temOrigemDesktop && (
            <Badge
              className={`self-start text-[10px] px-2 py-0 h-5 ${origemTipoDesktop === 'troca_pdv' ? 'bg-cyan-600 text-white hover:bg-cyan-600' : ''}`}
              variant={
                origemTipoDesktop === 'terceiro' ? 'default' :
                origemTipoDesktop === 'fornecedor' ? 'secondary' :
                origemTipoDesktop === 'troca_pdv' ? 'default' :
                'outline'
              }
            >
              {origemTipoDesktop === 'terceiro' && '👤 Terceiro'}
              {origemTipoDesktop === 'fornecedor' && '🏢 Fornecedor'}
              {origemTipoDesktop === 'estoque_proprio' && '📦 Estoque'}
              {origemTipoDesktop === 'troca_pdv' && '🔄 Entrada (Troca)'}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border p-3.5">
        <div className="px-1.5 first:pl-0 last:pr-0 min-w-0">
          <span className="block text-[10px] text-muted-foreground mb-1.5">Custo</span>
          <strong className="block text-[11px] xl:text-[12px] font-bold text-foreground leading-tight break-words">
            {podeVerCustos
              ? (dispositivo.custo ? <ValorMonetario valor={dispositivo.custo} /> : "-")
              : <Lock className="inline h-3 w-3 text-muted-foreground" />
            }
          </strong>
        </div>
        <div className="px-1.5 first:pl-0 last:pr-0 min-w-0">
          <span className="block text-[10px] text-muted-foreground mb-1.5">Preço de venda</span>
          <strong className="block text-[11px] xl:text-[12px] font-bold text-blue-600 dark:text-blue-400 leading-tight break-words">
            {dispositivo.preco ? <ValorMonetario valor={dispositivo.preco} tipo="preco" /> : "-"}
          </strong>
        </div>
        <div className="px-1.5 first:pl-0 last:pr-0 min-w-0">
          <span className="block text-[10px] text-muted-foreground mb-1.5">Lucro potencial</span>
          <strong className={`block text-[11px] xl:text-[12px] font-bold leading-tight break-words ${dispositivo.lucro && dispositivo.lucro >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {podeVerLucros
              ? (dispositivo.lucro !== undefined && dispositivo.lucro !== null
                  ? <ValorMonetario valor={dispositivo.lucro} />
                  : "-")
              : <Lock className="inline h-3 w-3 text-muted-foreground" />
            }
          </strong>
          {podeVerLucros && margemLucroPct !== null && (
            <span
              className={
                margemLucroPct >= 0
                  ? "inline-block mt-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[9px] px-1.5 py-0.5 font-bold"
                  : "inline-block mt-1.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-[9px] px-1.5 py-0.5 font-bold"
              }
            >
              {margemLucroPct.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      <div className="px-3.5 pb-3.5 mt-auto">
        <button
          type="button"
          onClick={handleVender}
          disabled={dispositivo.quantidade === 0}
          className="w-full flex items-center justify-center gap-3 rounded-xl py-3.5 text-white shadow-sm transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: GRADIENTE_BOTAO_PDV }}
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-sm font-bold">Vender no PDV</span>
            <span className="text-[10px] font-normal text-white/75">1 toque</span>
          </span>
        </button>
      </div>

      {dialogsCompartilhados}
    </div>
  );
}

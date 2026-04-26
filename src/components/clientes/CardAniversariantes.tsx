import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Cake, Crown, MessageCircle, PartyPopper, Lock, X } from "lucide-react";
import { Cliente } from "@/types/cliente";
import { useAniversariantes, getNomeMes, ClienteAniversariante } from "@/hooks/useAniversariantes";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { formatPhone } from "@/lib/formatters";
import { DialogDismissCard } from "@/components/dashboard/DialogDismissCard";
import { isDismissed, dismissCard, DismissDuration } from "@/lib/card-dismiss";

const CARD_ID = 'aniversariantes';

interface CardAniversariantesProps {
  clientes: Cliente[];
}

export function CardAniversariantes({ clientes }: CardAniversariantesProps) {
  const { aniversariantes, aniversariantesHoje, totalMes, mesAtual } = useAniversariantes(clientes);
  const { config } = useConfiguracaoLoja();
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(isDismissed(CARD_ID));
  }, []);

  const handleDismiss = (duration: DismissDuration) => {
    dismissCard(CARD_ID, duration);
    setHidden(true);
  };

  const gerarMensagemWhatsApp = (cliente: ClienteAniversariante) => {
    const nomeLoja = config?.nome_loja || "nossa loja";
    return encodeURIComponent(
      `🎂🎉 *Feliz Aniversário, ${cliente.nome}!* 🎉🎂\n\n` +
      `Hoje você completa ${cliente.idade} anos! 🎈\n\n` +
      `A equipe ${nomeLoja} deseja a você um dia cheio de alegria, saúde e muitas realizações!\n\n` +
      `Obrigado por ser nosso cliente! 💙`
    );
  };

  const abrirWhatsApp = (cliente: ClienteAniversariante) => {
    if (!cliente.telefone) return;
    const telefoneFormatado = cliente.telefone.replace(/\D/g, "");
    const telefoneComCodigo = telefoneFormatado.startsWith("55")
      ? telefoneFormatado
      : `55${telefoneFormatado}`;
    const mensagem = gerarMensagemWhatsApp(cliente);
    window.open(`https://wa.me/${telefoneComCodigo}?text=${mensagem}`, "_blank");
  };

  const proximosAniversariantes = useMemo(() => {
    return aniversariantes.filter((a) => !a.aniversario_hoje);
  }, [aniversariantes]);

  if (hidden) return null;

  if (totalMes === 0) {
    return (
      <>
        <Card className="border-dashed relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 hover:bg-black/10 dark:hover:bg-white/10 z-10"
            onClick={() => setDismissDialogOpen(true)}
          >
            <X className="h-4 w-4" />
          </Button>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Cake className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Nenhum aniversariante em {getNomeMes(mesAtual)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastre a data de nascimento dos clientes para ver os aniversariantes
            </p>
          </CardContent>
        </Card>
        <DialogDismissCard
          open={dismissDialogOpen}
          onOpenChange={setDismissDialogOpen}
          onDismiss={handleDismiss}
        />
      </>
    );
  }

  return (
    <>
      <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7 hover:bg-black/10 dark:hover:bg-white/10 z-10"
          onClick={() => setDismissDialogOpen(true)}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardHeader className="pb-3 pr-10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cake className="h-5 w-5 text-amber-500" />
              Aniversariantes de {getNomeMes(mesAtual)}
            </CardTitle>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
              {totalMes} {totalMes === 1 ? "cliente" : "clientes"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Aniversariantes de hoje */}
          {aniversariantesHoje.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                <PartyPopper className="h-4 w-4" />
                HOJE - {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </div>
              <div className="space-y-2">
                {aniversariantesHoje.map((cliente) => (
                  <div
                    key={cliente.id}
                    className="flex items-center justify-between p-3 bg-amber-100 dark:bg-amber-900/40 rounded-lg border border-amber-200 dark:border-amber-800"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎈</span>
                      <div>
                        <p className="font-medium">{cliente.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {cliente.idade} anos
                        </p>
                      </div>
                    </div>
                    {cliente.telefone ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                        onClick={() => abrirWhatsApp(cliente)}
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem telefone</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Próximos aniversariantes */}
          {proximosAniversariantes.length > 0 && (
            <div className="space-y-2">
              {aniversariantesHoje.length > 0 && (
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  📅 Próximos
                </div>
              )}
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {proximosAniversariantes.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="flex items-center justify-between p-2 bg-background/60 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-12">
                          {cliente.dia_aniversario.toString().padStart(2, "0")}/{(mesAtual + 1).toString().padStart(2, "0")}
                        </span>
                        <div>
                          <p className="font-medium text-sm">{cliente.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {cliente.idade} anos
                          </p>
                        </div>
                      </div>
                      {cliente.telefone ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 text-green-600"
                          onClick={() => abrirWhatsApp(cliente)}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
      <DialogDismissCard
        open={dismissDialogOpen}
        onOpenChange={setDismissDialogOpen}
        onDismiss={handleDismiss}
      />
    </>
  );
}

// Card bloqueado para planos não profissionais
export function CardAniversariantesBloqueado() {
  const navigate = useNavigate();
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(isDismissed(CARD_ID + '_bloqueado'));
  }, []);

  const handleDismiss = (duration: DismissDuration) => {
    dismissCard(CARD_ID + '_bloqueado', duration);
    setHidden(true);
  };

  if (hidden) return null;

  return (
    <>
      <Card className="border-dashed border-muted-foreground/30 bg-muted/30 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7 hover:bg-black/10 dark:hover:bg-white/10 z-10"
          onClick={() => setDismissDialogOpen(true)}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardHeader className="pb-3 pr-10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg text-muted-foreground">
              <Cake className="h-5 w-5" />
              Aniversariantes do Mês
            </CardTitle>
            <Crown className="h-5 w-5 text-amber-500" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
          <Lock className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">
            Recurso exclusivo do Plano Profissional
          </p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Visualize aniversariantes e envie felicitações via WhatsApp
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => navigate("/plano")}
          >
            <Crown className="h-4 w-4 text-amber-500" />
            Ver Planos
          </Button>
        </CardContent>
      </Card>
      <DialogDismissCard
        open={dismissDialogOpen}
        onOpenChange={setDismissDialogOpen}
        onDismiss={handleDismiss}
      />
    </>
  );
}

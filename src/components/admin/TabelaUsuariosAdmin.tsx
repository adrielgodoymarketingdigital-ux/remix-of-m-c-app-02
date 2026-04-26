import { useState } from "react";
import { UsuarioAdmin, TipoBloqueio } from "@/hooks/useAdminUsuarios";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { MessageCircle, Mail, Clock, CreditCard, AlertTriangle, Phone, ChevronLeft, ChevronRight, Download, ShieldAlert, ShieldX, ShieldCheck, Lock, Trash2, KeyRound } from "lucide-react";
import { aplicarMascaraTelefone } from "@/lib/mascaras";
import { toast } from "sonner";

interface TabelaUsuariosAdminProps {
  usuarios: UsuarioAdmin[];
  isLoading: boolean;
  mostrarDiasTrial?: boolean;
  mostrarUsoIndevido?: boolean;
  onBloquear?: (usuario: UsuarioAdmin) => void;
  onDeletar?: (usuario: UsuarioAdmin) => void;
  onConcederAcesso?: (usuario: UsuarioAdmin) => void;
  getMensagemFormatada?: (status: string, nome: string) => string;
}

export function TabelaUsuariosAdmin({ 
  usuarios, 
  isLoading, 
  mostrarDiasTrial = false, 
  mostrarUsoIndevido = false,
  onBloquear,
  onDeletar,
  onConcederAcesso,
  getMensagemFormatada
}: TabelaUsuariosAdminProps) {
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 20;

  const totalPaginas = Math.ceil(usuarios.length / itensPorPagina);
  const usuariosPaginados = usuarios.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  const irParaPagina = (pagina: number) => {
    if (pagina >= 1 && pagina <= totalPaginas) {
      setPaginaAtual(pagina);
    }
  };

  const exportarCSV = () => {
    const formatarPlanoTexto = (plano: string) => {
      const planos: Record<string, string> = {
        demonstracao: "Pendente",
        trial: "Trial",
        basico_mensal: "Básico Mensal",
        basico_anual: "Básico Anual",
        intermediario_mensal: "Intermediário Mensal",
        intermediario_anual: "Intermediário Anual",
        profissional_mensal: "Profissional Mensal",
        profissional_anual: "Profissional Anual",
        admin: "Admin",
      };
      return planos[plano] || plano;
    };

    const formatarStatusTexto = (usuario: UsuarioAdmin) => {
      const { status, plano_tipo: planoTipo, is_trial_with_card, dias_restantes_trial } = usuario;
      
      // PRIORIDADE 1: Usuário em trial com cartão ativo (7 dias)
      if (is_trial_with_card && (dias_restantes_trial ?? 0) > 0) {
        return "Em Trial (7d)";
      }
      
      // PRIORIDADE 2: Trial com cartão expirado
      if (is_trial_with_card && (dias_restantes_trial ?? 0) <= 0) {
        return "Trial Expirado";
      }
      
      // PRIORIDADE 3: Usuários em demonstração com status canceled são "Pendentes"
      if (planoTipo === "demonstracao" && status === "canceled") {
        return "Pendente";
      }
      
      const statusMap: Record<string, string> = {
        active: "Ativo",
        trialing: "Em Trial",
        canceled: "Cancelado",
        past_due: "Atrasado",
        unpaid: "Não Pago",
        incomplete: "Incompleto",
      };
      return statusMap[status] || status;
    };

    const headers = [
      "Nome",
      "Email",
      "Telefone",
    ];

    const rows = usuarios.map((usuario) => {
      const primeiroNome = (usuario.nome || "").split(" ")[0];
      const telefoneNumeros = usuario.celular ? usuario.celular.replace(/\D/g, "") : "";
      return [primeiroNome, usuario.email || "", telefoneNumeros];
    });

    const escapeCsvValue = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(escapeCsvValue).join(","))
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `usuarios_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${usuarios.length} usuários exportados com sucesso!`);
  };

  const TIMEZONE_BRASIL = "America/Sao_Paulo";

  const formatarData = (data: string | null) => {
    if (!data) return "-";
    const dataUTC = parseISO(data);
    const dataBrasil = toZonedTime(dataUTC, TIMEZONE_BRASIL);
    return format(dataBrasil, "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const formatarPlano = (plano: string) => {
    const planos: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      demonstracao: { label: "Pendente", variant: "outline" },
      trial: { label: "Trial", variant: "secondary" },
      basico_mensal: { label: "Básico Mensal", variant: "default" },
      basico_anual: { label: "Básico Anual", variant: "default" },
      intermediario_mensal: { label: "Intermediário Mensal", variant: "default" },
      intermediario_anual: { label: "Intermediário Anual", variant: "default" },
      profissional_mensal: { label: "Profissional Mensal", variant: "default" },
      profissional_anual: { label: "Profissional Anual", variant: "default" },
      admin: { label: "Admin", variant: "destructive" },
    };

    const config = planos[plano] || { label: plano, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatarStatus = (usuario: UsuarioAdmin) => {
    const { status, plano_tipo: planoTipo, is_trial_with_card, dias_restantes_trial } = usuario;
    
    // PRIORIDADE 1: Usuário em trial com cartão ativo (7 dias)
    // Mesmo que status seja "canceled" no banco, se trial_with_card=true e ainda tem dias, está em trial
    if (is_trial_with_card && (dias_restantes_trial ?? 0) > 0) {
      return <Badge className="bg-blue-100 text-blue-800">Em Trial (7d)</Badge>;
    }
    
    // PRIORIDADE 2: Trial com cartão expirado
    if (is_trial_with_card && (dias_restantes_trial ?? 0) <= 0) {
      return <Badge className="bg-orange-100 text-orange-800">Trial Expirado</Badge>;
    }
    
    // PRIORIDADE 3: Usuários em demonstração com status canceled são "Aguardando Ativação"
    if (planoTipo === "demonstracao" && status === "canceled") {
      return <Badge className="bg-amber-100 text-amber-800">Aguardando Ativação</Badge>;
    }
    
    const statusMap: Record<string, { label: string; className: string }> = {
      active: { label: "Ativo", className: "bg-green-100 text-green-800" },
      trialing: { label: "Em Trial", className: "bg-blue-100 text-blue-800" },
      canceled: { label: "Cancelado", className: "bg-red-100 text-red-800" },
      past_due: { label: "Atrasado", className: "bg-orange-100 text-orange-800" },
      unpaid: { label: "Não Pago", className: "bg-yellow-100 text-yellow-800" },
      incomplete: { label: "Incompleto", className: "bg-gray-100 text-gray-800" },
    };

    const config = statusMap[status] || { label: status, className: "bg-gray-100 text-gray-800" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const formatarCelular = (celular: string | null) => {
    if (!celular) return null;
    return aplicarMascaraTelefone(celular);
  };

  const abrirWhatsApp = (usuario: UsuarioAdmin) => {
    if (!usuario.celular) {
      toast.error("Usuário não possui celular cadastrado");
      return;
    }

    // Determinar status do usuário para personalizar mensagem
    const isTrialOuDemo = usuario.plano_tipo === 'trial' || usuario.plano_tipo === 'demonstracao';
    const trialExpirado = isTrialOuDemo && usuario.dias_restantes_trial !== null && usuario.dias_restantes_trial <= 0;
    const statusInativos = ['canceled', 'past_due', 'unpaid', 'incomplete_expired', 'incomplete'];
    const assinaturaInativa = statusInativos.includes(usuario.status);
    const bloqueado = usuario.bloqueado_admin;
    const isFree = usuario.plano_tipo === 'free';

    // Determinar se free está ativo (logou nos últimos 2 dias)
    const doisDiasAtras = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const isFreeAtivo = isFree && usuario.last_login_at 
      ? new Date(usuario.last_login_at) >= doisDiasAtras 
      : false;

    // Mapear para o key de template
    const tipoMensagem = bloqueado ? "bloqueado" : 
      trialExpirado ? "trial_expirado" : 
      assinaturaInativa ? "assinatura_inativa" : 
      usuario.is_pagante ? "pagante_ativo" : 
      isFreeAtivo ? "free_ativo" :
      isFree ? "free" :
      "trial_ativo";

    console.log("[DEBUG WhatsApp Admin]", {
      nome: usuario.nome,
      plano_tipo: usuario.plano_tipo,
      status: usuario.status,
      is_trial: usuario.is_trial,
      is_pagante: usuario.is_pagante,
      dias_restantes_trial: usuario.dias_restantes_trial,
      bloqueado_admin: usuario.bloqueado_admin,
      isFree,
      isFreeAtivo,
      tipoMensagem
    });

    let mensagem: string;
    const nome = usuario.nome || "Cliente";

    if (getMensagemFormatada) {
      mensagem = getMensagemFormatada(tipoMensagem as any, nome);
    } else if (bloqueado) {
      mensagem = `Olá ${nome}! Tudo bem? Vi que seu acesso ao MecApp está temporariamente bloqueado. Gostaria de ajudá-lo a regularizar sua situação e voltar a usar o sistema. Posso te ajudar com isso?`;
    } else if (trialExpirado) {
      mensagem = `Olá ${nome}! Tudo bem? Seu período de teste gratuito do MecApp chegou ao fim. Gostaria de apresentar nossos planos para você continuar usando todas as funcionalidades. Posso te ajudar a escolher o melhor plano?`;
    } else if (assinaturaInativa) {
      mensagem = `Olá ${nome}! Tudo bem? Notei que houve uma alteração em sua assinatura do MecApp. Gostaria de ajudá-lo a reativar seu acesso e continuar aproveitando o sistema. Como posso te ajudar?`;
    } else if (usuario.is_pagante) {
      mensagem = `Olá ${nome}! Tudo bem? Sou da equipe do MecApp e gostaria de saber como está sua experiência com o sistema. Precisa de algum suporte ou tem alguma sugestão?`;
    } else {
      mensagem = `Olá ${nome}! Tudo bem? Percebi que você está usando o MecApp e gostaria de saber como está sendo sua experiência. Posso te ajudar em algo?`;
    }

    window.open(`https://wa.me/55${usuario.celular}?text=${encodeURIComponent(mensagem)}`, "_blank");
  };


  const enviarEmail = (email: string) => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
    window.open(gmailUrl, "_blank");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (usuarios.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum usuário encontrado com os filtros aplicados.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportarCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="min-w-[900px] px-4 sm:px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Celular</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bloqueio</TableHead>
                {mostrarDiasTrial && <TableHead>Tempo Restante</TableHead>}
                {mostrarUsoIndevido && <TableHead>Uso Indevido</TableHead>}
                <TableHead>Cadastro</TableHead>
                <TableHead>Stripe</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuariosPaginados.map((usuario) => (
                <TableRow key={usuario.id} className={usuario.bloqueado_admin ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                  <TableCell className="font-medium">{usuario.nome || "-"}</TableCell>
                  <TableCell>
                    {usuario.celular ? (
                      <button
                        onClick={() => abrirWhatsApp(usuario)}
                        className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 hover:underline transition-colors"
                        title="Clique para abrir WhatsApp"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {formatarCelular(usuario.celular)}
                      </button>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{usuario.email || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {formatarPlano(usuario.plano_tipo)}
                      {usuario.is_trial_with_card && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-green-300 text-green-600">
                          7d 💳
                        </Badge>
                      )}
                      {usuario.is_trial_24h && !usuario.is_trial_with_card && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-purple-300 text-purple-600">
                          24h
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatarStatus(usuario)}</TableCell>
                  <TableCell>
                    {usuario.bloqueado_admin ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <ShieldX className="h-3 w-3" />
                          Bloqueado
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {usuario.bloqueado_tipo === "indeterminado" ? (
                            <>
                              <Lock className="h-3 w-3" />
                              Indeterminado
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-3 w-3" />
                              Até assinar
                            </>
                          )}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-300 flex items-center gap-1 w-fit">
                        <ShieldCheck className="h-3 w-3" />
                        Liberado
                      </Badge>
                    )}
                  </TableCell>
                  {mostrarDiasTrial && (
                    <TableCell>
                      {usuario.is_trial ? (
                        usuario.is_trial_24h && !usuario.is_trial_with_card ? (
                          // Trial de 24h LEGADO - exibir em horas
                          <div className="flex items-center gap-2">
                            {(usuario.horas_restantes_trial ?? 0) < 0 ? (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Expirado há {Math.abs(usuario.horas_restantes_trial ?? 0)}h
                              </Badge>
                            ) : (usuario.horas_restantes_trial ?? 0) === 0 ? (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Expira agora
                              </Badge>
                            ) : (usuario.horas_restantes_trial ?? 0) <= 6 ? (
                              <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {usuario.horas_restantes_trial}h restantes
                              </Badge>
                            ) : (usuario.horas_restantes_trial ?? 0) <= 12 ? (
                              <Badge className="bg-orange-100 text-orange-800 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {usuario.horas_restantes_trial}h restantes
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {usuario.horas_restantes_trial}h restantes
                              </Badge>
                            )}
                          </div>
                        ) : (
                          // Trial de 7 dias (NOVO com cartão OU legado longo) - exibir em dias
                          <div className="flex items-center gap-2">
                            {(usuario.dias_restantes_trial ?? 0) < 0 ? (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Expirado há {Math.abs(usuario.dias_restantes_trial ?? 0)} dias
                              </Badge>
                            ) : (usuario.dias_restantes_trial ?? 0) === 0 ? (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Expira hoje
                              </Badge>
                            ) : (usuario.dias_restantes_trial ?? 0) <= 3 ? (
                              <Badge className="bg-orange-100 text-orange-800 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {usuario.dias_restantes_trial} dias
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {usuario.dias_restantes_trial} dias
                                {usuario.is_trial_with_card && " 💳"}
                              </Badge>
                            )}
                          </div>
                        )
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  )}
                  {mostrarUsoIndevido && (
                    <TableCell>
                      {usuario.usando_apos_trial ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <ShieldAlert className="h-3 w-3" />
                          Uso Indevido
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-sm">{formatarData(usuario.created_at)}</TableCell>
                  <TableCell>
                    {usuario.stripe_customer_id?.startsWith("cus_") ? (
                      <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        Stripe
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Não vinculado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {onConcederAcesso && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onConcederAcesso(usuario)}
                          title="Conceder acesso ao sistema"
                          className="h-8 px-2 text-green-600 border-green-300 hover:bg-green-50 hover:text-green-700"
                        >
                          <KeyRound className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Acesso</span>
                        </Button>
                      )}
                      {onBloquear && (
                        <Button
                          variant={usuario.bloqueado_admin ? "outline" : "destructive"}
                          size="sm"
                          onClick={() => onBloquear(usuario)}
                          title={usuario.bloqueado_admin ? "Desbloquear usuário" : "Bloquear usuário"}
                          className="h-8 px-2"
                        >
                          {usuario.bloqueado_admin ? (
                            <>
                              <ShieldCheck className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">Desbloquear</span>
                            </>
                          ) : (
                            <>
                              <ShieldX className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">Bloquear</span>
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => abrirWhatsApp(usuario)}
                        title={usuario.celular ? "Enviar WhatsApp" : "Celular não cadastrado"}
                        disabled={!usuario.celular}
                      >
                        <MessageCircle className={`h-4 w-4 ${usuario.celular ? 'text-green-600' : 'text-gray-400'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => enviarEmail(usuario.email)}
                        title="Enviar Email"
                      >
                        <Mail className="h-4 w-4 text-blue-600" />
                      </Button>
                      {onDeletar && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeletar(usuario)}
                          title="Deletar usuário"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Exibindo {(paginaAtual - 1) * itensPorPagina + 1}-{Math.min(paginaAtual * itensPorPagina, usuarios.length)} de {usuarios.length} usuários
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => irParaPagina(paginaAtual - 1)}
              disabled={paginaAtual === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                let pageNum: number;
                if (totalPaginas <= 5) {
                  pageNum = i + 1;
                } else if (paginaAtual <= 3) {
                  pageNum = i + 1;
                } else if (paginaAtual >= totalPaginas - 2) {
                  pageNum = totalPaginas - 4 + i;
                } else {
                  pageNum = paginaAtual - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={paginaAtual === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => irParaPagina(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => irParaPagina(paginaAtual + 1)}
              disabled={paginaAtual === totalPaginas}
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

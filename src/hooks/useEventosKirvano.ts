import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface EventoKirvano {
  id: string;
  kirvano_event_id: string;
  tipo: string;
  dados: any;
  processado: boolean;
  email_usuario: string | null;
  plano_tipo: string | null;
  created_at: string;
}

export function useEventosKirvano() {
  const queryClient = useQueryClient();

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["kirvano-eventos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kirvano_eventos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as EventoKirvano[];
    },
  });

  const reprocessarEvento = useMutation({
    mutationFn: async (eventoId: string) => {
      // Chamar edge function para reprocessar
      const { data, error } = await supabase.functions.invoke("reprocessar-evento-kirvano", {
        body: { eventoId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Evento reprocessado",
        description: "O evento foi reprocessado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["kirvano-eventos"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reprocessar",
        description: error.message || "Não foi possível reprocessar o evento.",
        variant: "destructive",
      });
    },
  });

  const estatisticas = {
    total: eventos.length,
    processados: eventos.filter((e) => e.processado).length,
    pendentes: eventos.filter((e) => !e.processado).length,
    porTipo: eventos.reduce((acc, evento) => {
      acc[evento.tipo] = (acc[evento.tipo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  const recarregar = () => {
    queryClient.invalidateQueries({ queryKey: ["kirvano-eventos"] });
  };

  return {
    eventos,
    isLoading,
    reprocessarEvento: reprocessarEvento.mutate,
    isReprocessing: reprocessarEvento.isPending,
    estatisticas,
    recarregar,
  };
}

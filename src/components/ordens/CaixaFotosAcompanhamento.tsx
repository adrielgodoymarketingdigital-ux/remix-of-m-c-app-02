import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { AVISO_DOCUMENTO } from "@/lib/os/fotosImpressaoOS";
import {
  ROTULO_CAIXA_OS, decidirCaixaFotosLink, lojaMostraFotos, mesclarFotosAcompanhamento, osIncluiFotos, totalFotosParaLink,
} from "@/lib/acompanhamento/fotosAcompanhamento";

interface CaixaFotosAcompanhamentoProps {
  ordemId: string;
  /** avarias da OS como a tela já tem (pode estar desatualizado; o valor do banco é relido). */
  avarias: unknown;
  /** Chamado depois de gravar, com o valor gravado. */
  onGravado?: (incluir: boolean) => void;
}

/**
 * Caixa "Incluir fotos neste link" da OS (ordens_servico.avarias.fotos_acompanhamento).
 * As fotos só aparecem no acompanhamento se a loja também ligou "Mostrar fotos no
 * acompanhamento" — e quem aplica as duas regras é o banco (RPC), não esta tela.
 */
export function CaixaFotosAcompanhamento({ ordemId, avarias, onGravado }: CaixaFotosAcompanhamentoProps) {
  // Opção da loja: sempre a linha da matriz (é dela que o banco lê).
  const { config, loading: carregandoLoja } = useConfiguracaoLoja();
  const [avariasAtuais, setAvariasAtuais] = useState<unknown>(avarias);
  const [gravando, setGravando] = useState(false);

  // Relê a OS ao abrir: o objeto da lista pode estar desatualizado.
  useEffect(() => {
    let ativo = true;
    setAvariasAtuais(avarias);
    supabase
      .from("ordens_servico")
      .select("avarias")
      .eq("id", ordemId)
      .maybeSingle()
      .then(({ data }) => {
        if (ativo && data) setAvariasAtuais(data.avarias);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordemId]);

  const lojaLigada = lojaMostraFotos((config as { cores_personalizadas?: unknown } | null)?.cores_personalizadas);
  const decisao = decidirCaixaFotosLink({
    lojaLigada,
    totalFotos: totalFotosParaLink(avariasAtuais),
    marcada: osIncluiFotos(avariasAtuais),
  });

  const gravar = async (incluir: boolean) => {
    setGravando(true);
    try {
      // Relê e mescla: avarias guarda também checklist, assinaturas, pagamento e as próprias fotos.
      const { data: atual, error: erroLeitura } = await supabase
        .from("ordens_servico")
        .select("id, avarias")
        .eq("id", ordemId)
        .maybeSingle();
      if (erroLeitura || !atual) throw new Error("Não foi possível ler a OS. Nada foi alterado — tente novamente.");

      const novasAvarias = mesclarFotosAcompanhamento(atual.avarias, incluir);
      const { data: gravadas, error } = await supabase
        .from("ordens_servico")
        .update({ avarias: novasAvarias as Json })
        .eq("id", atual.id)
        .select("id");
      if (error) throw new Error("O banco recusou a gravação. Tente novamente.");
      if (!gravadas?.length) throw new Error("Você não tem permissão para alterar esta OS.");

      setAvariasAtuais(novasAvarias);
      onGravado?.(incluir);
      toast.success(incluir ? "Fotos incluídas no link de acompanhamento" : "Fotos retiradas do link de acompanhamento");
    } catch (error) {
      toast.error("Erro ao salvar a opção de fotos", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setGravando(false);
    }
  };

  const desabilitada = carregandoLoja || gravando || !decisao.habilitada;

  return (
    <div className="mb-4 rounded-lg border border-border/60 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Checkbox
          id="fotos-acompanhamento"
          checked={decisao.incluir}
          disabled={desabilitada}
          onCheckedChange={(v) => gravar(v === true)}
        />
        <Label
          htmlFor="fotos-acompanhamento"
          className={`text-xs font-semibold ${desabilitada ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
        >
          {ROTULO_CAIXA_OS}
        </Label>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {carregandoLoja ? "Carregando…" : decisao.habilitada ? AVISO_DOCUMENTO : decisao.motivo}
      </p>
    </div>
  );
}

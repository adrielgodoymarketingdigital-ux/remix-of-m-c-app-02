import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CatalogoOnline } from "@/components/catalogo/CatalogoOnline";
import { ConfiguracaoCatalogo, CONFIG_PADRAO } from "@/types/catalogo";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { ItemCatalogo, dispositivoParaItemCatalogo, produtoParaItemCatalogo } from "@/types/catalogo-item";
import { Loader2, AlertCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizarCategoriasCatalogo, sanitizarSelecaoCatalogo } from "@/lib/catalogo-selection";

interface CatalogoPublicoData {
  configuracaoLoja: ConfiguracaoLoja | null;
  itens: ItemCatalogo[];
  config: ConfiguracaoCatalogo;
}

export default function CatalogoPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [dados, setDados] = useState<CatalogoPublicoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      buscarCatalogo();
    }
  }, [slug]);

  const buscarCatalogo = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar configuração da loja pelo slug usando a view pública (não expõe dados sensíveis)
      const { data: configLoja, error: errorConfig } = await supabase
        .from("configuracoes_loja_publico")
        .select("*")
        .eq("catalogo_slug", slug)
        .maybeSingle();

      if (errorConfig) {
        console.error("Erro ao buscar configuração:", errorConfig);
        setError("Erro ao carregar catálogo. Tente novamente.");
        return;
      }

      if (!configLoja) {
        setError("Catálogo não encontrado ou não está ativo.");
        return;
      }

      // Buscar dispositivos disponíveis usando a view segura (não expõe user_id)
      const [dispResult, prodResult, pecaResult] = await Promise.all([
        supabase.from("dispositivos_catalogo").select("*").eq("catalogo_slug", slug).order("created_at", { ascending: false }),
        supabase.from("produtos_catalogo" as any).select("*").eq("catalogo_slug", slug).order("created_at", { ascending: false }),
        supabase.from("pecas_catalogo" as any).select("*").eq("catalogo_slug", slug).order("created_at", { ascending: false }),
      ]);

      if (dispResult.error) {
        console.error("Erro ao buscar dispositivos:", dispResult.error);
        setError("Erro ao carregar dispositivos.");
        return;
      }

      // Parse da configuração do catálogo
      const catalogoConfig = configLoja.catalogo_config 
        ? (configLoja.catalogo_config as unknown as ConfiguracaoCatalogo)
        : CONFIG_PADRAO;

      // Mapear dispositivos para ItemCatalogo
      const dispositivosItens: ItemCatalogo[] = (dispResult.data || []).map((d: any) => dispositivoParaItemCatalogo({
        id: d.id || '',
        tipo: d.tipo || 'celular',
        marca: d.marca || '',
        modelo: d.modelo || '',
        cor: d.cor,
        capacidade_gb: d.capacidade_gb,
        condicao: (d.condicao || 'semi_novo') as 'novo' | 'semi_novo' | 'usado',
        preco: d.preco,
        preco_promocional: d.preco_promocional,
        foto_url: d.foto_url,
        fotos: Array.isArray(d.fotos) ? (d.fotos as string[]) : undefined,
        garantia: d.garantia,
        tempo_garantia: d.tempo_garantia,
        saude_bateria: d.saude_bateria,
        subtipo_computador: d.subtipo_computador,
        vendido: d.vendido,
        created_at: d.created_at,
        quantidade: d.quantidade || 1,
      } as any));

      // Mapear produtos para ItemCatalogo
      const produtosItens: ItemCatalogo[] = (prodResult.data || []).map((p: any) => produtoParaItemCatalogo({
        id: p.id,
        nome: p.nome,
        preco: p.preco,
        fotos: Array.isArray(p.fotos) ? p.fotos : [],
        quantidade: p.quantidade || 1,
        created_at: p.created_at,
        tipo: 'produto',
        codigo_barras: p.codigo_barras,
        sku: p.sku,
      } as any));

      // Mapear peças para ItemCatalogo
      const pecasItens: ItemCatalogo[] = (pecaResult.data || []).map((p: any) => produtoParaItemCatalogo({
        id: p.id,
        nome: p.nome,
        preco: p.preco,
        fotos: Array.isArray(p.fotos) ? p.fotos : [],
        quantidade: p.quantidade || 1,
        created_at: p.created_at,
        tipo: 'peca',
        codigo_barras: p.codigo_barras,
      } as any));

      const todosItens = [...dispositivosItens, ...produtosItens, ...pecasItens];

      const idsDisponiveis = todosItens.map((item) => item.id);
      const { idsValidos: idsSelecionados } = sanitizarSelecaoCatalogo(catalogoConfig.itensSelecionadosIds, idsDisponiveis);
      const categoriasSanitizadas = sanitizarCategoriasCatalogo(catalogoConfig.categoriasCatalogo, idsDisponiveis);
      const configSanitizada: ConfiguracaoCatalogo = {
        ...catalogoConfig,
        itensSelecionadosIds: idsSelecionados,
        categoriasCatalogo: categoriasSanitizadas,
      };

      // Aplicar filtro de seleção
      const itensMapeados = idsSelecionados && idsSelecionados.length > 0
        ? todosItens.filter(item => idsSelecionados.includes(item.id))
        : todosItens;

      // Mapear dados da view pública para o tipo esperado
      const configuracaoLojaCompleta = configLoja ? {
        ...configLoja,
        // Campos não disponíveis na view pública (preenchidos com valores padrão)
        user_id: '',
        created_at: null,
        updated_at: null,
        cnpj: null,
        endereco: null,
        telefone: null,
        email: null,
        cep: null,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        razao_social: null,
        inscricao_estadual: null,
        inscricao_municipal: null,
        horario_funcionamento: null,
      } as unknown as ConfiguracaoLoja : null;

      setDados({
        configuracaoLoja: configuracaoLojaCompleta,
        itens: itensMapeados,
        config: configSanitizada,
      });
    } catch (err) {
      console.error("Erro ao buscar catálogo:", err);
      setError("Erro inesperado ao carregar catálogo.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Catálogo Indisponível</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <Button onClick={buscarCatalogo} variant="outline">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!dados || dados.itens.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 mx-auto bg-muted rounded-full flex items-center justify-center">
            <Smartphone className="w-10 h-10 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {dados?.configuracaoLoja?.nome_loja || "Catálogo"}
            </h1>
            <p className="text-muted-foreground">Nenhum dispositivo disponível no momento.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <CatalogoOnline
          itens={dados.itens}
          configuracaoLoja={dados.configuracaoLoja}
          config={dados.config}
        />
      </div>
    </div>
  );
}

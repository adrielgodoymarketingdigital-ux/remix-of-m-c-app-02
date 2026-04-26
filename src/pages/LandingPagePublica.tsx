import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LandingPagePreview } from "@/components/catalogo/LandingPagePreview";
import { ConfiguracaoLandingPage, LANDING_PAGE_PADRAO, ConfiguracaoCatalogo, CONFIG_PADRAO } from "@/types/catalogo";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { Dispositivo } from "@/types/dispositivo";

export default function LandingPagePublica() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [configLoja, setConfigLoja] = useState<ConfiguracaoLoja | null>(null);
  const [configLP, setConfigLP] = useState<ConfiguracaoLandingPage>(LANDING_PAGE_PADRAO);
  const [configCatalogo, setConfigCatalogo] = useState<ConfiguracaoCatalogo>(CONFIG_PADRAO);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);

  useEffect(() => {
    if (slug) {
      carregarDados();
    }
  }, [slug]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Buscar dados da landing page via view pública
      const { data: lpData, error: lpError } = await supabase
        .from("landing_page_publico")
        .select("*")
        .eq("catalogo_slug", slug)
        .single();

      if (lpError || !lpData) {
        console.error("Landing page não encontrada:", lpError);
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Montar configuração da loja
      const lojaConfig: ConfiguracaoLoja = {
        id: "",
        nome_loja: lpData.nome_loja || "Loja",
        whatsapp: lpData.whatsapp || undefined,
        endereco: lpData.endereco || undefined,
        cidade: lpData.cidade || undefined,
        estado: lpData.estado || undefined,
        logo_url: lpData.logo_url || undefined,
        created_at: "",
        updated_at: "",
      };
      setConfigLoja(lojaConfig);

      // Configuração da landing page
      if (lpData.landing_page_config && typeof lpData.landing_page_config === 'object') {
        setConfigLP(lpData.landing_page_config as unknown as ConfiguracaoLandingPage);
      }

      // Configuração do catálogo
      if (lpData.catalogo_config && typeof lpData.catalogo_config === 'object') {
        setConfigCatalogo(lpData.catalogo_config as unknown as ConfiguracaoCatalogo);
      }

      // Buscar dispositivos públicos via view existente
      const { data: dispositivosData, error: dispError } = await supabase
        .from("dispositivos_catalogo")
        .select("*")
        .eq("catalogo_slug", slug);

      if (dispError) {
        console.error("Erro ao buscar dispositivos:", dispError);
      } else {
        // Transformar para o tipo Dispositivo
        const dispositivosMapeados: Dispositivo[] = (dispositivosData || []).map((d) => ({
          id: d.id,
          marca: d.marca || "",
          modelo: d.modelo || "",
          tipo: d.tipo || "celular",
          cor: d.cor || undefined,
          capacidade_gb: d.capacidade_gb || undefined,
          preco: d.preco || undefined,
          preco_promocional: d.preco_promocional || undefined,
          condicao: (d.condicao as 'novo' | 'semi_novo' | 'usado') || 'usado',
          quantidade: d.quantidade || 1,
          saude_bateria: d.saude_bateria || undefined,
          garantia: d.garantia || false,
          tempo_garantia: d.tempo_garantia || undefined,
          foto_url: d.foto_url || undefined,
          fotos: Array.isArray(d.fotos) ? (d.fotos as string[]) : [],
          vendido: false,
          created_at: d.created_at || "",
        }));
        setDispositivos(dispositivosMapeados);
      }
    } catch (error) {
      console.error("Erro ao carregar landing page:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
        <h1 className="text-4xl font-bold mb-4">Página não encontrada</h1>
        <p className="text-muted-foreground mb-8">
          Esta landing page não existe ou não está mais disponível.
        </p>
        <a
          href="/"
          className="text-primary hover:underline"
        >
          Voltar ao início
        </a>
      </div>
    );
  }

  return (
    <LandingPagePreview
      config={configLP}
      configCatalogo={configCatalogo}
      dispositivos={dispositivos}
      configuracaoLoja={configLoja}
    />
  );
}

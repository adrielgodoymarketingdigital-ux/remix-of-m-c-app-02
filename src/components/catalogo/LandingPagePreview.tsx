import { useMemo } from "react";
import { MessageCircle, MapPin, Clock, Instagram, Facebook, Phone, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardCatalogo } from "./CardCatalogo";
import {
  ConfiguracaoLandingPage,
  ConfiguracaoCatalogo,
  TEMPLATES_PADRAO,
  CONFIG_PADRAO,
  LANDING_PAGE_PADRAO,
} from "@/types/catalogo";
import { Dispositivo } from "@/types/dispositivo";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { dispositivoParaItemCatalogo } from "@/types/catalogo-item";

const FONT_MAP: Record<string, string> = {
  inter: "'Inter', sans-serif",
  poppins: "'Poppins', sans-serif",
  playfair: "'Playfair Display', serif",
  montserrat: "'Montserrat', sans-serif",
  raleway: "'Raleway', sans-serif",
  oswald: "'Oswald', sans-serif",
  'open-sans': "'Open Sans', sans-serif",
  roboto: "'Roboto', sans-serif",
  lato: "'Lato', sans-serif",
  nunito: "'Nunito', sans-serif",
};

const GOOGLE_FONTS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Poppins:wght@400;600;700&family=Playfair+Display:wght@400;700&family=Montserrat:wght@400;600;700&family=Raleway:wght@400;600;700&family=Oswald:wght@400;600;700&family=Open+Sans:wght@400;600;700&family=Roboto:wght@400;500;700&family=Lato:wght@400;700&family=Nunito:wght@400;600;700&display=swap";

interface LandingPagePreviewProps {
  config: ConfiguracaoLandingPage;
  configCatalogo?: ConfiguracaoCatalogo;
  dispositivos: Dispositivo[];
  configuracaoLoja: ConfiguracaoLoja | null;
  modoEdicao?: boolean;
  onAtualizarDispositivo?: (
    id: string,
    dados: { fotos: string[]; preco: number | null; precoPromocional: number | null }
  ) => Promise<void>;
}

export function LandingPagePreview({
  config,
  configCatalogo = CONFIG_PADRAO,
  dispositivos,
  configuracaoLoja,
  modoEdicao = false,
  onAtualizarDispositivo,
}: LandingPagePreviewProps) {
  const safeConfig: ConfiguracaoLandingPage = useMemo(() => {
    const incoming = (config ?? {}) as Partial<ConfiguracaoLandingPage>;
    return {
      ...LANDING_PAGE_PADRAO,
      ...incoming,
      dispositivosDestaque: Array.isArray(incoming.dispositivosDestaque)
        ? incoming.dispositivosDestaque
        : LANDING_PAGE_PADRAO.dispositivosDestaque,
    };
  }, [config]);

  const template = useMemo(() => {
    return TEMPLATES_PADRAO.find((t) => t.id === safeConfig.templateBase) || TEMPLATES_PADRAO[0];
  }, [safeConfig.templateBase]);

  // Merge custom colors over template
  const cores = useMemo(() => ({
    ...template.cores,
    ...(safeConfig.corFundoCustom ? { fundo: safeConfig.corFundoCustom } : {}),
    ...(safeConfig.corTextoCustom ? { texto: safeConfig.corTextoCustom } : {}),
  }), [template.cores, safeConfig.corFundoCustom, safeConfig.corTextoCustom]);

  const fonteTitulo = FONT_MAP[safeConfig.fonteTitulo || 'inter'] || FONT_MAP.inter;
  const fonteCorpo = FONT_MAP[safeConfig.fonteCorpo || 'inter'] || FONT_MAP.inter;

  // Grid responsivo: mobile vs desktop independentes
  const gridColunasMobile = safeConfig.gridColunasMobile || 1;
  const gridColunasDesktop = safeConfig.gridColunasDesktop || safeConfig.gridColunas || 3;
  const gridColsClass = `${gridColunasMobile === 2 ? 'grid-cols-2' : 'grid-cols-1'} ${
    gridColunasDesktop === 2 ? 'md:grid-cols-2' : gridColunasDesktop === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'
  }`;

  // Card styles from secaoGrid
  const cardShadow = (() => {
    switch (safeConfig.secaoGrid?.sombraCard) {
      case 'nenhuma': return 'shadow-none';
      case 'leve': return 'shadow-sm';
      case 'forte': return 'shadow-xl';
      default: return 'shadow-md';
    }
  })();
  const cardRadius = (() => {
    switch (safeConfig.secaoGrid?.borderRadiusCard) {
      case 'nenhum': return 'rounded-none';
      case 'pequeno': return 'rounded-sm';
      case 'grande': return 'rounded-2xl';
      default: return 'rounded-lg';
    }
  })();

  const destaqueIds = safeConfig.dispositivosDestaque || [];

  const dispositivosDestaque = useMemo(() => {
    return dispositivos.filter((d) => destaqueIds.includes(d.id));
  }, [dispositivos, destaqueIds]);

  const dispositivosGrid = useMemo(() => {
    return dispositivos.filter((d) => !destaqueIds.includes(d.id));
  }, [dispositivos, destaqueIds]);

  const whatsappLink = configuracaoLoja?.whatsapp
    ? `https://wa.me/55${configuracaoLoja.whatsapp.replace(/\D/g, "")}`
    : "#";

  const scrollToGrid = () => {
    document.getElementById("grid-dispositivos")?.scrollIntoView({ behavior: "smooth" });
  };

  const heroAnimationClass = (() => {
    switch (safeConfig.animacaoHero) {
      case 'fade': return 'animate-[fadeIn_0.8s_ease-out]';
      case 'slide-up': return 'animate-[slideUp_0.8s_ease-out]';
      case 'zoom': return 'animate-[zoomIn_0.8s_ease-out]';
      default: return '';
    }
  })();

  const headerStyle = (() => {
    const base: React.CSSProperties = { borderColor: `${cores.primaria}20` };
    switch (safeConfig.headerEstilo) {
      case 'transparente':
        return { ...base, backgroundColor: 'transparent' };
      case 'colorido':
        return { ...base, backgroundColor: cores.primaria, color: '#fff' };
      default:
        return { ...base, backgroundColor: `${cores.fundo}ee` };
    }
  })();

  const headerTextColor = safeConfig.headerEstilo === 'colorido' ? '#fff' : cores.texto;

  const ctaBgColor = safeConfig.secaoHero?.corBotao || safeConfig.corBotaoCustom || (safeConfig.heroEstilo === 'simples' ? cores.primaria : '#ffffff');
  const ctaTextColor = safeConfig.secaoHero?.corBotaoTexto || safeConfig.corBotaoTextoCustom || (safeConfig.heroEstilo === 'simples' ? '#ffffff' : cores.primaria);

  return (
    <>
      {/* Google Fonts */}
      <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
      
      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <div className="min-h-screen" style={{ backgroundColor: cores.fundo, fontFamily: fonteCorpo }}>

        {/* Badge Promocional */}
        {safeConfig.mostrarBadge && safeConfig.textoBadge && (
          <div
            className="text-center py-2 px-4 text-xs sm:text-sm font-semibold"
            style={{ backgroundColor: safeConfig.corBadge || '#EF4444', color: '#fff' }}
          >
            {safeConfig.textoBadge}
          </div>
        )}

        {/* Header */}
        <header
          className={`${safeConfig.headerEstilo === 'fixo' ? 'sticky top-0' : ''} z-50 border-b backdrop-blur-sm`}
          style={headerStyle}
        >
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {(safeConfig.logoLandingPageUrl || configuracaoLoja?.logo_url) && (
                <img
                  src={safeConfig.logoLandingPageUrl || configuracaoLoja?.logo_url || ''}
                  alt={configuracaoLoja?.nome_loja || "Logo"}
                  className="h-8 sm:h-10 w-auto object-contain flex-shrink-0"
                />
              )}
              <span
                className="font-bold text-sm sm:text-lg truncate"
                style={{ color: headerTextColor, fontFamily: fonteTitulo }}
              >
                {configuracaoLoja?.nome_loja || "Minha Loja"}
              </span>
            </div>

            {configuracaoLoja?.whatsapp && (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <Button
                  size="sm"
                  style={{ backgroundColor: "#25D366", color: "#fff" }}
                  className="gap-1.5 text-xs sm:text-sm"
                >
                  <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </Button>
              </a>
            )}
          </div>
        </header>

        {/* Hero */}
        {safeConfig.mostrarHero && (
          <section
            className="relative py-12 sm:py-16 md:py-24 overflow-hidden"
            style={{
              background: safeConfig.secaoHero?.corFundo
                ? safeConfig.secaoHero.corFundo
                : safeConfig.heroEstilo === "gradiente"
                  ? `linear-gradient(135deg, ${cores.primaria} 0%, ${cores.secundaria} 100%)`
                  : safeConfig.heroEstilo === "imagem" && safeConfig.heroImagemFundo
                  ? `url(${safeConfig.heroImagemFundo}) center/cover no-repeat`
                  : cores.primaria,
            }}
          >
            {safeConfig.heroEstilo === "imagem" && safeConfig.heroImagemFundo && (
              <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} />
            )}

            <div className={`relative max-w-4xl mx-auto px-4 text-center ${heroAnimationClass}`}>
              <h1
                className="text-2xl sm:text-3xl md:text-5xl font-bold mb-3 sm:mb-4 leading-tight"
                style={{
                  color: safeConfig.secaoHero?.corTitulo || safeConfig.secaoHero?.corTexto || (safeConfig.heroEstilo === "simples" ? cores.texto : "#ffffff"),
                  fontFamily: fonteTitulo,
                }}
              >
                {safeConfig.heroTitulo}
              </h1>
              <p
                className="text-sm sm:text-lg md:text-xl mb-6 sm:mb-8 opacity-90 max-w-2xl mx-auto"
                style={{
                  color: safeConfig.secaoHero?.corTexto || (safeConfig.heroEstilo === "simples" ? cores.texto : "#ffffff"),
                }}
              >
                {safeConfig.heroSubtitulo}
              </p>
              <Button
                variant="ghost"
                size="lg"
                onClick={scrollToGrid}
                style={{ background: ctaBgColor, color: ctaTextColor }}
                className="gap-2 font-semibold px-6 sm:px-8 text-sm sm:text-base shadow-md hover:opacity-90"
              >
                {safeConfig.heroCTA}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </section>
        )}

        {/* Destaques */}
        {safeConfig.mostrarDestaques && dispositivosDestaque.length > 0 && (
          <section className="py-8 sm:py-12 md:py-16" style={{ backgroundColor: safeConfig.secaoDestaques?.corFundo || `${cores.primaria}08` }}>
            <div className="max-w-6xl mx-auto px-4">
              <h2
                className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-6 sm:mb-8"
                style={{ color: safeConfig.secaoDestaques?.corTitulo || safeConfig.secaoDestaques?.corTexto || cores.texto, fontFamily: fonteTitulo }}
              >
                {safeConfig.tituloDestaques}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                {dispositivosDestaque.map((dispositivo) => (
                  <CardCatalogo
                    key={dispositivo.id}
                    item={dispositivoParaItemCatalogo(dispositivo)}
                    whatsapp={configuracaoLoja?.whatsapp}
                    config={configCatalogo}
                    cores={cores}
                    modoEdicao={modoEdicao}
                    onAtualizarItem={onAtualizarDispositivo ? async (id, _tipo, dados) => { await onAtualizarDispositivo(id, dados); } : undefined}
                    cardClasses={`${cardShadow} hover:shadow-xl transition-shadow ${cardRadius}`}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Grid de Dispositivos */}
        {safeConfig.mostrarGrid && (
          <section id="grid-dispositivos" className="py-8 sm:py-12 md:py-16" style={{ backgroundColor: safeConfig.secaoGrid?.corFundo }}>
            <div className="max-w-6xl mx-auto px-4">
              <div className="text-center mb-6 sm:mb-8">
                <h2
                  className="text-xl sm:text-2xl md:text-3xl font-bold"
                  style={{ color: safeConfig.secaoGrid?.corTitulo || safeConfig.secaoGrid?.corTexto || cores.texto, fontFamily: fonteTitulo }}
                >
                  {safeConfig.tituloGrid || 'Todos os Dispositivos'}
                </h2>
                {safeConfig.subtituloGrid && (
                  <p className="mt-2 text-sm sm:text-base opacity-70" style={{ color: safeConfig.secaoGrid?.corTexto || cores.texto }}>
                    {safeConfig.subtituloGrid}
                  </p>
                )}
              </div>

              {dispositivos.length === 0 ? (
                <p className="text-center py-8 sm:py-12 text-sm" style={{ color: cores.texto, opacity: 0.6 }}>
                  Nenhum dispositivo disponível no momento.
                </p>
              ) : (
                <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
                  {(safeConfig.mostrarDestaques ? dispositivosGrid : dispositivos).map((dispositivo) => (
                    <CardCatalogo
                      key={dispositivo.id}
                      item={dispositivoParaItemCatalogo(dispositivo)}
                      whatsapp={configuracaoLoja?.whatsapp}
                      config={configCatalogo}
                      cores={cores}
                      modoEdicao={modoEdicao}
                      onAtualizarItem={onAtualizarDispositivo ? async (id, _tipo, dados) => { await onAtualizarDispositivo(id, dados); } : undefined}
                      cardClasses={`${cardShadow} ${cardRadius}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Contato */}
        {safeConfig.mostrarContato && (
          <section className="py-8 sm:py-12 md:py-16" style={{ backgroundColor: safeConfig.secaoContato?.corFundo || `${cores.secundaria}10` }}>
            <div className="max-w-4xl mx-auto px-4">
              <h2
                className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-6 sm:mb-8"
                style={{ color: safeConfig.secaoContato?.corTitulo || safeConfig.secaoContato?.corTexto || cores.texto, fontFamily: fonteTitulo }}
              >
                {safeConfig.tituloContato || 'Entre em Contato'}
              </h2>

              <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-6">
                {/* WhatsApp */}
                {configuracaoLoja?.whatsapp && (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 sm:gap-3 p-2 sm:p-4 rounded-lg border bg-background hover:shadow-md transition-shadow overflow-hidden"
                    style={{ borderColor: `${cores.primaria}30` }}>
                    <div className="w-7 h-7 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#25D366" }}>
                      <Phone className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[11px] sm:text-base leading-tight" style={{ color: safeConfig.secaoContato?.corTexto || cores.texto }}>WhatsApp</p>
                      <p className="text-[10px] sm:text-sm truncate leading-tight" style={{ color: safeConfig.secaoContato?.corTexto || cores.texto, opacity: 0.7 }}>{configuracaoLoja.whatsapp}</p>
                    </div>
                  </a>
                )}

                {/* Endereço */}
                {safeConfig.mostrarEndereco && configuracaoLoja?.endereco && (
                  <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-4 rounded-lg border bg-background overflow-hidden" style={{ borderColor: `${cores.primaria}30` }}>
                    <div className="w-7 h-7 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${safeConfig.secaoContato?.corIcones || cores.primaria}20` }}>
                      <MapPin className="w-3.5 h-3.5 sm:w-6 sm:h-6" style={{ color: safeConfig.secaoContato?.corIcones || cores.primaria }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[11px] sm:text-base leading-tight" style={{ color: safeConfig.secaoContato?.corTexto || cores.texto }}>Endereço</p>
                      <p className="text-[10px] sm:text-sm break-words leading-tight" style={{ color: safeConfig.secaoContato?.corTexto || cores.texto, opacity: 0.7 }}>
                        {configuracaoLoja.endereco}{configuracaoLoja.cidade && `, ${configuracaoLoja.cidade}`}{configuracaoLoja.estado && ` - ${configuracaoLoja.estado}`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Horário */}
                {safeConfig.mostrarHorario && safeConfig.horarioFuncionamento && (
                  <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-4 rounded-lg border bg-background overflow-hidden" style={{ borderColor: `${cores.primaria}30` }}>
                    <div className="w-7 h-7 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${safeConfig.secaoContato?.corIcones || cores.primaria}20` }}>
                      <Clock className="w-3.5 h-3.5 sm:w-6 sm:h-6" style={{ color: safeConfig.secaoContato?.corIcones || cores.primaria }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[11px] sm:text-base leading-tight" style={{ color: safeConfig.secaoContato?.corTexto || cores.texto }}>Horário</p>
                      <p className="text-[10px] sm:text-sm break-words leading-tight" style={{ color: safeConfig.secaoContato?.corTexto || cores.texto, opacity: 0.7 }}>{safeConfig.horarioFuncionamento}</p>
                    </div>
                  </div>
                )}

                {/* Redes Sociais */}
                {safeConfig.mostrarRedesSociais && (safeConfig.linkInstagram || safeConfig.linkFacebook) && (
                  <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
                    {safeConfig.linkInstagram && (
                      <a href={safeConfig.linkInstagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ backgroundColor: "#E1306C" }}>
                        <Instagram className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </a>
                    )}
                    {safeConfig.linkFacebook && (
                      <a href={safeConfig.linkFacebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ backgroundColor: "#1877F2" }}>
                        <Facebook className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </a>
                    )}
                  </div>
                )}

                {/* Botão Extra */}
                {safeConfig.secaoContato?.mostrarBotaoExtra && safeConfig.secaoContato?.textoBotaoExtra && (
                  <a href={safeConfig.secaoContato.linkBotaoExtra || '#'} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center p-3 sm:p-4 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
                    style={{ backgroundColor: cores.primaria, color: '#fff' }}>
                    {safeConfig.secaoContato.textoBotaoExtra}
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        {safeConfig.mostrarFooter && (
          <footer
            className="py-4 sm:py-6 border-t"
            style={{ backgroundColor: safeConfig.secaoFooter?.corFundo || cores.secundaria, borderColor: `${cores.primaria}30` }}
          >
            <div className="max-w-6xl mx-auto px-4 text-center">
              <p className="text-xs sm:text-sm" style={{ color: safeConfig.secaoFooter?.corTexto || cores.fundo, opacity: 0.8 }}>
                {safeConfig.textoRodape || `© ${new Date().getFullYear()} ${configuracaoLoja?.nome_loja || "Minha Loja"}. Todos os direitos reservados.`}
              </p>
            </div>
          </footer>
        )}

        {/* Botão flutuante WhatsApp */}
        {configuracaoLoja?.whatsapp && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`fixed bottom-4 sm:bottom-6 ${
              safeConfig.posicaoWhatsApp === 'esquerda' ? 'left-4 sm:left-6' : 'right-4 sm:right-6'
            } flex items-center gap-2 rounded-full shadow-lg hover:scale-110 transition-transform z-50 ${
              safeConfig.textoWhatsApp ? 'px-4 py-3' : 'w-12 h-12 sm:w-14 sm:h-14 justify-center'
            }`}
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle className={`${safeConfig.textoWhatsApp ? 'w-5 h-5' : 'w-6 h-6 sm:w-7 sm:h-7'} text-white`} />
            {safeConfig.textoWhatsApp && (
              <span className="text-white text-sm font-medium hidden sm:inline">
                {safeConfig.textoWhatsApp}
              </span>
            )}
          </a>
        )}
      </div>
    </>
  );
}

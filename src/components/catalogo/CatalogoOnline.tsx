import { useState, useMemo } from "react";
import { ItemCatalogo } from "@/types/catalogo-item";
import { CategoriaCatalogo } from "@/types/catalogo";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { CardCatalogo } from "./CardCatalogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  SlidersHorizontal,
  X,
  Smartphone,
  Tablet,
  Laptop,
  Watch,
  Monitor,
  MessageCircle,
  Package,
} from "lucide-react";
import { ConfiguracaoCatalogo, CONFIG_PADRAO, TEMPLATES_PADRAO } from "@/types/catalogo";

interface CatalogoOnlineProps {
  itens: ItemCatalogo[];
  configuracaoLoja: ConfiguracaoLoja | null;
  config?: ConfiguracaoCatalogo;
  modoEdicao?: boolean;
  onAtualizarItem?: (id: string, tipoItem: string, dados: { fotos: string[]; preco: number | null; precoPromocional: number | null }) => Promise<void>;
}

export function CatalogoOnline({
  itens,
  configuracaoLoja,
  config = CONFIG_PADRAO,
  modoEdicao = false,
  onAtualizarItem,
}: CatalogoOnlineProps) {
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroCondicao, setFiltroCondicao] = useState<string>("todos");
  const [ordenacao, setOrdenacao] = useState<string>("preco_asc");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const templateAtual =
    TEMPLATES_PADRAO.find((t) => t.id === config.templateId) || TEMPLATES_PADRAO[0];

  const cores = {
    primaria: config.corPrimariaPersonalizada || templateAtual.cores.primaria,
    header:
      config.corHeaderPersonalizada ||
      config.corPrimariaPersonalizada ||
      templateAtual.cores.primaria,
    fundo: config.corFundoPersonalizada || templateAtual.cores.fundo,
    texto: config.corTextoPersonalizada || templateAtual.cores.texto,
    secundaria: templateAtual.cores.secundaria,
    destaque: templateAtual.cores.destaque,
  };

  const logoUrl = config.logoPersonalizadoUrl || configuracaoLoja?.logo_url;

  const tiposDisponiveis = useMemo(() => {
    const tipos = new Set<string>();
    itens.forEach((item) => {
      if (item.tipo_item === 'dispositivo' && item.tipo_dispositivo) {
        tipos.add(item.tipo_dispositivo);
      } else if (item.tipo_item === 'produto') {
        tipos.add('Produto');
      } else if (item.tipo_item === 'peca') {
        tipos.add('Peça');
      }
    });
    return Array.from(tipos).sort();
  }, [itens]);

  const itensFiltrados = useMemo(() => {
    let resultado = [...itens];

    if (busca) {
      const termoBusca = busca.toLowerCase();
      resultado = resultado.filter(
        (item) =>
          item.nome.toLowerCase().includes(termoBusca) ||
          (item.subtitulo && item.subtitulo.toLowerCase().includes(termoBusca)) ||
          (item.tipo_dispositivo && item.tipo_dispositivo.toLowerCase().includes(termoBusca))
      );
    }

    if (filtroTipo !== "todos") {
      resultado = resultado.filter((item) => {
        if (filtroTipo === 'Produto') return item.tipo_item === 'produto';
        if (filtroTipo === 'Peça') return item.tipo_item === 'peca';
        return item.tipo_dispositivo === filtroTipo;
      });
    }

    if (filtroCondicao !== "todos") {
      resultado = resultado.filter((item) => item.condicao === filtroCondicao);
    }

    switch (ordenacao) {
      case "preco_asc":
        resultado.sort((a, b) => (a.preco || 0) - (b.preco || 0));
        break;
      case "preco_desc":
        resultado.sort((a, b) => (b.preco || 0) - (a.preco || 0));
        break;
      case "nome_asc":
        resultado.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        break;
      case "recente":
        resultado.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
    }

    return resultado;
  }, [itens, busca, filtroTipo, filtroCondicao, ordenacao]);

  const getTipoIcon = (tipo: string) => {
    const tipoLower = tipo.toLowerCase();
    if (tipoLower.includes("celular") || tipoLower.includes("smartphone"))
      return <Smartphone className="w-4 h-4" />;
    if (tipoLower.includes("tablet")) return <Tablet className="w-4 h-4" />;
    if (tipoLower.includes("notebook") || tipoLower.includes("laptop"))
      return <Laptop className="w-4 h-4" />;
    if (tipoLower.includes("relogio") || tipoLower.includes("watch"))
      return <Watch className="w-4 h-4" />;
    if (tipoLower.includes("computador") || tipoLower.includes("desktop"))
      return <Monitor className="w-4 h-4" />;
    if (tipoLower === "produto" || tipoLower === "peça")
      return <Package className="w-4 h-4" />;
    return <Smartphone className="w-4 h-4" />;
  };

  const limparFiltros = () => {
    setBusca("");
    setFiltroTipo("todos");
    setFiltroCondicao("todos");
    setOrdenacao("preco_asc");
  };

  const temFiltrosAtivos = busca || filtroTipo !== "todos" || filtroCondicao !== "todos";

  const getCardClasses = () => {
    const classes: string[] = [];
    switch (config.bordaCards) {
      case "quadrada": classes.push("rounded-none"); break;
      case "sutil": classes.push("rounded-sm"); break;
      default: classes.push("rounded-xl");
    }
    switch (config.sombraCards) {
      case "nenhuma": classes.push("shadow-none"); break;
      case "leve": classes.push("shadow-sm"); break;
      case "forte": classes.push("shadow-xl"); break;
      default: classes.push("shadow-md");
    }
    return classes.join(" ");
  };

  const getGridGap = () => {
    switch (config.espacamentoCards) {
      case "compacto": return "gap-1 sm:gap-2";
      case "amplo": return "gap-2 sm:gap-4";
      default: return "gap-1.5 sm:gap-3";
    }
  };

  const getHeaderStyles = (): React.CSSProperties => {
    if (config.imagemFundoUrl) {
      return {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.5)), url(${config.imagemFundoUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: "#ffffff",
      };
    }
    switch (config.estiloHeader) {
      case "gradiente":
        return {
          background: `linear-gradient(135deg, ${cores.header}15 0%, ${cores.header}05 50%, ${cores.header}15 100%)`,
          borderColor: `${cores.header}30`,
        };
      case "minimalista":
        return {
          backgroundColor: "transparent",
          borderBottom: `1px solid ${cores.header}20`,
        };
      case "simples":
      default:
        return {
          backgroundColor: cores.header,
          color: "#ffffff",
        };
    }
  };

  const headerTextColor = config.imagemFundoUrl || config.estiloHeader === "simples" ? "#ffffff" : cores.texto;

  const handleWhatsAppClick = () => {
    if (configuracaoLoja?.whatsapp) {
      const numero = configuracaoLoja.whatsapp.replace(/\D/g, "");
      const mensagem = encodeURIComponent(
        `Olá! Vi o catálogo e gostaria de mais informações.`
      );
      window.open(`https://wa.me/55${numero}?text=${mensagem}`, "_blank");
    }
  };

  const getContainerStyles = (): React.CSSProperties => {
    return {
      backgroundColor: cores.fundo,
      minHeight: "100vh",
    };
  };

  return (
    <div className="relative pb-20" style={getContainerStyles()}>
      <div
        className={`text-center py-4 sm:py-8 md:py-12 px-3 sm:px-4 ${
          config.estiloHeader !== "minimalista" && !config.imagemFundoUrl
            ? "rounded-b-xl sm:rounded-b-3xl border-b"
            : ""
        } ${config.imagemFundoUrl ? "rounded-b-xl sm:rounded-b-3xl" : ""}`}
        style={getHeaderStyles()}
      >
        {config.mostrarLogo !== false && logoUrl && (
          <img
            src={logoUrl}
            alt={configuracaoLoja?.nome_loja || "Logo"}
            className="h-8 sm:h-14 md:h-16 mx-auto mb-2 sm:mb-4 object-contain"
          />
        )}
        <h1
          className="text-base sm:text-2xl md:text-3xl font-bold px-2"
          style={{ color: headerTextColor }}
        >
          {config.textos.tituloCapa ||
            configuracaoLoja?.nome_loja ||
            "Catálogo"}
        </h1>
        {(config.mostrarSubtitulo ?? true) && config.textos.subtituloCapa && (
          <p
            className="mt-1 text-xs sm:text-base opacity-80 px-2"
            style={{ color: headerTextColor }}
          >
            {config.textos.subtituloCapa}
          </p>
        )}
        <p
          className="mt-1 sm:mt-2 text-[10px] sm:text-sm opacity-70"
          style={{ color: headerTextColor }}
        >
          {itensFiltrados.length} itens disponíveis
        </p>
      </div>

      <div className="px-2 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="space-y-2 sm:space-y-4 py-3 sm:py-6">
          <div className="flex gap-1.5 sm:gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-7 sm:pl-9 h-8 sm:h-11 text-xs sm:text-base"
              />
            </div>
            <Button
              variant={mostrarFiltros ? "secondary" : "outline"}
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className="h-8 sm:h-11 px-2 sm:px-4"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Filtros</span>
            </Button>
          </div>

          {mostrarFiltros && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-3 p-2 sm:p-4 bg-muted/50 rounded-lg">
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {tiposDisponiveis.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      <div className="flex items-center gap-2">
                        {getTipoIcon(tipo)}
                        {tipo}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filtroCondicao} onValueChange={setFiltroCondicao}>
                <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                  <SelectValue placeholder="Condição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as condições</SelectItem>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="semi_novo">Semi-novo</SelectItem>
                  <SelectItem value="usado">Usado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={ordenacao} onValueChange={setOrdenacao}>
                <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preco_asc">Menor preço</SelectItem>
                  <SelectItem value="preco_desc">Maior preço</SelectItem>
                  <SelectItem value="nome_asc">Nome (A-Z)</SelectItem>
                  <SelectItem value="recente">Mais recentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {temFiltrosAtivos && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] sm:text-sm text-muted-foreground">Filtros ativos:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={limparFiltros}
                className="h-6 sm:h-7 text-[10px] sm:text-xs px-2"
              >
                <X className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                Limpar
              </Button>
            </div>
          )}
        </div>

        {itensFiltrados.length > 0 ? (
          <ItensAgrupados
            itens={itensFiltrados}
            categorias={config.categoriasCatalogo}
            config={config}
            cores={cores}
            getCardClasses={getCardClasses}
            getGridGap={getGridGap}
            configuracaoLoja={configuracaoLoja}
            modoEdicao={modoEdicao}
            onAtualizarItem={onAtualizarItem}
          />
        ) : (
          <div className="text-center py-8 sm:py-16 text-muted-foreground">
            <Package className="w-10 h-10 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-4 opacity-30" />
            <p className="text-sm sm:text-lg font-medium">Nenhum item encontrado</p>
            <p className="text-[10px] sm:text-sm">Tente ajustar os filtros de busca</p>
          </div>
        )}

        {configuracaoLoja && (config.mostrarContato ?? true) && (
          <div className="text-center py-3 sm:py-6 border-t border-border mt-4 sm:mt-8">
            <p className="text-[10px] sm:text-sm text-muted-foreground px-2">
              {config.textos.textoContato}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-4 mt-1.5 sm:mt-2 text-[10px] sm:text-sm">
              {configuracaoLoja.telefone && <span>{configuracaoLoja.telefone}</span>}
              {configuracaoLoja.whatsapp && <span>{configuracaoLoja.whatsapp}</span>}
              {configuracaoLoja.email && <span className="break-all">{configuracaoLoja.email}</span>}
            </div>
          </div>
        )}
      </div>

      {(config.mostrarBotaoWhatsApp ?? true) && configuracaoLoja?.whatsapp && (
        <button
          onClick={handleWhatsAppClick}
          className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 w-10 h-10 sm:w-14 sm:h-14 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-50 active:scale-95"
          style={{ backgroundColor: config.corBotaoWhatsApp || '#22c55e' }}
          aria-label="Contato via WhatsApp"
        >
          <MessageCircle className="w-5 h-5 sm:w-7 sm:h-7" />
        </button>
      )}
    </div>
  );
}

// Sub-component to render items grouped by category or as a flat grid
function ItensAgrupados({
  itens,
  categorias,
  config,
  cores,
  getCardClasses,
  getGridGap,
  configuracaoLoja,
  modoEdicao,
  onAtualizarItem,
}: {
  itens: ItemCatalogo[];
  categorias?: CategoriaCatalogo[];
  config: any;
  cores: any;
  getCardClasses: () => string;
  getGridGap: () => string;
  configuracaoLoja: any;
  modoEdicao: boolean;
  onAtualizarItem?: (id: string, tipoItem: string, dados: { fotos: string[]; preco: number | null; precoPromocional: number | null }) => Promise<void>;
}) {
  const categoriasComItens = useMemo(() => {
    if (!categorias || categorias.length === 0) return null;

    const grupos = categorias
      .map((cat) => ({
        ...cat,
        itens: itens.filter((item) => cat.itemIds.includes(item.id)),
      }))
      .filter((g) => g.itens.length > 0);

    // Items not in any category
    const idsCategorizados = new Set(categorias.flatMap((c) => c.itemIds));
    const semCategoria = itens.filter((item) => !idsCategorizados.has(item.id));

    if (grupos.length === 0) return null;

    return { grupos, semCategoria };
  }, [itens, categorias]);

  const renderGrid = (items: ItemCatalogo[]) => (
    <div
      className={`grid ${getGridGap()}`}
      style={{
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))',
      }}
    >
      {items.map((item) => (
        <div key={item.id} className="min-w-0 max-w-[280px] w-full justify-self-center">
          <CardCatalogo
            item={item}
            whatsapp={configuracaoLoja?.whatsapp}
            config={config}
            cardClasses={getCardClasses()}
            cores={cores}
            modoEdicao={modoEdicao}
            onAtualizarItem={onAtualizarItem}
          />
        </div>
      ))}
    </div>
  );

  if (!categoriasComItens) {
    return renderGrid(itens);
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {categoriasComItens.grupos.map((grupo) => (
        <div key={grupo.id}>
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div
              className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: grupo.cor || cores.primaria }}
            />
            <h2
              className="text-sm sm:text-lg font-bold"
              style={{ color: cores.texto }}
            >
              {grupo.nome}
            </h2>
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              ({grupo.itens.length})
            </span>
          </div>
          {renderGrid(grupo.itens)}
        </div>
      ))}

      {categoriasComItens.semCategoria.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <h2
              className="text-sm sm:text-lg font-bold"
              style={{ color: cores.texto }}
            >
              Outros
            </h2>
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              ({categoriasComItens.semCategoria.length})
            </span>
          </div>
          {renderGrid(categoriasComItens.semCategoria)}
        </div>
      )}
    </div>
  );
}

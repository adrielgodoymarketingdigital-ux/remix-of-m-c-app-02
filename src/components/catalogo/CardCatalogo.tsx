import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ItemCatalogo } from "@/types/catalogo-item";
import { formatCurrency } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Battery, HardDrive, Shield, Smartphone, Pencil, Package } from "lucide-react";
import { ConfiguracaoCatalogo, CONFIG_PADRAO } from "@/types/catalogo";
import { DialogEditarDispositivoCatalogo } from "./DialogEditarDispositivoCatalogo";

interface CardCatalogoProps {
  item: ItemCatalogo;
  whatsapp?: string;
  config?: ConfiguracaoCatalogo;
  cardClasses?: string;
  cores?: {
    primaria: string;
    fundo: string;
    texto: string;
    secundaria: string;
    destaque: string;
  };
  modoEdicao?: boolean;
  onAtualizarItem?: (id: string, tipoItem: string, dados: { fotos: string[]; preco: number | null; precoPromocional: number | null }) => Promise<void>;
}

function formatarGarantia(tempoMeses: number): string {
  if (tempoMeses >= 12) {
    const anos = Math.floor(tempoMeses / 12);
    const mesesRestantes = tempoMeses % 12;
    if (mesesRestantes === 0) {
      return anos === 1 ? "1 ano" : `${anos} anos`;
    }
    return `${anos} ano${anos > 1 ? 's' : ''} e ${mesesRestantes} ${mesesRestantes === 1 ? 'mês' : 'meses'}`;
  }
  return tempoMeses === 1 ? "1 mês" : `${tempoMeses} meses`;
}

function ImageGallery({ 
  fotos, 
  nome,
  isProduct,
}: { 
  fotos: string[]; 
  nome: string;
  isProduct?: boolean;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  if (fotos.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
        {isProduct ? (
          <Package className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground/30" />
        ) : (
          <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground/30" />
        )}
      </div>
    );
  }

  if (fotos.length === 1) {
    return (
      <img
        src={fotos[0]}
        alt={nome}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={emblaRef} className="overflow-hidden w-full h-full">
        <div className="flex h-full">
          {fotos.map((foto, index) => (
            <div key={index} className="flex-[0_0_100%] min-w-0 h-full">
              <img
                src={foto}
                alt={`${nome} - Foto ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5 z-10">
        {fotos.map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              scrollTo(index);
            }}
            className={`w-1 h-1 rounded-full transition-all ${
              index === selectedIndex
                ? "bg-white shadow-md"
                : "bg-white/40 hover:bg-white/60"
            }`}
            aria-label={`Ver foto ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export function CardCatalogo({ 
  item, 
  whatsapp, 
  config = CONFIG_PADRAO,
  cardClasses = '',
  cores,
  modoEdicao = false,
  onAtualizarItem,
}: CardCatalogoProps) {
  const [dialogEditarAberto, setDialogEditarAberto] = useState(false);
  
  const isDevice = item.tipo_item === 'dispositivo';
  const isProduct = item.tipo_item === 'produto' || item.tipo_item === 'peca';

  const handleWhatsApp = () => {
    if (!whatsapp) return;
    const numero = whatsapp.replace(/\D/g, "");
    const mensagem = encodeURIComponent(
      `Olá! Vi no catálogo e tenho interesse no ${item.nome}. Ainda está disponível?`
    );
    window.open(`https://wa.me/55${numero}?text=${mensagem}`, "_blank");
  };

  const handleSalvar = async (dados: { fotos: string[]; preco: number | null; precoPromocional: number | null }) => {
    if (onAtualizarItem) {
      await onAtualizarItem(item.id, item.tipo_item, dados);
    }
  };

  const getCondicaoBadge = () => {
    if (!(config.mostrarCondicao ?? true) || !isDevice || !item.condicao) return null;
    
    switch (item.condicao) {
      case "novo":
        return <Badge className="bg-green-500 hover:bg-green-600 text-[7px] sm:text-[9px] px-0.5 sm:px-1 py-0 leading-tight">Novo</Badge>;
      case "semi_novo":
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-[7px] sm:text-[9px] px-0.5 sm:px-1 py-0 leading-tight">Semi-novo</Badge>;
      case "usado":
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-[7px] sm:text-[9px] px-0.5 sm:px-1 py-0 leading-tight">Usado</Badge>;
      default:
        return null;
    }
  };

  const getTipoBadge = () => {
    if (!isProduct) return null;
    return (
      <Badge className="bg-purple-500 hover:bg-purple-600 text-[7px] sm:text-[9px] px-0.5 sm:px-1 py-0 leading-tight">
        {item.tipo_item === 'produto' ? 'Produto' : 'Peça'}
      </Badge>
    );
  };

  const getTextoGarantia = () => {
    if (!item.garantia) return null;
    const tempoMeses = item.tempo_garantia || 0;
    if (tempoMeses > 0) {
      return config.textos.textoGarantia.replace("{tempo}", formatarGarantia(tempoMeses));
    }
    return "Com garantia";
  };

  const cardStyle: React.CSSProperties = cores ? {
    backgroundColor: cores.fundo,
    color: cores.texto,
  } : {};

  const precoStyle: React.CSSProperties = cores ? {
    color: cores.primaria,
  } : {};

  const precoPromocional = item.preco_promocional;
  const temDesconto = precoPromocional && precoPromocional > 0 && item.preco && precoPromocional < item.preco;

  return (
    <>
      <div 
        className={`group relative bg-card border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/30 min-w-0 flex flex-col ${cardClasses || 'rounded-xl'}`}
        style={cardStyle}
      >
        <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/50 overflow-hidden flex-shrink-0">
          <ImageGallery 
            fotos={item.fotos} 
            nome={item.nome}
            isProduct={isProduct}
          />
          
          <div className="absolute top-0.5 left-0.5 z-10 flex flex-col gap-0.5">
            {getCondicaoBadge()}
            {getTipoBadge()}
          </div>

          {modoEdicao && (
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-0.5 right-0.5 z-10 h-5 w-5 sm:h-6 sm:w-6 bg-background/90 backdrop-blur-sm hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                setDialogEditarAberto(true);
              }}
            >
              <Pencil className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </Button>
          )}

          {!modoEdicao && item.quantidade === 0 && (
            <div className="absolute top-0.5 right-0.5 z-10">
              <Badge variant="destructive" className="text-[7px] sm:text-[9px] px-0.5 sm:px-1 py-0">
                Sem estoque
              </Badge>
            </div>
          )}
          {!modoEdicao && config.mostrarQuantidade && item.quantidade > 1 && (
            <div className="absolute top-0.5 right-0.5 z-10">
              <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-[7px] sm:text-[9px] px-0.5 sm:px-1 py-0">
                {item.quantidade} un.
              </Badge>
            </div>
          )}

          {!modoEdicao && item.fotos.length > 1 && !(config.mostrarQuantidade && item.quantidade > 1) && (
            <div className="absolute top-0.5 right-0.5 z-10">
              <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-[7px] sm:text-[9px] px-0.5 sm:px-1 py-0">
                {item.fotos.length} fotos
              </Badge>
            </div>
          )}

          {(config.mostrarDesconto ?? true) && temDesconto && (
            <div className="absolute bottom-0.5 left-0.5 z-10">
              <Badge className="bg-red-500 hover:bg-red-600 text-[7px] sm:text-[9px] px-0.5 sm:px-1 py-0">
                -{Math.round(((item.preco! - precoPromocional) / item.preco!) * 100)}%
              </Badge>
            </div>
          )}
        </div>

        <div className="p-1 sm:p-1.5 flex flex-col flex-grow min-w-0">
          <div className="min-w-0 mb-0.5">
            {isDevice && item.marca && (config.mostrarMarca ?? true) ? (
              <>
                <p className="text-[7px] sm:text-[8px] text-muted-foreground uppercase tracking-wider truncate leading-none">
                  {item.marca}
                </p>
                <h3 
                  className="font-semibold text-[9px] sm:text-[10px] leading-tight truncate text-card-foreground" 
                  title={item.modelo}
                  style={cores ? { color: cores.texto } : undefined}
                >
                  {item.modelo}
                </h3>
              </>
            ) : (
              <h3 
                className="font-semibold text-[9px] sm:text-[10px] leading-tight truncate text-card-foreground" 
                title={item.nome}
                style={cores ? { color: cores.texto } : undefined}
              >
                {item.nome}
              </h3>
            )}
          </div>

          <div className="flex flex-wrap gap-0.5 mb-0.5 overflow-hidden max-h-[20px] sm:max-h-[24px]">
            {isDevice && (config.mostrarCapacidade ?? true) && item.capacidade_gb && (
              <div className="flex items-center gap-0.5 text-[7px] sm:text-[8px] text-muted-foreground bg-muted px-0.5 sm:px-1 py-0 rounded-full flex-shrink-0">
                <HardDrive className="w-1.5 h-1.5 sm:w-2 sm:h-2 flex-shrink-0" />
                <span>{item.capacidade_gb}GB</span>
              </div>
            )}
            {isDevice && config.mostrarBateria && item.saude_bateria && (
              <div className="flex items-center gap-0.5 text-[7px] sm:text-[8px] text-muted-foreground bg-muted px-0.5 sm:px-1 py-0 rounded-full flex-shrink-0">
                <Battery className="w-1.5 h-1.5 sm:w-2 sm:h-2 flex-shrink-0" />
                <span>{item.saude_bateria}%</span>
              </div>
            )}
            {isDevice && (config.mostrarCor ?? true) && item.cor && (
              <div className="text-[7px] sm:text-[8px] text-muted-foreground bg-muted px-0.5 sm:px-1 py-0 rounded-full truncate max-w-[35px] sm:max-w-[45px] flex-shrink-0">
                {item.cor}
              </div>
            )}
          </div>

          {isDevice && config.mostrarGarantia && item.garantia && (
            <div className="flex items-center gap-0.5 text-[7px] sm:text-[8px] text-green-600 mb-0.5 overflow-hidden">
              <Shield className="w-1.5 h-1.5 sm:w-2 sm:h-2 flex-shrink-0" />
              <span className="truncate">{getTextoGarantia()}</span>
            </div>
          )}

          <div className="flex-grow" />

          <div className="pt-0.5 border-t border-border mt-auto">
            {config.mostrarPrecos && item.preco != null && item.preco > 0 ? (
              <div className="min-w-0 mb-0.5">
                <p className="text-[6px] sm:text-[8px] text-muted-foreground leading-none">
                  {config.textos.textoPreco}
                </p>
                {temDesconto ? (
                  <div className="flex flex-col">
                    <span className="text-[8px] sm:text-[10px] text-muted-foreground line-through leading-none">
                      {formatCurrency(item.preco)}
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold text-green-600 leading-tight">
                      {formatCurrency(precoPromocional!)}
                    </span>
                  </div>
                ) : (
                  <p className="text-[10px] sm:text-xs font-bold text-primary truncate leading-tight" style={precoStyle}>
                    {formatCurrency(item.preco)}
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-0.5">
                <p className="text-[8px] sm:text-[9px] text-muted-foreground">Consulte</p>
              </div>
            )}

            {whatsapp && !modoEdicao && (
              <Button
                size="sm"
                className="text-white h-5 sm:h-6 text-[8px] sm:text-[9px] px-1 sm:px-1.5 w-full"
                style={{ backgroundColor: config.corBotaoWhatsApp || '#22c55e' }}
                onClick={handleWhatsApp}
              >
                <MessageCircle className="w-2 h-2 sm:w-2.5 sm:h-2.5 mr-0.5 flex-shrink-0" />
                <span>{config.textoBotaoWhatsApp || 'WhatsApp'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Dialog de edição - para todos os tipos */}
      {modoEdicao && (
        <DialogEditarDispositivoCatalogo
          open={dialogEditarAberto}
          onOpenChange={setDialogEditarAberto}
          dispositivo={{
            id: item.id,
            marca: item.marca || item.nome,
            modelo: item.modelo || '',
            tipo: item.tipo_dispositivo || item.tipo_item,
            condicao: item.condicao || 'semi_novo',
            garantia: item.garantia || false,
            vendido: item.vendido || false,
            quantidade: item.quantidade,
            created_at: item.created_at,
            preco: item.preco,
            preco_promocional: item.preco_promocional,
            foto_url: item.foto_url,
            fotos: item.fotos,
          }}
          onSave={handleSalvar}
        />
      )}
    </>
  );
}

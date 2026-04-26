import { 
  SecaoNovidade, 
  SecaoBannerConfig, 
  SecaoVideoConfig, 
  SecaoImagemConfig,
  SecaoCardConfig,
  SecaoTextoConfig,
  SecaoGridConfig,
  EstiloSecao,
  EstiloTextoCard
} from "@/types/novidade";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface VisualizadorNovidadeProps {
  conteudo: SecaoNovidade[];
  className?: string;
}

// Helper para gerar classes de estilo
const getEstiloClasses = (estilo?: EstiloSecao) => {
  if (!estilo) return {};
  
  const classes: string[] = [];
  const styles: React.CSSProperties = {};
  
  // Tamanho da seção
  switch (estilo.tamanho) {
    case 'pequeno':
      classes.push('max-w-sm');
      break;
    case 'medio':
      classes.push('max-w-2xl');
      break;
    case 'grande':
      classes.push('max-w-4xl');
      break;
    // 'auto' não adiciona restrição
  }
  
  // Tamanho do texto
  switch (estilo.tamanhoTexto) {
    case 'xs':
      classes.push('text-xs');
      break;
    case 'sm':
      classes.push('text-sm');
      break;
    case 'lg':
      classes.push('text-lg');
      break;
    case 'xl':
      classes.push('text-xl');
      break;
    case '2xl':
      classes.push('text-2xl');
      break;
    case '3xl':
      classes.push('text-3xl');
      break;
    // 'base' é o padrão
  }
  
  // Fonte
  switch (estilo.fonte) {
    case 'serif':
      classes.push('font-serif');
      break;
    case 'mono':
      classes.push('font-mono');
      break;
    case 'display':
      classes.push('font-bold tracking-tight');
      break;
    // 'default' usa a fonte padrão
  }
  
  // Padding
  switch (estilo.padding) {
    case 'none':
      classes.push('p-0');
      break;
    case 'sm':
      classes.push('p-2');
      break;
    case 'lg':
      classes.push('p-6');
      break;
    default:
      classes.push('p-4');
  }
  
  // Border radius
  switch (estilo.borderRadius) {
    case 'none':
      classes.push('rounded-none');
      break;
    case 'sm':
      classes.push('rounded-sm');
      break;
    case 'lg':
      classes.push('rounded-xl');
      break;
    case 'full':
      classes.push('rounded-3xl');
      break;
    default:
      classes.push('rounded-lg');
  }
  
  // Cores (inline styles)
  if (estilo.corFundo) {
    styles.backgroundColor = estilo.corFundo;
  }
  if (estilo.corTexto) {
    styles.color = estilo.corTexto;
  }
  
  return { className: classes.join(' '), style: styles };
};

// Helper para gerar estilos de texto do card
const getTextoCardStyles = (estilo?: EstiloTextoCard) => {
  if (!estilo) return { className: '', style: {} as React.CSSProperties };
  
  const classes: string[] = [];
  const styles: React.CSSProperties = {};
  
  // Tamanho do texto
  switch (estilo.tamanhoTexto) {
    case 'xs':
      classes.push('text-xs');
      break;
    case 'sm':
      classes.push('text-sm');
      break;
    case 'lg':
      classes.push('text-lg');
      break;
    case 'xl':
      classes.push('text-xl');
      break;
    case '2xl':
      classes.push('text-2xl');
      break;
    case '3xl':
      classes.push('text-3xl');
      break;
  }
  
  // Fonte
  switch (estilo.fonte) {
    case 'serif':
      classes.push('font-serif');
      break;
    case 'mono':
      classes.push('font-mono');
      break;
    case 'display':
      classes.push('tracking-tight');
      break;
  }
  
  // Negrito
  if (estilo.negrito) {
    classes.push('font-bold');
  }
  
  // Itálico
  if (estilo.italico) {
    classes.push('italic');
  }
  
  // Cor do texto
  if (estilo.corTexto) {
    styles.color = estilo.corTexto;
  }
  
  return { className: classes.join(' '), style: styles };
};

// Componente para Banner
function SecaoBanner({ config, estilo }: { config: SecaoBannerConfig; estilo?: EstiloSecao }) {
  const { className: estiloClass, style: estiloStyle } = getEstiloClasses(estilo);
  
  const alturaClasses = {
    small: 'h-32',
    medium: 'h-48',
    large: 'h-64',
  };

  const content = (
    <div 
      className={cn(
        "relative overflow-hidden",
        config.largura === 'full' ? 'w-full' : 'w-1/2',
        alturaClasses[config.altura],
        estiloClass || 'rounded-lg'
      )}
      style={estiloStyle}
    >
      <img 
        src={config.imagem_url} 
        alt="Banner"
        className="w-full h-full object-cover"
      />
    </div>
  );

  if (config.link_url) {
    return (
      <a href={config.link_url} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }

  return content;
}

// Componente para Vídeo
function SecaoVideo({ config, estilo }: { config: SecaoVideoConfig; estilo?: EstiloSecao }) {
  const { className: estiloClass, style: estiloStyle } = getEstiloClasses(estilo);
  
  // Detectar tipo de vídeo (YouTube, Vimeo, ou direto)
  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be') 
        ? url.split('/').pop() 
        : new URLSearchParams(new URL(url).search).get('v');
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('vimeo.com')) {
      const videoId = url.split('/').pop();
      return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
  };

  const isDirectVideo = config.video_url.endsWith('.mp4') || 
                        config.video_url.endsWith('.webm') ||
                        config.video_url.endsWith('.mov');

  return (
    <div 
      className={cn("w-full space-y-2", estiloClass)}
      style={estiloStyle}
    >
      {config.titulo && (
        <h3 className="text-lg font-semibold">{config.titulo}</h3>
      )}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
        {isDirectVideo ? (
          <video 
            src={config.video_url} 
            controls 
            className="w-full h-full object-cover"
          />
        ) : (
          <iframe
            src={getEmbedUrl(config.video_url)}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        )}
      </div>
      {config.descricao && (
        <p className="text-sm text-muted-foreground">{config.descricao}</p>
      )}
    </div>
  );
}

// Componente para Imagem
function SecaoImagem({ config, estilo }: { config: SecaoImagemConfig; estilo?: EstiloSecao }) {
  const { className: estiloClass, style: estiloStyle } = getEstiloClasses(estilo);
  
  const posicaoClasses = {
    left: 'text-left',
    center: 'text-center mx-auto',
    right: 'text-right ml-auto',
  };

  return (
    <div 
      className={cn("w-full", posicaoClasses[config.posicao], estiloClass)}
      style={estiloStyle}
    >
      <img 
        src={config.imagem_url} 
        alt={config.legenda || "Imagem"}
        className="max-w-full rounded-lg"
      />
      {config.legenda && (
        <p className="text-sm text-muted-foreground mt-2">{config.legenda}</p>
      )}
    </div>
  );
}

// Componente para Card
function SecaoCard({ config, estilo }: { config: SecaoCardConfig; estilo?: EstiloSecao }) {
  const { className: estiloClass, style: estiloStyle } = getEstiloClasses(estilo);
  const tituloStyles = getTextoCardStyles(config.estiloTitulo);
  const descricaoStyles = getTextoCardStyles(config.estiloDescricao);
  const botaoStyles = getTextoCardStyles(config.estiloBotao);
  
  return (
    <Card className={cn("overflow-hidden", estiloClass)} style={estiloStyle}>
      {config.imagem_url && (
        <div className="aspect-video overflow-hidden">
          <img 
            src={config.imagem_url} 
            alt={config.titulo}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardHeader>
        <CardTitle 
          className={tituloStyles.className}
          style={tituloStyles.style}
        >
          {config.titulo}
        </CardTitle>
        {config.descricao && (
          <CardDescription 
            className={descricaoStyles.className}
            style={descricaoStyles.style}
          >
            {config.descricao}
          </CardDescription>
        )}
      </CardHeader>
      {config.link_url && (
        <CardContent>
          <Button asChild variant="outline" className={botaoStyles.className} style={botaoStyles.style}>
            <a href={config.link_url} target="_blank" rel="noopener noreferrer">
              {config.botao_texto || "Saiba mais"}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

// Componente para Texto
function SecaoTexto({ config, estilo }: { config: SecaoTextoConfig; estilo?: EstiloSecao }) {
  const { className: estiloClass, style: estiloStyle } = getEstiloClasses(estilo);
  
  const estiloBaseClasses = {
    normal: 'text-base',
    destaque: 'text-lg font-medium text-primary',
    titulo: 'text-2xl font-bold',
  };

  return (
    <div 
      className={cn(estiloBaseClasses[config.estilo], estiloClass)}
      style={estiloStyle}
    >
      {config.conteudo.split('\n').map((linha, i) => (
        <p key={i} className="mb-2">{linha}</p>
      ))}
    </div>
  );
}

// Componente para Grid
function SecaoGrid({ config, estilo }: { config: SecaoGridConfig; estilo?: EstiloSecao }) {
  const { className: estiloClass, style: estiloStyle } = getEstiloClasses(estilo);
  
  const colunasClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  };

  return (
    <div 
      className={cn("grid gap-4", colunasClasses[config.colunas], estiloClass)}
      style={estiloStyle}
    >
      {config.itens.map((item, index) => {
        const content = (
          <div key={index} className="space-y-2">
            <div className="aspect-square overflow-hidden rounded-lg">
              <img 
                src={item.imagem_url} 
                alt={item.titulo || `Item ${index + 1}`}
                className="w-full h-full object-cover transition-transform hover:scale-105"
              />
            </div>
            {item.titulo && (
              <p className="text-sm font-medium text-center">{item.titulo}</p>
            )}
          </div>
        );

        if (item.link_url) {
          return (
            <a 
              key={index}
              href={item.link_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block"
            >
              {content}
            </a>
          );
        }

        return content;
      })}
    </div>
  );
}

// Componente principal
export function VisualizadorNovidade({ conteudo, className }: VisualizadorNovidadeProps) {
  if (!conteudo || conteudo.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Nenhum conteúdo disponível
      </div>
    );
  }

  // Ordenar por ordem
  const secoesOrdenadas = [...conteudo].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {secoesOrdenadas.map((secao) => {
        switch (secao.tipo) {
          case 'banner':
            return <SecaoBanner key={secao.id} config={secao.config as SecaoBannerConfig} estilo={secao.estilo} />;
          case 'video':
            return <SecaoVideo key={secao.id} config={secao.config as SecaoVideoConfig} estilo={secao.estilo} />;
          case 'imagem':
            return <SecaoImagem key={secao.id} config={secao.config as SecaoImagemConfig} estilo={secao.estilo} />;
          case 'card':
            return <SecaoCard key={secao.id} config={secao.config as SecaoCardConfig} estilo={secao.estilo} />;
          case 'texto':
            return <SecaoTexto key={secao.id} config={secao.config as SecaoTextoConfig} estilo={secao.estilo} />;
          case 'grid':
            return <SecaoGrid key={secao.id} config={secao.config as SecaoGridConfig} estilo={secao.estilo} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

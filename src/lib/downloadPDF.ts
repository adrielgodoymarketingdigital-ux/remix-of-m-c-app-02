import { toast } from "sonner";

/**
 * Estratégias de download com múltiplos fallbacks para evitar bloqueios
 * do navegador ou extensões de ad-block
 */

interface DownloadOptions {
  url: string;
  filename: string;
  onRetry?: () => void;
}

/**
 * Tenta fazer download de PDF usando múltiplas estratégias:
 * 1. Fetch + blob + element <a> (mais confiável)
 * 2. Window.open como fallback
 * 3. Oferece cópia de URL como último recurso
 */
export async function downloadPDFRobust({ url, filename, onRetry }: DownloadOptions): Promise<void> {
  try {
    // Estratégia 1: Fetch + Blob + Download (mais confiável, não bloqueado)
    toast.loading("Baixando recibo...");
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    
    // Criar link temporário e forçar download
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'recibo-legal.pdf';
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 100);
    
    toast.dismiss();
    toast.success("Recibo baixado com sucesso!");
    
  } catch (error: any) {
    console.error("Erro no download via fetch:", error);
    
    // Estratégia 2: Fallback para window.open
    try {
      toast.dismiss();
      toast.loading("Tentando método alternativo...");
      
      const newWindow = window.open(url, '_blank');
      
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        // Pop-up foi bloqueado
        throw new Error('Pop-up bloqueado');
      }
      
      toast.dismiss();
      toast.success("Recibo aberto em nova aba!");
      
    } catch (fallbackError) {
      console.error("Erro no fallback window.open:", fallbackError);
      
      // Estratégia 3: Oferecer cópia de URL e instruções
      toast.dismiss();
      toast.error(
        "Não foi possível baixar automaticamente. Copie o link abaixo:",
        {
          duration: 10000,
          action: {
            label: "Copiar Link",
            onClick: async () => {
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Link copiado! Cole no navegador para acessar o recibo.");
              } catch (clipboardError) {
                console.error("Erro ao copiar:", clipboardError);
                // Mostrar URL em um prompt como último recurso
                prompt("Copie este link para acessar o recibo:", url);
              }
            }
          },
          description: onRetry ? "Ou tente novamente" : undefined,
          cancel: onRetry ? {
            label: "Tentar Novamente",
            onClick: onRetry
          } : undefined
        }
      );
      
      // Também logar no console para facilitar debug
      console.log("URL do PDF:", url);
      
      // Mostrar dica sobre extensões de bloqueio
      setTimeout(() => {
        toast.info(
          "💡 Dica: Desative extensões de bloqueio (AdBlock, uBlock) temporariamente se o problema persistir",
          { duration: 8000 }
        );
      }, 1000);
    }
  }
}

/**
 * Versão simplificada para abrir PDF em nova aba
 * (usado quando o usuário quer apenas visualizar, não baixar)
 */
export function openPDFInNewTab(url: string): void {
  try {
    const newWindow = window.open(url, '_blank');
    
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      // Pop-up bloqueado
      toast.error("Pop-up bloqueado! Permitir pop-ups para visualizar o recibo.", {
        action: {
          label: "Copiar Link",
          onClick: async () => {
            await navigator.clipboard.writeText(url);
            toast.success("Link copiado!");
          }
        }
      });
    }
  } catch (error) {
    console.error("Erro ao abrir PDF:", error);
    toast.error("Erro ao abrir PDF. Verifique o bloqueador de pop-ups.");
  }
}

/**
 * Detecta se o download foi bloqueado e retorna o tipo de bloqueio
 */
export function detectBlockedDownload(error: any): 'popup' | 'network' | 'unknown' {
  const errorMessage = error?.message?.toLowerCase() || '';
  
  if (errorMessage.includes('pop') || errorMessage.includes('blocked')) {
    return 'popup';
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return 'network';
  }
  
  return 'unknown';
}

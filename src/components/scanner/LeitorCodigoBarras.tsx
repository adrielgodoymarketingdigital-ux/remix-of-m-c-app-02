import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScanBarcode, X, Camera, Flashlight, RotateCcw, ZoomIn } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { toast } from "sonner";

// Formatos de código de barras suportados - incluindo QR para IMEI
const FORMATOS_SUPORTADOS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

interface LeitorCodigoBarrasProps {
  onCodigoLido: (codigo: string) => void;
  placeholder?: string;
  disabled?: boolean;
  valor?: string;
  onChange?: (valor: string) => void;
  className?: string;
  mostrarInput?: boolean;
}

export const LeitorCodigoBarras = ({
  onCodigoLido,
  placeholder = "Código de barras",
  disabled = false,
  valor = "",
  onChange,
  className = "",
  mostrarInput = true,
}: LeitorCodigoBarrasProps) => {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [flashLigado, setFlashLigado] = useState(false);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(5);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const pararScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (error) {
        console.log("Scanner já estava parado");
      }
      scannerRef.current = null;
      trackRef.current = null;
      setEscaneando(false);
      setFlashLigado(false);
      setZoomLevel(1);
      setZoomSupported(false);
    }
  }, []);

  const aplicarZoom = useCallback(async (nivel: number) => {
    if (!trackRef.current) return;
    
    try {
      const capabilities = trackRef.current.getCapabilities() as any;
      if (capabilities.zoom) {
        await trackRef.current.applyConstraints({
          advanced: [{ zoom: nivel } as any]
        });
        setZoomLevel(nivel);
      }
    } catch (error) {
      console.error("Erro ao aplicar zoom:", error);
    }
  }, []);

  const iniciarScanner = useCallback(async (useCameraId?: string) => {
    try {
      // Parar scanner anterior se existir
      await pararScanner();

      // Aguardar um pouco para garantir que o DOM está pronto
      await new Promise(resolve => setTimeout(resolve, 200));

      const readerElement = document.getElementById("barcode-reader");
      if (!readerElement) {
        console.error("Elemento barcode-reader não encontrado");
        return;
      }

      // Criar scanner com configurações otimizadas
      const scanner = new Html5Qrcode("barcode-reader", {
        formatsToSupport: FORMATOS_SUPORTADOS,
        verbose: false,
      });
      scannerRef.current = scanner;

      // Obter lista de câmeras
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        
        // Preferir câmera traseira
        const cameraTraseira = devices.find(
          d => d.label.toLowerCase().includes("back") || 
               d.label.toLowerCase().includes("rear") ||
               d.label.toLowerCase().includes("traseira") ||
               d.label.toLowerCase().includes("environment")
        );
        const cameraParaUsar = useCameraId || cameraTraseira?.id || devices[0].id;
        setCameraId(cameraParaUsar);

        // Configurações otimizadas para mobile
        await scanner.start(
          cameraParaUsar,
          {
            fps: 15, // Mais FPS para captura mais rápida
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              // Área de escaneamento dinâmica baseada no tamanho da tela
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const boxWidth = Math.floor(minEdge * 0.9);
              const boxHeight = Math.floor(minEdge * 0.4); // Mais largo para códigos de barras
              return { width: boxWidth, height: boxHeight };
            },
            aspectRatio: 1.0, // Aspecto quadrado para melhor visualização
            disableFlip: false, // Permitir flip para códigos espelhados
          },
          (decodedText, result) => {
            // Código lido com sucesso
            const formato = result?.result?.format?.formatName || "código";
            onCodigoLido(decodedText);
            if (onChange) {
              onChange(decodedText);
            }
            
            // Vibrar se disponível
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }
            
            toast.success("Código lido com sucesso!", {
              description: `${formato}: ${decodedText}`,
            });
            pararScanner();
            setDialogAberto(false);
          },
          () => {
            // Erro de leitura - continua tentando silenciosamente
          }
        );

        // Verificar suporte a zoom após iniciar
        try {
          const videoElement = readerElement.querySelector("video");
          if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            const track = stream.getVideoTracks()[0];
            trackRef.current = track;
            
            const capabilities = track.getCapabilities() as any;
            if (capabilities.zoom) {
              setZoomSupported(true);
              setMinZoom(capabilities.zoom.min || 1);
              setMaxZoom(capabilities.zoom.max || 5);
              setZoomLevel(capabilities.zoom.min || 1);
            }
          }
        } catch (zoomError) {
          console.log("Zoom não suportado nesta câmera");
        }

        setEscaneando(true);
      } else {
        toast.error("Nenhuma câmera encontrada");
        setDialogAberto(false);
      }
    } catch (error: any) {
      console.error("Erro ao iniciar scanner:", error);
      
      let mensagemErro = "Verifique as permissões de câmera do navegador.";
      if (error.message?.includes("Permission denied") || error.name === "NotAllowedError") {
        mensagemErro = "Permissão de câmera negada. Permita o acesso nas configurações do navegador.";
      } else if (error.message?.includes("not found") || error.name === "NotFoundError") {
        mensagemErro = "Câmera não encontrada no dispositivo.";
      } else if (error.message?.includes("in use") || error.name === "NotReadableError") {
        mensagemErro = "Câmera em uso por outro aplicativo. Feche outros apps e tente novamente.";
      }
      
      toast.error("Erro ao acessar câmera", { description: mensagemErro });
      setDialogAberto(false);
    }
  }, [onCodigoLido, onChange, pararScanner]);

  const alternarFlash = async () => {
    if (!scannerRef.current) return;
    
    try {
      const track = scannerRef.current.getRunningTrackCameraCapabilities();
      if (track.torchFeature().isSupported()) {
        const novoEstado = !flashLigado;
        await track.torchFeature().apply(novoEstado);
        setFlashLigado(novoEstado);
      } else {
        toast.info("Flash não disponível nesta câmera");
      }
    } catch (error) {
      console.error("Erro ao alternar flash:", error);
    }
  };

  const trocarCamera = async () => {
    if (cameras.length <= 1) {
      toast.info("Apenas uma câmera disponível");
      return;
    }
    
    const currentIndex = cameras.findIndex(c => c.id === cameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCameraId = cameras[nextIndex].id;
    
    await iniciarScanner(nextCameraId);
  };

  useEffect(() => {
    if (dialogAberto) {
      // Delay para garantir que o dialog está renderizado
      const timer = setTimeout(() => {
        iniciarScanner();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      pararScanner();
    }
  }, [dialogAberto, iniciarScanner, pararScanner]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      pararScanner();
    };
  }, [pararScanner]);

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      pararScanner();
    }
    setDialogAberto(open);
  };

  return (
    <>
      <div className={`flex gap-2 ${className}`}>
        {mostrarInput && (
          <Input
            placeholder={placeholder}
            value={valor}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            className="flex-1"
          />
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setDialogAberto(true)}
          disabled={disabled}
          title="Escanear código de barras"
        >
          <ScanBarcode className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={dialogAberto} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Escanear Código de Barras
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 px-4 pb-4">
            {/* Container do scanner */}
            <div
              ref={containerRef}
              id="barcode-reader"
              className="w-full rounded-lg overflow-hidden bg-black min-h-[350px] relative"
              style={{ maxHeight: "50vh" }}
            />

            {/* Controle de Zoom */}
            {zoomSupported && escaneando && (
              <div className="flex items-center gap-3 px-2">
                <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Slider
                  value={[zoomLevel]}
                  min={minZoom}
                  max={maxZoom}
                  step={0.1}
                  onValueChange={(value) => aplicarZoom(value[0])}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-12 text-right">
                  {zoomLevel.toFixed(1)}x
                </span>
              </div>
            )}

            {/* Dica de uso */}
            <p className="text-sm text-muted-foreground text-center">
              {escaneando 
                ? zoomSupported 
                  ? "Use o zoom para focar em códigos pequenos"
                  : "Aponte a câmera para o código de barras ou IMEI"
                : "Iniciando câmera..."
              }
            </p>

            {/* Botões de controle */}
            <div className="flex flex-wrap justify-center gap-2">
              {cameras.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={trocarCamera}
                  disabled={!escaneando}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Trocar Câmera
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={alternarFlash}
                disabled={!escaneando}
                className={flashLigado ? "bg-yellow-100 border-yellow-400" : ""}
              >
                <Flashlight className={`h-4 w-4 mr-2 ${flashLigado ? "text-yellow-600" : ""}`} />
                {flashLigado ? "Flash Ligado" : "Flash"}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogAberto(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Componente simplificado só com botão de scanner (para barras de busca)
interface BotaoScannerProps {
  onCodigoLido: (codigo: string) => void;
  disabled?: boolean;
  className?: string;
}

export const BotaoScanner = ({
  onCodigoLido,
  disabled = false,
  className = "",
}: BotaoScannerProps) => {
  return (
    <LeitorCodigoBarras
      onCodigoLido={onCodigoLido}
      disabled={disabled}
      className={className}
      mostrarInput={false}
    />
  );
};

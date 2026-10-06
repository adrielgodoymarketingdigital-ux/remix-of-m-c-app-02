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
import { ScanBarcode, X, Camera, Flashlight, RotateCcw, ZoomIn, Hash, Loader2, AlertTriangle } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { toast } from "sonner";
import { decidirLeituraOcr } from "@/lib/codigos/imei";
import { CARACTERES_IMEI, carregarMotorOcr, type MotorOcr } from "@/lib/ocr/motorOcr";

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

// Modo Números (OCR): retângulo guia, relativo ao vídeo, e intervalo entre leituras.
const GUIA_OCR = { x: 0.075, y: 0.36, largura: 0.85, altura: 0.28 };
const INTERVALO_OCR_MS = 700;

type ModoLeitor = "barras" | "numeros";
type EstadoOcr = "parado" | "carregando" | "lendo" | "erro";

function mensagemErroCamera(error: unknown): string {
  const e = error as { message?: string; name?: string } | null;
  if (e?.message?.includes("Permission denied") || e?.name === "NotAllowedError") {
    return "Permissão de câmera negada. Permita o acesso nas configurações do navegador.";
  }
  if (e?.message?.includes("not found") || e?.name === "NotFoundError") {
    return "Câmera não encontrada no dispositivo.";
  }
  if (e?.message?.includes("in use") || e?.name === "NotReadableError") {
    return "Câmera em uso por outro aplicativo. Feche outros apps e tente novamente.";
  }
  return "Verifique as permissões de câmera do navegador.";
}

interface LeitorCodigoBarrasProps {
  onCodigoLido: (codigo: string) => void;
  /** Id único do elemento do leitor (dois leitores com o mesmo id disputam a câmera). */
  scannerId: string;
  placeholder?: string;
  disabled?: boolean;
  valor?: string;
  onChange?: (valor: string) => void;
  className?: string;
  mostrarInput?: boolean;
  titulo?: string;
  /**
   * Filtro do campo: devolve o valor a gravar ou null para continuar lendo
   * (mostrando `mensagemRecusa`). Sem ele, aceita o primeiro código lido (como antes).
   */
  aceitarCodigo?: (texto: string) => string | null;
  mensagemRecusa?: string;
  /**
   * Candidatos dentro do texto lido (ex.: extrairImeis). Com ele o leitor ganha o
   * modo "Números" (OCR) e, havendo 2+ candidatos, pede para o usuário escolher.
   */
  extrairCandidatos?: (texto: string) => string[];
  /** Caracteres que o OCR pode devolver (padrão: dígitos e "IMEI"). */
  caracteresOcr?: string;
  /**
   * No modo Números, mostrar o valor para o usuário confirmar em vez de gravar
   * direto (para campos sem dígito verificador, como número de série).
   */
  confirmarLeituraOcr?: boolean;
  dicaNumeros?: string;
  formatos?: Html5QrcodeSupportedFormats[];
  /** Toast "Código lido com sucesso!" (padrão: sim). */
  exibirToast?: boolean;
}

export const LeitorCodigoBarras = ({
  onCodigoLido,
  scannerId,
  placeholder = "Código de barras",
  disabled = false,
  valor = "",
  onChange,
  className = "",
  mostrarInput = true,
  titulo = "Escanear Código de Barras",
  aceitarCodigo,
  mensagemRecusa = "Esse código não serve para este campo. Continue apontando.",
  extrairCandidatos,
  caracteresOcr = CARACTERES_IMEI,
  confirmarLeituraOcr = false,
  dicaNumeros = "Enquadre só o número do IMEI no retângulo",
  formatos,
  exibirToast = true,
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
  const [modo, setModo] = useState<ModoLeitor>("barras");
  const [estadoOcr, setEstadoOcr] = useState<EstadoOcr>("parado");
  const [progressoOcr, setProgressoOcr] = useState(0);
  const [dica, setDica] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<string[] | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const iniciandoRef = useRef(false);
  // Modo Números
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamOcrRef = useRef<MediaStream | null>(null);
  const motorRef = useRef<MotorOcr | null>(null);
  const ocrAtivoRef = useRef(false);
  const timerOcrRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anterioresRef = useRef<string[]>([]);
  // Leitura já decidida (aceita ou aguardando escolha): ignora novos quadros.
  const decididoRef = useRef(false);

  const habilitarNumeros = !!extrairCandidatos;

  /** Candidatos que passam no filtro do campo, sem repetidos. */
  const filtrarCandidatos = useCallback((texto: string): string[] => {
    const brutos = extrairCandidatos ? extrairCandidatos(texto) : [texto];
    const aceitos: string[] = [];
    for (const c of brutos) {
      const v = aceitarCodigo ? aceitarCodigo(c) : c;
      if (v && !aceitos.includes(v)) aceitos.push(v);
    }
    return aceitos;
  }, [extrairCandidatos, aceitarCodigo]);

  const pararScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // SCANNING (2) ou PAUSED (3): a lib ainda tem o stream aberto e precisa de stop()
        if (state === 2 || state === 3) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (error) {
        console.log("Erro ao parar scanner via lib, forçando stop do track", error);
      }
      scannerRef.current = null;
    }

    // Fallback: garante que o MediaStreamTrack é efetivamente parado, mesmo que
    // scanner.stop() não tenha rodado (estado inesperado) ou tenha lançado erro.
    // Sem isso a permissão de câmera fica "presa" e a próxima tentativa falha com
    // "câmera em uso" mesmo sem nenhum outro app usando-a.
    if (trackRef.current) {
      try {
        if (trackRef.current.readyState === "live") {
          trackRef.current.stop();
        }
      } catch (error) {
        console.log("Erro ao forçar stop do track", error);
      }
      trackRef.current = null;
    }

    setEscaneando(false);
    setFlashLigado(false);
    setZoomLevel(1);
    setZoomSupported(false);
  }, []);

  /** Para o OCR por completo: laço, câmera e worker (nada fica rodando em segundo plano). */
  const pararNumeros = useCallback(() => {
    ocrAtivoRef.current = false;
    if (timerOcrRef.current) {
      clearTimeout(timerOcrRef.current);
      timerOcrRef.current = null;
    }
    streamOcrRef.current?.getTracks().forEach((t) => t.stop());
    streamOcrRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const motor = motorRef.current;
    motorRef.current = null;
    motor?.encerrar().catch((e) => console.log("Erro ao encerrar OCR", e));
    anterioresRef.current = [];
    setEstadoOcr("parado");
  }, []);

  const finalizarLeitura = useCallback((valorLido: string, descricao: string) => {
    decididoRef.current = true;
    onCodigoLido(valorLido);
    onChange?.(valorLido);
    if (navigator.vibrate) navigator.vibrate(100);
    if (exibirToast) toast.success("Código lido com sucesso!", { description: `${descricao}: ${valorLido}` });
    setDialogAberto(false);
  }, [onCodigoLido, onChange, exibirToast]);

  /** Decide o que fazer com os candidatos aceitos: 1 grava, 2+ pede escolha. */
  const decidir = useCallback((candidatos: string[], descricao: string) => {
    if (candidatos.length === 1) {
      finalizarLeitura(candidatos[0], descricao);
    } else if (candidatos.length > 1) {
      decididoRef.current = true;
      setOpcoes(candidatos);
    }
  }, [finalizarLeitura]);

  const aplicarZoom = useCallback(async (nivel: number) => {
    if (!trackRef.current) return;

    try {
      const capabilities = trackRef.current.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number } };
      if (capabilities.zoom) {
        await trackRef.current.applyConstraints({
          advanced: [{ zoom: nivel } as MediaTrackConstraintSet]
        });
        setZoomLevel(nivel);
      }
    } catch (error) {
      console.error("Erro ao aplicar zoom:", error);
    }
  }, []);

  const iniciarScanner = useCallback(async (useCameraId?: string) => {
    // Evita que chamadas concorrentes (abrir/fechar rápido, trocar câmera durante
    // a inicialização) disputem a câmera ao mesmo tempo.
    if (iniciandoRef.current) return;
    iniciandoRef.current = true;
    try {
      // Parar scanner anterior se existir
      await pararScanner();

      // Aguardar um pouco para garantir que o DOM está pronto
      await new Promise(resolve => setTimeout(resolve, 200));

      const readerElement = document.getElementById(scannerId);
      if (!readerElement) {
        console.error(`Elemento ${scannerId} não encontrado`);
        return;
      }

      // Criar scanner com configurações otimizadas
      const scanner = new Html5Qrcode(scannerId, {
        formatsToSupport: formatos ?? FORMATOS_SUPORTADOS,
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
            if (decididoRef.current) return;
            // Código de barras tem verificação própria: não precisa repetir em 2 quadros.
            const candidatos = filtrarCandidatos(decodedText);
            if (candidatos.length === 0) {
              setDica(mensagemRecusa);
              return; // continua lendo
            }
            const formato = result?.result?.format?.formatName || "código";
            decidir(candidatos, formato);
            if (candidatos.length === 1) pararScanner();
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

            const capabilities = track.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number } };
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
    } catch (error: unknown) {
      console.error("Erro ao iniciar scanner:", error);
      toast.error("Erro ao acessar câmera", { description: mensagemErroCamera(error) });
      setDialogAberto(false);
    } finally {
      iniciandoRef.current = false;
    }
  }, [pararScanner, scannerId, formatos, filtrarCandidatos, mensagemRecusa, decidir]);

  /** Um ciclo do OCR: lê o retângulo guia, confirma em 2 quadros seguidos e agenda o próximo. */
  const cicloOcr = useCallback(async () => {
    const video = videoRef.current;
    const motor = motorRef.current;
    if (!ocrAtivoRef.current || !video || !motor || decididoRef.current) return;
    const inicio = performance.now();
    if (video.videoWidth > 0 && video.readyState >= 2) {
      try {
        const recorte = {
          x: Math.round(video.videoWidth * GUIA_OCR.x),
          y: Math.round(video.videoHeight * GUIA_OCR.y),
          largura: Math.round(video.videoWidth * GUIA_OCR.largura),
          altura: Math.round(video.videoHeight * GUIA_OCR.altura),
        };
        const texto = await motor.reconhecer(video, recorte);
        if (!ocrAtivoRef.current || decididoRef.current) return;
        const atuais = filtrarCandidatos(texto);
        const decisao = decidirLeituraOcr(anterioresRef.current, atuais, confirmarLeituraOcr);
        anterioresRef.current = atuais;
        if (decisao.acao === "aceitar") {
          finalizarLeitura(decisao.valor, "Número");
          return;
        }
        if (decisao.acao === "escolher") {
          decididoRef.current = true;
          setOpcoes(decisao.opcoes);
          return;
        }
        setDica(/\d{5,}/.test(texto) && atuais.length === 0 ? mensagemRecusa : dicaNumeros);
      } catch (error) {
        console.error("[leitor] OCR falhou neste quadro", error);
      }
    }
    if (!ocrAtivoRef.current) return;
    const espera = Math.max(0, INTERVALO_OCR_MS - (performance.now() - inicio));
    timerOcrRef.current = setTimeout(() => { void cicloOcr(); }, espera);
  }, [filtrarCandidatos, finalizarLeitura, confirmarLeituraOcr, mensagemRecusa, dicaNumeros]);

  const iniciarNumeros = useCallback(async () => {
    pararNumeros();
    ocrAtivoRef.current = true;
    setDica(dicaNumeros);
    setEstadoOcr("carregando");
    setProgressoOcr(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!ocrAtivoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamOcrRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (error) {
      console.error("[leitor] câmera do modo Números", error);
      toast.error("Erro ao acessar câmera", { description: mensagemErroCamera(error) });
      pararNumeros();
      setDialogAberto(false);
      return;
    }
    try {
      // A biblioteca de OCR (tesseract.js) é importada dinamicamente dentro do motor:
      // só é baixada quando o modo Números abre.
      const motor = await carregarMotorOcr({ caracteres: caracteresOcr, onProgresso: setProgressoOcr });
      if (!ocrAtivoRef.current) {
        await motor.encerrar();
        return;
      }
      motorRef.current = motor;
      setEstadoOcr("lendo");
      void cicloOcr();
    } catch (error) {
      console.error("[leitor] falha ao carregar o OCR", error);
      streamOcrRef.current?.getTracks().forEach((t) => t.stop());
      streamOcrRef.current = null;
      ocrAtivoRef.current = false;
      setEstadoOcr("erro");
    }
  }, [pararNumeros, dicaNumeros, caracteresOcr, cicloOcr]);

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
    if (!dialogAberto) {
      pararScanner();
      pararNumeros();
      return;
    }
    decididoRef.current = false;
    setOpcoes(null);
    setDica(null);
    if (modo === "numeros") {
      pararScanner().then(() => iniciarNumeros());
      return () => pararNumeros();
    }
    pararNumeros();
    // Delay para garantir que o dialog está renderizado
    const timer = setTimeout(() => {
      iniciarScanner();
    }, 300);
    return () => clearTimeout(timer);
  }, [dialogAberto, modo, iniciarScanner, pararScanner, iniciarNumeros, pararNumeros]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      pararScanner();
      pararNumeros();
    };
  }, [pararScanner, pararNumeros]);

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      pararScanner();
      pararNumeros();
      setModo("barras");
    }
    setDialogAberto(open);
  };

  const lerDeNovo = () => {
    setOpcoes(null);
    decididoRef.current = false;
    anterioresRef.current = [];
    if (modo === "numeros" && ocrAtivoRef.current) void cicloOcr();
    else if (modo === "barras") iniciarScanner();
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
        <DialogContent className="sm:max-w-lg sm:max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {titulo}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 px-4 pb-4">
            {habilitarNumeros && (
              <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Tipo de leitura">
                <Button
                  type="button"
                  role="tab"
                  aria-selected={modo === "barras"}
                  variant={modo === "barras" ? "default" : "outline"}
                  className="h-11"
                  onClick={() => setModo("barras")}
                >
                  <ScanBarcode className="h-4 w-4 mr-2" />
                  Código de barras
                </Button>
                <Button
                  type="button"
                  role="tab"
                  aria-selected={modo === "numeros"}
                  variant={modo === "numeros" ? "default" : "outline"}
                  className="h-11"
                  onClick={() => setModo("numeros")}
                >
                  <Hash className="h-4 w-4 mr-2" />
                  Números
                </Button>
              </div>
            )}

            {/* Container do scanner de código de barras (escondido no modo Números, nunca removido com a câmera ligada) */}
            <div
              ref={containerRef}
              id={scannerId}
              className={`w-full rounded-lg overflow-hidden bg-black min-h-[350px] relative ${modo === "numeros" ? "hidden" : ""}`}
              style={{ maxHeight: "50vh" }}
            />

            {/* Modo Números: vídeo + retângulo guia */}
            {modo === "numeros" && (
              <div className="relative w-full rounded-lg overflow-hidden bg-black">
                <video ref={videoRef} className="block w-full h-auto" playsInline muted autoPlay />
                <div
                  className="pointer-events-none absolute rounded-md border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                  style={{
                    left: `${GUIA_OCR.x * 100}%`,
                    top: `${GUIA_OCR.y * 100}%`,
                    width: `${GUIA_OCR.largura * 100}%`,
                    height: `${GUIA_OCR.altura * 100}%`,
                  }}
                />
                {estadoOcr === "carregando" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white text-sm">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Carregando leitor de números…{progressoOcr > 0 ? ` ${Math.round(progressoOcr * 100)}%` : ""}
                  </div>
                )}
              </div>
            )}

            {modo === "numeros" && estadoOcr === "erro" && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-2">
                <p className="flex items-start gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  Não foi possível carregar o leitor de números. Verifique a internet e tente de novo.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => iniciarNumeros()}>Tentar de novo</Button>
                  <Button type="button" size="sm" onClick={() => setModo("barras")}>Voltar ao código de barras</Button>
                </div>
              </div>
            )}

            {/* Mais de um valor válido (ex.: tela *#06# com IMEI 1 e IMEI 2): o usuário escolhe */}
            {opcoes && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {opcoes.length > 1 ? "Encontrei mais de um número. Qual usar neste campo?" : "Confira com a tela e toque para usar:"}
                </p>
                {opcoes.map((o, i) => (
                  <Button
                    key={o}
                    type="button"
                    variant="outline"
                    className="w-full h-14 justify-start text-base font-mono"
                    onClick={() => finalizarLeitura(o, modo === "numeros" ? "Número" : "Código")}
                  >
                    <span className="mr-3 text-xs text-muted-foreground font-sans">{i + 1}</span>
                    {o}
                  </Button>
                ))}
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={lerDeNovo}>
                  Ler de novo
                </Button>
              </div>
            )}

            {/* Controle de Zoom */}
            {modo === "barras" && zoomSupported && escaneando && (
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
            {!opcoes && (
              <p className="text-sm text-muted-foreground text-center" aria-live="polite">
                {dica
                  ? dica
                  : modo === "numeros"
                    ? dicaNumeros
                    : escaneando
                      ? zoomSupported
                        ? "Use o zoom para focar em códigos pequenos"
                        : "Aponte a câmera para o código de barras ou IMEI"
                      : "Iniciando câmera..."
                }
              </p>
            )}

            {/* Botões de controle */}
            <div className="flex flex-wrap justify-center gap-2">
              {modo === "barras" && cameras.length > 1 && (
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

              {modo === "barras" && (
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
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDialogChange(false)}
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
  /** Id único do elemento do leitor. */
  scannerId: string;
  disabled?: boolean;
  className?: string;
}

export const BotaoScanner = ({
  onCodigoLido,
  scannerId,
  disabled = false,
  className = "",
}: BotaoScannerProps) => {
  return (
    <LeitorCodigoBarras
      onCodigoLido={onCodigoLido}
      scannerId={scannerId}
      disabled={disabled}
      className={className}
      mostrarInput={false}
    />
  );
};

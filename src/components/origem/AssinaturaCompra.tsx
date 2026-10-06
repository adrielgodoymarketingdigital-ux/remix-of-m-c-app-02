import { useRef, useEffect, useState, useCallback } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Eraser, Check, PenTool, Globe, Loader2 } from "lucide-react";
import { capturarIP } from "@/lib/capturarIP";
import { dimensaoAssinaturaExportada } from "@/lib/origem/fluxoCompra";

/**
 * PNG da assinatura recortada, limitado a 600×200 px: no celular o canvas é
 * multiplicado pelo devicePixelRatio (DPR 3 ≈ 1000×257 px, ~58 KB em base64,
 * contra ~15 KB em DPR 1). Reduzir cria pixels de suavização que às vezes deixam
 * o PNG maior (DPR 2: 35 → 41 KB), então fica a versão menor das duas. Mantém o
 * fundo transparente e o formato PNG (o termo em PDF embute como PNG);
 * assinaturas já gravadas não mudam.
 */
function exportarAssinatura(aparado: HTMLCanvasElement): string {
  const original = aparado.toDataURL("image/png");
  const { largura, altura, reduzida } = dimensaoAssinaturaExportada(aparado.width, aparado.height);
  if (!reduzida) return original;
  const destino = document.createElement("canvas");
  destino.width = largura;
  destino.height = altura;
  const ctx = destino.getContext("2d");
  if (!ctx) return original;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(aparado, 0, 0, largura, altura);
  const reduzidaUrl = destino.toDataURL("image/png");
  return reduzidaUrl.length < original.length ? reduzidaUrl : original;
}

interface AssinaturaCompraProps {
  label: string;
  textoAceite: string;
  onSave: (assinatura: string, ip: string) => void;
  onClear?: () => void;
  assinaturaExistente?: string;
  ipExistente?: string;
  disabled?: boolean;
  /** Avisa o formulário enquanto a confirmação da assinatura (IP) está em andamento. */
  onProcessandoChange?: (processando: boolean) => void;
}

export function AssinaturaCompra({
  label,
  textoAceite,
  onSave,
  onClear,
  assinaturaExistente,
  ipExistente,
  disabled = false,
  onProcessandoChange,
}: AssinaturaCompraProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [aceite, setAceite] = useState(!!assinaturaExistente);
  const [assinado, setAssinado] = useState(!!assinaturaExistente);
  const [isEmpty, setIsEmpty] = useState(!assinaturaExistente);
  const [ip, setIp] = useState<string>(ipExistente || '');
  const [carregandoIP, setCarregandoIP] = useState(false);
  const [ultimaAssinaturaSalva, setUltimaAssinaturaSalva] = useState<string | null>(assinaturaExistente || null);

  // Captura IP ao montar o componente
  useEffect(() => {
    if (!ipExistente && !disabled) {
      setCarregandoIP(true);
      capturarIP()
        .then(ipCapturado => setIp(ipCapturado))
        .finally(() => setCarregandoIP(false));
    }
  }, [ipExistente, disabled]);

  // Carrega assinatura existente
  useEffect(() => {
    if (assinaturaExistente && sigCanvas.current && assinaturaExistente !== ultimaAssinaturaSalva) {
      sigCanvas.current.clear();
      sigCanvas.current.fromDataURL(assinaturaExistente);
      setAssinado(true);
      setIsEmpty(false);
    }
  }, [assinaturaExistente, ultimaAssinaturaSalva]);

  const handleClear = useCallback(() => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
      setAssinado(false);
      setIsEmpty(true);
      setUltimaAssinaturaSalva(null);
      onClear?.();
    }
  }, [onClear]);

  const handleSave = useCallback(async () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const dataUrl = exportarAssinatura(sigCanvas.current.getTrimmedCanvas());

      onProcessandoChange?.(true);
      try {
        // Captura IP mais recente se não tiver
        let ipAtual = ip;
        if (!ipAtual || ipAtual === 'IP não disponível') {
          setCarregandoIP(true);
          ipAtual = await capturarIP();
          setIp(ipAtual);
          setCarregandoIP(false);
        }

        setUltimaAssinaturaSalva(dataUrl);
        onSave(dataUrl, ipAtual);
        setAssinado(true);
        setIsEmpty(false);
      } finally {
        onProcessandoChange?.(false);
      }
    }
  }, [ip, onSave, onProcessandoChange]);

  const handleEnd = useCallback(() => {
    if (sigCanvas.current) {
      setIsEmpty(sigCanvas.current.isEmpty());
    }
  }, []);

  const canSave = aceite && !isEmpty;

  // Modo de visualização (disabled)
  if (disabled && assinaturaExistente) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-2 bg-muted/20">
            <img 
              src={assinaturaExistente} 
              alt="Assinatura" 
              className="max-h-32 mx-auto"
            />
          </div>
          {ipExistente && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2 justify-center">
              <Globe className="h-3 w-3" />
              IP: {ipExistente}
            </div>
          )}
          <p className="text-xs text-green-600 mt-1 text-center font-medium">
            ✓ Assinatura digital registrada
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PenTool className="h-4 w-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* IP do usuário */}
        <div className="flex items-center gap-2 text-sm bg-muted/30 p-2 rounded-lg">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">IP:</span>
          {carregandoIP ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span className="font-mono text-xs">{ip || 'Obtendo...'}</span>
          )}
        </div>

        {/* Checkbox de aceite */}
        <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
          <Checkbox
            id={`aceite-${label.replace(/\s/g, '-')}`}
            checked={aceite}
            onCheckedChange={(checked) => setAceite(checked === true)}
            disabled={disabled}
          />
          <Label 
            htmlFor={`aceite-${label.replace(/\s/g, '-')}`}
            className="text-sm leading-relaxed cursor-pointer"
          >
            {textoAceite}
          </Label>
        </div>

        {/* Área de Assinatura */}
        <div 
          className={`border-2 border-dashed rounded-lg bg-white dark:bg-gray-900 transition-colors ${
            disabled ? "opacity-50 pointer-events-none" : "hover:border-primary/50"
          } ${assinado ? "border-green-500" : "border-muted-foreground/30"}`}
        >
          <SignatureCanvas
            ref={sigCanvas}
            canvasProps={{
              className: "w-full h-32 touch-none",
              style: { width: "100%", height: "128px" },
            }}
            backgroundColor="transparent"
            penColor="black"
            onEnd={handleEnd}
          />
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Use o dedo ou mouse para assinar
        </p>

        {/* Botões */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={disabled}
            className="flex-1"
          >
            <Eraser className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={disabled || !canSave || carregandoIP}
            className="flex-1"
          >
            {carregandoIP ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            {assinado ? "Atualizar" : "Confirmar"}
          </Button>
        </div>

        {assinado && (
          <p className="text-xs text-green-600 text-center font-medium">
            ✓ Assinatura confirmada
          </p>
        )}
      </CardContent>
    </Card>
  );
}

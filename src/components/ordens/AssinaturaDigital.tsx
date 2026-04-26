import { useRef, useEffect, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Eraser, Check, PenTool, FileSignature } from "lucide-react";
import { TipoAssinatura } from "@/types/ordem-servico";

interface AssinaturaDigitalProps {
  onSave: (assinaturaBase64: string) => void;
  onClear?: () => void;
  onTipoChange?: (tipo: TipoAssinatura) => void;
  assinaturaExistente?: string;
  tipoAssinatura?: TipoAssinatura;
  label?: string;
  disabled?: boolean;
  textoAceite?: string;
  mostrarCheckbox?: boolean;
  mostrarSeletorTipo?: boolean;
}

export const AssinaturaDigital = ({
  onSave,
  onClear,
  onTipoChange,
  assinaturaExistente,
  tipoAssinatura = 'digital',
  label = "Assinatura do Cliente",
  disabled = false,
  textoAceite = "Declaro estar ciente das condições do dispositivo conforme checklist e avarias registradas neste documento.",
  mostrarCheckbox = true,
  mostrarSeletorTipo = true,
}: AssinaturaDigitalProps) => {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [aceite, setAceite] = useState(false);
  const [assinado, setAssinado] = useState(!!assinaturaExistente);
  const [isEmpty, setIsEmpty] = useState(true);
  const [ultimaAssinaturaSalva, setUltimaAssinaturaSalva] = useState<string | null>(null);
  const [tipoAtual, setTipoAtual] = useState<TipoAssinatura>(tipoAssinatura);

  useEffect(() => {
    setTipoAtual(tipoAssinatura);
  }, [tipoAssinatura]);

  useEffect(() => {
    // Só carrega a assinatura existente se for diferente da última salva
    // Isso evita recarregar quando acabamos de salvar
    if (assinaturaExistente && sigCanvas.current && assinaturaExistente !== ultimaAssinaturaSalva && tipoAtual === 'digital') {
      sigCanvas.current.clear();
      sigCanvas.current.fromDataURL(assinaturaExistente);
      setAssinado(true);
      setIsEmpty(false);
    }
  }, [assinaturaExistente, ultimaAssinaturaSalva, tipoAtual]);

  const handleTipoChange = (tipo: TipoAssinatura) => {
    setTipoAtual(tipo);
    onTipoChange?.(tipo);
    
    // Se mudar para física, limpa o canvas e notifica
    if (tipo === 'fisica') {
      if (sigCanvas.current) {
        sigCanvas.current.clear();
      }
      setAssinado(false);
      setIsEmpty(true);
      onClear?.();
    }
  };

  const handleClear = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
      setAssinado(false);
      setIsEmpty(true);
      setUltimaAssinaturaSalva(null);
      onClear?.();
    }
  };

  const handleSave = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL("image/png");
      setUltimaAssinaturaSalva(dataUrl);
      onSave(dataUrl);
      setAssinado(true);
      setIsEmpty(false);
    }
  };

  const handleEnd = () => {
    if (sigCanvas.current) {
      setIsEmpty(sigCanvas.current.isEmpty());
    }
  };

  const canSave = mostrarCheckbox ? aceite && !isEmpty : !isEmpty;

  if (disabled && assinaturaExistente && tipoAtual === 'digital') {
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
          <p className="text-xs text-muted-foreground mt-2 text-center">
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
        {/* Seletor de Tipo de Assinatura */}
        {mostrarSeletorTipo && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <Label className="text-xs font-medium mb-2 block">Tipo de Assinatura</Label>
            <RadioGroup
              value={tipoAtual}
              onValueChange={(value) => handleTipoChange(value as TipoAssinatura)}
              className="flex flex-col gap-3 sm:flex-row sm:gap-4"
              disabled={disabled}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="digital" id="assinatura-digital" />
                <Label htmlFor="assinatura-digital" className="font-normal cursor-pointer text-sm flex items-center gap-1">
                  <PenTool className="h-3 w-3" />
                  Digital (na tela)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fisica" id="assinatura-fisica" />
                <Label htmlFor="assinatura-fisica" className="font-normal cursor-pointer text-sm flex items-center gap-1">
                  <FileSignature className="h-3 w-3" />
                  Física (no papel)
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {mostrarCheckbox && (
          <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <Checkbox
              id="aceite-assinatura"
              checked={aceite}
              onCheckedChange={(checked) => setAceite(checked === true)}
              disabled={disabled}
            />
            <Label 
              htmlFor="aceite-assinatura" 
              className="text-sm leading-relaxed cursor-pointer"
            >
              {textoAceite}
            </Label>
          </div>
        )}

        {/* Área de Assinatura Digital */}
        {tipoAtual === 'digital' && (
          <>
            <div 
              ref={containerRef}
              className={`border-2 border-dashed rounded-lg bg-white dark:bg-gray-900 transition-colors ${
                disabled ? "opacity-50 pointer-events-none" : "hover:border-primary/50"
              } ${assinado ? "border-green-500" : "border-muted-foreground/30"}`}
            >
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  className: "w-full h-40 touch-none",
                  style: { width: "100%", height: "160px" },
                }}
                backgroundColor="transparent"
                penColor="black"
                onEnd={handleEnd}
              />
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Use o dedo ou mouse para assinar no campo acima
            </p>

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
                disabled={disabled || !canSave}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                {assinado ? "Atualizar" : "Confirmar"}
              </Button>
            </div>

            {assinado && (
              <p className="text-xs text-green-600 text-center font-medium">
                ✓ Assinatura digital confirmada
              </p>
            )}
          </>
        )}

        {/* Mensagem para Assinatura Física */}
        {tipoAtual === 'fisica' && (
          <div className="p-4 border-2 border-dashed rounded-lg bg-muted/10 text-center">
            <FileSignature className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              A assinatura será feita no documento impresso.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Ao imprimir, haverá um espaço reservado para assinatura.
            </p>
            {mostrarCheckbox && aceite && (
              <p className="text-xs text-green-600 mt-2 font-medium">
                ✓ Cliente ciente das condições
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

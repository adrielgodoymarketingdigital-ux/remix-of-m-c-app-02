import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { APP_BUILD_ID } from '@/lib/build';
import {
  assinarEventosImpressao,
  formatarDiagnosticoImpressao,
  listarEventosImpressao,
} from '@/lib/etiquetas/avisoImpressao';

/** Últimos eventos da impressão de etiquetas, para copiar e enviar ao suporte. */
export const DiagnosticoImpressaoEtiquetas = () => {
  const [aberto, setAberto] = useState(false);
  const eventos = useSyncExternalStore(assinarEventosImpressao, listarEventosImpressao);

  const texto = aberto
    ? formatarDiagnosticoImpressao(eventos, [`Versão: ${APP_BUILD_ID}`, `Navegador: ${navigator.userAgent}`])
    : '';

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Diagnóstico copiado.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  };

  return (
    <div className="min-w-0 space-y-2">
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-[11px] text-muted-foreground"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
      >
        {aberto ? 'Ocultar diagnóstico da impressão' : 'Diagnóstico da impressão'}
      </Button>
      {aberto && (
        <div className="space-y-2">
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 p-2 text-[11px] select-text">
            {texto}
          </pre>
          <Button type="button" variant="outline" size="sm" onClick={copiar}>
            Copiar diagnóstico
          </Button>
        </div>
      )}
    </div>
  );
};

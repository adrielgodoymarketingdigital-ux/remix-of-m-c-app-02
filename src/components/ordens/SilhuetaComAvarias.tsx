import { AvariaVisual } from "@/types/ordem-servico";
import { SilhuetaCelular } from "./silhuetas/SilhuetaCelular";
import { SilhuetaNotebook } from "./silhuetas/SilhuetaNotebook";
import { SilhuetaTablet } from "./silhuetas/SilhuetaTablet";
import { SilhuetaComputador } from "./silhuetas/SilhuetaComputador";
import { SilhuetaRelogioSmart } from "./silhuetas/SilhuetaRelogioSmart";
import { SilhuetaImpressora } from "./silhuetas/SilhuetaImpressora";
import { SilhuetaVideoGame } from "./silhuetas/SilhuetaVideoGame";
import { SilhuetaDesktop } from "./silhuetas/SilhuetaDesktop";
import { SilhuetaTelevisao } from "./silhuetas/SilhuetaTelevisao";
import { SilhuetaEstabilizador } from "./silhuetas/SilhuetaEstabilizador";
import { SilhuetaNobreak } from "./silhuetas/SilhuetaNobreak";
import { SilhuetaProjetor } from "./silhuetas/SilhuetaProjetor";
import { pontoNoDesenho, tipoDoDesenho, VIEWBOX_DESENHO } from "@/lib/ordemServico/posicaoAvaria";

interface SilhuetaComAvariasProps {
  tipoDispositivo: string;
  subtipoRelogio?: string;
  lado: 'frente' | 'traseira';
  avarias: AvariaVisual[];
  printMode?: boolean;
}

const tipoAvariaCores: Record<string, string> = {
  riscos: "bg-red-500",
  trinca: "bg-orange-500",
  amassado: "bg-yellow-500",
  quebrado: "bg-purple-500",
  outro: "bg-blue-500",
};

// Mesmas cores das classes acima, em estilo inline: o documento isolado da
// impressão no Android (iframe) não leva o Tailwind.
const tipoAvariaCoresHex: Record<string, string> = {
  riscos: "#ef4444",
  trinca: "#f97316",
  amassado: "#eab308",
  quebrado: "#a855f7",
  outro: "#3b82f6",
};

const tipoAvariaLabels: Record<string, string> = {
  riscos: "Riscos",
  trinca: "Trinca",
  amassado: "Amassado",
  quebrado: "Quebrado",
  outro: "Outro",
};

export const SilhuetaComAvarias = ({
  tipoDispositivo,
  subtipoRelogio,
  lado,
  avarias,
  printMode = false
}: SilhuetaComAvariasProps) => {
  // Mesmo tipo da tela de marcação: "Relogio_Smart" desenha o relógio (antes, celular).
  const tipo = tipoDoDesenho(tipoDispositivo);

  const renderSilhueta = () => {
    switch (tipo) {
      case "notebook":
        return <SilhuetaNotebook />;
      case "tablet":
        return <SilhuetaTablet lado={lado} />;
      case "computador":
        return <SilhuetaComputador />;
      case "desktop":
        return <SilhuetaDesktop lado={lado} />;
      case "relogio_smart":
        return <SilhuetaRelogioSmart lado={lado} subtipo={subtipoRelogio} />;
      case "impressora":
        return <SilhuetaImpressora lado={lado} />;
      case "video_game":
        return <SilhuetaVideoGame lado={lado} />;
      case "televisao":
        return <SilhuetaTelevisao lado={lado} />;
      case "estabilizador":
        return <SilhuetaEstabilizador lado={lado} />;
      case "nobreak":
        return <SilhuetaNobreak lado={lado} />;
      case "projetor":
        return <SilhuetaProjetor lado={lado} />;
      default:
        return <SilhuetaCelular lado={lado} />;
    }
  };

  // Recuo da caixa (p-2 / p-4), escala do desenho (0,85 na impressão) e tamanho da
  // bolinha (w-2.5 / w-4): os valores das classes, repetidos inline para valer
  // também onde não há Tailwind.
  const recuo = printMode ? 8 : 16;
  const escala = printMode ? 0.85 : 1;
  const tamanho = printMode ? 10 : 16;

  return (
    <div className={printMode ? "space-y-0.5" : "space-y-4"}>
      {!printMode && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold capitalize">
            {lado === "frente" ? "Frente" : "Traseira"}
          </h4>
          {avarias.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {avarias.length} {avarias.length === 1 ? "avaria" : "avarias"}
            </span>
          )}
        </div>
      )}

      <div
        className={`relative border rounded-lg bg-muted/20 ${printMode ? 'p-2' : 'p-4'}`}
        style={{ position: "relative", padding: recuo }}
      >
        <div
          className={printMode ? 'scale-[0.85] origin-top-left' : ''}
          style={printMode ? { transform: "scale(0.85)", transformOrigin: "top left" } : undefined}
        >
          {renderSilhueta()}
        </div>

        {/* Marcações: o ponto foi gravado em % da caixa 9:16 da tela de marcação;
            aqui vira posição no desenho (proporção do aparelho), já descontando o
            recuo da caixa e a escala do desenho. */}
        {avarias.map((avaria, index) => {
          const { fx, fy } = pontoNoDesenho(avaria.x, avaria.y, VIEWBOX_DESENHO[tipo]);
          return (
            <div
              key={index}
              className={`absolute ${printMode ? 'w-2.5 h-2.5' : 'w-4 h-4'} rounded-full ${tipoAvariaCores[avaria.tipo]} opacity-80 border-2 border-white cursor-help flex items-center justify-center`}
              style={{
                position: "absolute",
                width: tamanho,
                height: tamanho,
                borderRadius: 9999,
                backgroundColor: tipoAvariaCoresHex[avaria.tipo],
                opacity: 0.8,
                border: "2px solid #fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                left: `calc(${recuo}px + (100% - ${2 * recuo}px) * ${escala * fx})`,
                top: `calc(${recuo}px + (100% - ${2 * recuo}px) * ${escala * fy})`,
                transform: 'translate(-50%, -50%)'
              }}
              title={`${tipoAvariaLabels[avaria.tipo]}${avaria.descricao ? `: ${avaria.descricao}` : ''}`}
            >
              {printMode && (
                <span
                  className="text-[6px] font-bold text-white leading-none"
                  style={{ fontSize: 6, fontWeight: 700, color: "#fff", lineHeight: 1 }}
                >
                  {index + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      {avarias.length > 0 && (
        <div
          className={`flex flex-wrap ${printMode ? 'gap-0.5 text-[6px] mt-0.5' : 'gap-2 text-xs'}`}
          style={printMode ? { display: "flex", flexWrap: "wrap", gap: 2, fontSize: 6, marginTop: 2 } : undefined}
        >
          {avarias.map((avaria, index) => (
            <div
              key={index}
              className="flex items-center gap-0.5"
              style={printMode ? { display: "flex", alignItems: "center", gap: 2 } : undefined}
            >
              {printMode && (
                <span className="font-bold" style={{ fontWeight: 700 }}>{index + 1}.</span>
              )}
              <div
                className={`${printMode ? 'w-1.5 h-1.5' : 'w-3 h-3'} rounded-full ${tipoAvariaCores[avaria.tipo]}`}
                style={printMode ? { width: 6, height: 6, borderRadius: 9999, backgroundColor: tipoAvariaCoresHex[avaria.tipo] } : undefined}
              />
              <span>{tipoAvariaLabels[avaria.tipo]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

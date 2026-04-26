import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface PatternLockInputProps {
  value: number[];
  onChange: (pattern: number[]) => void;
}

const GRID_SIZE = 3;
const SVG_SIZE = 240;
const CELL_SIZE = SVG_SIZE / GRID_SIZE;
const DOT_RADIUS = 24;

export const PatternLockInput = ({ value, onChange }: PatternLockInputProps) => {
  const [currentPattern, setCurrentPattern] = useState<number[]>([]);

  useEffect(() => {
    setCurrentPattern(value);
  }, [value]);

  const getCoordinates = (dotNumber: number) => {
    const row = Math.floor((dotNumber - 1) / GRID_SIZE);
    const col = (dotNumber - 1) % GRID_SIZE;
    const x = col * CELL_SIZE + CELL_SIZE / 2;
    const y = row * CELL_SIZE + CELL_SIZE / 2;
    return { x, y };
  };

  const handleDotClick = (dotNumber: number) => {
    if (!currentPattern.includes(dotNumber)) {
      const newPattern = [...currentPattern, dotNumber];
      setCurrentPattern(newPattern);
      onChange(newPattern);
    }
  };

  const resetPattern = () => {
    setCurrentPattern([]);
    onChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="relative flex items-center justify-center bg-muted/30 p-6 rounded-lg">
        <svg
          width={SVG_SIZE}
          height={SVG_SIZE}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="absolute"
        >
          <defs>
            <marker
              id="arrowhead-input"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 8 4, 0 8" fill="#22c55e" />
            </marker>
          </defs>

          {/* Linhas conectando os pontos */}
          {currentPattern.length > 1 &&
            currentPattern.map((dot, index) => {
              if (index === currentPattern.length - 1) return null;
              const from = getCoordinates(dot);
              const to = getCoordinates(currentPattern[index + 1]);

              return (
                <line
                  key={`line-${dot}-${currentPattern[index + 1]}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#22c55e"
                  strokeWidth="3"
                  strokeLinecap="round"
                  markerEnd="url(#arrowhead-input)"
                />
              );
            })}

          {/* Círculos de fundo para todos os pontos */}
          {Array.from({ length: 9 }, (_, i) => i + 1).map((dotNumber) => {
            const coords = getCoordinates(dotNumber);
            const isActive = currentPattern.includes(dotNumber);

            return (
              <g key={`dot-${dotNumber}`}>
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={DOT_RADIUS}
                  fill={isActive ? "#22c55e" : "hsl(var(--muted))"}
                  stroke={isActive ? "#16a34a" : "hsl(var(--border))"}
                  strokeWidth="2"
                  style={{ cursor: "pointer" }}
                  onClick={() => handleDotClick(dotNumber)}
                />
                {isActive && (
                  <text
                    x={coords.x}
                    y={coords.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="16"
                    fontWeight="bold"
                    style={{ pointerEvents: "none" }}
                  >
                    {currentPattern.indexOf(dotNumber) + 1}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Espaço para o SVG */}
        <div style={{ width: SVG_SIZE, height: SVG_SIZE }} />
      </div>

      {/* Informações sobre o padrão */}
      <div className="flex items-center justify-between">
        {currentPattern.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Padrão: {currentPattern.join(' → ')}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Clique nos círculos para desenhar o padrão
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={resetPattern}
          disabled={currentPattern.length === 0}
        >
          Limpar padrão
        </Button>
      </div>
    </div>
  );
};

interface PatternLockVisualizacaoProps {
  pattern: number[];
  size?: number;
}

const GRID_SIZE = 3;

export const PatternLockVisualizacao = ({ pattern, size = 120 }: PatternLockVisualizacaoProps) => {
  if (!pattern || pattern.length === 0) return null;

  const dotSize = size / 6;
  const gap = size / 12;

  const getCoordinates = (dotNumber: number) => {
    const row = Math.floor((dotNumber - 1) / 3);
    const col = (dotNumber - 1) % 3;
    const x = col * (dotSize + gap) + dotSize / 2 + gap;
    const y = row * (dotSize + gap) + dotSize / 2 + gap;
    return { x, y };
  };

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="inline-block print:visible" style={{ width: size, height: size }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker
          id="arrowhead-print"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="#22c55e" />
        </marker>
      </defs>

      {/* Desenhar todos os pontos */}
      {Array.from({ length: 9 }, (_, i) => i + 1).map((dotNumber) => {
        const { x, y } = getCoordinates(dotNumber);
        const isActive = pattern.includes(dotNumber);

        return (
          <circle
            key={dotNumber}
            cx={x}
            cy={y}
            r={dotSize / 2}
            fill={isActive ? "#22c55e" : "#e5e7eb"}
            stroke="#000"
            strokeWidth="1"
          />
        );
      })}

      {/* Linhas conectando os pontos */}
      {pattern.length > 1 &&
        pattern.map((dot, index) => {
          if (index === pattern.length - 1) return null;
          const from = getCoordinates(dot);
          const to = getCoordinates(pattern[index + 1]);

          return (
            <line
              key={`${dot}-${pattern[index + 1]}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#22c55e"
              strokeWidth="3"
              strokeLinecap="round"
              markerEnd="url(#arrowhead-print)"
            />
          );
        })}

      {/* Números nos pontos ativos */}
      {pattern.map((dot, index) => {
        const { x, y } = getCoordinates(dot);
        return (
          <text
            key={`num-${dot}`}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fff"
            fontSize={dotSize / 2.5}
            fontWeight="bold"
          >
            {index + 1}
          </text>
        );
      })}
    </svg>
  );
};

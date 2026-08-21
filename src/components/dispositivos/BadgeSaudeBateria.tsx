interface BadgeSaudeBateriaProps {
  saudeBateria?: number | null;
}

function getCorDotSaudeBateria(saude: number): string {
  if (saude >= 90) return "#16a34a";
  if (saude >= 80) return "#eab308";
  return "#dc2626";
}

export function BadgeSaudeBateria({ saudeBateria }: BadgeSaudeBateriaProps) {
  if (saudeBateria === undefined || saudeBateria === null) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: getCorDotSaudeBateria(saudeBateria) }}
      />
      <span>{saudeBateria}%</span>
    </span>
  );
}

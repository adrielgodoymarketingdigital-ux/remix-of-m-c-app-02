interface SilhuetaImpressoraProps {
  lado: 'frente' | 'traseira';
}

export const SilhuetaImpressora = ({ lado }: SilhuetaImpressoraProps) => {
  if (lado === 'frente') {
    return (
      <svg viewBox="0 0 260 220" className="w-full h-full">
        {/* Corpo da impressora */}
        <rect x="20" y="25" width="220" height="140" rx="12" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        {/* Tampa do scanner */}
        <rect x="32" y="37" width="196" height="40" rx="6" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
        {/* Painel de controle no topo */}
        <rect x="150" y="86" width="78" height="30" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
        <rect x="158" y="94" width="34" height="14" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
        <circle cx="208" cy="101" r="4" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
        <circle cx="220" cy="101" r="4" fill="hsl(var(--accent))"/>
        {/* Saída de papel */}
        <rect x="34" y="120" width="104" height="6" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.4"/>
        {/* Bandeja de saída de papel na frente */}
        <rect x="45" y="160" width="170" height="42" rx="8" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        <rect x="60" y="172" width="140" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 260 220" className="w-full h-full">
      {/* Corpo traseiro */}
      <rect x="20" y="25" width="220" height="150" rx="12" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      {/* Grade de ventilação */}
      <rect x="40" y="45" width="80" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="40" y="55" width="80" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="40" y="65" width="80" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      {/* Porta USB */}
      <rect x="150" y="90" width="30" height="14" rx="2" fill="hsl(var(--muted-foreground))"/>
      {/* Entrada de energia */}
      <rect x="150" y="120" width="26" height="20" rx="3" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="1"/>
      <circle cx="163" cy="130" r="5" fill="hsl(var(--background))"/>
    </svg>
  );
};

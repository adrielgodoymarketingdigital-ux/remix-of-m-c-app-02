interface SilhuetaVideoGameProps {
  lado: 'frente' | 'traseira';
}

export const SilhuetaVideoGame = ({ lado }: SilhuetaVideoGameProps) => {
  if (lado === 'frente') {
    return (
      <svg viewBox="0 0 300 180" className="w-full h-full">
        {/* Corpo do console */}
        <rect x="20" y="45" width="260" height="90" rx="14" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        {/* Vinco central */}
        <rect x="150" y="55" width="2" height="70" rx="1" fill="hsl(var(--border))"/>
        {/* Leitor de disco / slot */}
        <rect x="40" y="86" width="120" height="6" rx="3" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
        {/* Botão de energia */}
        <circle cx="185" cy="90" r="7" fill="hsl(var(--primary))" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.8"/>
        {/* Botão de ejetar */}
        <circle cx="210" cy="90" r="6" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
        {/* LED */}
        <circle cx="240" cy="90" r="3" fill="hsl(var(--accent))"/>
        {/* Ventilação lateral */}
        <rect x="245" y="60" width="24" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
        <rect x="245" y="68" width="24" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 300 180" className="w-full h-full">
      {/* Corpo traseiro */}
      <rect x="20" y="45" width="260" height="90" rx="14" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      {/* Grade de ventilação */}
      <rect x="40" y="58" width="90" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="40" y="66" width="90" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="40" y="74" width="90" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      {/* Painel de portas */}
      <rect x="150" y="88" width="120" height="34" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
      {/* Porta de energia */}
      <rect x="158" y="98" width="22" height="16" rx="2" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="1"/>
      {/* HDMI */}
      <rect x="188" y="100" width="24" height="12" rx="2" fill="hsl(var(--muted-foreground))"/>
      {/* USB */}
      <rect x="220" y="101" width="18" height="10" rx="1" fill="hsl(var(--muted-foreground))"/>
      {/* Rede */}
      <rect x="244" y="100" width="18" height="12" rx="1" fill="hsl(var(--muted-foreground))"/>
    </svg>
  );
};

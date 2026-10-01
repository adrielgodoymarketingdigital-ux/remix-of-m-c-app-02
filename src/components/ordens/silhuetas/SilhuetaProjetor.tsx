interface SilhuetaProjetorProps {
  lado: 'frente' | 'traseira';
}

export const SilhuetaProjetor = ({ lado }: SilhuetaProjetorProps) => {
  if (lado === 'frente') {
    return (
      <svg viewBox="0 0 280 180" className="w-full h-full">
        {/* Corpo do projetor */}
        <rect x="20" y="40" width="240" height="100" rx="18" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        {/* Lente */}
        <circle cx="80" cy="90" r="34" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="2"/>
        <circle cx="80" cy="90" r="22" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1"/>
        <circle cx="80" cy="90" r="10" fill="hsl(var(--foreground))" opacity="0.15"/>
        {/* Anel de foco/zoom */}
        <circle cx="80" cy="90" r="28" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.4" strokeDasharray="3 4"/>
        {/* Painel de controle no topo */}
        <rect x="150" y="54" width="92" height="30" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
        <circle cx="166" cy="69" r="6" fill="hsl(var(--primary))" opacity="0.8"/>
        <circle cx="186" cy="69" r="4" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
        <circle cx="202" cy="69" r="4" fill="hsl(var(--accent))"/>
        <circle cx="220" cy="69" r="4" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
        {/* Grade de ventilação lateral */}
        <rect x="150" y="100" width="70" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
        <rect x="150" y="108" width="70" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
        <rect x="150" y="116" width="70" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 280 180" className="w-full h-full">
      {/* Corpo traseiro */}
      <rect x="20" y="40" width="240" height="100" rx="18" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      {/* Grade de ventilação do cooler */}
      <circle cx="60" cy="90" r="26" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.4"/>
      <circle cx="60" cy="90" r="18" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.3"/>
      <circle cx="60" cy="90" r="4" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
      {/* Painel de conexões */}
      <rect x="110" y="54" width="132" height="72" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
      {/* HDMI x2 */}
      <rect x="120" y="64" width="26" height="12" rx="2" fill="hsl(var(--muted-foreground))"/>
      <rect x="120" y="82" width="26" height="12" rx="2" fill="hsl(var(--muted-foreground))"/>
      {/* VGA */}
      <rect x="154" y="64" width="22" height="18" rx="3" fill="hsl(var(--muted-foreground))" opacity="0.7"/>
      {/* USB */}
      <rect x="154" y="90" width="18" height="10" rx="1" fill="hsl(var(--muted-foreground))" opacity="0.7"/>
      {/* Áudio */}
      <circle cx="190" cy="70" r="5" fill="hsl(var(--muted-foreground))" opacity="0.6"/>
      {/* Energia */}
      <rect x="206" y="90" width="26" height="20" rx="3" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="1"/>
      <circle cx="219" cy="100" r="5" fill="hsl(var(--background))"/>
    </svg>
  );
};

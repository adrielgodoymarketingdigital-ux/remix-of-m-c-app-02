export const SilhuetaComputador = () => {
  return (
    <svg viewBox="0 0 200 300" className="w-full h-full">
      {/* Gabinete */}
      <rect x="30" y="20" width="140" height="260" rx="8" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      
      {/* Painel frontal */}
      <rect x="45" y="35" width="110" height="180" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
      
      {/* Drives/Slots */}
      <rect x="60" y="50" width="80" height="8" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.4"/>
      <rect x="60" y="65" width="80" height="8" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.4"/>
      
      {/* Ventilação */}
      <circle cx="100" cy="130" r="25" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.5"/>
      <circle cx="100" cy="130" r="20" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.5"/>
      <circle cx="100" cy="130" r="15" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.5"/>
      
      {/* Portas USB frontais */}
      <rect x="60" y="230" width="12" height="8" rx="1" fill="hsl(var(--muted-foreground))"/>
      <rect x="75" y="230" width="12" height="8" rx="1" fill="hsl(var(--muted-foreground))"/>
      <rect x="90" y="230" width="12" height="8" rx="1" fill="hsl(var(--muted-foreground))"/>
      
      {/* Botão Power */}
      <circle cx="100" cy="260" r="8" fill="hsl(var(--primary))" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.8"/>
      
      {/* LED */}
      <circle cx="120" cy="260" r="3" fill="hsl(var(--accent))"/>
    </svg>
  );
};

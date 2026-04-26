export const SilhuetaNotebook = () => {
  return (
    <svg viewBox="0 0 400 280" className="w-full h-full">
      {/* Tela */}
      <rect x="20" y="10" width="360" height="220" rx="8" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      {/* Display */}
      <rect x="30" y="20" width="340" height="200" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
      {/* Webcam */}
      <circle cx="200" cy="15" r="4" fill="hsl(var(--muted-foreground))"/>
      
      {/* Base/Teclado */}
      <rect x="10" y="240" width="380" height="35" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      {/* Trackpad */}
      <rect x="170" y="250" width="60" height="20" rx="2" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
      {/* Teclado (representação simplificada) */}
      <rect x="40" y="248" width="100" height="6" rx="1" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="260" y="248" width="100" height="6" rx="1" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
    </svg>
  );
};

interface SilhuetaTabletProps {
  lado: 'frente' | 'traseira';
}

export const SilhuetaTablet = ({ lado }: SilhuetaTabletProps) => {
  if (lado === 'frente') {
    return (
      <svg viewBox="0 0 320 240" className="w-full h-full">
        {/* Corpo do tablet */}
        <rect x="10" y="10" width="300" height="220" rx="15" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        {/* Tela */}
        <rect x="25" y="25" width="270" height="190" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
        {/* Câmera frontal */}
        <circle cx="160" cy="15" r="4" fill="hsl(var(--muted-foreground))"/>
        {/* Botão home */}
        <circle cx="160" cy="230" r="8" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="1"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 320 240" className="w-full h-full">
      {/* Corpo traseiro */}
      <rect x="10" y="10" width="300" height="220" rx="15" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      {/* Câmera traseira */}
      <circle cx="40" cy="30" r="10" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="2"/>
      <circle cx="40" cy="30" r="7" fill="hsl(var(--background))"/>
      {/* Logo */}
      <rect x="140" y="110" width="40" height="20" rx="4" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
    </svg>
  );
};

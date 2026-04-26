interface SilhuetaCelularProps {
  lado: 'frente' | 'traseira';
}

export const SilhuetaCelular = ({ lado }: SilhuetaCelularProps) => {
  if (lado === 'frente') {
    return (
      <svg viewBox="0 0 180 320" className="w-full h-full">
        {/* Corpo do celular */}
        <rect x="10" y="10" width="160" height="300" rx="20" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        {/* Tela */}
        <rect x="20" y="40" width="140" height="240" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
        {/* Câmera frontal */}
        <circle cx="90" cy="25" r="5" fill="hsl(var(--muted-foreground))"/>
        {/* Alto-falante */}
        <rect x="70" y="22" width="40" height="3" rx="1.5" fill="hsl(var(--muted-foreground))"/>
        {/* Botão home */}
        <circle cx="90" cy="295" r="10" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="1"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 180 320" className="w-full h-full">
      {/* Corpo traseiro */}
      <rect x="10" y="10" width="160" height="300" rx="20" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      {/* Câmera traseira */}
      <circle cx="140" cy="35" r="12" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="2"/>
      <circle cx="140" cy="35" r="8" fill="hsl(var(--background))"/>
      {/* Flash */}
      <circle cx="140" cy="60" r="6" fill="hsl(var(--accent))"/>
      {/* Logo */}
      <rect x="70" y="150" width="40" height="20" rx="4" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
    </svg>
  );
};

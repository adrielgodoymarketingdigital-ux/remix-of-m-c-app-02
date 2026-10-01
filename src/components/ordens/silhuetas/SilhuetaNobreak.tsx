interface SilhuetaNobreakProps {
  lado: 'frente' | 'traseira';
}

export const SilhuetaNobreak = ({ lado }: SilhuetaNobreakProps) => {
  if (lado === 'frente') {
    return (
      <svg viewBox="0 0 260 190" className="w-full h-full">
        {/* Corpo do nobreak */}
        <rect x="18" y="30" width="224" height="130" rx="10" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        {/* Painel frontal */}
        <rect x="30" y="42" width="200" height="106" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
        {/* Display/LCD */}
        <rect x="42" y="54" width="90" height="36" rx="3" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1"/>
        <rect x="50" y="62" width="50" height="6" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
        <rect x="50" y="74" width="34" height="6" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.4"/>
        {/* Ícone de bateria */}
        <rect x="146" y="58" width="26" height="14" rx="2" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" opacity="0.6"/>
        <rect x="172" y="62" width="3" height="6" fill="hsl(var(--muted-foreground))" opacity="0.6"/>
        <rect x="149" y="61" width="18" height="8" rx="1" fill="hsl(var(--accent))"/>
        {/* Botão liga/desliga */}
        <circle cx="160" cy="110" r="11" fill="hsl(var(--primary))" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.8"/>
        {/* Botão mudo/teste */}
        <circle cx="195" cy="110" r="8" fill="hsl(var(--muted-foreground))" opacity="0.4"/>
        {/* LEDs de status */}
        <circle cx="48" cy="112" r="4" fill="hsl(var(--accent))"/>
        <circle cx="62" cy="112" r="4" fill="hsl(var(--muted-foreground))" opacity="0.4"/>
        <circle cx="76" cy="112" r="4" fill="hsl(var(--muted-foreground))" opacity="0.4"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 260 190" className="w-full h-full">
      {/* Corpo traseiro */}
      <rect x="18" y="30" width="224" height="130" rx="10" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      {/* Grade de ventilação */}
      <rect x="32" y="46" width="70" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="32" y="54" width="70" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="32" y="62" width="70" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      {/* Chave liga/desliga traseira */}
      <rect x="32" y="84" width="30" height="16" rx="2" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="1"/>
      {/* Cabo/entrada de energia */}
      <rect x="32" y="112" width="26" height="18" rx="3" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="1"/>
      {/* Porta USB de monitoramento */}
      <rect x="70" y="116" width="20" height="10" rx="1" fill="hsl(var(--muted-foreground))" opacity="0.6"/>
      {/* Painel de tomadas de saída */}
      <rect x="110" y="48" width="122" height="94" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
      <circle cx="136" cy="74" r="9" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
      <circle cx="136" cy="74" r="4" fill="hsl(var(--background))"/>
      <circle cx="170" cy="74" r="9" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
      <circle cx="170" cy="74" r="4" fill="hsl(var(--background))"/>
      <circle cx="204" cy="74" r="9" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
      <circle cx="204" cy="74" r="4" fill="hsl(var(--background))"/>
      <circle cx="136" cy="110" r="9" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
      <circle cx="136" cy="110" r="4" fill="hsl(var(--background))"/>
      <circle cx="170" cy="110" r="9" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
      <circle cx="170" cy="110" r="4" fill="hsl(var(--background))"/>
      <circle cx="204" cy="110" r="9" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
      <circle cx="204" cy="110" r="4" fill="hsl(var(--background))"/>
    </svg>
  );
};

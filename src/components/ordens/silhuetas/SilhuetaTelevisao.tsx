interface SilhuetaTelevisaoProps {
  lado: 'frente' | 'traseira';
}

export const SilhuetaTelevisao = ({ lado }: SilhuetaTelevisaoProps) => {
  if (lado === 'frente') {
    return (
      <svg viewBox="0 0 320 220" className="w-full h-full">
        {/* Moldura da TV */}
        <rect x="15" y="15" width="290" height="160" rx="10" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        {/* Tela */}
        <rect x="25" y="25" width="270" height="140" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
        {/* Sensor / LED inferior */}
        <circle cx="160" cy="170" r="3" fill="hsl(var(--muted-foreground))" opacity="0.6"/>
        {/* Pedestal */}
        <rect x="140" y="175" width="40" height="22" rx="3" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        {/* Base / suporte */}
        <rect x="105" y="196" width="110" height="12" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 320 220" className="w-full h-full">
      {/* Carcaça traseira */}
      <rect x="15" y="15" width="290" height="160" rx="10" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      {/* Suporte VESA */}
      <rect x="135" y="60" width="50" height="50" rx="3" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.5"/>
      {/* Grade de ventilação */}
      <rect x="40" y="30" width="90" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="40" y="38" width="90" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="40" y="46" width="90" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      {/* Painel de entradas */}
      <rect x="210" y="110" width="82" height="50" rx="3" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
      {/* HDMI */}
      <rect x="218" y="120" width="26" height="10" rx="2" fill="hsl(var(--muted-foreground))"/>
      <rect x="218" y="134" width="26" height="10" rx="2" fill="hsl(var(--muted-foreground))"/>
      {/* Antena */}
      <circle cx="262" cy="126" r="7" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="1"/>
      <circle cx="262" cy="126" r="3" fill="hsl(var(--background))"/>
      {/* Energia */}
      <rect x="255" y="142" width="24" height="12" rx="2" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="1"/>
      {/* Pedestal */}
      <rect x="140" y="175" width="40" height="22" rx="3" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      {/* Base / suporte */}
      <rect x="105" y="196" width="110" height="12" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
    </svg>
  );
};

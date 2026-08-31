interface SilhuetaDesktopProps {
  lado: 'frente' | 'traseira';
}

export const SilhuetaDesktop = ({ lado }: SilhuetaDesktopProps) => {
  if (lado === 'frente') {
    return (
      <svg viewBox="0 0 180 300" className="w-full h-full">
        {/* Gabinete */}
        <rect x="40" y="15" width="100" height="270" rx="10" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        {/* Painel frontal */}
        <rect x="52" y="28" width="76" height="244" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
        {/* Leitor óptico */}
        <rect x="60" y="45" width="60" height="10" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.4"/>
        <rect x="60" y="62" width="60" height="10" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.4"/>
        {/* Botão liga/desliga */}
        <circle cx="90" cy="100" r="8" fill="hsl(var(--primary))" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.8"/>
        {/* LED de atividade */}
        <circle cx="90" cy="120" r="3" fill="hsl(var(--accent))"/>
        {/* Portas USB / áudio frontais */}
        <rect x="72" y="140" width="12" height="8" rx="1" fill="hsl(var(--muted-foreground))"/>
        <rect x="88" y="140" width="12" height="8" rx="1" fill="hsl(var(--muted-foreground))"/>
        <circle cx="80" cy="160" r="4" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
        <circle cx="98" cy="160" r="4" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
        {/* Grade de ventilação */}
        <rect x="64" y="210" width="52" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
        <rect x="64" y="222" width="52" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
        <rect x="64" y="234" width="52" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 180 300" className="w-full h-full">
      {/* Gabinete */}
      <rect x="40" y="15" width="100" height="270" rx="10" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      {/* Fonte de alimentação */}
      <rect x="50" y="25" width="80" height="46" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
      <circle cx="72" cy="48" r="13" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.5"/>
      <rect x="98" y="34" width="22" height="16" rx="2" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="1"/>
      {/* Painel de I/O traseiro */}
      <rect x="50" y="82" width="80" height="66" rx="3" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
      {/* USB */}
      <rect x="58" y="92" width="16" height="8" rx="1" fill="hsl(var(--muted-foreground))"/>
      <rect x="58" y="104" width="16" height="8" rx="1" fill="hsl(var(--muted-foreground))"/>
      {/* HDMI */}
      <rect x="82" y="92" width="24" height="10" rx="2" fill="hsl(var(--muted-foreground))"/>
      {/* Rede */}
      <rect x="82" y="108" width="18" height="12" rx="1" fill="hsl(var(--muted-foreground))"/>
      {/* Áudio */}
      <circle cx="62" cy="132" r="4" fill="hsl(var(--muted-foreground))" opacity="0.6"/>
      <circle cx="76" cy="132" r="4" fill="hsl(var(--muted-foreground))" opacity="0.6"/>
      <circle cx="90" cy="132" r="4" fill="hsl(var(--muted-foreground))" opacity="0.6"/>
      {/* Slots de expansão */}
      <rect x="52" y="160" width="76" height="6" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="52" y="174" width="76" height="6" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="52" y="188" width="76" height="6" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      {/* Grade de ventilação inferior */}
      <rect x="56" y="230" width="68" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="56" y="242" width="68" height="4" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
    </svg>
  );
};

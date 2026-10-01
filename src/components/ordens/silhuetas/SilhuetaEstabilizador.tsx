interface SilhuetaEstabilizadorProps {
  lado: 'frente' | 'traseira';
}

export const SilhuetaEstabilizador = ({ lado }: SilhuetaEstabilizadorProps) => {
  if (lado === 'frente') {
    return (
      <svg viewBox="0 0 260 180" className="w-full h-full">
        {/* Corpo do estabilizador */}
        <rect x="20" y="35" width="220" height="110" rx="10" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        {/* Painel frontal */}
        <rect x="32" y="47" width="196" height="86" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
        {/* Botão liga/desliga */}
        <circle cx="60" cy="90" r="10" fill="hsl(var(--primary))" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.8"/>
        {/* LED de tensão (rede ok) */}
        <circle cx="95" cy="80" r="4" fill="hsl(var(--accent))"/>
        <circle cx="95" cy="100" r="4" fill="hsl(var(--muted-foreground))" opacity="0.4"/>
        {/* Selo de voltagem/chave seletora 115/220V */}
        <rect x="120" y="70" width="46" height="40" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1"/>
        <rect x="128" y="86" width="30" height="8" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
        {/* Visor de potência (VA) */}
        <rect x="178" y="74" width="38" height="20" rx="2" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 260 180" className="w-full h-full">
      {/* Corpo traseiro */}
      <rect x="20" y="35" width="220" height="110" rx="10" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      {/* Grade de ventilação */}
      <rect x="36" y="52" width="70" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="36" y="60" width="70" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      <rect x="36" y="68" width="70" height="3" rx="1.5" fill="hsl(var(--muted-foreground))" opacity="0.3"/>
      {/* Fusível */}
      <rect x="36" y="88" width="34" height="14" rx="2" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
      {/* Cabo de entrada de energia */}
      <rect x="40" y="112" width="26" height="18" rx="3" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="1"/>
      {/* Tomadas de saída */}
      <rect x="120" y="55" width="112" height="78" rx="4" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
      <circle cx="144" cy="78" r="9" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
      <circle cx="144" cy="78" r="4" fill="hsl(var(--background))"/>
      <circle cx="178" cy="78" r="9" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
      <circle cx="178" cy="78" r="4" fill="hsl(var(--background))"/>
      <circle cx="212" cy="78" r="9" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
      <circle cx="212" cy="78" r="4" fill="hsl(var(--background))"/>
      <circle cx="144" cy="110" r="9" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
      <circle cx="144" cy="110" r="4" fill="hsl(var(--background))"/>
      <circle cx="178" cy="110" r="9" fill="hsl(var(--muted-foreground))" opacity="0.5"/>
      <circle cx="178" cy="110" r="4" fill="hsl(var(--background))"/>
    </svg>
  );
};

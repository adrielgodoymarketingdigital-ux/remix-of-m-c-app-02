interface SilhuetaRelogioSmartProps {
  lado: 'frente' | 'traseira';
  subtipo?: string;
}

export const SilhuetaRelogioSmart = ({ lado, subtipo }: SilhuetaRelogioSmartProps) => {
  // Apple Watch - Retangular arredondado
  const renderAppleWatch = () => {
    if (lado === 'frente') {
      return (
        <svg viewBox="0 0 200 280" className="w-full h-full">
          {/* Pulseira superior */}
          <rect x="80" y="10" width="40" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
          
      {/* Corpo retangular arredondado */}
      <rect x="55" y="60" width="90" height="110" rx="20" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      
      {/* Tela */}
      <rect x="62" y="67" width="76" height="96" rx="16" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
      
      {/* Coroa digital (DENTRO da borda direita) */}
      <circle cx="145" cy="115" r="8" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="1"/>
      <circle cx="145" cy="115" r="5" fill="hsl(var(--accent))"/>
      
      {/* Botão lateral (acima da coroa, alinhado) */}
      <rect x="143" y="95" width="5" height="12" rx="2" fill="hsl(var(--muted-foreground))"/>
          
          {/* Pulseira inferior */}
          <rect x="80" y="170" width="40" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
          
          {/* Furos da pulseira */}
          <circle cx="100" cy="190" r="3" fill="hsl(var(--background))"/>
          <circle cx="100" cy="205" r="3" fill="hsl(var(--background))"/>
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 200 280" className="w-full h-full">
        {/* Pulseira superior */}
        <rect x="80" y="10" width="40" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        
        {/* Corpo traseiro */}
        <rect x="55" y="60" width="90" height="110" rx="20" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        
        {/* Sensores ópticos (parte traseira) */}
        <circle cx="100" cy="105" r="15" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="2"/>
        <circle cx="100" cy="105" r="10" fill="hsl(var(--background))"/>
        <circle cx="100" cy="105" r="5" fill="hsl(var(--accent))"/>
        
        {/* Sensores adicionais */}
        <circle cx="80" cy="130" r="5" fill="hsl(var(--muted-foreground))"/>
        <circle cx="120" cy="130" r="5" fill="hsl(var(--muted-foreground))"/>
        
        {/* Pulseira inferior */}
        <rect x="80" y="170" width="40" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        
        {/* Furos da pulseira */}
        <circle cx="100" cy="190" r="3" fill="hsl(var(--background))"/>
        <circle cx="100" cy="205" r="3" fill="hsl(var(--background))"/>
      </svg>
    );
  };

  // Garmin - Circular robusto com 5 botões
  const renderGarmin = () => {
    if (lado === 'frente') {
      return (
        <svg viewBox="0 0 200 280" className="w-full h-full">
          {/* Pulseira superior */}
          <rect x="75" y="10" width="50" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
          
          {/* Corpo circular */}
          <circle cx="100" cy="115" r="55" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="3"/>
          
          {/* Bisel externo */}
          <circle cx="100" cy="115" r="48" fill="none" stroke="hsl(var(--border))" strokeWidth="2"/>
          
          {/* Tela circular */}
          <circle cx="100" cy="115" r="42" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
          
          {/* 5 botões externos */}
          <rect x="35" y="95" width="10" height="12" rx="2" fill="hsl(var(--muted-foreground))"/> {/* Esquerda superior */}
          <rect x="35" y="115" width="10" height="12" rx="2" fill="hsl(var(--muted-foreground))"/> {/* Esquerda meio */}
          <rect x="35" y="135" width="10" height="12" rx="2" fill="hsl(var(--muted-foreground))"/> {/* Esquerda inferior */}
          <rect x="155" y="105" width="10" height="12" rx="2" fill="hsl(var(--muted-foreground))"/> {/* Direita superior */}
          <rect x="155" y="125" width="10" height="12" rx="2" fill="hsl(var(--muted-foreground))"/> {/* Direita inferior */}
          
          {/* Pulseira inferior */}
          <rect x="75" y="170" width="50" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
          
          {/* Furos da pulseira */}
          <circle cx="100" cy="190" r="3" fill="hsl(var(--background))"/>
          <circle cx="100" cy="205" r="3" fill="hsl(var(--background))"/>
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 200 280" className="w-full h-full">
        {/* Pulseira superior */}
        <rect x="75" y="10" width="50" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        
        {/* Corpo traseiro circular */}
        <circle cx="100" cy="115" r="55" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="3"/>
        
        {/* Sensores (parte traseira) */}
        <circle cx="100" cy="115" r="18" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="2"/>
        <circle cx="100" cy="115" r="12" fill="hsl(var(--background))"/>
        <circle cx="100" cy="115" r="6" fill="hsl(var(--accent))"/>
        
        {/* Sensores adicionais em círculo */}
        <circle cx="85" cy="95" r="4" fill="hsl(var(--muted-foreground))"/>
        <circle cx="115" cy="95" r="4" fill="hsl(var(--muted-foreground))"/>
        <circle cx="85" cy="135" r="4" fill="hsl(var(--muted-foreground))"/>
        <circle cx="115" cy="135" r="4" fill="hsl(var(--muted-foreground))"/>
        
        {/* Pulseira inferior */}
        <rect x="75" y="170" width="50" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        
        {/* Furos da pulseira */}
        <circle cx="100" cy="190" r="3" fill="hsl(var(--background))"/>
        <circle cx="100" cy="205" r="3" fill="hsl(var(--background))"/>
      </svg>
    );
  };

  // Samsung Watch - Circular com bisel rotativo
  const renderSamsungWatch = () => {
    if (lado === 'frente') {
      return (
        <svg viewBox="0 0 200 280" className="w-full h-full">
          {/* Pulseira superior */}
          <rect x="75" y="10" width="50" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
          
          {/* Corpo circular */}
          <circle cx="100" cy="115" r="52" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
          
          {/* Bisel rotativo (com marcações) */}
          <circle cx="100" cy="115" r="46" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="3"/>
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 100 + 40 * Math.cos(rad);
            const y1 = 115 + 40 * Math.sin(rad);
            const x2 = 100 + 46 * Math.cos(rad);
            const y2 = 115 + 46 * Math.sin(rad);
            return (
              <line
                key={angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="hsl(var(--border))"
                strokeWidth="1"
              />
            );
          })}
          
          {/* Tela circular */}
          <circle cx="100" cy="115" r="38" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
          
          {/* 2 botões laterais */}
          <rect x="155" y="105" width="8" height="10" rx="2" fill="hsl(var(--muted-foreground))"/>
          <rect x="155" cy="125" width="8" height="10" rx="2" fill="hsl(var(--muted-foreground))"/>
          
          {/* Pulseira inferior */}
          <rect x="75" y="170" width="50" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
          
          {/* Furos da pulseira */}
          <circle cx="100" cy="190" r="3" fill="hsl(var(--background))"/>
          <circle cx="100" cy="205" r="3" fill="hsl(var(--background))"/>
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 200 280" className="w-full h-full">
        {/* Pulseira superior */}
        <rect x="75" y="10" width="50" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        
        {/* Corpo traseiro */}
        <circle cx="100" cy="115" r="52" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        
        {/* Sensores (parte traseira) */}
        <circle cx="100" cy="115" r="16" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="2"/>
        <circle cx="100" cy="115" r="11" fill="hsl(var(--background))"/>
        <circle cx="100" cy="115" r="6" fill="hsl(var(--accent))"/>
        
        {/* Sensores adicionais */}
        <circle cx="82" cy="130" r="5" fill="hsl(var(--muted-foreground))"/>
        <circle cx="118" cy="130" r="5" fill="hsl(var(--muted-foreground))"/>
        
        {/* Pulseira inferior */}
        <rect x="75" y="170" width="50" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        
        {/* Furos da pulseira */}
        <circle cx="100" cy="190" r="3" fill="hsl(var(--background))"/>
        <circle cx="100" cy="205" r="3" fill="hsl(var(--background))"/>
      </svg>
    );
  };

  // Determinar qual renderizar baseado no subtipo
  if (subtipo === 'Apple Watch') {
    return renderAppleWatch();
  } else if (subtipo === 'Garmin') {
    return renderGarmin();
  } else if (subtipo === 'Samsung Watch') {
    return renderSamsungWatch();
  }

  // Fallback para genérico se subtipo não especificado
  if (lado === 'frente') {
    return (
      <svg viewBox="0 0 200 280" className="w-full h-full">
        {/* Pulseira superior */}
        <rect x="80" y="10" width="40" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        
        {/* Corpo do relógio */}
        <rect x="60" y="60" width="80" height="100" rx="16" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        
        {/* Tela */}
        <rect x="68" y="68" width="64" height="84" rx="12" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1"/>
        
        {/* Coroa digital (lado direito) */}
        <circle cx="145" cy="110" r="8" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="1"/>
        <circle cx="145" cy="110" r="5" fill="hsl(var(--accent))"/>
        
        {/* Botão lateral */}
        <rect x="145" y="90" width="6" height="12" rx="2" fill="hsl(var(--muted-foreground))"/>
        
        {/* Pulseira inferior */}
        <rect x="80" y="160" width="40" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
        
        {/* Furos da pulseira */}
        <circle cx="100" cy="180" r="3" fill="hsl(var(--background))"/>
        <circle cx="100" cy="195" r="3" fill="hsl(var(--background))"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 200 280" className="w-full h-full">
      {/* Pulseira superior */}
      <rect x="80" y="10" width="40" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      
      {/* Corpo traseiro */}
      <rect x="60" y="60" width="80" height="100" rx="16" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      
      {/* Sensores (parte traseira) */}
      <circle cx="100" cy="100" r="12" fill="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" strokeWidth="2"/>
      <circle cx="100" cy="100" r="8" fill="hsl(var(--background))"/>
      <circle cx="100" cy="100" r="4" fill="hsl(var(--accent))"/>
      
      {/* Sensores adicionais */}
      <circle cx="85" cy="120" r="4" fill="hsl(var(--muted-foreground))"/>
      <circle cx="115" cy="120" r="4" fill="hsl(var(--muted-foreground))"/>
      
      {/* Pulseira inferior */}
      <rect x="80" y="160" width="40" height="50" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2"/>
      
      {/* Furos da pulseira */}
      <circle cx="100" cy="180" r="3" fill="hsl(var(--background))"/>
      <circle cx="100" cy="195" r="3" fill="hsl(var(--background))"/>
    </svg>
  );
};

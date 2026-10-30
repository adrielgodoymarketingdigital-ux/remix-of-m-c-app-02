// Marca do MécApp fora da landing V4: o mesmo ícone do Menu/Rodape da V4 (/img/mecapp-icone.webp,
// 384x384 transparente) com o nome em texto HTML ao lado. O texto mantém a proporção da V4
// (ícone de 32 px com texto de 18 px) em todos os tamanhos.

const TAMANHOS = {
  sm: { px: 32, icone: "h-8 w-8", texto: "text-lg", gap: "gap-2.5" },
  md: { px: 40, icone: "h-10 w-10", texto: "text-[1.375rem]", gap: "gap-3" },
  lg: { px: 48, icone: "h-12 w-12", texto: "text-[1.6875rem]", gap: "gap-3" },
  xl: { px: 64, icone: "h-16 w-16", texto: "text-4xl", gap: "gap-4" },
} as const;

interface MarcaMecAppProps {
  tamanho: keyof typeof TAMANHOS;
  lazy?: boolean;
  /** Fundo escuro (páginas públicas) usa o branco; telas que seguem o tema do app, "text-foreground". */
  corTexto?: string;
  /** Só o ícone no celular (o texto fica para leitores de tela), para cabeçalhos que já têm um título com o nome. */
  textoSoNoDesktop?: boolean;
  className?: string;
}

export function MarcaMecApp({ tamanho, lazy = false, corTexto = "text-white", textoSoNoDesktop = false, className = "" }: MarcaMecAppProps) {
  const t = TAMANHOS[tamanho];
  const visibilidade = textoSoNoDesktop ? "sr-only sm:not-sr-only" : "";
  return (
    <div className={`flex items-center ${t.gap} ${className}`}>
      <img
        src="/img/mecapp-icone.webp"
        alt=""
        width={t.px}
        height={t.px}
        loading={lazy ? "lazy" : undefined}
        decoding="async"
        className={`${t.icone} shrink-0`}
      />
      <span className={`font-display font-bold tracking-tight leading-none ${corTexto} ${t.texto} ${visibilidade}`}>MécApp</span>
    </div>
  );
}

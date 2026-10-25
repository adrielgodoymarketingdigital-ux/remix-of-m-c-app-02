/**
 * Ícones de rede social do recibo novo, em SVG inline (imprime e vira PDF sem
 * rede). Mesmo traço dos ícones do lucide (24×24, stroke 2, currentColor).
 */
interface IconeProps {
  className?: string;
}

const base = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconeInstagram({ className }: IconeProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconeFacebook({ className }: IconeProps) {
  return (
    <svg {...base} className={className}>
      <path d="M15.5 3.5h-2.2a4 4 0 0 0-4 4v2.7H7v3.4h2.3v7.9h3.5v-7.9h2.6l.6-3.4h-3.2V8a1 1 0 0 1 1-1h1.7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconeWhatsApp({ className }: IconeProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 20.5l1.3-4.1a8.6 8.6 0 1 1 3.1 3l-4.4 1.1z" />
      <path
        d="M9.1 7.9c-.4 0-.9.4-.9 1.2 0 2.9 3 5.8 5.9 5.8.8 0 1.3-.5 1.3-.9v-.9l-1.9-.8-.8.9c-1-.4-1.9-1.3-2.4-2.3l.9-.8-.8-1.9z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

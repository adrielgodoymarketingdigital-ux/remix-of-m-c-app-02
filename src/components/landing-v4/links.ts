// Destinos reais do MecApp (ver projetos/mecapp/fonte.md). Não mudar sem conferir o fonte.md.
// A captura de UTMs/fbclid acontece no index.html do MecApp (localStorage), então links internos já a preservam.
export const LINKS = {
  testeGratis: "/auth?tab=signup",
  entrar: "/auth",
  planos: "#planos",
  recursos: "#recursos",
  faq: "#faq",
  comoFunciona: "#como-funciona",
  // Planos pagos: mesmo destino da landing atual (PricingCard.tsx)
  plano: (chave: string) => `/cadastro-plano?plan=${chave}`,
  instagram: "https://www.instagram.com/mecappoficial/",
  // WhatsApp oficial do suporte (o mesmo do app: src/components/suporte/BotaoWhatsAppSuporte.tsx do MecApp)
  whatsappSuporte: "https://wa.me/5519971454829",
  // Páginas legais (no MécApp: /termos e /privacidade)
  termos: "/termos/",
  privacidade: "/privacidade/",
} as const;

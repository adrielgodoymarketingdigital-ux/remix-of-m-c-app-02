/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** "true" liga o pixel do TikTok (index.html + src/lib/trackingTiktok.ts). Padrão: desligado. */
  readonly VITE_TIKTOK_PIXEL_ATIVO?: string;
}

declare module "*.JPG" {
  const src: string;
  export default src;
}

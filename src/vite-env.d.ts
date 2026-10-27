/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Versão do build (vite.config.ts → define). Ex.: "2026-10-27 19:45 · fd0ff5a". */
declare const __VERSAO_APP__: string;

interface ImportMetaEnv {
  /** "true" liga o pixel do TikTok (index.html + src/lib/trackingTiktok.ts). Padrão: desligado. */
  readonly VITE_TIKTOK_PIXEL_ATIVO?: string;
}

declare module "*.JPG" {
  const src: string;
  export default src;
}

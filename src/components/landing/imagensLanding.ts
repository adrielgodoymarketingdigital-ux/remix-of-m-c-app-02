// Imagens da landing (/, /lp2, /es) em WebP no tamanho exibido, com versão 1x e 2x.
// Os originais (PNG/JPG) continuam em src/assets e não são mais usados pela landing.
import adriel320 from "@/assets/adriel-fundador-320.webp";
import adriel640 from "@/assets/adriel-fundador-640.webp";
import logoMec from "@/assets/logo-mec-new.webp";
import depoimentoWhatsapp1 from "@/assets/depoimento-whatsapp-1-900.webp";
import depoimentoWhatsapp2 from "@/assets/depoimento-whatsapp-2-885.webp";
import depoimentoWhatsapp3 from "@/assets/screenshots/depoimento-whatsapp-3-900.webp";
import depoimentoWhatsapp4 from "@/assets/screenshots/depoimento-whatsapp-4-900.webp";
import depoimentoWhatsapp5 from "@/assets/screenshots/depoimento-whatsapp-5-900.webp";
import dashboard800 from "@/assets/screenshots/dashboard-landing-800.webp";
import dashboard1600 from "@/assets/screenshots/dashboard-landing-1600.webp";
import notifVendas520 from "@/assets/screenshots/notif-vendas-520.webp";
import notifVendas780 from "@/assets/screenshots/notif-vendas-780.webp";
import checklist680 from "@/assets/screenshots/checklist-680.webp";
import checklist1300 from "@/assets/screenshots/checklist-1300.webp";
import avarias680 from "@/assets/screenshots/avarias-680.webp";
import avarias1300 from "@/assets/screenshots/avarias-1300.webp";
import dispositivos680 from "@/assets/screenshots/dispositivos-680.webp";
import dispositivos1300 from "@/assets/screenshots/dispositivos-1300.webp";
import vendas680 from "@/assets/screenshots/vendas-680.webp";
import vendas1300 from "@/assets/screenshots/vendas-1300.webp";
import financeiro680 from "@/assets/screenshots/financeiro-680.webp";
import financeiro1300 from "@/assets/screenshots/financeiro-1300.webp";
import lucros680 from "@/assets/screenshots/lucros-680.webp";
import lucros1300 from "@/assets/screenshots/lucros-1300.webp";
import dispositivosEstoque680 from "@/assets/screenshots/dispositivos-estoque-680.webp";
import dispositivosEstoque1300 from "@/assets/screenshots/dispositivos-estoque-1300.webp";
import origemDispositivos680 from "@/assets/screenshots/origem-dispositivos-680.webp";
import origemDispositivos1300 from "@/assets/screenshots/origem-dispositivos-1300.webp";
import catalogoDispositivos680 from "@/assets/screenshots/catalogo-dispositivos-680.webp";
import catalogoDispositivos1300 from "@/assets/screenshots/catalogo-dispositivos-1300.webp";
import equipeLista680 from "@/assets/screenshots/equipe-lista-680.webp";
import equipeLista1300 from "@/assets/screenshots/equipe-lista-1300.webp";
import equipeComissao680 from "@/assets/screenshots/equipe-comissao-680.webp";
import equipeComissao1300 from "@/assets/screenshots/equipe-comissao-1300.webp";
import equipePermissoes680 from "@/assets/screenshots/equipe-permissoes-680.webp";
import equipePermissoes1300 from "@/assets/screenshots/equipe-permissoes-1300.webp";
import posterDemoRecursos from "@/assets/demo-recursos-poster.webp";
import posterDepoimento from "@/assets/depoimento-video-poster.webp";

/** width/height = proporção do arquivo menor (reserva o espaço e evita pulo de layout). */
export interface ImagemLanding {
  src: string;
  srcSet?: string;
  width: number;
  height: number;
}

const duas = (menor: string, larguraMenor: number, maior: string, larguraMaior: number, alturaMenor: number): ImagemLanding => ({
  src: menor,
  srcSet: `${menor} ${larguraMenor}w, ${maior} ${larguraMaior}w`,
  width: larguraMenor,
  height: alturaMenor,
});

// Prints dos cartões (FeatureCard): caixa de até ~440 px, cortada com object-cover.
export const SIZES_CARTAO = "(min-width: 1024px) 440px, (min-width: 640px) 50vw, 100vw";
export const imgChecklist = duas(checklist680, 680, checklist1300, 1300, 464);
export const imgAvarias = duas(avarias680, 680, avarias1300, 1300, 574);
export const imgDispositivos = duas(dispositivos680, 680, dispositivos1300, 1300, 312);
export const imgVendas = duas(vendas680, 680, vendas1300, 1300, 406);
export const imgFinanceiro = duas(financeiro680, 680, financeiro1300, 1300, 408);
export const imgLucros = duas(lucros680, 680, lucros1300, 1300, 270);
export const imgDispositivosEstoque = duas(dispositivosEstoque680, 680, dispositivosEstoque1300, 1300, 290);
export const imgOrigemDispositivos = duas(origemDispositivos680, 680, origemDispositivos1300, 1300, 290);
export const imgCatalogoDispositivos = duas(catalogoDispositivos680, 680, catalogoDispositivos1300, 1300, 337);
export const imgEquipeLista = duas(equipeLista680, 680, equipeLista1300, 1300, 361);
export const imgEquipeComissao = duas(equipeComissao680, 680, equipeComissao1300, 1300, 364);
export const imgEquipePermissoes = duas(equipePermissoes680, 680, equipePermissoes1300, 1300, 363);

// Dashboard do topo: só aparece a partir de lg (1024 px), com ~650 px de largura.
// Abaixo disso fica escondido (hidden lg:block): o <picture> só oferece o WebP
// para (min-width: 1024px) e o <img> usa este pixel embutido, então nada é baixado.
export const MIDIA_DASHBOARD = "(min-width: 1024px)";
export const PIXEL_VAZIO = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
export const SIZES_DASHBOARD = "(min-width: 1280px) 650px, 50vw";
export const imgDashboard = duas(dashboard800, 800, dashboard1600, 1600, 402);

// Foto do fundador: círculo de 184 / 248 / 312 px.
export const SIZES_FUNDADOR = "(min-width: 768px) 312px, (min-width: 640px) 248px, 184px";
export const imgFundador = duas(adriel320, 320, adriel640, 640, 482);

// Celular da seção de notificações: 208 / 248 px.
export const SIZES_NOTIFICACAO = "(min-width: 768px) 248px, 208px";
export const imgNotifVendas = duas(notifVendas520, 520, notifVendas780, 780, 1129);

// Logo do topo e do rodapé: exibido com 120x40.
export const imgLogo: ImagemLanding = { src: logoMec, width: 120, height: 40 };

// Depoimentos de WhatsApp (carrossel): um arquivo só, largura até ~900 px.
export const imgDepoimentoWhatsapp1: ImagemLanding = { src: depoimentoWhatsapp1, width: 900, height: 429 };
export const imgDepoimentoWhatsapp2: ImagemLanding = { src: depoimentoWhatsapp2, width: 885, height: 1920 };
export const imgDepoimentoWhatsapp3: ImagemLanding = { src: depoimentoWhatsapp3, width: 900, height: 136 };
export const imgDepoimentoWhatsapp4: ImagemLanding = { src: depoimentoWhatsapp4, width: 900, height: 110 };
export const imgDepoimentoWhatsapp5: ImagemLanding = { src: depoimentoWhatsapp5, width: 900, height: 418 };

// Capas (primeiro quadro) dos vídeos de demonstração e depoimento: com preload="none"
// o vídeo só baixa no play, e a capa mostra o mesmo quadro que aparecia antes.
export const POSTER_DEMO_RECURSOS = posterDemoRecursos;
export const POSTER_DEPOIMENTO = posterDepoimento;
/** As capas só entram no <video> quando ele chega a esta distância da tela. */
export const MARGEM_POSTER = "400px 0px";
/** Dimensões do depoimento-video.mp4 (reserva a altura antes de carregar). */
export const VIDEO_DEPOIMENTO = { width: 886, height: 1270 };

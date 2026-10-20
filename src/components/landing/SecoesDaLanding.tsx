import { SecaoAdiada, secaoDe } from "@/components/landing/SecoesAdiadas";
import type * as ModuloSecoes from "@/components/landing/secoesAbaixoDaDobra";

type Secoes = typeof ModuloSecoes;

// Seções abaixo do topo de /, /lp2 e /es (mesma composição), na ordem da página.
// Altura da reserva = altura medida de cada seção com 390 / 768 / 1280 px de largura
// (arredondada para baixo), para a página não pular quando a seção monta.
const SECOES_DA_LANDING = [
  ["SystemDemoSection", "min-h-[590px] md:min-h-[810px] lg:min-h-[910px]"],
  ["TestimonialsSection", "min-h-[2130px] md:min-h-[2170px] lg:min-h-[2170px]"],
  ["SupportSection", "min-h-[2480px] md:min-h-[1670px] lg:min-h-[1550px]"],
  ["MobileDemoSection", "min-h-[1330px] md:min-h-[1380px] lg:min-h-[980px]"],
  ["FeaturesGrid", "min-h-[3120px] md:min-h-[2240px] lg:min-h-[1810px]"],
  ["SellDevicesSection", "min-h-[1630px] md:min-h-[1400px] lg:min-h-[970px]"],
  ["NotificationsSection", "min-h-[1170px] md:min-h-[1240px] lg:min-h-[1260px]"],
  ["StaffSection", "min-h-[1700px] md:min-h-[1430px] lg:min-h-[1000px]"],
  ["FounderSection", "min-h-[1450px] md:min-h-[1500px] lg:min-h-[1210px]"],
  ["ComparisonSection", "min-h-[1340px] md:min-h-[1060px] lg:min-h-[1040px]"],
  ["PricingSection", "min-h-[5530px] md:min-h-[3840px] lg:min-h-[2180px]"],
  ["FAQSection", "min-h-[1080px] md:min-h-[1060px] lg:min-h-[1070px]"],
  ["FinalCTA", "min-h-[860px] md:min-h-[740px] lg:min-h-[790px]"],
  ["LandingFooter", "min-h-[740px] md:min-h-[310px] lg:min-h-[290px]"],
] as const satisfies ReadonlyArray<readonly [keyof Secoes, string]>;

/** Chamar no nível do módulo (lazy() não pode ser criado durante a renderização). */
export function criarSecoesDaLanding(carregar: () => Promise<Secoes>) {
  return SECOES_DA_LANDING.map(([nome, altura]) => ({ nome, altura, secao: secaoDe(carregar, nome) }));
}

export function SecoesDaLanding({ secoes }: { secoes: ReturnType<typeof criarSecoesDaLanding> }) {
  return (
    <>
      {secoes.map(({ nome, altura, secao }, ordem) => (
        <SecaoAdiada key={nome} secao={secao} ordem={ordem} altura={altura} />
      ))}
    </>
  );
}

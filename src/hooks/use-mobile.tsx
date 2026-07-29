import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const onChange = () => {
      const width = window.innerWidth;
      setIsTablet(width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT);
    };
    
    window.addEventListener("resize", onChange);
    onChange();
    return () => window.removeEventListener("resize", onChange);
  }, []);

  return !!isTablet;
}

export function useIsMobileOrTablet() {
  const [isMobileOrTablet, setIsMobileOrTablet] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobileOrTablet(window.innerWidth < TABLET_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobileOrTablet(window.innerWidth < TABLET_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobileOrTablet;
}

/** true quando o app roda instalado (PWA standalone) em uma tela mobile. */
export function useIsPwaMobile() {
  const [isPwaMobile, setIsPwaMobile] = React.useState(false);

  React.useEffect(() => {
    const mqlStandalone = window.matchMedia("(display-mode: standalone)");
    const mqlMobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const compute = () => {
      const standalone = mqlStandalone.matches || (navigator as any).standalone === true;
      setIsPwaMobile(standalone && window.innerWidth < MOBILE_BREAKPOINT);
    };
    compute();
    mqlStandalone.addEventListener("change", compute);
    mqlMobile.addEventListener("change", compute);
    return () => {
      mqlStandalone.removeEventListener("change", compute);
      mqlMobile.removeEventListener("change", compute);
    };
  }, []);

  return isPwaMobile;
}

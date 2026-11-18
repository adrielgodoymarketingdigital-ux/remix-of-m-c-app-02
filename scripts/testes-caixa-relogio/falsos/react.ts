// React mínimo para chamar o hook real fora de um componente.
export const useState = <T,>(inicial: T) => [inicial, () => undefined] as const;
export const useEffect = () => undefined;
export const useRef = <T,>(inicial: T) => ({ current: inicial });

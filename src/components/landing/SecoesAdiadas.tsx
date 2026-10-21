import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type LazyExoticComponent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { usePertoDaTela } from "@/components/landing/usePertoDaTela";

// Seções abaixo do topo das landings: saem do pacote imediato e montam sob demanda,
// para o título aparecer sem esperar a página inteira baixar.
//  - Cada seção adiada ocupa uma reserva com a altura medida até montar (CLS 0).
//  - Monta quando chega a MARGEM_SECAO da tela. Depois do carregamento da página, com o
//    navegador ocioso, o arquivo das seções é baixado e as seções montam em segundo plano,
//    uma por vez (tarefas curtas, sem travar a tela): a página fica completa sem rolar,
//    o que também cobre robôs de busca (renderizam com viewport alto e o topo, com
//    min-h-screen, cresce junto e esconde as seções do IntersectionObserver).
//  - Âncoras (#planos, #faq…) e botões de rolagem montam TODAS as seções e só rolam
//    quando nenhuma reserva sobrou (senão o alvo mudaria de lugar durante a rolagem).

/** Distância da tela em que a seção começa a montar. */
const MARGEM_SECAO = "800px 0px";
/** Espera máxima pelas seções antes de rolar mesmo assim (rede muito lenta). */
const ESPERA_MAXIMA_MS = 10000;
/** Só ids de seção: o hash de retorno do login (#access_token=…) não entra. */
const ID_DE_SECAO = /^[A-Za-z][\w-]*$/;

export type SecaoPreguicosa = LazyExoticComponent<ComponentType>;

/** lazy() de um export nomeado: todas as seções do mesmo `carregar` vêm num arquivo só. */
export function secaoDe<K extends string, M extends Record<K, ComponentType>>(
  carregar: () => Promise<M>,
  nome: K,
): SecaoPreguicosa {
  return lazy(() => carregar().then((modulo) => ({ default: modulo[nome] })));
}

interface ContextoSecoes {
  todas: boolean;
  /** Seções (pela ordem na página) já liberadas para montar em segundo plano. */
  liberadas: number;
  irPara: (id: string) => void;
}

const ContextoSecoesAdiadas = createContext<ContextoSecoes | null>(null);

interface PaginaComSecoesAdiadasProps {
  carregar: () => Promise<unknown>;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Div raiz da landing: guarda o estado das seções adiadas e trata os links "#id". */
export function PaginaComSecoesAdiadas({ carregar, className, style, children }: PaginaComSecoesAdiadasProps) {
  const raiz = useRef<HTMLDivElement>(null);
  const [todas, setTodas] = useState(false);
  const [liberadas, setLiberadas] = useState(0);

  const irPara = useCallback((id: string) => {
    setTodas(true);
    const inicio = performance.now();
    const tentar = () => {
      const alvo = document.getElementById(id);
      const faltaSecao = raiz.current?.querySelector("[data-secao-adiada]");
      if ((alvo && !faltaSecao) || performance.now() - inicio > ESPERA_MAXIMA_MS) {
        // Sem opção: segue o scroll-behavior: smooth do <html> (index.css), como a âncora nativa.
        alvo?.scrollIntoView();
        return;
      }
      requestAnimationFrame(tentar);
    };
    requestAnimationFrame(tentar);
  }, []);

  // Depois do carregamento, com o navegador ocioso: baixa o arquivo das seções e monta
  // uma seção por vez, até não sobrar reserva.
  useEffect(() => {
    let cancelado = false;
    let cancelarOcioso = () => {};
    const quandoOcioso = (tarefa: () => void) => {
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(tarefa, { timeout: 3000 });
        cancelarOcioso = () => window.cancelIdleCallback(id);
      } else {
        const id = window.setTimeout(tarefa, 200);
        cancelarOcioso = () => window.clearTimeout(id);
      }
    };
    const montarProxima = () => {
      if (cancelado || !raiz.current?.querySelector("[data-secao-adiada]")) return;
      setLiberadas((n) => n + 1);
      quandoOcioso(montarProxima);
    };
    const iniciar = () =>
      quandoOcioso(() => {
        carregar().then(
          () => !cancelado && quandoOcioso(montarProxima),
          () => undefined, // se falhar, o lazy() tenta de novo quando a seção chegar perto da tela
        );
      });
    if (document.readyState === "complete") iniciar();
    else window.addEventListener("load", iniciar, { once: true });
    return () => {
      cancelado = true;
      window.removeEventListener("load", iniciar);
      cancelarOcioso();
    };
  }, [carregar]);

  // Entrou já com âncora na URL (ex.: /#planos).
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (ID_DE_SECAO.test(id)) irPara(id);
  }, [irPara]);

  const aoClicar = (evento: MouseEvent<HTMLDivElement>) => {
    if (evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    const link = (evento.target as Element).closest?.("a[href^='#']");
    const id = decodeURIComponent(link?.getAttribute("href")?.slice(1) ?? "");
    if (!ID_DE_SECAO.test(id)) return; // href="#" segue como antes
    evento.preventDefault();
    window.history.pushState(window.history.state, "", `#${id}`);
    irPara(id);
  };

  const valor = useMemo(() => ({ todas, liberadas, irPara }), [todas, liberadas, irPara]);

  return (
    <ContextoSecoesAdiadas.Provider value={valor}>
      <div ref={raiz} className={className} style={style} onClick={aoClicar}>
        {children}
      </div>
    </ContextoSecoesAdiadas.Provider>
  );
}

/** Rola até a seção `id`, montando antes as seções adiadas. */
export function useIrParaSecao() {
  const contexto = useContext(ContextoSecoesAdiadas);
  return useCallback(
    (id: string) => {
      if (contexto) contexto.irPara(id);
      else document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    },
    [contexto],
  );
}

/**
 * Props de um link `<a>` para a seção `id` (botões do topo das landings).
 *  - Clique normal: preventDefault e rola com irParaSecao, como o botão fazia (sem pôr #id na URL).
 *  - Ctrl/Cmd/Shift/Alt + clique e botão do meio: ficam com o navegador (nova aba em #id).
 *  - Antes do JavaScript (topo estático do HTML): âncora comum; ao montar, a página rola até #id.
 */
export function useLinkParaSecao() {
  const irParaSecao = useIrParaSecao();
  return useCallback(
    (id: string, depois?: () => void) => ({
      href: `#${id}`,
      onClick: (evento: MouseEvent<HTMLAnchorElement>) => {
        if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
        evento.preventDefault();
        irParaSecao(id);
        depois?.();
      },
    }),
    [irParaSecao],
  );
}

interface SecaoAdiadaProps {
  secao: SecaoPreguicosa;
  /** Posição entre as seções adiadas da página (0 = logo abaixo do topo). */
  ordem: number;
  /** Classes de min-height da reserva (altura medida da seção em cada largura). */
  altura: string;
}

export function SecaoAdiada({ secao: Secao, ordem, altura }: SecaoAdiadaProps) {
  const contexto = useContext(ContextoSecoesAdiadas);
  const [ref, perto] = usePertoDaTela<HTMLDivElement>(MARGEM_SECAO);
  const reserva = <div ref={ref} className={altura} data-secao-adiada="" aria-hidden="true" />;
  const liberada = contexto ? contexto.todas || ordem < contexto.liberadas : true;
  if (!perto && !liberada) return reserva;
  return (
    <Suspense fallback={reserva}>
      <Secao />
    </Suspense>
  );
}

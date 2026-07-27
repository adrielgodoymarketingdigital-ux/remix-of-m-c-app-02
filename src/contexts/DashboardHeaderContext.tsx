/**
 * ID do elemento DOM (renderizado pelo MobileHeader só na rota /dashboard)
 * que serve de alvo para o createPortal em Dashboard.tsx. Usar um portal em
 * vez de Context+useEffect evita perder o conteúdo quando a Dashboard
 * re-renderiza rápido (hooks de cotação/resumo disparando múltiplos setState
 * logo após o mount) — cada re-render antigo recriava o nó JSX e o efeito de
 * cleanup podia rodar depois do novo setContent, zerando o slot.
 */
export const DASHBOARD_HEADER_SLOT_ID = "dashboard-header-slot";

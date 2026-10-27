// Versão do build, gerada pelo Vite a cada build (vite.config.ts → versaoDoBuild):
// "AAAA-MM-DD HH:mm · <commit curto>". Só para exibição (console, Configurações, Plano).
export const APP_BUILD_ID = __VERSAO_APP__;

// Função para verificar se o build está atualizado
export const getBuildInfo = () => ({
  buildId: APP_BUILD_ID,
  timestamp: new Date().toISOString(),
});

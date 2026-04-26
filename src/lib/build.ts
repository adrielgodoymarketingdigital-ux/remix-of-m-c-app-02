// Build ID - atualizar a cada publicação importante para garantir cache bust
// Formato: ANO-MES-DIA-SEQUENCIAL
export const APP_BUILD_ID = "2026-04-25-005";

// Função para verificar se o build está atualizado
export const getBuildInfo = () => ({
  buildId: APP_BUILD_ID,
  timestamp: new Date().toISOString(),
});

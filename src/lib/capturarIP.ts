// Função para capturar o IP público do cliente
export async function capturarIP(): Promise<string> {
  try {
    // Tenta primeiro o ipify (mais confiável)
    const response = await fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // timeout de 5s
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.ip;
    }
    
    throw new Error('Falha ao obter IP');
  } catch (error) {
    console.warn('Erro ao capturar IP via ipify, tentando alternativa:', error);
    
    try {
      // Alternativa: ip-api
      const response = await fetch('http://ip-api.com/json/?fields=query', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.query;
      }
    } catch (err) {
      console.warn('Erro ao capturar IP via ip-api:', err);
    }
    
    // Retorna valor padrão se não conseguir
    return 'IP não disponível';
  }
}

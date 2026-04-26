import type { SenhaDesbloqueio } from "@/types/ordem-servico";

/**
 * NOTA DE SEGURANÇA:
 * 
 * As senhas de desbloqueio de dispositivos são armazenadas de forma ofuscada
 * para evitar leitura casual. Esta NÃO é uma criptografia forte - é apenas
 * uma camada de proteção básica para dados que são visíveis apenas pelo
 * próprio usuário autenticado (protegido por RLS).
 * 
 * Para uma solução mais segura, considere:
 * 1. Usar pgcrypto no PostgreSQL para criptografia server-side
 * 2. Implementar criptografia assimétrica com chaves por usuário
 * 3. Usar um serviço de gerenciamento de chaves (KMS)
 * 
 * O risco atual é baixo porque:
 * - Os dados são acessíveis apenas pelo proprietário (RLS)
 * - São senhas de dispositivos de terceiros, não credenciais do sistema
 * - O acesso ao banco já requer autenticação
 */

const OBFUSCATION_PREFIX = "OBF:";
const PATTERN_OFFSET = 100;

/**
 * Ofusca um valor de texto usando Base64 simples
 * Não é criptografia, apenas dificulta leitura casual
 */
export function encryptValue(value: string): string {
  if (!value) return value;
  
  // Já ofuscado
  if (value.startsWith(OBFUSCATION_PREFIX)) return value;
  
  try {
    const base64 = btoa(unescape(encodeURIComponent(value)));
    return OBFUSCATION_PREFIX + base64;
  } catch {
    console.warn("Falha ao ofuscar valor");
    return value;
  }
}

/**
 * Desofusca um valor de texto
 */
export function decryptValue(value: string): string {
  if (!value) return value;
  
  // Não ofuscado, retornar como está (compatibilidade)
  if (!value.startsWith(OBFUSCATION_PREFIX)) {
    // Verificar se é o formato antigo (ENC:)
    if (value.startsWith("ENC:")) {
      try {
        const base64 = value.slice(4);
        return decodeURIComponent(escape(atob(base64)));
      } catch {
        return value;
      }
    }
    return value;
  }
  
  try {
    const base64 = value.slice(OBFUSCATION_PREFIX.length);
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    console.warn("Falha ao desofuscar valor");
    return value;
  }
}

/**
 * Ofusca um objeto SenhaDesbloqueio
 */
export function encryptSenhaDesbloqueio(senha: SenhaDesbloqueio | undefined): SenhaDesbloqueio | undefined {
  if (!senha) return senha;
  
  return {
    tipo: senha.tipo,
    valor: encryptValue(senha.valor),
    padrao: senha.padrao ? senha.padrao.map(n => n + PATTERN_OFFSET) : undefined,
  };
}

/**
 * Desofusca um objeto SenhaDesbloqueio
 */
export function decryptSenhaDesbloqueio(senha: SenhaDesbloqueio | undefined): SenhaDesbloqueio | undefined {
  if (!senha) return senha;
  
  // Verificar se o padrão parece estar ofuscado (valores >= 100)
  const isPatternObfuscated = senha.padrao && senha.padrao.some(n => n >= PATTERN_OFFSET);
  
  return {
    tipo: senha.tipo,
    valor: decryptValue(senha.valor),
    padrao: senha.padrao && isPatternObfuscated
      ? senha.padrao.map(n => n - PATTERN_OFFSET) 
      : senha.padrao,
  };
}

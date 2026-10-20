import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Com o localStorage bloqueado (cookies desativados, alguns navegadores internos),
// só acessá-lo já lança erro e o app inteiro ficava em tela branca. Nesse caso a
// sessão fica em memória (não persiste ao recarregar); no caso normal nada muda.
function armazenamentoDaSessao(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  try {
    const teste = "__mec_teste_armazenamento__";
    window.localStorage.setItem(teste, "1");
    window.localStorage.removeItem(teste);
    return window.localStorage;
  } catch {
    const memoria = new Map<string, string>();
    return {
      getItem: (chave) => memoria.get(chave) ?? null,
      setItem: (chave, valor) => { memoria.set(chave, valor); },
      removeItem: (chave) => { memoria.delete(chave); },
    };
  }
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: armazenamentoDaSessao(),
    persistSession: true,
    autoRefreshToken: true,
    flowType: 'implicit',
  },
});

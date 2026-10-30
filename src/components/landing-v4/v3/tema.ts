import { createContext, useContext } from "react";

// Diz aos blocos "tech" se a página está no tema claro (versão 4) ou escuro (versão 3).
// As cores em si vêm das variáveis --t-* do tech.css; isto só serve para componentes
// que têm duas variações prontas (ex.: o selo de plano).
export const TemaClaro = createContext(false);
export const useTemaClaro = () => useContext(TemaClaro);

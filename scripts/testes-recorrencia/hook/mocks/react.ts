// React falso: useContas é chamado como função comum. useState devolve o estado
// preparado pelo teste (lista de contas) e ignora set; efeitos não rodam.
// deno-lint-ignore-file no-explicit-any
const g = globalThis as any;
export function useState<T>(inicial: T | (() => T)): [T, (v: unknown) => void] {
  const i = g.__reactIdx++;
  const preparado = g.__reactEstados?.[i];
  const v = preparado !== undefined ? preparado : typeof inicial === "function" ? (inicial as () => T)() : inicial;
  return [v, () => {}];
}
export const useCallback = <F,>(fn: F) => fn;
export const useEffect = () => {};
export const useMemo = <T,>(fn: () => T) => fn();
export const useRef = <T,>(v: T) => ({ current: v });
export default { useState, useCallback, useEffect, useMemo, useRef };

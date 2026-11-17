// deno-lint-ignore-file no-explicit-any
const registrar = (t: unknown) => {
  (globalThis as any).__toasts.push(t);
  return { id: "t", dismiss() {}, update() {} };
};
export function useToast() {
  return { toast: registrar, toasts: [], dismiss() {} };
}
export const toast = registrar;

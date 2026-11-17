// deno-lint-ignore-file no-explicit-any
const g = globalThis as any;
export const useResolvedUserId = () => g.__targetUserId ?? null;
export const useEmpresaInfo = () => ({ empresaId: g.__empresaVisao ?? null });
export const useIdentidadeLeitura = () => ({ empresaId: null, isFilial: false, carregando: false });
export const useFuncionarioPermissoes = () => ({ isFuncionario: false });

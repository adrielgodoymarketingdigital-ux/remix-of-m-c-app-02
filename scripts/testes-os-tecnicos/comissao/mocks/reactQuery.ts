// useQuery falso: guarda o queryFn em globalThis.__ultimaConsulta; o teste
// chama o hook como função comum e depois roda o queryFn.
const g = globalThis as unknown as { __ultimaConsulta?: () => Promise<unknown> };
export function useQuery(opts: { queryFn: () => Promise<unknown> }) {
  g.__ultimaConsulta = opts.queryFn;
  return { data: undefined, isLoading: true };
}

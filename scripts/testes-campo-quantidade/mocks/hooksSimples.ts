export function useOrigemPessoas() {
  return { pessoas: [], carregarPessoas: async () => {}, criarPessoa: async () => null };
}
export function useFornecedores() {
  return { fornecedores: [{ id: "forn-1", nome: "Fornecedor Teste" }], criarFornecedor: async () => true };
}
export function useFuncionarioPermissoes() {
  return { podeVerCustos: true, podeVerLucros: true, isFuncionario: false };
}
export function LeitorCodigoBarras() { return null; }

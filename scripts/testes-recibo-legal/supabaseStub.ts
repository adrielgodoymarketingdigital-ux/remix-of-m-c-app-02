// Os testes nunca falam com o Supabase: qualquer uso aqui é erro.
export const supabase = new Proxy({}, {
  get() {
    throw new Error("Supabase não deve ser usado nos testes do recibo legal");
  },
});

export const aplicarMascaraCNPJ = (valor: string): string => {
  const numeros = valor.replace(/\D/g, "");
  return numeros
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
};

export const aplicarMascaraCPF = (valor: string): string => {
  const numeros = valor.replace(/\D/g, "");
  return numeros
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2")
    .slice(0, 14);
};

export const aplicarMascaraCEP = (valor: string): string => {
  const numeros = valor.replace(/\D/g, "");
  return numeros.replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
};

export const aplicarMascaraTelefone = (valor: string): string => {
  const numeros = valor.replace(/\D/g, "");
  
  if (numeros.length <= 10) {
    // Telefone fixo: (XX) XXXX-XXXX
    return numeros
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 14);
  } else {
    // Celular: (XX) XXXXX-XXXX
    return numeros
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15);
  }
};

export const removerMascara = (valor: string): string => {
  return valor.replace(/\D/g, "");
};

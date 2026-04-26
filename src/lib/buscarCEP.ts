interface EnderecoViaCEP {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export interface DadosEndereco {
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export const buscarCEP = async (cep: string): Promise<DadosEndereco | null> => {
  try {
    const cepLimpo = cep.replace(/\D/g, "");
    
    if (cepLimpo.length !== 8) {
      throw new Error("CEP inválido");
    }

    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    
    if (!response.ok) {
      throw new Error("Erro ao buscar CEP");
    }

    const dados: EnderecoViaCEP = await response.json();

    if (dados.erro) {
      throw new Error("CEP não encontrado");
    }

    return {
      logradouro: dados.logradouro,
      bairro: dados.bairro,
      cidade: dados.localidade,
      estado: dados.uf,
    };
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    return null;
  }
};

// Campos obrigatórios da loja para recibos (movida de hooks/useConfiguracaoLoja.ts sem mudança;
// o hook reexporta). Pura: sem React nem Supabase.
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";

export function validarConfiguracaoParaRecibos(config: ConfiguracaoLoja | null) {
  if (!config) return { valido: false, camposFaltando: ["Configuração não encontrada"], percentual: 0 };

  const camposObrigatorios = [
    { campo: config.nome_loja, nome: "Nome da loja" },
    { campo: config.razao_social, nome: "Razão social" },
    { campo: config.telefone, nome: "Telefone" },
    { campo: config.email, nome: "E-mail" },
    { campo: config.cep, nome: "CEP" },
    { campo: config.logradouro, nome: "Logradouro" },
    { campo: config.numero, nome: "Número" },
    { campo: config.bairro, nome: "Bairro" },
    { campo: config.cidade, nome: "Cidade" },
    { campo: config.estado, nome: "Estado" },
  ];

  const camposFaltando: string[] = [];
  let camposPreenchidos = 0;
  camposObrigatorios.forEach(({ campo, nome }) => {
    if (campo && campo.trim() !== "") {
      camposPreenchidos++;
    } else {
      camposFaltando.push(nome);
    }
  });

  const percentual = Math.round((camposPreenchidos / camposObrigatorios.length) * 100);

  return {
    valido: camposFaltando.length === 0,
    camposFaltando,
    percentual,
    camposPreenchidos,
    totalCampos: camposObrigatorios.length,
  };
}

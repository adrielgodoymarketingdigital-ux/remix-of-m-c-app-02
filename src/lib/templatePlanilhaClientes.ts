import * as XLSX from 'xlsx';

export const baixarTemplateClientes = () => {
  const dados = [
    ['Nome', 'CPF', 'CNPJ', 'Telefone', 'Endereço', 'Data de Nascimento'],
    ['João Silva', '123.456.789-00', '', '(11) 99999-0000', 'Rua A, 123 - São Paulo/SP', '1990-05-15'],
    ['Empresa XYZ Ltda', '', '12.345.678/0001-90', '(11) 3333-4444', 'Av. B, 456 - São Paulo/SP', ''],
    ['Maria Santos', '987.654.321-00', '', '(21) 98888-7777', 'Rua C, 789 - Rio de Janeiro/RJ', '1985-12-20'],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(dados);

  ws['!cols'] = [
    { wch: 25 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 35 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, 'modelo_importacao_clientes.xlsx');
};

export const MAPEAMENTO_COLUNAS_CLIENTES: Record<string, string[]> = {
  nome: ['nome', 'name', 'cliente', 'razao_social', 'razão social', 'descrição', 'description'],
  cpf: ['cpf', 'cpf_cnpj', 'documento', 'doc'],
  cnpj: ['cnpj'],
  telefone: ['telefone', 'tel', 'celular', 'phone', 'fone', 'whatsapp', 'contato'],
  endereco: ['endereco', 'endereço', 'address', 'logradouro', 'rua'],
  data_nascimento: ['data_nascimento', 'nascimento', 'aniversario', 'aniversário', 'data nascimento', 'birthday', 'dt_nascimento'],
};

export const detectarMapeamentoClientes = (headers: string[]): Record<string, number> => {
  const mapeamento: Record<string, number> = {};

  headers.forEach((header, index) => {
    if (!header) return;
    const headerNorm = String(header).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    for (const [campo, aliases] of Object.entries(MAPEAMENTO_COLUNAS_CLIENTES)) {
      const aliasesNorm = aliases.map(a => a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      if (aliasesNorm.includes(headerNorm)) {
        mapeamento[campo] = index;
        break;
      }
    }
  });

  return mapeamento;
};
